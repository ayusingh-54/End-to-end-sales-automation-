import { z } from 'zod';

export const LeadStatus = z.enum([
  'new',
  'verified',
  'emailed',
  'registered',
  'attended',
  'offered',
  'paid',
  'lost',
  'reengaged',
]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const EmailTemplateKind = z.enum([
  'invite',
  'reminder_24h',
  'reminder_1h',
  'offer_d0',
  'offer_d1',
  'offer_d2_morning',
  'offer_d2_final',
  'noshow',
  'reengage',
  'registration_confirmation',
  'payment_receipt',
  'resource_delivery',
]);
export type EmailTemplateKind = z.infer<typeof EmailTemplateKind>;

export const CampaignStatus = z.enum(['draft', 'running', 'paused', 'done']);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const PipelineStage = z.enum([
  'school_discovery',
  'tier_verification',
  'contact_enrichment',
  'linkedin_verification',
  'email_validation',
  'invite_send',
  'reminder_send',
  'attendance_sync',
  'offer_send',
  'payment_received',
  'resource_delivery',
  'reengage',
]);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const EventStatus = z.enum(['started', 'success', 'error', 'skipped']);
export type EventStatus = z.infer<typeof EventStatus>;

export const ProgramStatus = z.enum(['draft', 'active', 'archived']);
export type ProgramStatus = z.infer<typeof ProgramStatus>;

export const MasterclassStatus = z.enum(['scheduled', 'live', 'completed', 'cancelled']);
export type MasterclassStatus = z.infer<typeof MasterclassStatus>;

export const OfferStatus = z.enum(['active', 'paid', 'expired', 'cancelled']);
export type OfferStatus = z.infer<typeof OfferStatus>;

export const PaymentStatus = z.enum(['pending', 'succeeded', 'refunded', 'failed']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const AppRole = z.enum(['admin', 'operator', 'viewer']);
export type AppRole = z.infer<typeof AppRole>;
