import type { PipelineStage, EventStatus } from '@lwl/shared';
import { db } from './supabase.js';
import { logger } from './logger.js';

export async function recordEvent(
  stage: PipelineStage,
  status: EventStatus,
  opts: {
    leadId?: string;
    campaignId?: string;
    payload?: unknown;
    error?: unknown;
  } = {},
): Promise<void> {
  const errText =
    opts.error instanceof Error
      ? opts.error.message
      : typeof opts.error === 'string'
        ? opts.error
        : opts.error
          ? JSON.stringify(opts.error)
          : null;

  const { error } = await db()
    .from('pipeline_events')
    .insert({
      lead_id: opts.leadId ?? null,
      campaign_id: opts.campaignId ?? null,
      stage,
      status,
      payload_json: opts.payload ?? null,
      error_text: errText,
    });

  if (error) {
    logger.error({ err: error, stage, status }, 'failed to record pipeline_event');
  }
}
