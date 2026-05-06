import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { stripe } from '@/lib/stripe';
import { verifyRequest } from '@/lib/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Input = z.object({
  campaign_id: z.string().uuid(),
  step: z.enum(['offer_d0', 'offer_d1', 'offer_d2_morning', 'offer_d2_final', 'noshow']),
});

interface ProgRow {
  id: string;
  slug: string;
  name: string;
  standard_price_cents: number;
  offer_price_cents: number;
  offer_window_hours: number;
}
interface CampRow {
  id: string;
  program_id: string;
  masterclass_id: string | null;
  programs: ProgRow | null;
}
interface RegLeadRow {
  lead_id: string;
  attended: boolean;
  leads: { id: string; email: string; first_name: string | null } | null;
}

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
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
  const { campaign_id, step } = parsed.data;

  const db = createSupabaseAdmin();
  const { data: campData } = await db
    .from('campaigns')
    .select('id, program_id, masterclass_id, programs(*)')
    .eq('id', campaign_id)
    .maybeSingle();
  if (!campData) return NextResponse.json({ error: 'campaign_not_found' }, { status: 404 });
  const camp = campData as unknown as CampRow;
  const prog = camp.programs;
  if (!prog) return NextResponse.json({ error: 'program_missing' }, { status: 500 });
  if (!camp.masterclass_id) {
    return NextResponse.json({ error: 'no_masterclass' }, { status: 400 });
  }

  const { data: regs } = await db
    .from('registrations')
    .select('lead_id, attended, leads!inner(id, email, first_name)')
    .eq('masterclass_id', camp.masterclass_id);

  const audience = ((regs ?? []) as unknown as RegLeadRow[]).filter((r) =>
    step === 'noshow' ? !r.attended : r.attended,
  );

  const { data: tplData } = await db
    .from('email_templates')
    .select('subject, body_md, variables')
    .eq('program_id', prog.id)
    .eq('kind', step)
    .maybeSingle();
  if (!tplData) return NextResponse.json({ error: 'template_missing' }, { status: 500 });

  let sent = 0;
  for (const r of audience) {
    const lead = r.leads;
    if (!lead) continue;

    const expiresAt = new Date(Date.now() + prog.offer_window_hours * 3_600_000);
    // Stripe idempotency key is intentionally NOT passed — checkout sessions
    // are cheap to create, and `offers.stripe_session_id` unique constraint
    // prevents downstream double-recording. Avoids Stripe's 24h cache friction.

    let session;
    try {
      session = await stripe().checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              product_data: { name: prog.name },
              unit_amount: prog.offer_price_cents,
            },
          },
        ],
        customer_email: lead.email,
        client_reference_id: lead.id,
        metadata: {
          lead_id: lead.id,
          program_slug: prog.slug,
          campaign_id: camp.id,
        },
        // Stripe Checkout sessions max out at 24h; the BUSINESS offer window
        // (72h for FDF) is tracked separately in offers.expires_at. We cap
        // the Stripe session expiry just under 24h here.
        expires_at: Math.floor((Date.now() + 23 * 3_600_000) / 1000),
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/thanks?s={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/m/${camp.masterclass_id}/back`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[offer-sequence] stripe checkout failed:', msg);
      await db.from('pipeline_events').insert({
        lead_id: lead.id,
        campaign_id: camp.id,
        stage: 'offer_send',
        status: 'error',
        error_text: `stripe: ${msg}`.slice(0, 500),
      });
      continue;
    }

    const { data: offerRow } = await db
      .from('offers')
      .upsert(
        {
          lead_id: lead.id,
          program_id: prog.id,
          campaign_id: camp.id,
          price_cents: prog.offer_price_cents,
          expires_at: expiresAt.toISOString(),
          stripe_checkout_url: session.url,
          stripe_session_id: session.id,
          status: 'active',
        },
        { onConflict: 'stripe_session_id' },
      )
      .select('id')
      .maybeSingle();
    void offerRow;

    const rendered = renderTemplate(
      tplData as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        standard_price: fmtPrice(prog.standard_price_cents),
        offer_price: fmtPrice(prog.offer_price_cents),
        checkout_url: session.url ?? '',
        expires_at: expiresAt.toUTCString(),
      },
    );

    try {
      // For pilot demo: cold sends go via the same provider as transactional
      // (Resend), since Instantly isn't wired and we don't have a warmed domain.
      // In production this would be pickProvider('cold') → Instantly.
      const provider = pickProvider(process.env.INSTANTLY_API_KEY ? 'cold' : 'transactional');
      const sendIdem = createHash('sha256')
        .update(`send:${step}:${camp.id}:${lead.id}`)
        .digest('hex')
        .slice(0, 32);
      const r2 = await provider.send({
        to: lead.email,
        fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev',
        fromName: process.env.EMAIL_FROM_NAME ?? 'Learn with Leaders',
        replyTo: process.env.EMAIL_REPLY_TO,
        subject: rendered.subject,
        textBody: rendered.text,
        idempotencyKey: sendIdem,
      });
      await db.from('email_sends').insert({
        lead_id: lead.id,
        campaign_id: camp.id,
        provider: provider.name,
        provider_message_id: r2.providerMessageId,
        status: 'sent',
        sent_at: r2.acceptedAt,
        idempotency_key: sendIdem,
      });
      await db.from('leads').update({ status: 'offered' }).eq('id', lead.id);
      sent += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[offer-sequence] email send failed:', msg);
      await db.from('pipeline_events').insert({
        lead_id: lead.id,
        campaign_id: camp.id,
        stage: 'offer_send',
        status: 'error',
        error_text: `email: ${msg}`.slice(0, 500),
      });
    }
  }

  return NextResponse.json({ step, sent, audience: audience.length });
}
