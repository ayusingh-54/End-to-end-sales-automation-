import { z } from 'zod';
import { CampaignStatus } from './enums.js';

export const Campaign = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  masterclass_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  status: CampaignStatus,
  daily_send_cap: z.number().int().positive().default(200),
  started_at: z.string().datetime().nullable().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Campaign = z.infer<typeof Campaign>;
