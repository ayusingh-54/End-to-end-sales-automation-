import * as cheerio from 'cheerio';
import { politeFetchText } from '../lib/http.js';
import { db } from '../lib/supabase.js';
import { recordEvent } from '../lib/events.js';
import { logger } from '../lib/logger.js';

export interface SeedSource {
  source: string;
  url: string;
  parse: (html: string) => Array<{
    name?: string | undefined;
    website?: string | undefined;
    state?: string | undefined;
    city?: string | undefined;
    school_type?: string | undefined;
    tuition_text?: string | undefined;
    raw: Record<string, unknown>;
  }>;
}

const NAIS_DIRECTORY: SeedSource = {
  source: 'nais_directory',
  url: 'https://www.nais.org/directories/member-school-directory/',
  parse: (html) => {
    const $ = cheerio.load(html);
    const out: Array<{
      name?: string | undefined;
      website?: string | undefined;
      state?: string | undefined;
      raw: Record<string, unknown>;
    }> = [];
    $('.directory-result, .school-card, article').each((_, el) => {
      const name = $(el).find('h3, .school-name').first().text().trim();
      const link =
        $(el).find('a[href^="http"]').first().attr('href') ?? $(el).find('a').first().attr('href');
      const state = $(el).find('.state, [data-state]').first().text().trim();
      if (name) {
        out.push({
          name,
          website: link ?? undefined,
          state: state || undefined,
          raw: { html: $(el).html()?.slice(0, 4000) ?? '' },
        });
      }
    });
    return out;
  },
};

const BOARDING_SCHOOL_REVIEW: SeedSource = {
  source: 'boardingschoolreview',
  url: 'https://www.boardingschoolreview.com/most_expensive_boarding_schools',
  parse: (html) => {
    const $ = cheerio.load(html);
    const out: Array<{
      name?: string | undefined;
      website?: string | undefined;
      state?: string | undefined;
      tuition_text?: string | undefined;
      school_type?: string | undefined;
      raw: Record<string, unknown>;
    }> = [];
    $('table tr').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 2) return;
      const name = $(tds[0]).text().trim();
      const tuition = $(tds[2] ?? tds[1])
        .text()
        .trim();
      const state = $(tds[1]).text().trim();
      if (name && /^[A-Z]/.test(name)) {
        out.push({
          name,
          state,
          tuition_text: tuition,
          school_type: 'boarding',
          raw: { row: $(tr).html()?.slice(0, 2000) ?? '' },
        });
      }
    });
    return out;
  },
};

const TABS_DIRECTORY: SeedSource = {
  source: 'tabs_directory',
  url: 'https://www.boardingschools.com/find-a-school',
  parse: (html) => {
    const $ = cheerio.load(html);
    const out: Array<{
      name?: string | undefined;
      website?: string | undefined;
      state?: string | undefined;
      school_type?: string | undefined;
      raw: Record<string, unknown>;
    }> = [];
    $('.school-listing, .listing-result').each((_, el) => {
      const name = $(el).find('h3, .name, .title').first().text().trim();
      const state = $(el).find('.state, .location').first().text().trim();
      const website = $(el).find('a[href^="http"]').first().attr('href');
      if (name) {
        out.push({
          name,
          state,
          website,
          school_type: 'boarding',
          raw: { html: $(el).html()?.slice(0, 4000) ?? '' },
        });
      }
    });
    return out;
  },
};

export const SEED_SOURCES: SeedSource[] = [NAIS_DIRECTORY, BOARDING_SCHOOL_REVIEW, TABS_DIRECTORY];

export async function runSchoolDiscovery(opts: { limit?: number } = {}): Promise<{
  fetched: number;
  inserted: number;
  errors: number;
}> {
  let fetched = 0;
  let inserted = 0;
  let errors = 0;

  for (const src of SEED_SOURCES) {
    await recordEvent('school_discovery', 'started', { payload: { source: src.source } });
    try {
      const html = await politeFetchText(src.url);
      const rows = src.parse(html);
      fetched += rows.length;

      const limit = opts.limit ?? rows.length;
      const slice = rows.slice(0, limit);
      if (slice.length === 0) {
        logger.warn({ source: src.source }, 'no rows parsed (selectors may have shifted)');
        await recordEvent('school_discovery', 'skipped', {
          payload: { source: src.source, reason: 'no_rows' },
        });
        continue;
      }

      const { error } = await db()
        .from('schools_raw')
        .insert(
          slice.map((r) => ({
            name: r.name ?? null,
            website: r.website ?? null,
            country: 'US',
            state: r.state ?? null,
            city: r.city ?? null,
            tuition_text: r.tuition_text ?? null,
            school_type: r.school_type ?? null,
            source: src.source,
            raw_payload: r.raw,
          })),
        );
      if (error) throw error;
      inserted += slice.length;
      await recordEvent('school_discovery', 'success', {
        payload: { source: src.source, rows: slice.length },
      });
    } catch (err) {
      errors += 1;
      logger.error({ err, source: src.source }, 'discovery_failed');
      await recordEvent('school_discovery', 'error', {
        payload: { source: src.source },
        error: err,
      });
    }
  }

  return { fetched, inserted, errors };
}
