import { request } from 'undici';
import { loadEnv } from './env.js';
import { logger } from './logger.js';
import { getHostQueue } from './rate-limit.js';

export interface ApolloPerson {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  organization?: { name?: string; website_url?: string };
}

const APOLLO_HOST = 'api.apollo.io';

export async function searchPeopleByOrganization(opts: {
  organizationName: string;
  titles: string[];
  perPage?: number;
}): Promise<ApolloPerson[]> {
  const env = loadEnv();
  if (!env.APOLLO_API_KEY) {
    logger.warn('APOLLO_API_KEY not set — returning empty result (mock mode)');
    return [];
  }
  const queue = getHostQueue(APOLLO_HOST, {
    intervalMs: 1_000,
    intervalCap: 5,
    concurrency: 1,
  });
  return (await queue.add(async () => {
    const res = await request(`https://${APOLLO_HOST}/v1/mixed_people/search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.APOLLO_API_KEY!,
      },
      body: JSON.stringify({
        q_organization_name: opts.organizationName,
        person_titles: opts.titles,
        per_page: opts.perPage ?? 25,
      }),
      bodyTimeout: 20_000,
      headersTimeout: 20_000,
    });
    if (res.statusCode >= 400) {
      const text = await res.body.text();
      throw new Error(`apollo_${res.statusCode}: ${text.slice(0, 200)}`);
    }
    const json = (await res.body.json()) as { people?: ApolloPerson[] };
    return json.people ?? [];
  })) as ApolloPerson[];
}
