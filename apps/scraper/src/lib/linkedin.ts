import { request } from 'undici';
import {
  type LinkedInAgentClient,
  type LinkedInVerifyRequest,
  type LinkedInVerifyResponse,
  LinkedInVerifyResponse as LinkedInVerifyResponseSchema,
} from '@lwl/shared';
import { loadEnv } from './env.js';
import { logger } from './logger.js';

class HttpLinkedInAgent implements LinkedInAgentClient {
  constructor(
    private url: string,
    private apiKey: string,
  ) {}
  async verify(req: LinkedInVerifyRequest): Promise<LinkedInVerifyResponse> {
    const res = await request(`${this.url}/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(req),
      bodyTimeout: 30_000,
      headersTimeout: 30_000,
    });
    if (res.statusCode >= 400) {
      throw new Error(`linkedin_agent_${res.statusCode}`);
    }
    const json = await res.body.json();
    return LinkedInVerifyResponseSchema.parse(json);
  }
}

class MockLinkedInAgent implements LinkedInAgentClient {
  async verify(req: LinkedInVerifyRequest): Promise<LinkedInVerifyResponse> {
    // Deterministic mock: confidence based on URL hash, role/employer "match"
    // is a simple substring check. Used until the real agent is wired.
    const hash = [...req.linkedinUrl].reduce((a, c) => (a + c.charCodeAt(0)) % 100, 0) / 100;
    return {
      leadId: req.leadId,
      roleMatches: hash > 0.1,
      employerMatches: hash > 0.1,
      observedRole: req.expectedRole,
      observedEmployer: req.expectedEmployer,
      confidence: 0.5 + hash / 2,
      checkedAt: new Date().toISOString(),
    };
  }
}

export function createLinkedInAgent(): LinkedInAgentClient {
  const env = loadEnv();
  if (env.LINKEDIN_AGENT_URL && env.LINKEDIN_AGENT_API_KEY) {
    return new HttpLinkedInAgent(env.LINKEDIN_AGENT_URL, env.LINKEDIN_AGENT_API_KEY);
  }
  logger.warn('LinkedIn agent not configured — using deterministic mock');
  return new MockLinkedInAgent();
}
