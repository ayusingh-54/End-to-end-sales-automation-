import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { verifyRequest } from '@/lib/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Input = z.object({ campaign_id: z.string().uuid(), action: z.enum(['start']) });

interface CampRow {
  id: string;
  program_id: string;
  masterclass_id: string | null;
  daily_send_cap: number;
  programs: { slug: string; name: string } | null;
  masterclasses: { topic: string; mentor_name: string; registration_page_slug: string } | null;
}
interface LeadRow {
  id: string;
  email: string;
  first_name: string | null;
  schools: { name: string } | null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const ts = req.headers.get('x-lwl-ts');
  const sig = req.headers.get('x-lwl-sig');
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret || !verifyRequest(secret, body, ts, sig)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const parsed = Input.safeParse(JSON.parse(body));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'bad_request', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = createSupabaseAdmin();
  const { data: campData } = await db
    .from('campaigns')
    .select(
      'id, program_id, masterclass_id, daily_send_cap, programs(slug, name), masterclasses(topic, mentor_name, registration_page_slug)',
    )
    .eq('id', parsed.data.campaign_id)
    .maybeSingle();
  if (!campData) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  const camp = campData as unknown as CampRow;
  if (!camp.masterclasses || !camp.programs) {
    return NextResponse.json({ error: 'masterclass_or_program_missing' }, { status: 400 });
  }

  const { data: tplData } = await db
    .from('email_templates')
    .select('subject, body_md, variables')
    .eq('program_id', camp.program_id)
    .eq('kind', 'invite')
    .maybeSingle();
  if (!tplData) return NextResponse.json({ error: 'invite_template_missing' }, { status: 500 });

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await db
    .from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', camp.id)
    .gte('created_at', since);
  const remaining = Math.max(0, camp.daily_send_cap - (count ?? 0));
  if (remaining === 0) return NextResponse.json({ sent: 0, reason: 'daily_cap_reached' });

  const { data: leadsData } = await db
    .from('leads')
    .select('id, email, first_name, schools(name)')
    .eq('email_verified', true)
    .eq('role_verified', true)
    .eq('status', 'verified')
    .limit(remaining);
  const leads = (leadsData ?? []) as unknown as LeadRow[];

  const provider = pickProvider('cold');
  const registrationLink = `${process.env.NEXT_PUBLIC_APP_URL}/m/${camp.masterclasses.registration_page_slug}`;
  let sent = 0;
  for (const lead of leads) {
    const idem = createHash('sha256')
      .update(`invite:${camp.id}:${lead.id}`)
      .digest('hex')
      .slice(0, 32);
    const rendered = renderTemplate(
      tplData as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        school: lead.schools?.name ?? '',
        masterclass_topic: camp.masterclasses.topic,
        mentor_name: camp.masterclasses.mentor_name,
        registration_link: `${registrationLink}?lead=${lead.id}`,
      },
    );
    try {
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
        campaign_id: camp.id,
        provider: provider.name,
        provider_message_id: r.providerMessageId,
        status: 'sent',
        sent_at: r.acceptedAt,
        idempotency_key: idem,
      });
      await db.from('leads').update({ status: 'emailed' }).eq('id', lead.id);
      sent += 1;
    } catch {
      // continue
    }
  }
  return NextResponse.json({ sent, audience: leads.length });
}
