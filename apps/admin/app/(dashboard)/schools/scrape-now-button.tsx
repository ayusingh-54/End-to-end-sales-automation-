'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runScrapeNow } from './actions';

export function ScrapeNowButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg('Running discovery + tier scoring…');
            try {
              const res = await runScrapeNow();
              setMsg(
                `Discovery: ${res.discoveryInserted} raw rows. Tier: ${res.tierPromoted} promoted of ${res.tierEvaluated}.`,
              );
              router.refresh();
            } catch (err) {
              setMsg(`Error: ${(err as Error).message}`);
            }
          })
        }
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? 'Running…' : 'Run scraper now'}
      </button>
    </div>
  );
}
