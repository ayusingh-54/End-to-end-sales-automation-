import { z } from 'zod';
import { ProgramStatus } from './enums.js';

export const Program = z.object({
  id: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens only'),
  name: z.string().min(1),
  standard_price_cents: z.number().int().nonnegative(),
  offer_price_cents: z.number().int().nonnegative(),
  offer_window_hours: z.number().int().positive().default(72),
  resource_pack_url: z.string().url().nullable().optional(),
  brand_assets_url: z.string().url().nullable().optional(),
  status: ProgramStatus,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Program = z.infer<typeof Program>;

export const ProgramInsert = Program.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  status: ProgramStatus.default('draft'),
});
export type ProgramInsert = z.infer<typeof ProgramInsert>;
