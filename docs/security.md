# Security

## Non-negotiables (enforced)

1. **No secrets in the repo.** `.env*` gitignored. `gitleaks` runs on every PR via GitHub Actions; PRs cannot merge if it fires. `.gitleaks.toml` allow-lists `.env.example` only.
2. **Service-role key never reaches the browser.** Only `NEXT_PUBLIC_*` vars cross the boundary.
3. **RLS on every table that holds PII.** `packages/db/migrations/0002_rls.sql`. Default deny for `anon`. `viewer`/`operator`/`admin` policies isolate read/write.
4. **Single anon-callable RPC** for the public registration page: `register_for_masterclass(...)`. `SECURITY DEFINER` so RLS is bypassed only inside the function body.
5. **HMAC on every machine-to-machine call.** Admin signs `(timestamp, body)` with `N8N_WEBHOOK_SECRET`; n8n verifies, and admin webhook routes verify on inbound. 5-minute replay window.
6. **Stripe webhook signature** verified with `stripe.webhooks.constructEvent`. Never insert into `payments` without it.
7. **Rate limiting.** `lib/rate-limit.ts` token-bucket on `/login`, `/api/webhooks/*`, public registration server action. Per-IP keys.
8. **Input validation.** Every server action and API route parses with zod before touching the DB.
9. **Magic-link auth + email allow-list.** No passwords. `ADMIN_ALLOWED_EMAILS` (or `*@learnwithleaders.com` default).
10. **Audit log.** `audit_log` table, written by `service_role` only. Admin UI page reads it.
11. **CSP / security headers.** Next.js `next.config.mjs` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
12. **CodeQL** runs weekly + on every PR (`.github/workflows/codeql.yml`).

## Threat model

| Actor                   | Goal                                 | Mitigation                                                                                       |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| External attacker       | Steal lead PII                       | RLS + service-role isolation + Cloudflare WAF in front of admin                                  |
| External attacker       | Trigger fake n8n campaigns           | HMAC on every webhook, replay window 5 min                                                       |
| External attacker       | Spoof Stripe webhook for fake "paid" | `stripe.webhooks.constructEvent` signature verify, hard-fail on mismatch                         |
| Compromised ESP account | Send mail in our name                | DMARC `p=quarantine` then `p=reject` after 30d clean, per-template send caps, daily campaign cap |
| Insider (admin role)    | Bulk export leads                    | `audit_log` + email allow-list + admin-only `audit_log` view                                     |
| Bug                     | Charge a card twice                  | Stripe idempotency key on session creation + reconciliation cron                                 |
| Bug                     | Re-send same email                   | `email_sends.idempotency_key` unique index                                                       |

## CI security gates

- `gitleaks` (must pass on every PR — `.github/workflows/ci.yml`)
- `pnpm format:check` + `pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm build`
- `CodeQL` (`.github/workflows/codeql.yml`) for JS/TS, weekly + on PR

## Incident response

1. Rotate the affected key in the host's secret store (never in-repo).
2. Re-deploy admin app (Cloudflare Pages: trigger redeploy from dashboard).
3. Restart n8n container (Railway: restart service) so the new credential is read.
4. Audit `audit_log` and `pipeline_events` for activity using the rotated credential.
5. If lead PII may have leaked, follow LWL's data-breach process (contact legal first).

## Out of scope for the pilot

- External penetration test (recommended post-pilot)
- SOC2 readiness
- Multi-region failover
