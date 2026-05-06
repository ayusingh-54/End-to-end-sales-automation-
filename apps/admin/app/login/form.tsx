'use client';
import { useState, useTransition } from 'react';
import { signIn } from './actions';

export function LoginForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      action={(form) => {
        setMsg(null);
        start(async () => {
          const res = await signIn(form);
          if (res?.message) setMsg(res.message);
        });
      }}
      className="mt-6 space-y-3"
    >
      <input
        name="email"
        type="email"
        required
        autoComplete="username"
        placeholder="Email"
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="Password"
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      {msg && <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>}
    </form>
  );
}
