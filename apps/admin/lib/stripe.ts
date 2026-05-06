import Stripe from 'stripe';

let cached: Stripe | undefined;

export function stripe(): Stripe {
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY missing');
    cached = new Stripe(key);
  }
  return cached;
}
