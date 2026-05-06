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
    return (
      <div className="mt-5">
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
              You&apos;re in!
            </p>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-400">{result.message}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 text-sm">
          <p className="font-medium">What happens next:</p>
          <ul className="space-y-1.5 text-neutral-600 dark:text-neutral-400">
            <li className="flex gap-2">
              <span className="text-emerald-500">→</span> Confirmation email + calendar invite (next
              5 minutes)
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500">→</span> Reminder email 24 hours before the session
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500">→</span> Final reminder 1 hour before
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500">→</span> Live Zoom link delivered at the start time
            </li>
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Register another
          </button>
          <a
            href="https://learnwithleaders.com"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            About LWL
          </a>
        </div>
      </div>
    );
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
