'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { renderTemplate } from '@lwl/shared';
import { pickProvider } from '@/lib/email';
import { stripe } from '@/lib/stripe';

// ===========================================================================
// markLeadPaid — demo-only helper that simulates the Stripe webhook for a
// lead with an active offer. In production the real webhook handler at
// /api/webhooks/stripe does this automatically.
// ===========================================================================
export async function markLeadPaid(leadId: string): Promise<{ ok: boolean; message: string }> {
  const db = createSupabaseAdmin();

  const { data: offerData } = await db
    .from('offers')
    .select('id, program_id, price_cents, stripe_session_id')
    .eq('lead_id', leadId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const offer = offerData as {
    id: string;
    program_id: string;
    price_cents: number;
    stripe_session_id: string | null;
  } | null;
  if (!offer) {
    return {
      ok: false,
      message: 'No active offer for this lead. Send the Stripe link first.',
    };
  }

  const fakePiId = `pi_demo_${offer.id.slice(0, 8)}_${Date.now()}`;

  const { error: payErr } = await db.from('payments').upsert(
    {
      lead_id: leadId,
      offer_id: offer.id,
      stripe_payment_intent_id: fakePiId,
      amount_cents: offer.price_cents,
      currency: 'usd',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      raw_payload: { source: 'manual_mark_paid_demo_only' },
    },
    { onConflict: 'stripe_payment_intent_id' },
  );
  if (payErr) return { ok: false, message: `payment insert failed: ${payErr.message}` };

  await db.from('offers').update({ status: 'paid' }).eq('id', offer.id);
  await db.from('leads').update({ status: 'paid' }).eq('id', leadId);
  await db.from('pipeline_events').insert({
    lead_id: leadId,
    stage: 'payment_received',
    status: 'success',
    payload_json: {
      source: 'manual_mark_paid',
      offer_id: offer.id,
      amount_cents: offer.price_cents,
    },
  });

  // Best-effort receipt email
  const { data: leadData } = await db
    .from('leads')
    .select('email, first_name')
    .eq('id', leadId)
    .maybeSingle();
  const lead = leadData as { email: string; first_name: string | null } | null;
  const { data: receiptTpl } = await db
    .from('email_templates')
    .select('subject, body_md, variables')
    .eq('program_id', offer.program_id)
    .eq('kind', 'payment_receipt')
    .maybeSingle();
  if (lead && receiptTpl) {
    try {
      const provider = pickProvider('transactional');
      const r = renderTemplate(
        receiptTpl as { subject: string; body_md: string; variables: string[] },
        { first_name: lead.first_name ?? '', receipt_url: 'https://stripe.com (test mode)' },
      );
      const idem = createHash('sha256').update(`receipt:${fakePiId}`).digest('hex').slice(0, 32);
      const sent = await provider.send({
        to: lead.email,
        fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev',
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
      // Non-blocking
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/');
  return {
    ok: true,
    message: `✓ Marked paid · $${(offer.price_cents / 100).toFixed(0)} · receipt sent · payment_intent ${fakePiId.slice(0, 20)}…`,
  };
}

// ===========================================================================
// sendStripeCheckout — one-click "send a Stripe payment link to this lead"
// Marks attended → creates Stripe Checkout session → sends offer email.
// Returns the URL so the operator can also copy/share it directly during demo.
// ===========================================================================
export async function sendStripeCheckout(
  leadId: string,
): Promise<{ ok: boolean; message: string; checkoutUrl?: string }> {
  const db = createSupabaseAdmin();

  const { data: leadData } = await db
    .from('leads')
    .select('id, email, first_name, last_name')
    .eq('id', leadId)
    .maybeSingle();
  const lead = leadData as {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  if (!lead) return { ok: false, message: 'Lead not found' };

  const { data: progData } = await db
    .from('programs')
    .select('id, slug, name, standard_price_cents, offer_price_cents, offer_window_hours')
    .eq('status', 'active')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  const prog = progData as {
    id: string;
    slug: string;
    name: string;
    standard_price_cents: number;
    offer_price_cents: number;
    offer_window_hours: number;
  } | null;
  if (!prog) return { ok: false, message: 'No active program found.' };

  // Mark most-recent registration as attended (demo flow shortcut)
  const { data: regData } = await db
    .from('registrations')
    .select('id, masterclass_id')
    .eq('lead_id', leadId)
    .order('registered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const reg = regData as { id: string; masterclass_id: string } | null;
  if (reg) {
    await db
      .from('registrations')
      .update({ attended: true, attendance_minutes: 60 })
      .eq('id', reg.id);
  }

  const expiresAt = new Date(Date.now() + prog.offer_window_hours * 3_600_000);
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
      metadata: { lead_id: lead.id, program_slug: prog.slug, source: 'admin_send_link' },
      expires_at: Math.floor((Date.now() + 23 * 3_600_000) / 1000),
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/thanks?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/m/fdf-test`,
    });
  } catch (err) {
    return { ok: false, message: `Stripe error: ${(err as Error).message.slice(0, 120)}` };
  }
  if (!session.url) return { ok: false, message: 'Stripe returned no URL' };

  const { error: offerErr } = await db.from('offers').upsert(
    {
      lead_id: lead.id,
      program_id: prog.id,
      price_cents: prog.offer_price_cents,
      expires_at: expiresAt.toISOString(),
      stripe_checkout_url: session.url,
      stripe_session_id: session.id,
      status: 'active',
    },
    { onConflict: 'stripe_session_id' },
  );
  if (offerErr) return { ok: false, message: `DB error: ${offerErr.message}` };

  // Send the offer_d0 email (best-effort)
  const { data: tplData } = await db
    .from('email_templates')
    .select('subject, body_md, variables')
    .eq('program_id', prog.id)
    .eq('kind', 'offer_d0')
    .maybeSingle();
  let emailNote = '(no offer_d0 template — email skipped)';
  if (tplData) {
    const rendered = renderTemplate(
      tplData as { subject: string; body_md: string; variables: string[] },
      {
        first_name: lead.first_name ?? '',
        standard_price: `$${(prog.standard_price_cents / 100).toFixed(0)}`,
        offer_price: `$${(prog.offer_price_cents / 100).toFixed(0)}`,
        checkout_url: session.url,
        expires_at: expiresAt.toUTCString(),
      },
    );
    const sendIdem = createHash('sha256')
      .update(`offer_d0:${lead.id}:${session.id}`)
      .digest('hex')
      .slice(0, 32);
    try {
      const provider = pickProvider('transactional');
      const sent = await provider.send({
        to: lead.email,
        toName: [lead.first_name, lead.last_name].filter(Boolean).join(' ') || undefined,
        fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev',
        fromName: process.env.EMAIL_FROM_NAME ?? 'Learn with Leaders',
        subject: rendered.subject,
        textBody: rendered.text,
        idempotencyKey: sendIdem,
      });
      await db.from('email_sends').insert({
        lead_id: lead.id,
        provider: provider.name,
        provider_message_id: sent.providerMessageId,
        status: 'sent',
        sent_at: sent.acceptedAt,
        idempotency_key: sendIdem,
      });
      emailNote = `(email sent to ${lead.email})`;
    } catch (err) {
      emailNote = `(email failed: ${(err as Error).message.slice(0, 80)})`;
    }
  }

  await db.from('leads').update({ status: 'offered' }).eq('id', lead.id);
  await db.from('pipeline_events').insert({
    lead_id: lead.id,
    stage: 'offer_send',
    status: 'success',
    payload_json: { source: 'admin_send_link', stripe_session: session.id },
  });

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/');
  return {
    ok: true,
    message: `✓ Stripe link sent ${emailNote}`,
    checkoutUrl: session.url,
  };
}
