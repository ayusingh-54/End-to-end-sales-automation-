import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { PIPELINE_STAGES } from '@lwl/shared';

interface EvtRow {
  id: string;
  stage: string;
  status: string;
  error_text: string | null;
  created_at: string;
  lead_id: string | null;
  campaign_id: string | null;
}

export const dynamic = 'force-dynamic';

export default async function Logs({ searchParams }: { searchParams: { stage?: string } }) {
  let rows: EvtRow[] = [];
  let loadError: string | null = null;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    loadError =
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to load events.';
  } else {
    try {
      const db = createSupabaseAdmin();
      let q = db
        .from('pipeline_events')
        .select('id, stage, status, error_text, created_at, lead_id, campaign_id')
        .order('created_at', { ascending: false })
        .limit(200);
      if (searchParams.stage) q = q.eq('stage', searchParams.stage);
      const { data, error } = await q;
      if (error) {
        loadError = error.message;
      } else {
        rows = (data ?? []) as EvtRow[];
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : 'Unknown error loading pipeline events.';
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Pipeline events</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Every stage of every campaign writes here. Filter by stage to investigate failures.
      </p>

      <form className="mt-4 text-sm">
        <select
          name="stage"
          defaultValue={searchParams.stage ?? ''}
          className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="">All stages</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="ml-2 rounded bg-neutral-900 px-3 py-1 text-white dark:bg-white dark:text-neutral-900">
          Filter
        </button>
      </form>

      {loadError ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-300">
            Couldn’t load pipeline events
          </p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-red-700 dark:text-red-400">
            {loadError}
          </pre>
          <p className="mt-2 text-xs text-red-700 dark:text-red-400">
            Check Supabase env vars in{' '}
            <Link href="/settings" className="underline">
              Settings
            </Link>{' '}
            and confirm the <code>pipeline_events</code> table has been migrated.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm dark:border-neutral-700">
          <p className="text-neutral-600 dark:text-neutral-400">
            No pipeline events yet — this is normal until something runs.
          </p>
          <p className="mt-2 text-neutral-500">Events appear here when:</p>
          <ul className="mt-2 inline-block text-left text-xs text-neutral-500">
            <li>
              • Scraper finds schools (run from{' '}
              <Link href="/schools" className="underline">
                Schools
              </Link>
              )
            </li>
            <li>• Apollo enriches leads</li>
            <li>
              • Someone registers via <code>/m/&lt;slug&gt;</code>
            </li>
            <li>• A campaign sends invites or offers</li>
            <li>• A lead pays (Stripe webhook)</li>
          </ul>
          <p className="mt-4">
            <Link
              href="/dashboard"
              className="inline-block rounded bg-neutral-900 px-3 py-1.5 text-xs text-white dark:bg-white dark:text-neutral-900"
            >
              Back to quick-start
            </Link>
          </p>
        </div>
      ) : (
        <table className="mt-6 min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Stage</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-neutral-100 dark:border-neutral-900 ${r.status === 'error' ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
              >
                <td className="py-2 pr-4 text-xs text-neutral-500">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{r.stage}</td>
                <td className="py-2 pr-4 text-xs">{r.status}</td>
                <td className="py-2 pr-4 font-mono text-xs text-red-700 dark:text-red-400">
                  {r.error_text ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
