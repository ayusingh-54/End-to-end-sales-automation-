import { db } from '../lib/supabase.js';
import { createLinkedInAgent } from '../lib/linkedin.js';
import { recordEvent } from '../lib/events.js';
import { logger } from '../lib/logger.js';

interface LeadRow {
  id: string;
  role: string | null;
  linkedin_url: string | null;
  schools: { name: string } | { name: string }[] | null;
}

function schoolName(row: LeadRow): string {
  const s = row.schools;
  if (!s) return '';
  return Array.isArray(s) ? (s[0]?.name ?? '') : s.name;
}

export async function runLinkedInVerification(opts: { limit?: number } = {}): Promise<{
  checked: number;
  verified: number;
  failed: number;
}> {
  await recordEvent('linkedin_verification', 'started');
  const agent = createLinkedInAgent();

  const { data, error } = await db()
    .from('leads')
    .select('id, role, linkedin_url, schools(name)')
    .eq('role_verified', false)
    .not('linkedin_url', 'is', null)
    .limit(opts.limit ?? 200);
  if (error) throw error;

  let checked = 0;
  let verified = 0;
  let failed = 0;
  for (const row of (data ?? []) as LeadRow[]) {
    if (!row.linkedin_url) continue;
    checked += 1;
    try {
      const r = await agent.verify({
        leadId: row.id,
        linkedinUrl: row.linkedin_url,
        expectedRole: row.role ?? '',
        expectedEmployer: schoolName(row),
      });
      const ok = r.roleMatches && r.employerMatches && r.confidence >= 0.6;
      if (ok) verified += 1;
      const { error: upErr } = await db()
        .from('leads')
        .update({ role_verified: ok, status: ok ? 'verified' : 'lost' })
        .eq('id', row.id);
      if (upErr) failed += 1;
      await recordEvent('linkedin_verification', ok ? 'success' : 'skipped', {
        leadId: row.id,
        payload: { confidence: r.confidence, roleMatches: r.roleMatches },
      });
    } catch (err) {
      failed += 1;
      logger.warn({ err, leadId: row.id }, 'linkedin_verify_failed');
      await recordEvent('linkedin_verification', 'error', { leadId: row.id, error: err });
    }
  }

  return { checked, verified, failed };
}
