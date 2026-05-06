import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { consume } from '@/lib/rate-limit';

const Event = z.object({
  type: z.enum(['email.bounced', 'email.replied', 'email.opened', 'email.clicked']),
  message_id: z.string(),
  email: z.string().email().optional(),
});

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!consume(`webhook:instantly:${ip}`, { capacity: 60, refillPerSecond: 1 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let parsed;
  try {
    parsed = Event.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'bad_request', detail: String(err) }, { status: 400 });
  }

  const db = createSupabaseAdmin();
  const update: Record<string, unknown> = {};
  if (parsed.type === 'email.bounced') update.bounced = true;
  if (parsed.type === 'email.replied') update.replied = true;
  if (parsed.type === 'email.opened')
    update.opens = (await currentOpens(db, parsed.message_id)) + 1;
  if (parsed.type === 'email.clicked')
    update.clicks = (await currentClicks(db, parsed.message_id)) + 1;

  const { error: upErr } = await db
    .from('email_sends')
    .update(update)
    .eq('provider_message_id', parsed.message_id);
  if (upErr) {
    return NextResponse.json({ error: 'db_failed' }, { status: 500 });
  }

  if (parsed.type === 'email.bounced' && parsed.email) {
    await db.from('leads').update({ bounced: true, status: 'lost' }).eq('email', parsed.email);
  }
  if (parsed.type === 'email.replied' && parsed.email) {
    await db.from('leads').update({ replied: true }).eq('email', parsed.email);
  }
  return NextResponse.json({ ok: true });
}

async function currentOpens(db: ReturnType<typeof createSupabaseAdmin>, msgId: string) {
  const { data } = await db
    .from('email_sends')
    .select('opens')
    .eq('provider_message_id', msgId)
    .maybeSingle();
  return ((data as { opens?: number } | null)?.opens ?? 0) as number;
}
async function currentClicks(db: ReturnType<typeof createSupabaseAdmin>, msgId: string) {
  const { data } = await db
    .from('email_sends')
    .select('clicks')
    .eq('provider_message_id', msgId)
    .maybeSingle();
  return ((data as { clicks?: number } | null)?.clicks ?? 0) as number;
}
