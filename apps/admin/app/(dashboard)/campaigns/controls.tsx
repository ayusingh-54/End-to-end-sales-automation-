'use client';
import { useTransition } from 'react';
import { setCampaignStatus } from './actions';

export function CampaignControls({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const next = status === 'running' ? 'paused' : status === 'paused' ? 'running' : 'running';
  return (
    <button
      disabled={pending}
      onClick={() => start(() => setCampaignStatus(id, next))}
      className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
    >
      {pending ? '…' : next === 'running' ? 'Resume' : 'Pause'}
    </button>
  );
}
