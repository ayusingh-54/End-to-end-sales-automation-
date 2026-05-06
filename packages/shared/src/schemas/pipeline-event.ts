import { z } from 'zod';
import { EventStatus, PipelineStage } from './enums.js';

export const PipelineEvent = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  stage: PipelineStage,
  status: EventStatus,
  payload_json: z.unknown().nullable().optional(),
  error_text: z.string().nullable().optional(),
  created_at: z.string().datetime(),
});
export type PipelineEvent = z.infer<typeof PipelineEvent>;

export const PipelineEventInsert = PipelineEvent.omit({
  id: true,
  created_at: true,
});
export type PipelineEventInsert = z.infer<typeof PipelineEventInsert>;
