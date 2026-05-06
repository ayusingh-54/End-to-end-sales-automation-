import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { ScrapeNowButton } from './scrape-now-button';
import { EnrichButton } from './enrich-button';

const APOLLO_ON = Boolean(process.env.APOLLO_API_KEY);

interface SchoolRow {
  id: string;
  name: string;
  website: string | null;
  state: string | null;
  tuition_usd: number | null;
  school_type: string | null;
  tier_match_score: number | null;
  tier_verified: boolean;
}

export const dynamic = 'force-dynamic';

export default async function Schools() {
  const db = createSupabaseAdmin();
  const [schoolsRes, rawCount, verifiedCount] = await Promise.all([
    db
      .from('schools')
      .select('id, name, website, state, tuition_usd, school_type, tier_match_score, tier_verified')
      .neq('source', 'self_register') // hide placeholder schools auto-created when leads register
      .order('tier_match_score', { ascending: false, nullsFirst: false })
      .limit(200),
    db.from('schools_raw').select('id', { count: 'exact', head: true }),
    db.from('schools').select('id', { count: 'exact', head: true }).eq('tier_verified', true),
  ]);
  const rows = (schoolsRes.data ?? []) as SchoolRow[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        <ScrapeNowButton />
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        {rawCount.count ?? 0} raw / {verifiedCount.count ?? 0} verified · top 200 by tier-match
        score below.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm dark:border-neutral-700">
          <p className="text-neutral-600 dark:text-neutral-400">
            No schools yet. Click <strong>Run scraper now</strong> above to fetch from NAIS / TABS /
            BSR seed sources.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Or run from the CLI:{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
              pnpm -F @lwl/scraper dev discover
            </code>{' '}
            then{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
              pnpm -F @lwl/scraper dev tier
            </code>
          </p>
          <p className="mt-3">
            <Link
              href="/logs?stage=school_discovery"
              className="text-xs text-neutral-500 underline"
            >
              View discovery events in Logs
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">State</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Tuition</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Verified</th>
                <th className="py-2 pr-4">Apollo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4">
                    {s.website ? (
                      <a href={s.website} target="_blank" rel="noreferrer" className="underline">
                        {s.name}
                      </a>
                    ) : (
                      s.name
                    )}
                  </td>
                  <td className="py-2 pr-4">{s.state}</td>
                  <td className="py-2 pr-4">{s.school_type}</td>
                  <td className="py-2 pr-4">
                    {s.tuition_usd ? `$${s.tuition_usd.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-2 pr-4 font-mono">{s.tier_match_score ?? '—'}</td>
                  <td className="py-2 pr-4">{s.tier_verified ? '✓' : ''}</td>
                  <td className="py-2 pr-4">
                    {APOLLO_ON && s.tier_verified ? (
                      <EnrichButton schoolId={s.id} name={s.name} />
                    ) : (
                      <span className="text-xs text-neutral-500">{APOLLO_ON ? '—' : 'no key'}</span>
                    )}
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
