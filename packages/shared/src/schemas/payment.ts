import { z } from 'zod';
import { PaymentStatus } from './enums.js';

export const Payment = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  offer_id: z.string().uuid().nullable().optional(),
  stripe_payment_intent_id: z.string().min(1),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('usd'),
  status: PaymentStatus,
  paid_at: z.string().datetime().nullable().optional(),
  raw_payload: z.unknown().optional(),
  created_at: z.string().datetime(),
});
export type Payment = z.infer<typeof Payment>;
