import { z } from 'zod';

// Wire format for the existing LWL LinkedIn verification agent.
// Phase 2 swaps the mock for the real endpoint once credentials arrive.

export const LinkedInVerifyRequest = z.object({
  leadId: z.string().uuid(),
  linkedinUrl: z.string().url(),
  expectedRole: z.string().min(1),
  expectedEmployer: z.string().min(1),
});
export type LinkedInVerifyRequest = z.infer<typeof LinkedInVerifyRequest>;

export const LinkedInVerifyResponse = z.object({
  leadId: z.string().uuid(),
  roleMatches: z.boolean(),
  employerMatches: z.boolean(),
  observedRole: z.string().optional(),
  observedEmployer: z.string().optional(),
  confidence: z.number().min(0).max(1),
  checkedAt: z.string().datetime(),
});
export type LinkedInVerifyResponse = z.infer<typeof LinkedInVerifyResponse>;

export interface LinkedInAgentClient {
  verify(req: LinkedInVerifyRequest): Promise<LinkedInVerifyResponse>;
}
