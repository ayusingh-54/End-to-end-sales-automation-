import { createAdminClient, type SupabaseClient } from '@lwl/db';
import { loadEnv } from './env.js';

let cached: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (!cached) {
    const env = loadEnv();
    cached = createAdminClient({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    });
  }
  return cached;
}
