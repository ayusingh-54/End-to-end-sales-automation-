import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createRawClient } from '@supabase/supabase-js';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptions;
}

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          try {
            for (const { name, value, options } of toSet) {
              if (options) cookieStore.set(name, value, options);
              else cookieStore.set(name, value);
            }
          } catch {
            // Server Components cannot set cookies; safe to swallow.
          }
        },
      },
    },
  );
}

export function createSupabaseAdmin() {
  return createRawClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
