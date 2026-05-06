# @lwl/db

Supabase migrations + a thin client factory + generated TypeScript types.

## Layout

- `migrations/`
  - `0001_init.sql` — extensions, enums, tables, indexes, triggers, helper RPCs, funnel view.
  - `0002_rls.sql` — Row Level Security policies (admin/operator/viewer).
- `seed.sql` — FDF program + target roles + tier rules + 12 email templates. Idempotent.
- `src/index.ts` — `createAdminClient()` wraps `@supabase/supabase-js` with safe defaults.
- `src/types.ts` — placeholder; replaced by `src/types.gen.ts` from `pnpm supabase:gen`.

## Apply migrations

Local Postgres (via `infra/docker-compose.yml`):

```bash
docker exec -i lwl-postgres psql -U lwl -d lwl < packages/db/migrations/0001_init.sql
docker exec -i lwl-postgres psql -U lwl -d lwl < packages/db/migrations/0002_rls.sql
docker exec -i lwl-postgres psql -U lwl -d lwl < packages/db/seed.sql
```

Supabase (remote): paste each file into the SQL Editor in order, or use the Supabase CLI:

```bash
supabase db push
```

## Regenerate TypeScript types

After any migration:

```bash
SUPABASE_PROJECT_ID=<your-project-id> pnpm -F @lwl/db supabase:gen
git add packages/db/src/types.gen.ts
```

Commit both the migration and the regenerated types in the same PR.

## RLS in plain English

| Role                 | Can do                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `service_role` (n8n) | Bypasses RLS — full access. Used by every n8n workflow.                                      |
| `admin`              | Read + write everything from the JWT.                                                        |
| `operator`           | Read everything; write campaigns, templates, leads (no user_roles, no audit_log writes).     |
| `viewer`             | Read-only on programs, campaigns, schools, pipeline_events, registrations. Limited on leads. |
| `anon`               | Default deny. Single exception: `register_for_masterclass(...)` SECURITY DEFINER RPC.        |
