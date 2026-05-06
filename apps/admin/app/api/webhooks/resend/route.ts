import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { consume } from '@/lib/rate-limit';

const Event = z.object({
  type: z.string(),
  data: z.object({
    email_id: z.string().optional(),
    to: z.array(z.string()).optional(),
  }),
});

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!consume(`webhook:resend:${ip}`, { capacity: 60, refillPerSecond: 1 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  let parsed;
  try {
    parsed = Event.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'bad_request', detail: String(err) }, { status: 400 });
  }
  const db = createSupabaseAdmin();
  const id = parsed.data.email_id;
  if (!id) return NextResponse.json({ ok: true });
  const update: Record<string, unknown> = {};
  if (parsed.type === 'email.bounced') update.bounced = true;
  if (parsed.type === 'email.delivered') update.status = 'delivered';
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });
  await db.from('email_sends').update(update).eq('provider_message_id', id);
  return NextResponse.json({ ok: true });
}
