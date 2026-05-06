import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { Icon, type IconName } from '@/components/Icon';

interface RecentLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  status: string;
  created_at: string;
  schools: { name: string } | null;
}

interface RecentEvent {
  id: string;
  stage: string;
  status: string;
  created_at: string;
}

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const db = createSupabaseAdmin();

  const [progRes, mcRes, leadsCount, schoolsCount, campRes, payRes, recentLeads, recentEvents] =
    await Promise.all([
      db.from('programs').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('masterclasses').select('id', { count: 'exact', head: true }),
      db.from('leads').select('id', { count: 'exact', head: true }),
      db.from('schools').select('id', { count: 'exact', head: true }).eq('tier_verified', true),
      db.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'running'),
      db.from('payments').select('amount_cents').eq('status', 'succeeded'),
      db
        .from('leads')
        .select('id, first_name, last_name, email, status, created_at, schools(name)')
        .order('created_at', { ascending: false })
        .limit(5),
      db
        .from('pipeline_events')
        .select('id, stage, status, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

  const stats = {
    programs: progRes.count ?? 0,
    masterclasses: mcRes.count ?? 0,
    leads: leadsCount.count ?? 0,
    schools: schoolsCount.count ?? 0,
    campaigns: campRes.count ?? 0,
    revenueCents: ((payRes.data ?? []) as { amount_cents: number }[]).reduce(
      (sum, r) => sum + r.amount_cents,
      0,
    ),
  };

  const wiring = [
    { name: 'Supabase', on: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY), tone: 'core' as const },
    { name: 'Resend', on: Boolean(process.env.RESEND_API_KEY), tone: 'core' as const },
    { name: 'Stripe', on: Boolean(process.env.STRIPE_SECRET_KEY), tone: 'core' as const },
    { name: 'Apollo', on: Boolean(process.env.APOLLO_API_KEY), tone: 'opt' as const },
    { name: 'Instantly', on: Boolean(process.env.INSTANTLY_API_KEY), tone: 'opt' as const },
    { name: 'Zoom', on: Boolean(process.env.ZOOM_CLIENT_ID), tone: 'opt' as const },
  ];
  const wiredCount = wiring.filter((w) => w.on).length;

  const leads = (recentLeads.data ?? []) as unknown as RecentLead[];
  const events = (recentEvents.data ?? []) as RecentEvent[];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900">
      <header className="border-b border-neutral-200 bg-white/70 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 text-[11px] font-bold text-white shadow-sm">
              LWL
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Learn with Leaders — FDF Pipeline
            </span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            Open dashboard
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-12 pb-6">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Operator console
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          End-to-end sales automation for the Future Doctors Fellowship
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Scrape → verify → invite → register → masterclass → 72-hour offer → Stripe → resource
          delivery → re-engage. One pipeline, replicable across every LWL programme.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <Stat href="/programs" label="Programs" value={stats.programs} icon="book" />
          <Stat
            href="/programs"
            label="Masterclasses"
            value={stats.masterclasses}
            icon="graduation"
          />
          <Stat href="/schools" label="Verified schools" value={stats.schools} icon="building" />
          <Stat href="/leads" label="Leads" value={stats.leads} icon="users" />
          <Stat
            href="/campaigns"
            label="Running campaigns"
            value={stats.campaigns}
            icon="megaphone"
          />
          <Stat
            href="/dashboard"
            label="Revenue"
            value={`$${(stats.revenueCents / 100).toFixed(0)}`}
            icon="wallet"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              Full dashboard
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionCard
              href="/programs"
              title="Add masterclass"
              desc="Schedule a session, get a public registration link"
              icon="calendar"
            />
            <ActionCard
              href="/schools"
              title="Run scraper"
              desc="Pull elite US schools into the funnel (no Apollo cost)"
              icon="search"
            />
            <ActionCard
              href="/campaigns/new"
              title="Start a campaign"
              desc="Pick a program + masterclass + send-cap, hit Resume"
              icon="rocket"
            />
            <ActionCard
              href="/leads"
              title="View leads"
              desc="Filter by status, export CSV, see registration history"
              icon="users"
            />
            <ActionCard
              href="/templates"
              title="Edit templates"
              desc="12 email kinds: invite, reminders, offer sequence, receipts"
              icon="mail"
            />
            <ActionCard
              href="/logs"
              title="Pipeline events"
              desc="Every stage of every campaign — debug failures here"
              icon="activity"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Integration wiring</h2>
            <span className="text-xs text-neutral-500">
              {wiredCount}/{wiring.length} configured
            </span>
          </div>
          <ul className="space-y-2.5">
            {wiring.map((w) => (
              <li
                key={w.name}
                className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 dark:border-neutral-900"
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      w.on
                        ? 'bg-emerald-500'
                        : w.tone === 'core'
                          ? 'bg-amber-500'
                          : 'bg-neutral-400'
                    }`}
                  />
                  <span className={w.on ? 'font-medium' : 'text-neutral-500'}>{w.name}</span>
                  {w.tone === 'core' && !w.on && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                      core
                    </span>
                  )}
                </span>
                {w.on ? (
                  <Icon name="check" size={14} className="text-emerald-500" />
                ) : (
                  <Link
                    href="/settings"
                    className="text-xs text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    Configure
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-neutral-500">
            Core integrations are required for the demo. Optional ones are bonus — system gracefully
            degrades without them.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent leads</h2>
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              View all
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No leads yet. Run the scraper or wait for self-registrations.
            </p>
          ) : (
            <ul className="space-y-2">
              {leads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between border-b border-neutral-100 pb-2 text-sm last:border-b-0 dark:border-neutral-900"
                >
                  <div>
                    <p className="font-medium">
                      {[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {l.schools?.name ?? '—'} · {timeAgo(l.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pipeline activity</h2>
            <Link
              href="/logs"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              View all
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-neutral-500">No events yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.id}
                  className={`flex items-center justify-between border-b border-neutral-100 pb-2 text-sm last:border-b-0 dark:border-neutral-900 ${e.status === 'error' ? 'text-red-700 dark:text-red-400' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex h-2 w-2 rounded-full ${statusDot(e.status)}`} />
                    <span className="font-mono text-xs">{e.stage}</span>
                  </span>
                  <span className="text-xs text-neutral-500">{timeAgo(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-neutral-500">
          © Learn with Leaders · FDF pilot console · live data, no cached aggregates
        </div>
      </footer>
    </main>
  );
}

function Stat({
  href,
  label,
  value,
  icon,
}: {
  href: string;
  label: string;
  value: number | string;
  icon: IconName;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-600"
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </p>
        <span className="text-neutral-400 transition group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

function ActionCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: IconName;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-neutral-200 p-4 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <Icon name={icon} size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>
      </div>
      <span className="ml-auto self-center text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
        <Icon name="arrow-right" size={16} />
      </span>
    </Link>
  );
}

function statusDot(status: string): string {
  if (status === 'error') return 'bg-red-500';
  if (status === 'success') return 'bg-emerald-500';
  if (status === 'started') return 'bg-blue-500';
  return 'bg-neutral-400';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
