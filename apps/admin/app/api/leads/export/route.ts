import { createSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Row {
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  email: string;
  status: string;
  email_verified: boolean;
  role_verified: boolean;
  schools: { name: string } | null;
  created_at: string;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const db = createSupabaseAdmin();
  let q = db
    .from('leads')
    .select(
      'first_name, last_name, role, email, status, email_verified, role_verified, schools(name), created_at',
    )
    .order('created_at', { ascending: false })
    .limit(5000);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];

  const header = [
    'first_name',
    'last_name',
    'role',
    'school',
    'email',
    'status',
    'email_verified',
    'role_verified',
    'created_at',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.first_name,
        r.last_name,
        r.role,
        r.schools?.name,
        r.email,
        r.status,
        r.email_verified,
        r.role_verified,
        r.created_at,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="leads.csv"',
    },
  });
}
