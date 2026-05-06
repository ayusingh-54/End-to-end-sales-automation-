import { z } from 'zod';

export const SchoolRaw = z.object({
  id: z.string().uuid(),
  name: z.string().nullable().optional(),
  website: z.string().url().nullable().optional(),
  country: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  tuition_text: z.string().nullable().optional(),
  school_type: z.string().nullable().optional(),
  source: z.string().min(1),
  raw_payload: z.unknown(),
  fetched_at: z.string().datetime(),
});
export type SchoolRaw = z.infer<typeof SchoolRaw>;

export const School = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  website: z.string().url().nullable().optional(),
  country: z.string().min(1),
  state: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  tuition_usd: z.number().int().nullable().optional(),
  school_type: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  tier_match_score: z.number().int().min(0).max(100).nullable().optional(),
  tier_verified: z.boolean(),
  tier_signals: z.record(z.unknown()).default({}),
  raw_id: z.string().uuid().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type School = z.infer<typeof School>;

export const SchoolTierRule = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  min_tuition_usd: z.number().int().nonnegative(),
  country: z.string().min(1),
  school_types: z.array(z.string()).default([]),
  exclude_types: z.array(z.string()).default([]),
  scoring_weights: z.record(z.number()).default({}),
  threshold_score: z.number().int().min(0).max(100).default(70),
  created_at: z.string().datetime(),
});
export type SchoolTierRule = z.infer<typeof SchoolTierRule>;
