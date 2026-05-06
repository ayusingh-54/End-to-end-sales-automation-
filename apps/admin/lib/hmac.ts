import { createHmac, timingSafeEqual } from 'node:crypto';

const SKEW_SECONDS = 5 * 60;

export function signRequest(secret: string, body: string): { ts: string; sig: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return { ts, sig };
}

export function verifyRequest(
  secret: string,
  body: string,
  ts: string | null,
  sig: string | null,
): boolean {
  if (!ts || !sig) return false;
  const t = Number(ts);
  if (!Number.isFinite(t)) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - t);
  if (skew > SKEW_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  if (expected.length !== sig.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
}
