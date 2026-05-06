'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markLeadPaid, sendStripeCheckout } from './actions';

export function LeadActionsCell({ leadId, status }: { leadId: string; status: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const onSendLink = () =>
    start(async () => {
      setMsg('Creating Stripe session…');
      setCheckoutUrl(null);
      const res = await sendStripeCheckout(leadId);
      setMsg(res.message);
      if (res.ok && res.checkoutUrl) {
        setCheckoutUrl(res.checkoutUrl);
        router.refresh();
      }
    });

  const onMarkPaid = () =>
    start(async () => {
      setMsg('Recording payment…');
      const res = await markLeadPaid(leadId);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });

  const copy = async () => {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked in iframe — user can still click the link
    }
  };

  // Decide which buttons to show based on lead status
  const canSendLink = ['new', 'verified', 'emailed', 'registered', 'attended'].includes(status);
  const canMarkPaid = ['offered', 'attended'].includes(status);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        {canSendLink && (
          <button
            onClick={onSendLink}
            disabled={pending}
            title="Mark attended, create Stripe Checkout session, send offer email"
            className="rounded-md border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400"
          >
            Send Stripe link
          </button>
        )}
        {canMarkPaid && (
          <button
            onClick={onMarkPaid}
            disabled={pending}
            title="Demo helper: simulates Stripe webhook (records payment, sends receipt)"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
          >
            Mark paid (demo)
          </button>
        )}
        {!canSendLink && !canMarkPaid && (
          <span className="text-[11px] text-neutral-400">{status === 'paid' ? '✓ paid' : '—'}</span>
        )}
      </div>
      {msg && <span className="max-w-[260px] text-right text-[10px] text-neutral-500">{msg}</span>}
      {checkoutUrl && (
        <div className="mt-1 flex items-center gap-1.5">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[10px] font-mono text-neutral-700 underline hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          >
            Open checkout ↗
          </a>
          <button
            onClick={copy}
            className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-[10px] font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {copied ? '✓ copied' : 'Copy URL'}
          </button>
        </div>
      )}
    </div>
  );
}
