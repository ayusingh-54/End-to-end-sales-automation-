'use server';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdmin } from '@/lib/supabase/server';

// In-process implementation of the discovery + tier-verification jobs so the
// operator can trigger them from the admin UI without spinning up the scraper
// service. Mirrors apps/scraper/src/jobs but uses the admin's supabase client.

interface SchoolSeed {
  name: string;
  website: string | null;
  state: string | null;
  city: string | null;
  tuition_text: string | null;
  school_type: string | null;
  source: string;
  raw: Record<string, unknown>;
}

const FALLBACK_SEEDS: SchoolSeed[] = [
  {
    name: 'Phillips Academy Andover',
    website: 'https://www.andover.edu',
    state: 'MA',
    city: 'Andover',
    tuition_text: '$71,300',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Phillips Exeter Academy',
    website: 'https://www.exeter.edu',
    state: 'NH',
    city: 'Exeter',
    tuition_text: '$70,790',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Choate Rosemary Hall',
    website: 'https://www.choate.edu',
    state: 'CT',
    city: 'Wallingford',
    tuition_text: '$72,900',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Deerfield Academy',
    website: 'https://deerfield.edu',
    state: 'MA',
    city: 'Deerfield',
    tuition_text: '$72,800',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'The Lawrenceville School',
    website: 'https://www.lawrenceville.org',
    state: 'NJ',
    city: 'Lawrenceville',
    tuition_text: '$76,150',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Hotchkiss School',
    website: 'https://www.hotchkiss.org',
    state: 'CT',
    city: 'Lakeville',
    tuition_text: '$72,500',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Groton School',
    website: 'https://www.groton.org',
    state: 'MA',
    city: 'Groton',
    tuition_text: '$74,160',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: "St. Paul's School",
    website: 'https://www.sps.edu',
    state: 'NH',
    city: 'Concord',
    tuition_text: '$72,180',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Milton Academy',
    website: 'https://www.milton.edu',
    state: 'MA',
    city: 'Milton',
    tuition_text: '$70,650',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Northfield Mount Hermon',
    website: 'https://www.nmhschool.org',
    state: 'MA',
    city: 'Mount Hermon',
    tuition_text: '$71,500',
    school_type: 'boarding',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Trinity School NYC',
    website: 'https://www.trinityschoolnyc.org',
    state: 'NY',
    city: 'New York',
    tuition_text: '$66,280',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Horace Mann School',
    website: 'https://www.horacemann.org',
    state: 'NY',
    city: 'Bronx',
    tuition_text: '$64,540',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Dalton School',
    website: 'https://www.dalton.org',
    state: 'NY',
    city: 'New York',
    tuition_text: '$65,920',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Collegiate School',
    website: 'https://www.collegiateschool.org',
    state: 'NY',
    city: 'New York',
    tuition_text: '$66,450',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Brearley School',
    website: 'https://www.brearley.org',
    state: 'NY',
    city: 'New York',
    tuition_text: '$64,000',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Spence School',
    website: 'https://www.spenceschool.org',
    state: 'NY',
    city: 'New York',
    tuition_text: '$64,300',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Harvard-Westlake School',
    website: 'https://www.hw.com',
    state: 'CA',
    city: 'Studio City',
    tuition_text: '$48,500',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Sidwell Friends School',
    website: 'https://www.sidwell.edu',
    state: 'DC',
    city: 'Washington',
    tuition_text: '$53,015',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'St. Albans School',
    website: 'https://www.stalbansschool.org',
    state: 'DC',
    city: 'Washington',
    tuition_text: '$60,150',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
  {
    name: 'Lakeside School',
    website: 'https://www.lakesideschool.org',
    state: 'WA',
    city: 'Seattle',
    tuition_text: '$45,500',
    school_type: 'private',
    source: 'curated_seed',
    raw: {},
  },
];

function parseTuition(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/[, ]/g, '').match(/\$?(\d{4,6})/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

interface TierSignals {
  tuition_usd?: number;
  nais_member?: boolean;
  tabs_member?: boolean;
  boarding_offered?: boolean;
  top5_matriculation?: boolean;
}

function scoreTier(s: TierSignals): number {
  let score = 0;
  if ((s.tuition_usd ?? 0) >= 40_000) score += 35;
  if ((s.tuition_usd ?? 0) >= 60_000) score += 15;
  if (s.nais_member) score += 15;
  if (s.tabs_member) score += 10;
  if (s.boarding_offered) score += 10;
  if (s.top5_matriculation) score += 10;
  return Math.min(100, score);
}

export async function runScrapeNow(): Promise<{
  discoveryInserted: number;
  tierEvaluated: number;
  tierPromoted: number;
}> {
  const db = createSupabaseAdmin();

  // 1. Discovery into schools_raw. Append-only — duplicates are fine here.
  const { error: rawErr } = await db.from('schools_raw').insert(
    FALLBACK_SEEDS.map((s) => ({
      name: s.name,
      website: s.website,
      country: 'US',
      state: s.state,
      city: s.city,
      tuition_text: s.tuition_text,
      school_type: s.school_type,
      source: s.source,
      raw_payload: s.raw,
    })),
  );
  if (rawErr) {
    await db.from('pipeline_events').insert({
      stage: 'school_discovery',
      status: 'error',
      error_text: rawErr.message,
    });
    throw rawErr;
  }
  await db.from('pipeline_events').insert({
    stage: 'school_discovery',
    status: 'success',
    payload_json: { source: 'curated_seed', rows: FALLBACK_SEEDS.length },
  });

  // 2. Tier verification — manual upsert because schools.website has a partial
  // unique INDEX (not constraint), which PostgREST's onConflict can't target.
  await db.from('pipeline_events').insert({ stage: 'tier_verification', status: 'started' });

  // Fetch existing websites in one round-trip
  const { data: existingRows } = await db
    .from('schools')
    .select('id, website')
    .not('website', 'is', null);
  const existing = new Map<string, string>();
  for (const row of (existingRows ?? []) as { id: string; website: string }[]) {
    existing.set(row.website.toLowerCase(), row.id);
  }

  let evaluated = 0;
  let promoted = 0;
  for (const s of FALLBACK_SEEDS) {
    evaluated += 1;
    const tuition = parseTuition(s.tuition_text);
    const isBoarding = (s.school_type ?? '').includes('boarding');
    // The curated seed list = NAIS member elite schools, boarding ones are TABS,
    // all of these have demonstrated top-5 college matriculation. Marking these
    // explicitly because the in-app scrape can't fetch external membership APIs.
    const signals: TierSignals = {
      nais_member: true,
      tabs_member: isBoarding,
      boarding_offered: isBoarding,
      top5_matriculation: true,
    };
    if (tuition !== undefined) signals.tuition_usd = tuition;
    const score = scoreTier(signals);
    const verified = score >= 70 && (tuition ?? 0) >= 40_000;

    const row = {
      name: s.name,
      website: s.website,
      country: 'US',
      state: s.state,
      city: s.city,
      tuition_usd: tuition ?? null,
      school_type: s.school_type,
      source: s.source,
      tier_match_score: score,
      tier_verified: verified,
      tier_signals: signals as unknown as Record<string, unknown>,
    };

    const existingId = s.website ? existing.get(s.website.toLowerCase()) : undefined;
    if (existingId) {
      const { error } = await db.from('schools').update(row).eq('id', existingId);
      if (!error && verified) promoted += 1;
    } else {
      const { error } = await db.from('schools').insert(row);
      if (!error && verified) promoted += 1;
    }
  }
  await db.from('pipeline_events').insert({
    stage: 'tier_verification',
    status: 'success',
    payload_json: { evaluated, promoted },
  });

  // Invalidate caches so /dashboard, /schools, /logs reflect the new data
  // without the user needing a hard refresh.
  revalidatePath('/dashboard');
  revalidatePath('/schools');
  revalidatePath('/logs');

  return {
    discoveryInserted: FALLBACK_SEEDS.length,
    tierEvaluated: evaluated,
    tierPromoted: promoted,
  };
}

// ---------------------------------------------------------------------------
// Apollo enrichment for ONE school (free-tier friendly: 5 contacts max).
// Each click ≈ 1 Apollo API call. With APOLLO_DAILY_QUOTA=15 you get ~15 schools/day.
// ---------------------------------------------------------------------------

interface ApolloPerson {
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
}

export async function enrichSchool(
  schoolId: string,
): Promise<{ leadsAdded: number; apolloReturned: number; error?: string }> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey)
    return { leadsAdded: 0, apolloReturned: 0, error: 'APOLLO_API_KEY not set in .env.local' };

  const db = createSupabaseAdmin();

  const { data: school } = await db
    .from('schools')
    .select('id, name, tier_verified')
    .eq('id', schoolId)
    .maybeSingle();
  const sch = school as { id: string; name: string; tier_verified: boolean } | null;
  if (!sch) return { leadsAdded: 0, apolloReturned: 0, error: 'school_not_found' };
  if (!sch.tier_verified) {
    return {
      leadsAdded: 0,
      apolloReturned: 0,
      error: 'school not tier_verified — skipping to save credits',
    };
  }

  const { data: rolesData } = await db.from('target_roles').select('role_title').limit(20);
  const titles = ((rolesData ?? []) as { role_title: string }[]).map((r) => r.role_title);
  if (titles.length === 0) {
    return { leadsAdded: 0, apolloReturned: 0, error: 'no target_roles configured' };
  }

  let people: ApolloPerson[] = [];
  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        q_organization_name: sch.name,
        person_titles: titles,
        per_page: 5,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      await db.from('pipeline_events').insert({
        stage: 'contact_enrichment',
        status: 'error',
        payload_json: { school_id: schoolId, school: sch.name, http: res.status },
        error_text: text.slice(0, 400),
      });
      // Graceful messages for common Apollo error codes
      if (res.status === 403 && text.includes('free plan')) {
        return {
          leadsAdded: 0,
          apolloReturned: 0,
          error:
            'Apollo free tier blocks people-search. Upgrade plan or use the curated seed data.',
        };
      }
      if (res.status === 401) {
        return { leadsAdded: 0, apolloReturned: 0, error: 'Apollo key invalid or revoked.' };
      }
      if (res.status === 429) {
        return { leadsAdded: 0, apolloReturned: 0, error: 'Apollo rate-limited — wait a minute.' };
      }
      return { leadsAdded: 0, apolloReturned: 0, error: `apollo_${res.status}` };
    }
    const json = (await res.json()) as { people?: ApolloPerson[] };
    people = json.people ?? [];
  } catch (err) {
    return { leadsAdded: 0, apolloReturned: 0, error: (err as Error).message };
  }

  let added = 0;
  for (const p of people) {
    const email = p.email?.trim().toLowerCase();
    if (!email) continue;
    const idem = createHash('sha256').update(`fdf|${schoolId}|${email}`).digest('hex').slice(0, 32);
    const { error } = await db.from('leads').upsert(
      {
        school_id: schoolId,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        role: p.title ?? null,
        email,
        linkedin_url: p.linkedin_url ?? null,
        status: 'new',
        source: 'apollo_admin_button',
        idempotency_key: idem,
      },
      { onConflict: 'idempotency_key' },
    );
    if (!error) added += 1;
  }

  await db.from('pipeline_events').insert({
    stage: 'contact_enrichment',
    status: 'success',
    payload_json: {
      school_id: schoolId,
      school: sch.name,
      apollo_returned: people.length,
      leads_added: added,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/leads');
  revalidatePath('/schools');
  revalidatePath('/logs');

  return { leadsAdded: added, apolloReturned: people.length };
}
