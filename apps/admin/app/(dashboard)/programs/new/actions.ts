'use server';
import { z } from 'zod';
import { createSupabaseAdmin } from '@/lib/supabase/server';

const Create = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  standard_price_cents: z.coerce.number().int().nonnegative(),
  offer_price_cents: z.coerce.number().int().nonnegative(),
  offer_window_hours: z.coerce.number().int().positive().default(72),
});

const Clone = z.object({
  source_id: z.string().uuid(),
  new_slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/),
  new_name: z.string().min(1),
});

interface RoleRow {
  role_title: string;
  synonyms: string[];
}
interface RuleRow {
  min_tuition_usd: number;
  country: string;
  school_types: string[];
  exclude_types: string[];
  scoring_weights: Record<string, number>;
  threshold_score: number;
}
interface TplRow {
  kind: string;
  subject: string;
  body_md: string;
  variables: string[];
}

export async function createProgram(form: FormData) {
  const parsed = Create.parse(Object.fromEntries(form));
  const db = createSupabaseAdmin();
  const { error } = await db.from('programs').insert({ ...parsed, status: 'draft' });
  if (error) throw error;
}

export async function cloneProgram(form: FormData) {
  const { source_id, new_slug, new_name } = Clone.parse(Object.fromEntries(form));
  const db = createSupabaseAdmin();

  const { data: srcData, error: srcErr } = await db
    .from('programs')
    .select('*')
    .eq('id', source_id)
    .single();
  if (srcErr || !srcData) throw srcErr ?? new Error('source_not_found');
  const src = srcData as {
    standard_price_cents: number;
    offer_price_cents: number;
    offer_window_hours: number;
  };

  const { data: newProg, error: insErr } = await db
    .from('programs')
    .insert({
      slug: new_slug,
      name: new_name,
      standard_price_cents: src.standard_price_cents,
      offer_price_cents: src.offer_price_cents,
      offer_window_hours: src.offer_window_hours,
      status: 'draft',
    })
    .select('id')
    .single();
  if (insErr) throw insErr;
  const newId = (newProg as { id: string }).id;

  const { data: roles } = await db
    .from('target_roles')
    .select('role_title, synonyms')
    .eq('program_id', source_id);
  if (roles && roles.length > 0) {
    await db
      .from('target_roles')
      .insert((roles as RoleRow[]).map((r) => ({ ...r, program_id: newId })));
  }

  const { data: rules } = await db
    .from('school_tier_rules')
    .select(
      'min_tuition_usd, country, school_types, exclude_types, scoring_weights, threshold_score',
    )
    .eq('program_id', source_id);
  if (rules && rules.length > 0) {
    await db
      .from('school_tier_rules')
      .insert((rules as RuleRow[]).map((r) => ({ ...r, program_id: newId })));
  }

  const { data: tpls } = await db
    .from('email_templates')
    .select('kind, subject, body_md, variables')
    .eq('program_id', source_id);
  if (tpls && tpls.length > 0) {
    await db
      .from('email_templates')
      .insert((tpls as TplRow[]).map((t) => ({ ...t, program_id: newId })));
  }
}
