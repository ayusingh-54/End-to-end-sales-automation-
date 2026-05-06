'use client';
import { useState, useTransition } from 'react';
import { register } from './actions';

export function RegistrationForm({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(form: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await register(slug, form);
      setResult(res);
    });
  }

  if (result?.ok) {
    return <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">{result.message}</p>;
  }

  return (
    <form action={onSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input
        name="first_name"
        placeholder="First name"
        required
        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        name="last_name"
        placeholder="Last name"
        required
        className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        name="email"
        type="email"
        placeholder="Work email"
        required
        className="col-span-1 rounded border border-neutral-300 bg-white px-3 py-2 text-sm sm:col-span-2 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        name="school"
        placeholder="School name"
        required
        className="col-span-1 rounded border border-neutral-300 bg-white px-3 py-2 text-sm sm:col-span-2 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input type="hidden" name="lead_id" />
      <button
        type="submit"
        disabled={pending}
        className="col-span-1 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2 dark:bg-white dark:text-neutral-900"
      >
        {pending ? 'Reserving…' : 'Reserve my seat'}
      </button>
      {result && !result.ok && (
        <p className="col-span-1 text-sm text-red-600 sm:col-span-2 dark:text-red-400">
          {result.message}
        </p>
      )}
    </form>
  );
}
