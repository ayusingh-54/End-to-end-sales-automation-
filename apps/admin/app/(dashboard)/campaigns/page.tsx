import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { CampaignControls } from './controls';
import { StatusBadge } from '@/components/StatusBadge';

interface CampRow {
  id: string;
  name: string;
  status: string;
  daily_send_cap: number;
  started_at: string | null;
  ended_at: string | null;
  programs: { slug: string; name: string } | null;
  masterclasses: { topic: string } | null;
}

export const dynamic = 'force-dynamic';

export default async function Campaigns() {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('campaigns')
    .select(
      'id, name, status, daily_send_cap, started_at, ended_at, programs(slug, name), masterclasses(topic)',
    )
    .order('created_at', { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as CampRow[];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-neutral-500">
            One campaign = one program × one masterclass × one send window.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          + New campaign
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-3xl">🚀</p>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            No campaigns yet. A campaign drives the funnel — pick a program + masterclass and send
            caps.
          </p>
          <Link
            href="/campaigns/new"
            className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <table className="min-w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Program</th>
                <th className="px-4 py-2.5">Masterclass</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Daily cap</th>
                <th className="px-4 py-2.5">Started</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-100 transition last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
                >
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {c.programs?.name ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {c.masterclasses?.topic ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={c.status} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.daily_send_cap}</td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">
                    {c.started_at ? new Date(c.started_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <CampaignControls id={c.id} status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
