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

function isAllowed(email: string): boolean {
  const list = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return email.toLowerCase().endsWith('@learnwithleaders.com');
  return list.includes(email.toLowerCase());
}

export async function signIn(form: FormData): Promise<{ message: string }> {
  const ip = headers().get('x-forwarded-for') ?? 'local';
  if (!consume(`login:${ip}`, { capacity: 5, refillPerSecond: 0.1 })) {
    return { message: 'Too many attempts — try again shortly.' };
  }
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: 'Email and password are required.' };
  if (!isAllowed(parsed.data.email)) {
    return { message: 'Invalid credentials.' };
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    const detail = process.env.NODE_ENV === 'development' ? ` (${error.message})` : '';
    return { message: `Sign-in failed${detail}` };
  }
  // After login, land on the home overview — operator picks where to go.
  redirect('/');
}

export async function signOut(): Promise<void> {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
