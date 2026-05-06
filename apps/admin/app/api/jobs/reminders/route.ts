import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { verifyRequest } from '@/lib/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RegRow {
  lead_id: string;
  attended: boolean;
  leads: { email: string; first_name: string | null } | null;
  masterclasses: {
    id: string;
    topic: string;
    mentor_name: string;
    scheduled_at: string;
    zoom_join_url: string | null;
    program_id: string;
  } | null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const ts = req.headers.get('x-lwl-ts');
  const sig = req.headers.get('x-lwl-sig');
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret || !verifyRequest(secret, body, ts, sig)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let kind: 'reminder_24h' | 'reminder_1h';
  try {
    const json = JSON.parse(body) as { kind?: string };
    if (json.kind !== 'reminder_24h' && json.kind !== 'reminder_1h') {
      return NextResponse.json({ error: 'bad_kind' }, { status: 400 });
    }
    kind = json.kind;
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const windowMs = kind === 'reminder_24h' ? 24 * 60 * 60_000 : 60 * 60_000;
  const targetTime = new Date(Date.now() + windowMs);
  const lower = new Date(targetTime.getTime() - 30 * 60_000).toISOString();
  const upper = new Date(targetTime.getTime() + 30 * 60_000).toISOString();

  const db = createSupabaseAdmin();
  const { data: regs } = await db
    .from('registrations')
    .select(
      'lead_id, attended, leads!inner(email, first_name), masterclasses!inner(id, topic, mentor_name, scheduled_at, zoom_join_url, program_id)',
    )
    .gte('masterclasses.scheduled_at', lower)
    .lte('masterclasses.scheduled_at', upper)
    .eq('attended', false);

  let sent = 0;
  for (const row of (regs ?? []) as unknown as RegRow[]) {
    const mc = row.masterclasses;
    const lead = row.leads;
    if (!mc || !lead) continue;
    const { data: tplData } = await db
      .from('email_templates')
      .select('subject, body_md, variables')
      .eq('program_id', mc.program_id)
      .eq('kind', kind)
      .maybeSingle();
    if (!tplData) continue;
    const rendered = renderTemplate(
      tplData as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        masterclass_topic: mc.topic,
        mentor_name: mc.mentor_name,
        masterclass_time: new Date(mc.scheduled_at).toUTCString(),
        zoom_join_url: mc.zoom_join_url ?? '',
      },
    );
    const idem = createHash('sha256')
      .update(`${kind}:${row.lead_id}:${mc.id}`)
      .digest('hex')
      .slice(0, 32);
    try {
      const provider = pickProvider('transactional');
      const r = await provider.send({
        to: lead.email,
        fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'fdf@learnwithleaders.com',
        fromName: process.env.EMAIL_FROM_NAME ?? 'Learn with Leaders',
        replyTo: process.env.EMAIL_REPLY_TO,
        subject: rendered.subject,
        textBody: rendered.text,
        idempotencyKey: idem,
      });
      await db.from('email_sends').insert({
        lead_id: row.lead_id,
        provider: provider.name,
        provider_message_id: r.providerMessageId,
        status: 'sent',
        sent_at: r.acceptedAt,
        idempotency_key: idem,
      });
      sent += 1;
    } catch {
      // best-effort per-row; loop continues
    }
  }

  return NextResponse.json({ kind, sent });
}
