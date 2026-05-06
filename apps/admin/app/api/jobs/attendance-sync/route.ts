import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { verifyRequest } from '@/lib/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZoomReportParticipant {
  user_email?: string;
  email?: string;
  duration?: number;
}

interface ZoomReport {
  participants: ZoomReportParticipant[];
}

async function zoomToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
  ).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { authorization: `Basic ${auth}` } },
  );
  if (!res.ok) throw new Error(`zoom_oauth_${res.status}`);
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

async function fetchReport(token: string, meetingId: string): Promise<ZoomReport> {
  const res = await fetch(
    `https://api.zoom.us/v2/report/meetings/${encodeURIComponent(meetingId)}/participants?page_size=300`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`zoom_report_${res.status}`);
  return (await res.json()) as ZoomReport;
}

export async function POST(req: Request) {
  const body = await req.text();
  const ts = req.headers.get('x-lwl-ts');
  const sig = req.headers.get('x-lwl-sig');
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret || !verifyRequest(secret, body, ts, sig)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = createSupabaseAdmin();
  const { data: completed } = await db
    .from('masterclasses')
    .select('id, zoom_meeting_id')
    .eq('status', 'completed')
    .not('zoom_meeting_id', 'is', null)
    .limit(20);

  let updated = 0;
  for (const mc of (completed ?? []) as Array<{ id: string; zoom_meeting_id: string }>) {
    try {
      const token = await zoomToken();
      const report = await fetchReport(token, mc.zoom_meeting_id);
      for (const p of report.participants ?? []) {
        const email = (p.user_email ?? p.email ?? '').toLowerCase();
        if (!email) continue;
        const minutes = Math.round((p.duration ?? 0) / 60);
        const { data: lead } = await db.from('leads').select('id').eq('email', email).maybeSingle();
        if (!lead) continue;
        const { error } = await db
          .from('registrations')
          .update({ attended: minutes >= 10, attendance_minutes: minutes })
          .eq('lead_id', (lead as { id: string }).id)
          .eq('masterclass_id', mc.id);
        if (!error) updated += 1;
        if (minutes >= 10) {
          await db
            .from('leads')
            .update({ status: 'attended' })
            .eq('id', (lead as { id: string }).id);
        }
      }
    } catch {
      // continue with next masterclass
    }
  }

  return NextResponse.json({ updated });
}
