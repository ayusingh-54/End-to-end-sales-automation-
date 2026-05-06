'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] route error:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
        Error
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        This page failed to load. Common causes: Supabase env vars missing, the database is
        unreachable, or a required table hasn’t been migrated yet.
      </p>
      {error.message && (
        <pre className="mt-4 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {error.message}
        </pre>
      )}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white dark:bg-white dark:text-neutral-900"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
