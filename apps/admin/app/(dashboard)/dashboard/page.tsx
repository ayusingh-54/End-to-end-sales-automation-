import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';

interface FunnelRow {
  campaign_id: string;
  name: string;
  status: string;
  emails_sent: number;
  opened: number;
  clicked: number;
  registered: number;
  attended: number;
  offered: number;
  paid: number;
  revenue_cents: number;
}

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const db = createSupabaseAdmin();

  const [funnel, programs, masterclasses, campaigns, leads, schools] = await Promise.all([
    db.from('campaign_funnel').select('*').order('campaign_id', { ascending: false }),
    db
      .from('programs')
      .select('id, slug, name', { count: 'exact', head: true })
      .eq('status', 'active'),
    db.from('masterclasses').select('id', { count: 'exact', head: true }),
    db.from('campaigns').select('id', { count: 'exact', head: true }),
    db.from('leads').select('id', { count: 'exact', head: true }),
    db.from('schools').select('id', { count: 'exact', head: true }).eq('tier_verified', true),
  ]);

  const counts = {
    programs: programs.count ?? 0,
    masterclasses: masterclasses.count ?? 0,
    campaigns: campaigns.count ?? 0,
    leads: leads.count ?? 0,
    schools: schools.count ?? 0,
  };

  const wiring = {
    supabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    resend: Boolean(process.env.RESEND_API_KEY),
    instantly: Boolean(process.env.INSTANTLY_API_KEY),
    apollo: Boolean(process.env.APOLLO_API_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    zoom: Boolean(process.env.ZOOM_CLIENT_ID),
  };

  const checklist = [
    {
      done: counts.programs > 0,
      label: 'Schema applied + program seeded',
      cta: { label: 'View programs', href: '/programs' },
    },
    {
      done: wiring.supabase,
      label: 'Supabase keys wired',
      cta: { label: 'Settings', href: '/settings' },
    },
    {
      done: counts.masterclasses > 0,
      label: 'At least one masterclass scheduled',
      cta: { label: 'Add masterclass', href: '/programs' },
    },
    {
      done: wiring.resend || wiring.instantly,
      label: 'Email provider key set (Resend or Instantly)',
      cta: { label: 'Settings', href: '/settings' },
    },
    {
      done: wiring.stripe,
      label: 'Stripe test key set',
      cta: { label: 'Settings', href: '/settings' },
    },
    {
      done: counts.campaigns > 0,
      label: 'At least one campaign created',
      cta: { label: 'New campaign', href: '/campaigns/new' },
    },
  ];

  const rows = ((funnel.data ?? []) as FunnelRow[]).slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Live numbers from `campaign_funnel`. No app-side aggregation.
      </p>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <Stat label="Programs" value={counts.programs} href="/programs" />
        <Stat label="Masterclasses" value={counts.masterclasses} href="/programs" />
        <Stat label="Campaigns" value={counts.campaigns} href="/campaigns" />
        <Stat label="Verified schools" value={counts.schools} href="/schools" />
        <Stat label="Leads" value={counts.leads} href="/leads" />
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Operator quick-start
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${item.done ? 'bg-emerald-600 text-white' : 'border border-neutral-400 text-neutral-400'}`}
                >
                  {item.done ? '✓' : ''}
                </span>
                <span className={item.done ? 'text-neutral-500 line-through' : ''}>
                  {item.label}
                </span>
              </span>
              {!item.done && (
                <Link
                  href={item.cta.href}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  {item.cta.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Integration wiring
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <Wire label="Supabase" on={wiring.supabase} />
          <Wire label="Resend (transactional)" on={wiring.resend} />
          <Wire label="Instantly (cold)" on={wiring.instantly} />
          <Wire label="Apollo" on={wiring.apollo} />
          <Wire label="Stripe" on={wiring.stripe} />
          <Wire label="Zoom" on={wiring.zoom} />
        </div>
      </section>

      <h2 className="mt-10 text-lg font-medium">Funnel by campaign</h2>
      {funnel.error && (
        <p className="mt-2 text-sm text-red-600">Could not load funnel: {funnel.error.message}</p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Campaign</th>
              <th className="py-2 pr-4">Sent</th>
              <th className="py-2 pr-4">Opened</th>
              <th className="py-2 pr-4">Clicked</th>
              <th className="py-2 pr-4">Registered</th>
              <th className="py-2 pr-4">Attended</th>
              <th className="py-2 pr-4">Offered</th>
              <th className="py-2 pr-4">Paid</th>
              <th className="py-2 pr-4">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-neutral-500">
                  No campaigns running yet. Complete the quick-start above, then{' '}
                  <Link href="/campaigns/new" className="underline">
                    create your first campaign
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.campaign_id}
                  className="border-b border-neutral-100 dark:border-neutral-900"
                >
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">{r.emails_sent}</td>
                  <td className="py-2 pr-4">{r.opened}</td>
                  <td className="py-2 pr-4">{r.clicked}</td>
                  <td className="py-2 pr-4">{r.registered}</td>
                  <td className="py-2 pr-4">{r.attended}</td>
                  <td className="py-2 pr-4">{r.offered}</td>
                  <td className="py-2 pr-4 font-semibold">{r.paid}</td>
                  <td className="py-2 pr-4">${(r.revenue_cents / 100).toFixed(0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

function Wire({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-2 w-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-neutral-400'}`}
      />
      <span className={on ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500'}>
        {label}
      </span>
    </div>
  );
}
