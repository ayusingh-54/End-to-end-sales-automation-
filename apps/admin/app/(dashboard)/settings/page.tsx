export const dynamic = 'force-dynamic';

const ITEMS: Array<[string, string]> = [
  ['SUPABASE_URL', 'connected via env'],
  ['SUPABASE_SERVICE_ROLE_KEY', '••• (server-only)'],
  ['STRIPE_SECRET_KEY', '••• (server-only)'],
  ['STRIPE_WEBHOOK_SECRET', '••• (server-only)'],
  ['INSTANTLY_API_KEY', '••• (cold sends)'],
  ['RESEND_API_KEY', '••• (transactional sends)'],
  ['ZEROBOUNCE_API_KEY', '••• (email validation)'],
  ['APOLLO_API_KEY', '••• (contact enrichment)'],
  ['LINKEDIN_AGENT_URL', 'configured? — see env'],
  ['N8N_WEBHOOK_URL', 'where the admin posts to start workflows'],
  ['N8N_WEBHOOK_SECRET', '••• (HMAC over body+timestamp)'],
  ['ZOOM_ACCOUNT_ID / CLIENT_ID / CLIENT_SECRET', '••• (attendance pull)'],
  ['R2_* (account/access/secret/bucket)', '••• (signed resource URLs)'],
  ['ADMIN_ALLOWED_EMAILS', 'magic-link allow-list'],
];

export default function Settings() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        API keys are write-only. View this page in the host&apos;s dashboard (Cloudflare Pages,
        Railway, Supabase) for the actual values.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        {ITEMS.map(([k, v]) => (
          <li
            key={k}
            className="flex justify-between border-b border-neutral-100 py-2 dark:border-neutral-900"
          >
            <span className="font-mono text-xs">{k}</span>
            <span className="text-neutral-500">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
