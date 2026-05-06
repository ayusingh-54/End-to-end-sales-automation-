import { z } from 'zod';
import { LeadStatus } from './enums.js';

export const Lead = z.object({
  id: z.string().uuid(),
  school_id: z.string().uuid(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  email: z.string().email(),
  linkedin_url: z.string().url().nullable().optional(),
  email_verified: z.boolean(),
  role_verified: z.boolean(),
  status: LeadStatus,
  source: z.string().nullable().optional(),
  idempotency_key: z.string().min(1),
  replied: z.boolean(),
  bounced: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Lead = z.infer<typeof Lead>;

export const TargetRole = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  role_title: z.string().min(1),
  synonyms: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
});
export type TargetRole = z.infer<typeof TargetRole>;
