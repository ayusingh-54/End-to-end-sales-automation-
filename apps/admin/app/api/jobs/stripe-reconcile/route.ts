import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { verifyRequest } from '@/lib/hmac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  const ts = req.headers.get('x-lwl-ts');
  const sig = req.headers.get('x-lwl-sig');
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret || !verifyRequest(secret, body, ts, sig)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = createSupabaseAdmin();
  const sinceMs = Date.now() - 7 * 86_400_000;
  const sessions = await stripe().checkout.sessions.list({
    limit: 100,
    created: { gte: Math.floor(sinceMs / 1000) },
  });

  const missing: string[] = [];
  for (const s of sessions.data) {
    if (s.payment_status !== 'paid') continue;
    const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
    if (!pi) continue;
    const { data } = await db
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', pi)
      .maybeSingle();
    if (!data) missing.push(s.id);
  }
  if (missing.length > 0) {
    await db.from('pipeline_events').insert({
      stage: 'payment_received',
      status: 'error',
      payload_json: { missing_session_ids: missing },
      error_text: `${missing.length} stripe sessions paid but not in payments table`,
    });
  }
  return NextResponse.json({ checked: sessions.data.length, missing: missing.length });
}
