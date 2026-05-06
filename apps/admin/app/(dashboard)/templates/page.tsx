import { createSupabaseAdmin } from '@/lib/supabase/server';

interface TplRow {
  id: string;
  kind: string;
  subject: string;
  variables: string[];
  programs: { name: string; slug: string } | null;
}

export const dynamic = 'force-dynamic';

export default async function Templates() {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('email_templates')
    .select('id, kind, subject, variables, programs(name, slug)')
    .order('program_id');
  const rows = (data ?? []) as unknown as TplRow[];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Email templates</h1>
      <table className="mt-6 min-w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800">
            <th className="py-2 pr-4">Program</th>
            <th className="py-2 pr-4">Kind</th>
            <th className="py-2 pr-4">Subject</th>
            <th className="py-2 pr-4">Variables</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
              <td className="py-2 pr-4">{r.programs?.name}</td>
              <td className="py-2 pr-4 font-mono text-xs">{r.kind}</td>
              <td className="py-2 pr-4">{r.subject}</td>
              <td className="py-2 pr-4 font-mono text-xs text-neutral-500">
                {r.variables?.join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
