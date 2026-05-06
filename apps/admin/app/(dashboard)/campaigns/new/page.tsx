import { createSupabaseAdmin } from '@/lib/supabase/server';
import { createCampaign } from '../actions';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface ProgRow {
  id: string;
  name: string;
}
interface McRow {
  id: string;
  topic: string;
  scheduled_at: string;
}

export default async function NewCampaign() {
  const db = createSupabaseAdmin();
  const { data: programsData } = await db
    .from('programs')
    .select('id, name')
    .eq('status', 'active');
  const { data: mcData } = await db
    .from('masterclasses')
    .select('id, topic, scheduled_at')
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at');
  const programs = (programsData ?? []) as ProgRow[];
  const masterclasses = (mcData ?? []) as McRow[];

  async function action(form: FormData) {
    'use server';
    await createCampaign(form);
    redirect('/campaigns');
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
      <form action={action} className="mt-6 space-y-4 text-sm">
        <label className="block">
          <span className="block text-xs uppercase text-neutral-500">Name</span>
          <input
            name="name"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase text-neutral-500">Program</span>
          <select
            name="program_id"
            required
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs uppercase text-neutral-500">Masterclass</span>
          <select
            name="masterclass_id"
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">— none yet —</option>
            {masterclasses.map((m) => (
              <option key={m.id} value={m.id}>
                {m.topic} — {new Date(m.scheduled_at).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs uppercase text-neutral-500">Daily send cap</span>
          <input
            name="daily_send_cap"
            type="number"
            min={10}
            max={2000}
            defaultValue={200}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <button className="rounded bg-neutral-900 px-4 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
          Create
        </button>
      </form>
    </div>
  );
}
