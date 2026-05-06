import Link from 'next/link';
import { createSupabaseAdmin } from '@/lib/supabase/server';

interface ProgRow {
  id: string;
  slug: string;
  name: string;
  standard_price_cents: number;
  offer_price_cents: number;
  offer_window_hours: number;
  status: string;
}

interface McRow {
  id: string;
  program_id: string;
  topic: string;
  mentor_name: string;
  scheduled_at: string;
  status: string;
  registration_page_slug: string;
}

export const dynamic = 'force-dynamic';

export default async function Programs() {
  const db = createSupabaseAdmin();
  const [progRes, mcRes] = await Promise.all([
    db.from('programs').select('*').order('created_at'),
    db
      .from('masterclasses')
      .select('id, program_id, topic, mentor_name, scheduled_at, status, registration_page_slug')
      .order('scheduled_at', { ascending: false })
      .limit(50),
  ]);
  const programs = (progRes.data ?? []) as ProgRow[];
  const masterclasses = (mcRes.data ?? []) as McRow[];

  return (
    <div className="space-y-12">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
          <Link
            href="/programs/new"
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            New program
          </Link>
        </div>
        <table className="mt-6 min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Slug</th>
              <th className="py-2 pr-4">Standard</th>
              <th className="py-2 pr-4">Offer</th>
              <th className="py-2 pr-4">Window</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-neutral-500">
                  No programs yet — schema/seed not applied.
                </td>
              </tr>
            ) : (
              programs.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{p.slug}</td>
                  <td className="py-2 pr-4">${(p.standard_price_cents / 100).toFixed(0)}</td>
                  <td className="py-2 pr-4">${(p.offer_price_cents / 100).toFixed(0)}</td>
                  <td className="py-2 pr-4">{p.offer_window_hours}h</td>
                  <td className="py-2 pr-4">{p.status}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/programs/${p.id}/masterclasses/new`}
                      className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
                    >
                      + Masterclass
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-xl font-medium tracking-tight">Masterclasses</h2>
        <p className="mt-1 text-sm text-neutral-500">
          The masterclass is the hook for the campaign. Add one to enable starting a campaign.
        </p>
        <table className="mt-6 min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800">
              <th className="py-2 pr-4">Topic</th>
              <th className="py-2 pr-4">Mentor</th>
              <th className="py-2 pr-4">Scheduled</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Reg page</th>
            </tr>
          </thead>
          <tbody>
            {masterclasses.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-neutral-500">
                  No masterclasses yet. Click <span className="font-mono">+ Masterclass</span> on a
                  program above.
                </td>
              </tr>
            ) : (
              masterclasses.map((m) => (
                <tr key={m.id} className="border-b border-neutral-100 dark:border-neutral-900">
                  <td className="py-2 pr-4">{m.topic}</td>
                  <td className="py-2 pr-4">{m.mentor_name}</td>
                  <td className="py-2 pr-4 text-xs">{new Date(m.scheduled_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs">{m.status}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={`/m/${m.registration_page_slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs underline"
                    >
                      /m/{m.registration_page_slug}
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
