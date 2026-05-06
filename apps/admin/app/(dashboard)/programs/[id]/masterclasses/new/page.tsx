import { notFound } from 'next/navigation';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { MasterclassForm } from './form';

export const dynamic = 'force-dynamic';

interface ProgRow {
  id: string;
  name: string;
}

export default async function NewMasterclass({ params }: { params: { id: string } }) {
  const db = createSupabaseAdmin();
  const { data } = await db.from('programs').select('id, name').eq('id', params.id).maybeSingle();
  const prog = data as ProgRow | null;
  if (!prog) notFound();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight">New masterclass</h1>
      <p className="mt-1 text-sm text-neutral-500">For program: {prog.name}</p>
      <MasterclassForm programId={params.id} />
    </div>
  );
}
