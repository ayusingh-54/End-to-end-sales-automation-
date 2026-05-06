import type { EmailProvider } from '@lwl/shared';
import { InstantlyProvider } from './instantly';
import { ResendProvider } from './resend';
import { MailhogProvider } from './dev-mailhog';

export type Channel = 'cold' | 'transactional' | 'dev';

export function pickProvider(channel: Channel): EmailProvider {
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_DEV_MAILHOG === '1') {
    return new MailhogProvider();
  }
  if (channel === 'cold') {
    const k = process.env.INSTANTLY_API_KEY;
    if (!k) throw new Error('INSTANTLY_API_KEY missing for cold sends');
    return new InstantlyProvider(k);
  }
  const k = process.env.RESEND_API_KEY;
  if (!k) throw new Error('RESEND_API_KEY missing for transactional sends');
  return new ResendProvider(k);
}
