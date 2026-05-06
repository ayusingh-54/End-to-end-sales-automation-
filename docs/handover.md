# Handover checklist

> Pilot acceptance is conditional on every box below being ticked.

## Credentials transferred to LWL accounts

- [ ] Cloudflare account → admin app (Pages) + R2 bucket + DNS for sending subdomain
- [ ] Railway project → scraper service + n8n service + Postgres (n8n's metadata DB)
- [ ] Supabase project → primary DB + Auth (allow-list at `ADMIN_ALLOWED_EMAILS`)
- [ ] GitHub repo → transferred to LWL org; collaborator removed from personal account
- [ ] Apollo seat (LWL-paid; ours rotated/revoked)
- [ ] Stripe account (existing LWL; restricted-access key generated for n8n use only)
- [ ] Instantly account (cold-send)
- [ ] Resend account (transactional)
- [ ] ZeroBounce account
- [ ] Sentry org + DSN
- [ ] Better Stack source token
- [ ] Zoom account + OAuth credentials (for attendance pull)
- [ ] LinkedIn agent endpoint URL + API key (LWL's existing service)

## Documentation handed over

- [x] `docs/architecture.md`
- [x] `docs/decisions.md`
- [x] `docs/runbook.md`
- [x] `docs/replication-guide.md`
- [x] `docs/dns.md`
- [x] `docs/email.md`
- [x] `docs/security.md`
- [x] `docs/tier-rules.md`
- [x] `docs/schema.md` (ER diagram + key constraints)
- [x] `docs/loom-script.md`
- [ ] Loom walkthrough recording — link: **\*\*\*\***\_\_\_\_**\*\*\*\***

## Final acceptance demo

- [ ] One real end-to-end run: scrape → email (seed inbox) → register → attend → pay (Stripe test) → resource delivered, with no manual intervention.
- [ ] Dashboard answers every funnel question in under 30 seconds.
- [ ] Cloning to a second program done from the admin panel only — proven by adding a "Test Program 2" via the UI and watching the first stage run.
- [ ] No secrets in the repo (gitleaks clean on `main`).

## Honest blockers / scope notes (transparent for Gunjan)

- **Email warm-up.** The cold-send subdomain takes 14 days of automated warm-up before full-volume sends. Today's pilot demo uses Resend transactional + Mailhog locally. Real cold launch is T+14d.
- **LinkedIn agent.** Until LWL's existing agent's endpoint is provided, the system uses a deterministic mock (defined against the typed interface in `packages/shared/linkedin-agent.ts`). Swapping is one env-var change.
- **Real demo charge.** Phase 6 has been validated in Stripe **test mode**. A real $1 live test before flipping to production is in this checklist's `Final acceptance demo` row.
- **Pen test.** Out of scope for the pilot — recommend before scaling to programs 2–14.

## Post-handover support

- 7 days of asynchronous support after sign-off (one daily check-in + ad-hoc messages).
- Bug fixes covered free for 14 days post-launch.
- New features beyond what's in this repo are scoped separately.

## Sign-off

- LWL representative: \***\*\*\*\*\***\_\_\_\_\***\*\*\*\*\*** date: \***\*\_\_\*\***
- Vendor (u2xai): hello@u2xai.com date: \***\*\_\_\*\***
