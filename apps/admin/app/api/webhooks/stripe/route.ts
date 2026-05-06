import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { presignR2GetUrl } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProgRow {
  id: string;
  resource_pack_url: string | null;
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'misconfigured' }, { status: 500 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: 'bad_signature', detail: String(err) }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const leadId = session.metadata?.lead_id;
  const programSlug = session.metadata?.program_slug;
  if (!leadId || !programSlug) {
    return NextResponse.json({ error: 'missing_metadata' }, { status: 400 });
  }
  if (!session.payment_intent) {
    return NextResponse.json({ error: 'no_payment_intent' }, { status: 400 });
  }
  const pi =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;

  const db = createSupabaseAdmin();
  const { error: payErr } = await db.from('payments').upsert(
    {
      lead_id: leadId,
      offer_id: null,
      stripe_payment_intent_id: pi,
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      raw_payload: session as unknown as Record<string, unknown>,
    },
    { onConflict: 'stripe_payment_intent_id' },
  );
  if (payErr) {
    return NextResponse.json(
      { error: 'db_payment_failed', detail: payErr.message },
      { status: 500 },
    );
  }

  await db.from('offers').update({ status: 'paid' }).eq('stripe_session_id', session.id);
  await db.from('leads').update({ status: 'paid' }).eq('id', leadId);
  await db.from('pipeline_events').insert({
    lead_id: leadId,
    stage: 'payment_received',
    status: 'success',
    payload_json: { session_id: session.id, amount: session.amount_total },
  });

  // Send receipt + resource pack (best-effort).
  const { data: leadRow } = await db
    .from('leads')
    .select('email, first_name')
    .eq('id', leadId)
    .maybeSingle();
  const { data: progRow } = await db
    .from('programs')
    .select('id, resource_pack_url')
    .eq('slug', programSlug)
    .maybeSingle();
  const { data: receiptTpl } = await db
    .from('email_templates')
    .select('subject, body_md, variables')
    .eq('program_id', (progRow as ProgRow | null)?.id ?? '')
    .eq('kind', 'payment_receipt')
    .maybeSingle();
  const { data: deliveryTpl } = await db
    .from('email_templates')
    .select('subject, body_md, variables')
    .eq('program_id', (progRow as ProgRow | null)?.id ?? '')
    .eq('kind', 'resource_delivery')
    .maybeSingle();

  let resourceUrl = (progRow as ProgRow | null)?.resource_pack_url ?? '';
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    resourceUrl
  ) {
    try {
      const key = resourceUrl.replace(/^https?:\/\/[^/]+\//, '');
      resourceUrl = presignR2GetUrl({
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        accountId: process.env.R2_ACCOUNT_ID,
        bucket: process.env.R2_BUCKET_NAME,
        key,
        expiresInSeconds: 60 * 60 * 24 * 7,
      });
    } catch {
      // fall back to the un-presigned URL
    }
  }

  const lead = leadRow as { email: string; first_name: string | null } | null;
  if (lead && receiptTpl) {
    const provider = pickProvider('transactional');
    const r = renderTemplate(
      receiptTpl as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        receipt_url:
          (session as Stripe.Checkout.Session & { receipt_url?: string }).receipt_url ?? '',
      },
    );
    const idem = createHash('sha256').update(`receipt:${pi}`).digest('hex').slice(0, 32);
    try {
      const sent = await provider.send({
        to: lead.email,
        fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'fdf@learnwithleaders.com',
        fromName: process.env.EMAIL_FROM_NAME ?? 'Learn with Leaders',
        subject: r.subject,
        textBody: r.text,
        idempotencyKey: idem,
      });
      await db.from('email_sends').insert({
        lead_id: leadId,
        provider: provider.name,
        provider_message_id: sent.providerMessageId,
        status: 'sent',
        sent_at: sent.acceptedAt,
        idempotency_key: idem,
      });
    } catch {
      // best-effort send
    }
  }

  if (lead && deliveryTpl && resourceUrl) {
    const provider = pickProvider('transactional');
    const r = renderTemplate(
      deliveryTpl as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        resource_url: resourceUrl,
      },
    );
    const idem = createHash('sha256').update(`resource:${pi}`).digest('hex').slice(0, 32);
    try {
      const sent = await provider.send({
        to: lead.email,
        fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'fdf@learnwithleaders.com',
        fromName: process.env.EMAIL_FROM_NAME ?? 'Learn with Leaders',
        subject: r.subject,
        textBody: r.text,
        idempotencyKey: idem,
      });
      await db.from('email_sends').insert({
        lead_id: leadId,
        provider: provider.name,
        provider_message_id: sent.providerMessageId,
        status: 'sent',
        sent_at: sent.acceptedAt,
        idempotency_key: idem,
      });
      await db.from('pipeline_events').insert({
        lead_id: leadId,
        stage: 'resource_delivery',
        status: 'success',
      });
    } catch {
      // best-effort send
    }
  }

  return NextResponse.json({ ok: true });
}
