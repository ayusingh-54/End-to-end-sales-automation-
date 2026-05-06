'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markLeadPaid } from './actions';

export function MarkPaidButton({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await markLeadPaid(leadId);
            setMsg(res.message);
            if (res.ok) router.refresh();
          })
        }
        title="Demo helper: simulates Stripe webhook (records payment, sends receipt). In production the real webhook handles this automatically."
        className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        {pending ? '…' : 'Mark paid (demo)'}
      </button>
      {msg && <span className="max-w-[280px] text-right text-[10px] text-neutral-500">{msg}</span>}
    </div>
  );
}
