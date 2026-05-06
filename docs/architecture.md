# Architecture

## 1. System diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ADMIN PANEL (Next.js)                       │
│  - Trigger scrape jobs    - View leads / funnel    - Clone program  │
│  - Pause / resume         - Metrics dashboard      - Manage configs │
└─────────────────┬─────────────────────────────────┬─────────────────┘
                  │ Server Actions / signed webhooks
                  ▼                                 ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│   SUPABASE (Postgres + Auth) │      │     N8N (self-hosted)        │
│  programs, masterclasses,    │◄────►│  Orchestrates every stage    │
│  leads, schools, events,     │      │  Triggered by webhooks/cron  │
│  campaigns, payments, logs   │      │                              │
└──────────────────────────────┘      └──────┬───────────────────────┘
                                             │
        ┌────────────────────────────────────┼─────────────────────────────┐
        ▼                ▼                   ▼              ▼              ▼
┌──────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────┐
│ Scraper svc  │  │  Apollo API │  │ LinkedIn     │  │ Email ESP │  │  Stripe  │
│ (Playwright/ │  │             │  │ verifier     │  │ (Instantly│  │          │
│  Firecrawl)  │  │             │  │ (existing)   │  │  + Resend)│  │          │
└──────────────┘  └─────────────┘  └──────────────┘  └───────────┘  └──────────┘
```

## 2. Two execution planes

| Plane                           | Lives in           | Owns                                                                     |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| A — Long-running orchestration  | self-hosted n8n    | scrape, enrich, send, reminders, payment listener, re-engagement         |
| B — UI, auth, config, reporting | Next.js + Supabase | dashboard, leads table, programs/templates editors, magic-link auth, RLS |

The dashboard never calls Apollo or sends mail directly. It writes config rows and triggers n8n via authenticated webhooks (HMAC over body + timestamp, 5-min replay window).

**Why split:** n8n excels at long, retry-prone, multi-vendor jobs. Next.js + Supabase excel at UI + auth + structured data. Splitting them keeps each tool in its lane.

## 3. Hosting

| Component                      | Host             | Cost (pilot)                       |
| ------------------------------ | ---------------- | ---------------------------------- |
| Admin (Next.js)                | Cloudflare Pages | $0                                 |
| Scraper worker                 | Railway          | ~$5/mo                             |
| n8n + n8n's Postgres           | Railway          | ~$10/mo                            |
| Primary database               | Supabase         | $0 free tier ($25 Pro if exceeded) |
| Object storage (resource pack) | Cloudflare R2    | $0 (no egress fees)                |
| Email — cold                   | Instantly.ai     | ~$37/mo                            |
| Email — transactional          | Resend           | $0 (free tier ≤3k/mo)              |
| Email validation               | ZeroBounce       | ~$16 for 2k validations (one-time) |
| Logs                           | Better Stack     | $0 free tier                       |
| Errors                         | Sentry           | $0 free tier                       |
| Repo + CI                      | GitHub Actions   | $0                                 |

**Total infra: ~$60-90/mo + Apollo (depends on existing LWL plan).**

## 4. Data flow (one campaign run)

1. Operator clicks **Start FDF Campaign** in the admin panel.
2. Admin writes a `campaigns` row + signed POST to n8n's `start_campaign` webhook (workflow 06).
3. n8n forwards to admin's `/api/jobs/send-invites` — renders invite per verified lead, sends via Instantly with idempotency keys.
4. Lead clicks invite → registration page (Next.js) → `register_for_masterclass(...)` RPC → row in `registrations` + ICS calendar invite + confirmation email via Resend.
5. Workflow 07 fires every 30 min; sends T-24h and T-1h reminders within the matching time window.
6. Masterclass runs (Zoom).
7. Workflow 08 (every 15 min) pulls Zoom report → updates `registrations.attended` + `attendance_minutes` (>=10 min counts).
8. Workflow 09 (every 15 min) decides which offer step is due based on time-since-end and pushes D0/D1/D2-morning/D2-final via `/api/jobs/offer-sequence`. Workflow 10 runs the parallel no-show sequence every 6h.
9. Each step creates a Stripe Checkout session (idempotent, with `client_reference_id = lead_id`).
10. Lead pays → Stripe webhook → admin `/api/webhooks/stripe` verifies signature → `payments` insert + `leads.status = 'paid'` + receipt + R2-presigned resource link.
11. Workflow 11 reconciles every 6h as a safety net.
12. Workflow 12 (daily) fires the T+14d re-engagement.

Every stage above writes a row to `pipeline_events` so the dashboard computes funnel state without polling vendors.

## 5. Where each secret lives

| Secret                                                      | Lives in                                         | Read by                                    |
| ----------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Apollo, ZeroBounce, Instantly, Resend, Zoom, LinkedIn-agent | n8n env (Railway)                                | scraper jobs + n8n workflows               |
| Stripe webhook secret                                       | Cloudflare Pages env (admin)                     | `/api/webhooks/stripe` route               |
| Stripe secret key                                           | Cloudflare Pages env (admin) + n8n env (Railway) | server-side only                           |
| Supabase service role key                                   | Cloudflare Pages env + n8n env + scraper env     | server/job code only                       |
| Supabase anon key                                           | Cloudflare Pages env (admin, `NEXT_PUBLIC_*`)    | browser; safe by RLS                       |
| n8n webhook HMAC secret                                     | Cloudflare Pages env (admin) + n8n env           | admin signs outbound; n8n verifies inbound |
| Sentry DSN, Better Stack token                              | All app envs                                     | runtime telemetry                          |
| R2 access key / secret                                      | Cloudflare Pages env (admin)                     | resource-delivery presign                  |

Nothing in the repo. `.env.example` carries names only. CI runs `gitleaks` to enforce.

## 6. Replicability

Adding a new program requires (per `docs/replication-guide.md`):

1. One row insert in `programs` (admin UI: Programs → New, or Clone).
2. One row insert in `masterclasses`.
3. Optional edits to `target_roles`, `school_tier_rules`, `email_templates` (cloned from the source program).
4. **Zero code changes. Zero redeploys.** This is the pilot's central acceptance criterion.

The system is designed so that **everything that varies between programs lives in DB rows, not in code**. Hardcoded `'fdf'` references exist only in the seed file and the scraper CLI default — both are config, not pipeline logic.
