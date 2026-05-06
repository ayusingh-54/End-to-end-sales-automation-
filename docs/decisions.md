# Architecture Decision Records

Each ADR is a short defense (≤150 words) of a stack choice. Status reflects what was actually used in the pilot.

---

## ADR-0001 — Email provider: Instantly + Resend

**Status:** Accepted.
**Decision:** Instantly.ai for cold outreach, Resend for transactional.
**Why:** Cold outreach to thousands of educator inboxes from a fresh domain needs inbox rotation, automated warm-up, and reply detection. SendGrid/Mailgun are transactional-grade and cold sends from them get throttled fast. Gmail API on a workspace account would burn the domain — explicitly rejected. Resend handles transactional (registration confirmations, receipts) cleanly with cheap pricing and good deliverability.
**Trade-offs:** Two providers = two integrations (mitigated by `EmailProvider` interface in `packages/shared`). Bounce/reply webhooks wired separately for each; both normalised through workflow 13.

## ADR-0002 — Database: Supabase

**Status:** Accepted.
**Decision:** Supabase (Postgres + Auth + RLS + Storage).
**Why:** Postgres is non-negotiable for the relational schema with `jsonb`, citext, and partial unique indexes. Supabase bundles auth + RLS + a generated TS-type pipeline that aligns with config-as-data. Raw Postgres would mean rebuilding magic-link auth + RLS tooling. PlanetScale is MySQL — no `jsonb`, no RLS.
**Trade-offs:** Vendor lock-in on Auth. Mitigated by keeping all SQL in `packages/db/migrations/` so the DB is portable; `auth.users` is the only Supabase-specific reference and is easy to swap.

## ADR-0003 — Scraper: Playwright + Firecrawl fallback

**Status:** Accepted.
**Decision:** Self-hosted Playwright as primary, Firecrawl as fallback (env-gated).
**Why:** Most school sites are static enough for Cheerio + `undici`, but admissions pages often require JS execution. Playwright handles both. Firecrawl is the escape hatch when targets serve Cloudflare/PerimeterX challenges. Apify is more expensive at our scale.
**Trade-offs:** Playwright Docker image is ~1.5 GB; cold starts are slow on Railway free tier. Mitigated by keeping the worker warm.

## ADR-0004 — Hosting: Cloudflare Pages (admin) + Railway (workers, n8n)

**Status:** Accepted.
**Decision:** Admin → Cloudflare Pages. Scraper + n8n + n8n's Postgres → Railway. Lovable explicitly forbidden by client.
**Why:** Cloudflare Pages is free at this volume, has good Next.js support, and LWL already uses Cloudflare for DNS. Railway runs long-lived containers cheaply (~$5/service) with one-click n8n.
**Trade-offs:** Cloudflare Pages' Node runtime caveats — server actions that need Node-only APIs use the Node runtime explicitly via `export const runtime = 'nodejs'` on routes that touch Stripe SDK, nodemailer, or the crypto module.

## ADR-0005 — n8n hosting: self-hosted on Railway

**Status:** Accepted.
**Decision:** Self-hosted n8n on Railway with attached Postgres.
**Why:** Master prompt non-negotiable: credentials in LWL infra. n8n Cloud holds credentials in their tenant; if LWL ever leaves, exporting credentials is painful.
**Trade-offs:** LWL becomes responsible for upgrades and backup. Mitigated by Railway's automatic image updates and weekly Postgres snapshots.

## ADR-0006 — Email validation: ZeroBounce

**Status:** Accepted.
**Decision:** ZeroBounce.
**Why:** Highest published catch-rate among the three majors, pay-per-use (no subscription waste), straightforward API. NeverBounce and Bouncer are comparable on price and accuracy; ZeroBounce wins on documentation and bulk-batch jobs.
**Trade-offs:** None material at this scale (<10k validations).

## ADR-0007 — Admin auth: Supabase Auth (magic link + email allow-list)

**Status:** Accepted.
**Decision:** Supabase Auth, magic-link only, allow-listed by email domain.
**Why:** Supabase Auth is already in the stack. Clerk adds $25+/mo for tiny user counts. NextAuth requires writing the storage layer, which would conflict with RLS. Magic links are appropriate for an internal admin team of <20.
**Trade-offs:** No SSO out of the box. If LWL needs Google Workspace SSO later, swap to Clerk or wire Supabase's Google provider — neither is a code-deep change.

## ADR-0008 — n8n holds orchestration only; admin holds business logic

**Status:** Accepted.
**Decision:** Workflows are thin. They cron, sign, and HTTP-POST. The admin app's `/api/jobs/*` and `/api/webhooks/*` routes contain the actual rendering, Stripe-session creation, RLS-aware queries, and side effects.
**Why:** TypeScript code is testable and version-controlled. n8n JSON is hard to diff and harder to unit-test. Keeping logic in TS lets `pnpm test` cover the renderer, tier scorer, and webhook handlers.
**Trade-offs:** n8n's role is reduced — but its retry, scheduling, and credential storage remain valuable. Workflows still expose the funnel structure visually for non-engineers.
