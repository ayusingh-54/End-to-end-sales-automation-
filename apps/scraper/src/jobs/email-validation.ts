import { db } from '../lib/supabase.js';
import { validateEmail } from '../lib/zerobounce.js';
import { recordEvent } from '../lib/events.js';
import { logger } from '../lib/logger.js';

interface LeadRow {
  id: string;
  email: string;
}

export async function runEmailValidation(opts: { limit?: number } = {}): Promise<{
  checked: number;
  valid: number;
  invalid: number;
}> {
  await recordEvent('email_validation', 'started');

  const { data, error } = await db()
    .from('leads')
    .select('id, email')
    .eq('email_verified', false)
    .eq('role_verified', true)
    .limit(opts.limit ?? 200);
  if (error) throw error;

  let checked = 0;
  let valid = 0;
  let invalid = 0;
  for (const row of (data ?? []) as LeadRow[]) {
    checked += 1;
    try {
      const r = await validateEmail(row.email);
      const ok = r.status === 'valid' || r.status === 'catch-all';
      const lost = r.status === 'invalid' || r.status === 'spamtrap' || r.status === 'abuse';
      const { error: upErr } = await db()
        .from('leads')
        .update({
          email_verified: ok,
          status: lost ? 'lost' : 'verified',
          bounced: lost ? true : undefined,
        })
        .eq('id', row.id);
      if (upErr) logger.warn({ err: upErr, leadId: row.id }, 'lead_update_failed');
      if (ok) valid += 1;
      if (lost) invalid += 1;
    } catch (err) {
      logger.warn({ err, leadId: row.id }, 'zerobounce_failed');
    }
  }

  await recordEvent('email_validation', 'success', {
    payload: { checked, valid, invalid },
  });
  return { checked, valid, invalid };
}
