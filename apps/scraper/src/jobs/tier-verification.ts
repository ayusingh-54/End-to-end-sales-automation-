import { db } from '../lib/supabase.js';
import { recordEvent } from '../lib/events.js';
import { logger } from '../lib/logger.js';

export interface TierSignals {
  tuition_usd?: number;
  nais_member?: boolean;
  tabs_member?: boolean;
  ssatb_accepted?: boolean;
  boarding_offered?: boolean;
  top5_matriculation?: boolean;
  endowment_50m?: boolean;
  class_size_15_or_less?: boolean;
}

export interface TierWeights {
  tuition_40k?: number;
  tuition_60k?: number;
  nais_member?: number;
  tabs_member?: number;
  ssatb_accepted?: number;
  boarding_offered?: number;
  top5_matriculation?: number;
  endowment_50m?: number;
  class_size_15_or_less?: number;
}

const DEFAULT_WEIGHTS: Required<TierWeights> = {
  tuition_40k: 35,
  tuition_60k: 15,
  nais_member: 15,
  tabs_member: 10,
  ssatb_accepted: 5,
  boarding_offered: 10,
  top5_matriculation: 10,
  endowment_50m: 5,
  class_size_15_or_less: 5,
};

export function scoreTier(signals: TierSignals, weights: TierWeights = {}): number {
  const w: Required<TierWeights> = { ...DEFAULT_WEIGHTS, ...weights };
  let s = 0;
  if ((signals.tuition_usd ?? 0) >= 40_000) s += w.tuition_40k;
  if ((signals.tuition_usd ?? 0) >= 60_000) s += w.tuition_60k;
  if (signals.nais_member) s += w.nais_member;
  if (signals.tabs_member) s += w.tabs_member;
  if (signals.ssatb_accepted) s += w.ssatb_accepted;
  if (signals.boarding_offered) s += w.boarding_offered;
  if (signals.top5_matriculation) s += w.top5_matriculation;
  if (signals.endowment_50m) s += w.endowment_50m;
  if (signals.class_size_15_or_less) s += w.class_size_15_or_less;
  return Math.min(100, s);
}

export function parseTuition(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/[, ]/g, '').match(/\$?(\d{4,6})/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}

interface RawRow {
  id: string;
  name: string | null;
  website: string | null;
  state: string | null;
  city: string | null;
  tuition_text: string | null;
  school_type: string | null;
  source: string;
}

interface RuleRow {
  min_tuition_usd: number;
  threshold_score: number;
  scoring_weights: TierWeights;
  exclude_types: string[];
  school_types: string[];
}

export async function runTierVerification(programSlug: string): Promise<{
  evaluated: number;
  promoted: number;
}> {
  await recordEvent('tier_verification', 'started');

  const { data: prog, error: progErr } = await db()
    .from('programs')
    .select('id')
    .eq('slug', programSlug)
    .single();
  if (progErr || !prog) throw new Error(`program_not_found: ${programSlug}`);

  const { data: rules, error: ruleErr } = await db()
    .from('school_tier_rules')
    .select('min_tuition_usd, threshold_score, scoring_weights, exclude_types, school_types')
    .eq('program_id', (prog as { id: string }).id)
    .limit(1)
    .single();
  if (ruleErr || !rules) throw new Error('tier_rules_missing');
  const rule = rules as RuleRow;

  const { data: rawRows, error: rawErr } = await db()
    .from('schools_raw')
    .select('id, name, website, state, city, tuition_text, school_type, source')
    .order('fetched_at', { ascending: false })
    .limit(1000);
  if (rawErr) throw rawErr;

  let evaluated = 0;
  let promoted = 0;

  for (const r of (rawRows ?? []) as RawRow[]) {
    if (!r.name) continue;
    evaluated += 1;

    if (rule.exclude_types?.some((t) => (r.school_type ?? '').toLowerCase().includes(t))) {
      continue;
    }

    const tuition = parseTuition(r.tuition_text);
    const signals: TierSignals = {
      nais_member: r.source === 'nais_directory',
      tabs_member: r.source === 'tabs_directory',
      boarding_offered: (r.school_type ?? '').toLowerCase().includes('boarding'),
    };
    if (tuition !== undefined) signals.tuition_usd = tuition;
    const score = scoreTier(signals, rule.scoring_weights);
    const verified = score >= rule.threshold_score && (tuition ?? 0) >= rule.min_tuition_usd;

    const { error: upErr } = await db()
      .from('schools')
      .upsert(
        {
          name: r.name,
          website: r.website,
          country: 'US',
          state: r.state,
          city: r.city,
          tuition_usd: tuition ?? null,
          school_type: r.school_type,
          source: r.source,
          tier_match_score: score,
          tier_verified: verified,
          tier_signals: signals as unknown as Record<string, unknown>,
          raw_id: r.id,
        },
        { onConflict: 'website' },
      );
    if (upErr) {
      logger.warn({ err: upErr, school: r.name }, 'upsert_failed');
      continue;
    }
    if (verified) promoted += 1;
  }

  await recordEvent('tier_verification', 'success', {
    payload: { evaluated, promoted, threshold: rule.threshold_score },
  });
  return { evaluated, promoted };
}
