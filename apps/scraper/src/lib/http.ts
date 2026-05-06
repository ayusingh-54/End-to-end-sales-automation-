import { request } from 'undici';
import { createRequire } from 'node:module';
import { getHostQueue, DEFAULT_HOST_LIMIT, type HostLimit } from './rate-limit.js';
import { loadEnv } from './env.js';
import { logger } from './logger.js';

interface RobotsLike {
  isAllowed(url: string, ua: string): boolean | undefined;
}
const requireCjs = createRequire(import.meta.url);
const robotsParser = requireCjs('robots-parser') as (url: string, body: string) => RobotsLike;

const robotsCache = new Map<string, RobotsLike>();

async function getRobots(origin: string): Promise<RobotsLike> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  const url = `${origin}/robots.txt`;
  try {
    const res = await request(url, { method: 'GET' });
    const text = await res.body.text();
    const parser = robotsParser(url, res.statusCode === 200 ? text : '');
    robotsCache.set(origin, parser);
    return parser;
  } catch {
    const parser = robotsParser(url, '');
    robotsCache.set(origin, parser);
    return parser;
  }
}

export interface FetchOpts {
  hostLimit?: HostLimit;
  timeoutMs?: number;
}

export async function politeFetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const env = loadEnv();
  const u = new URL(url);
  const robots = await getRobots(u.origin);
  const allowed = robots.isAllowed(url, env.SCRAPER_USER_AGENT);
  if (allowed === false) {
    throw new Error(`disallowed_by_robots: ${url}`);
  }

  const queue = getHostQueue(u.host, opts.hostLimit ?? DEFAULT_HOST_LIMIT);
  return queue.add(async () => {
    logger.debug({ url }, 'fetch');
    const res = await request(url, {
      method: 'GET',
      headers: { 'user-agent': env.SCRAPER_USER_AGENT, accept: 'text/html,*/*' },
      bodyTimeout: opts.timeoutMs ?? 15_000,
      headersTimeout: opts.timeoutMs ?? 15_000,
    });
    if (res.statusCode >= 400) {
      throw new Error(`http_${res.statusCode}: ${url}`);
    }
    return res.body.text();
  }) as Promise<string>;
}
