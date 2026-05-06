import { z } from 'zod';
import { MasterclassStatus } from './enums.js';

export const Masterclass = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  mentor_name: z.string().min(1),
  mentor_bio: z.string().nullable().optional(),
  topic: z.string().min(1),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().positive().default(60),
  zoom_join_url: z.string().url().nullable().optional(),
  zoom_meeting_id: z.string().nullable().optional(),
  registration_page_slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/),
  status: MasterclassStatus,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Masterclass = z.infer<typeof Masterclass>;
