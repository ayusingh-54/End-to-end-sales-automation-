# @lwl/scraper

Long-running Node 20 worker. Owns three jobs (Phase 2):

1. **School discovery** — fetch seed sources (NCES, BSR, NAIS), extract candidate schools into `schools_raw`.
2. **Tier verification** — score against `school_tier_rules`, mark `tier_verified` per `docs/tier-rules.md`.
3. **Contact enrichment fallback** — when Apollo returns nothing, scrape the school's "Faculty / College Counseling" page directly.

The worker reads its job spec from a queue (DB-backed in dev, n8n webhook trigger in prod), respects `robots.txt` via `robots-parser`, and rate-limits per host (`src/lib/rate-limit.ts`).

Identifies as `LWL-LeadBot/1.0 (+https://learnwithleaders.com/bot)`. Default 1 req/sec/host. Never scrapes behind login or fights anti-bot.

## Local dev

```bash
pnpm -F @lwl/scraper dev
```

## Container

`apps/scraper/Dockerfile` is a multi-stage build on `mcr.microsoft.com/playwright` so headless Chromium ships pre-installed. Deploys to Railway (Phase 0 default).
