'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { enrichSchool } from './actions';

export function EnrichButton({ schoolId, name }: { schoolId: string; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-1">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg('Calling Apollo…');
            const res = await enrichSchool(schoolId);
            if (res.error) {
              setMsg(`✕ ${res.error}`);
            } else {
              setMsg(`✓ +${res.leadsAdded} leads (Apollo returned ${res.apolloReturned})`);
              router.refresh();
            }
          })
        }
        title={`Enrich ${name} via Apollo (~1 credit, max 5 leads)`}
        className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending ? '…' : 'Enrich'}
      </button>
      {msg && <span className="text-[10px] text-neutral-500">{msg}</span>}
    </div>
  );
}
