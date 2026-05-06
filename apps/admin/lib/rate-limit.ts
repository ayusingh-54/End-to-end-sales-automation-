// Minimal in-process token bucket. Adequate for a single-instance pilot.
// For multi-instance, swap with an upstash-redis-backed limiter.

interface Bucket {
  tokens: number;
  last: number;
}
const buckets = new Map<string, Bucket>();

export interface LimitOpts {
  capacity: number;
  refillPerSecond: number;
}

export function consume(key: string, opts: LimitOpts): boolean {
  const now = Date.now() / 1000;
  const b = buckets.get(key) ?? { tokens: opts.capacity, last: now };
  const refill = (now - b.last) * opts.refillPerSecond;
  b.tokens = Math.min(opts.capacity, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return true;
}
