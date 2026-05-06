'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServer } from '@/lib/supabase/server';
import { consume } from '@/lib/rate-limit';

const Input = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Optional allow-list. If ADMIN_ALLOWED_EMAILS is set, only listed emails can
// sign in. If unset (the demo default), any user that exists in Supabase Auth
// can sign in — RLS still gates what they can see (need user_roles entry).
function isAllowed(email: string): boolean {
  const list = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true; // no allow-list configured → open to any Supabase user
  return list.includes(email.toLowerCase());
}

export async function signIn(form: FormData): Promise<{ message: string }> {
  const ip = headers().get('x-forwarded-for') ?? 'local';
  if (!consume(`login:${ip}`, { capacity: 5, refillPerSecond: 0.1 })) {
    return { message: 'Too many attempts — try again shortly.' };
  }
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: 'Please enter a valid email and password.' };
  if (!isAllowed(parsed.data.email)) {
    return {
      message: `Email not allowed (set ADMIN_ALLOWED_EMAILS env var to include "${parsed.data.email}")`,
    };
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Surface the real reason — easier to debug. Common values:
    //   "Invalid login credentials" → wrong password OR user doesn't exist
    //   "Email not confirmed"       → user needs Auto-Confirm in Supabase
    //   "Email logins are disabled" → enable email provider in Supabase
    return { message: `Sign-in failed: ${error.message}` };
  }
  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
