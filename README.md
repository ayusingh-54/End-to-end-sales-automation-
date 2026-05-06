# LWL Pipeline — Future Doctors Fellowship

End-to-end AI sales automation pipeline for **Learn with Leaders**, piloted on the **Future Doctors Fellowship (FDF)** program. Designed to clone to 13+ programs by editing **configuration only**, never code.

> Status: **Phase 0 — scaffolding.** Nothing is deployed. See `docs/architecture.md` for the target system.

---

## Pipeline at a glance

`school discovery → tier verification → contact enrichment → LinkedIn verification → email validation → masterclass invite → registration → attendance → 72-hour offer → Stripe payment → resource delivery → re-engagement`

Two execution planes:

- **Plane A — Long-running orchestration** lives in self-hosted **n8n**: scrape, enrich, send, payment listener, reminders.
- **Plane B — UI, auth, config, reporting** lives in **Next.js + Supabase**. The dashboard never calls Apollo or sends email directly; it writes config rows and triggers n8n via signed webhooks.

See `docs/architecture.md` for the full diagram and rationale.

## Repo layout

```
lwl-pipeline/
├── apps/
│   ├── admin/          Next.js 14 admin panel (App Router, TS strict)
│   └── scraper/        Node 20 worker (Playwright + Firecrawl fallback)
├── packages/
│   ├── db/             Supabase migrations + generated TS types
│   └── shared/         zod schemas, constants, vendor interfaces
├── infra/
│   ├── n8n/            exported workflow JSONs (version controlled)
│   └── docker-compose.yml   local dev: postgres + n8n + mailhog
├── docs/               architecture, ADRs, runbook, replication-guide,
│                       dns, email, security, tier-rules, handover
└── .github/workflows/  lint + typecheck + build + gitleaks
```

## Local dev — quickstart

Prereqs: Node ≥ 20.11, Docker, `corepack enable` (ships with Node).

```bash
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm install
cp .env.example .env.local      # fill placeholders for any service you use locally
docker compose -f infra/docker-compose.yml up -d   # postgres + n8n + mailhog
pnpm -F admin dev               # http://localhost:3000
pnpm -F scraper dev             # worker process
```

Local URLs:

- Admin: http://localhost:3000
- n8n editor: http://localhost:5678 (basic auth — see `.env.example`)
- Mailhog (captures outbound mail in dev): http://localhost:8025

## Scripts (root)

| Script           | What it does                         |
| ---------------- | ------------------------------------ |
| `pnpm lint`      | ESLint across all workspaces         |
| `pnpm typecheck` | `tsc --noEmit` across all workspaces |
| `pnpm build`     | Build all workspaces                 |
| `pnpm test`      | Run all workspace tests              |
| `pnpm format`    | Prettier write                       |

## Non-negotiables (read before contributing)

1. **No secrets in the repo.** `.env*` is gitignored; CI runs `gitleaks` on every PR.
2. **Configuration is data.** Programs, target roles, school-tier rules, email templates, and offer prices are rows in Postgres — never hardcoded.
3. **Idempotency.** Every external write (email send, Stripe charge, lead insert) uses an idempotency key.
4. **Observability.** Every pipeline stage writes to `pipeline_events`.
5. **Email auth before send.** SPF, DKIM, DMARC must be live and the sending domain warmed before any cold mail.
6. **No fake data in the demo.** Stages that have not run on real data are marked `unverified` in the dashboard.

Full list: see master prompt §5 and `docs/security.md`.

## Phase status

| Phase | Description                                     | Status          |
| ----- | ----------------------------------------------- | --------------- |
| 0     | Repo scaffold + hosts + cost estimate           | **In progress** |
| 1     | Supabase schema + migrations                    | Pending         |
| 2     | Data acquisition (schools → leads)              | Pending         |
| 3     | Email infrastructure (SPF/DKIM/DMARC + warm-up) | Pending         |
| 4     | Masterclass capture (registration + reminders)  | Pending         |
| 5     | 72-hour conversion sequence                     | Pending         |
| 6     | Stripe payment + resource delivery              | Pending         |
| 7     | Re-engagement (T+14d)                           | Pending         |
| 8     | Admin panel (full UI)                           | Pending         |
| 9     | n8n workflows (export + commit)                 | Pending         |
| 10    | Testing, observability, security pass           | Pending         |
| 11    | Documentation & handover                        | Pending         |

## License

Proprietary. © Learn with Leaders.
