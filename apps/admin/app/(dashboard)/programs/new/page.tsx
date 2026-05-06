import { redirect } from 'next/navigation';
import { createProgram, cloneProgram } from './actions';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ProgRow {
  id: string;
  slug: string;
  name: string;
}

export default async function NewProgram() {
  const db = createSupabaseAdmin();
  const { data } = await db.from('programs').select('id, slug, name');
  const existing = (data ?? []) as ProgRow[];

  async function create(form: FormData) {
    'use server';
    await createProgram(form);
    redirect('/programs');
  }
  async function clone(form: FormData) {
    'use server';
    await cloneProgram(form);
    redirect('/programs');
  }

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-10 md:grid-cols-2">
      <section>
        <h2 className="text-lg font-medium">Create from blank</h2>
        <form action={create} className="mt-4 space-y-3 text-sm">
          <input
            name="slug"
            required
            placeholder="slug-with-dashes"
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="name"
            required
            placeholder="Program name"
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="standard_price_cents"
            type="number"
            min={0}
            required
            placeholder="Standard price (cents)"
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="offer_price_cents"
            type="number"
            min={0}
            required
            placeholder="Offer price (cents)"
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="offer_window_hours"
            type="number"
            min={1}
            defaultValue={72}
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="rounded bg-neutral-900 px-3 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
            Create
          </button>
        </form>
      </section>
      <section>
        <h2 className="text-lg font-medium">Clone an existing program</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Copies target_roles, school_tier_rules, and email_templates. Edit afterwards.
        </p>
        <form action={clone} className="mt-4 space-y-3 text-sm">
          <select
            name="source_id"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {existing.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
          <input
            name="new_slug"
            required
            placeholder="new-slug"
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            name="new_name"
            required
            placeholder="New name"
            className="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button className="rounded bg-neutral-900 px-3 py-2 font-medium text-white dark:bg-white dark:text-neutral-900">
            Clone
          </button>
        </form>
      </section>
    </div>
  );
}
