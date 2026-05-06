import { createHash } from 'node:crypto';
import { searchPeopleByOrganization } from '../lib/apollo.js';
import { db } from '../lib/supabase.js';
import { recordEvent } from '../lib/events.js';
import { logger } from '../lib/logger.js';

interface SchoolRow {
  id: string;
  name: string;
}

interface RoleRow {
  role_title: string;
  synonyms: string[] | null;
}

function makeIdempotencyKey(parts: string[]): string {
  return createHash('sha256').update(parts.join('|').toLowerCase()).digest('hex').slice(0, 32);
}

export async function runContactEnrichment(
  programSlug: string,
  opts: { schoolLimit?: number } = {},
): Promise<{ schools: number; leads: number; errors: number }> {
  await recordEvent('contact_enrichment', 'started');

  const { data: prog } = await db()
    .from('programs')
    .select('id, slug')
    .eq('slug', programSlug)
    .single();
  if (!prog) throw new Error(`program_not_found: ${programSlug}`);

  const { data: rolesData } = await db()
    .from('target_roles')
    .select('role_title, synonyms')
    .eq('program_id', (prog as { id: string }).id);
  const titles = ((rolesData ?? []) as RoleRow[]).flatMap((r) => [
    r.role_title,
    ...(r.synonyms ?? []),
  ]);

  if (titles.length === 0) {
    logger.warn('no target_roles configured for program');
    await recordEvent('contact_enrichment', 'skipped', { payload: { reason: 'no_roles' } });
    return { schools: 0, leads: 0, errors: 0 };
  }

  const { data: schoolsData } = await db()
    .from('schools')
    .select('id, name')
    .eq('tier_verified', true)
    .limit(opts.schoolLimit ?? 50);
  const schools = (schoolsData ?? []) as SchoolRow[];

  let leadsAdded = 0;
  let errors = 0;

  for (const school of schools) {
    try {
      const people = await searchPeopleByOrganization({
        organizationName: school.name,
        titles,
        perPage: 25,
      });
      for (const p of people) {
        const email = p.email?.trim().toLowerCase();
        if (!email) continue;
        const key = makeIdempotencyKey([programSlug, school.id, email]);
        const { error: insErr } = await db()
          .from('leads')
          .upsert(
            {
              school_id: school.id,
              first_name: p.first_name ?? null,
              last_name: p.last_name ?? null,
              role: p.title ?? null,
              email,
              linkedin_url: p.linkedin_url ?? null,
              status: 'new',
              source: 'apollo',
              idempotency_key: key,
            },
            { onConflict: 'idempotency_key' },
          );
        if (insErr) {
          errors += 1;
          logger.warn({ err: insErr, email }, 'lead_upsert_failed');
        } else {
          leadsAdded += 1;
        }
      }
    } catch (err) {
      errors += 1;
      logger.error({ err, school: school.name }, 'apollo_failed');
      await recordEvent('contact_enrichment', 'error', {
        payload: { school_id: school.id, school: school.name },
        error: err,
      });
    }
  }

  await recordEvent('contact_enrichment', 'success', {
    payload: { schools: schools.length, leads: leadsAdded, errors },
  });
  return { schools: schools.length, leads: leadsAdded, errors };
}
