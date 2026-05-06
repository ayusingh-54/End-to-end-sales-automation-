import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { verifyRequest } from '@/lib/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OfferRow {
  id: string;
  lead_id: string;
  program_id: string;
  expires_at: string;
  leads: { id: string; email: string; first_name: string | null; status: string } | null;
}

interface NextMcRow {
  id: string;
  scheduled_at: string;
  registration_page_slug: string;
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
  const cutoffNew = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const cutoffOld = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: offersData } = await db
    .from('offers')
    .select('id, lead_id, program_id, expires_at, leads!inner(id, email, first_name, status)')
    .in('status', ['active', 'expired', 'cancelled'])
    .lte('expires_at', cutoffNew)
    .gte('expires_at', cutoffOld)
    .in('leads.status', ['offered', 'lost']);

  let sent = 0;
  for (const o of (offersData ?? []) as unknown as OfferRow[]) {
    const lead = o.leads;
    if (!lead) continue;

    const { data: existing } = await db
      .from('email_sends')
      .select('id')
      .eq('lead_id', lead.id)
      .like('idempotency_key', 'reengage:%')
      .maybeSingle();
    if (existing) continue;

    const { data: tplData } = await db
      .from('email_templates')
      .select('subject, body_md, variables')
      .eq('program_id', o.program_id)
      .eq('kind', 'reengage')
      .maybeSingle();
    if (!tplData) continue;

    const { data: nextMc } = await db
      .from('masterclasses')
      .select('id, scheduled_at, registration_page_slug')
      .eq('program_id', o.program_id)
      .gt('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(1)
      .maybeSingle();
    const next = nextMc as NextMcRow | null;

    const rendered = renderTemplate(
      tplData as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        next_cohort_date: next ? new Date(next.scheduled_at).toUTCString() : 'soon',
        next_masterclass_link: next
          ? `${process.env.NEXT_PUBLIC_APP_URL}/m/${next.registration_page_slug}`
          : '',
      },
    );
    const idem = createHash('sha256')
      .update(`reengage:${o.id}:${lead.id}`)
      .digest('hex')
      .slice(0, 32);
    try {
      const provider = pickProvider('cold');
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
        lead_id: lead.id,
        provider: provider.name,
        provider_message_id: r.providerMessageId,
        status: 'sent',
        sent_at: r.acceptedAt,
        idempotency_key: idem,
      });
      await db.from('leads').update({ status: 'reengaged' }).eq('id', lead.id);
      await db.from('pipeline_events').insert({
        lead_id: lead.id,
        stage: 'reengage',
        status: 'success',
      });
      sent += 1;
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ sent });
}
