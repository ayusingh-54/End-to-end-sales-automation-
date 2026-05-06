import { z } from 'zod';
import { OfferStatus } from './enums.js';

export const Offer = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  program_id: z.string().uuid(),
  campaign_id: z.string().uuid().nullable().optional(),
  price_cents: z.number().int().nonnegative(),
  expires_at: z.string().datetime(),
  stripe_checkout_url: z.string().url().nullable().optional(),
  stripe_session_id: z.string().nullable().optional(),
  status: OfferStatus,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Offer = z.infer<typeof Offer>;
