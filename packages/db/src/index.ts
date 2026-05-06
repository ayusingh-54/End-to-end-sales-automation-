import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface CreateAdminClientOpts {
  url: string;
  serviceRoleKey: string;
}

export function createAdminClient(opts: CreateAdminClientOpts): SupabaseClient {
  return createClient(opts.url, opts.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-app': 'lwl-pipeline' } },
  });
}

export type { SupabaseClient } from '@supabase/supabase-js';
