import { z } from 'zod';
import { EmailTemplateKind } from './enums.js';

export const EmailTemplate = z.object({
  id: z.string().uuid(),
  program_id: z.string().uuid(),
  kind: EmailTemplateKind,
  subject: z.string().min(1),
  body_md: z.string().min(1),
  variables: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type EmailTemplate = z.infer<typeof EmailTemplate>;

export const EmailSend = z.object({
  id: z.string().uuid(),
  lead_id: z.string().uuid(),
  template_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  provider: z.enum(['instantly', 'resend', 'mailhog']),
  provider_message_id: z.string().nullable().optional(),
  status: z.string(),
  opens: z.number().int().nonnegative().default(0),
  clicks: z.number().int().nonnegative().default(0),
  bounced: z.boolean().default(false),
  replied: z.boolean().default(false),
  sent_at: z.string().datetime().nullable().optional(),
  idempotency_key: z.string().min(1),
  created_at: z.string().datetime(),
});
export type EmailSend = z.infer<typeof EmailSend>;
