import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { LEAD_STATUSES } from '@lwl/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { LeadActionsCell } from './lead-actions-cell';

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string;
  status: string;
  email_verified: boolean;
  role_verified: boolean;
  created_at: string;
  schools: { name: string } | null;
}

export const dynamic = 'force-dynamic';

export default async function Leads({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const db = createSupabaseAdmin();
  let query = db
    .from('leads')
    .select(
      'id, first_name, last_name, role, email, status, email_verified, role_verified, created_at, schools(name)',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (searchParams.status) query = query.eq('status', searchParams.status);
  if (searchParams.q) query = query.ilike('email', `%${searchParams.q}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as LeadRow[];

  const exportHref = `/api/leads/export${searchParams.status ? `?status=${searchParams.status}` : ''}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {rows.length} of up to 200 most recent. Filter by status or email substring.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:hover:bg-neutral-900"
        >
          ⬇ Export CSV
        </a>
      </div>

      <form className="mt-5 flex flex-wrap gap-2 text-sm" method="get">
        <input
          name="q"
          placeholder="Search by email…"
          defaultValue={searchParams.q ?? ''}
          className="min-w-[200px] flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-neutral-900 px-4 py-1.5 font-medium text-white dark:bg-white dark:text-neutral-900">
          Filter
        </button>
        {(searchParams.q || searchParams.status) && (
          <Link
            href="/leads"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center dark:border-neutral-700 dark:bg-neutral-950">
          <p className="text-3xl">👀</p>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            {searchParams.q || searchParams.status
              ? 'No leads match this filter.'
              : 'No leads yet — leads appear when:'}
          </p>
          {!(searchParams.q || searchParams.status) && (
            <ul className="mx-auto mt-3 max-w-md text-left text-xs text-neutral-500">
              <li className="mt-1">
                • Someone registers via{' '}
                <Link href="/programs" className="underline">
                  /m/&lt;slug&gt;
                </Link>
              </li>
              <li className="mt-1">
                • Apollo enriches a verified school (
                <Link href="/schools" className="underline">
                  Schools → Enrich
                </Link>
                )
              </li>
              <li className="mt-1">• A campaign sends invites and gets replies</li>
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <table className="min-w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">School</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Verified</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-neutral-100 transition last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/50"
                >
                  <td className="px-4 py-2.5 font-medium">
                    {[r.first_name, r.last_name].filter(Boolean).join(' ') || (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {r.role ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-400">
                    {r.schools?.name ?? <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                    {r.email}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={r.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 text-[10px]">
                      {r.email_verified && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          email
                        </span>
                      )}
                      {r.role_verified && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          role
                        </span>
                      )}
                      {!r.email_verified && !r.role_verified && (
                        <span className="text-neutral-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-neutral-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <LeadActionsCell leadId={r.id} status={r.status} />
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
