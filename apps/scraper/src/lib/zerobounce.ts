import { request } from 'undici';
import { loadEnv } from './env.js';
import { logger } from './logger.js';

export type ZbStatus =
  | 'valid'
  | 'invalid'
  | 'catch-all'
  | 'unknown'
  | 'spamtrap'
  | 'abuse'
  | 'do_not_mail';

export interface ZbResult {
  email: string;
  status: ZbStatus;
  sub_status?: string | undefined;
}

export async function validateEmail(email: string): Promise<ZbResult> {
  const env = loadEnv();
  if (!env.ZEROBOUNCE_API_KEY) {
    logger.warn('ZEROBOUNCE_API_KEY not set — marking as unknown (mock mode)');
    return { email, status: 'unknown', sub_status: 'mock_mode' };
  }
  const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(env.ZEROBOUNCE_API_KEY)}&email=${encodeURIComponent(email)}`;
  const res = await request(url, { method: 'GET', bodyTimeout: 15_000, headersTimeout: 15_000 });
  if (res.statusCode >= 400) {
    throw new Error(`zerobounce_${res.statusCode}`);
  }
  const json = (await res.body.json()) as { status: ZbStatus; sub_status?: string };
  return { email, status: json.status, sub_status: json.sub_status };
}
