export const LEAD_STATUSES = [
  'new',
  'verified',
  'emailed',
  'registered',
  'attended',
  'offered',
  'paid',
  'lost',
  'reengaged',
] as const;

export const EMAIL_TEMPLATE_KINDS = [
  'invite',
  'reminder_24h',
  'reminder_1h',
  'offer_d0',
  'offer_d1',
  'offer_d2_morning',
  'offer_d2_final',
  'noshow',
  'reengage',
] as const;

export const PIPELINE_STAGES = [
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
] as const;
