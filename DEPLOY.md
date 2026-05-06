# Deploy to Vercel — quick guide

This deploys the **admin Next.js app only**. Scraper worker + n8n stay local
(skipped for the pilot demo). Supabase is already cloud-hosted.

---

## Pre-deploy checklist

- [ ] All leaked keys ROTATED (Supabase, Apollo, Resend) — see project memory
- [ ] `.env.local` is **not** committed (gitignored)
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` all pass locally

---

## Step 1 — Push code to GitHub (10 min)

```bash
# In project root
cd "D:/Future Doctors Fellowship AI Sales Automation"

git add -A
git commit -m "feat: end-to-end FDF sales automation pipeline"

# Create a NEW empty repo on GitHub (e.g. lwl-fdf-pipeline) — do NOT init with README
# Then push:
git remote add origin https://github.com/<your-username>/lwl-fdf-pipeline.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Connect repo to Vercel (5 min)

1. Open https://vercel.com → sign in (use GitHub OAuth)
2. Click **"Add New" → "Project"**
3. Find your `lwl-fdf-pipeline` repo → **Import**
4. Configure:
   - **Project Name**: `lwl-fdf-pipeline`
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/admin` ← **important**
   - **Build / Install / Output**: leave defaults — they pick up `apps/admin/vercel.json`
5. Click **"Environment Variables"** — see Step 3 below for what to add

---

## Step 3 — Set environment variables in Vercel

Add these in Vercel dashboard → Project → Settings → Environment Variables.
Use ROTATED values (not the leaked ones).

### Required (without these the app errors)

```
NODE_ENV=production
SUPABASE_URL=https://xnwpylbbtffrpgqtqvgh.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://xnwpylbbtffrpgqtqvgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<rotated anon key>
SUPABASE_SERVICE_ROLE_KEY=<rotated service-role JWT>

ADMIN_ALLOWED_EMAILS=hello@lwl.com,hello@u2xai.com
SESSION_SECRET=<openssl rand -base64 32>

NEXT_PUBLIC_APP_URL=<the URL Vercel gave you, e.g. https://lwl-fdf-pipeline.vercel.app>
```

### Strongly recommended

```
RESEND_API_KEY=<rotated Resend key>
EMAIL_DEV_MAILHOG=0
EMAIL_FROM_ADDRESS=onboarding@resend.dev
EMAIL_FROM_NAME=Learn with Leaders

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=<paste after Step 5>

APOLLO_API_KEY=<rotated Apollo key>
APOLLO_DAILY_QUOTA=15

N8N_WEBHOOK_SECRET=<openssl rand -hex 32>
```

### Optional (skip for pilot)

```
INSTANTLY_API_KEY=
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
LINKEDIN_AGENT_URL=
LINKEDIN_AGENT_API_KEY=
ZEROBOUNCE_API_KEY=
SENTRY_DSN=
```

---

## Step 4 — First deploy

After saving env vars, click **Deploy**. First build takes ~3 min.

When done you'll get a URL like:

```
https://lwl-fdf-pipeline.vercel.app
```

Open it. Should redirect to `/login`. Sign in with `hello@lwl.com` + your password
→ should land on `/` (home page) with live KPIs.

---

## Step 5 — Wire Stripe webhook (so payments record automatically)

In production, Stripe can reach your Vercel URL → no need for the "Mark paid (demo)" button.

1. Open https://dashboard.stripe.com/test/webhooks → **Add endpoint**
2. **Endpoint URL**: `https://<your-vercel-url>/api/webhooks/stripe`
3. **Events to send**: `checkout.session.completed`
4. Click **Add endpoint**
5. On the next page, click **Reveal** under **Signing secret** — copy the `whsec_...` value
6. Vercel dashboard → Project → Settings → Environment Variables → set `STRIPE_WEBHOOK_SECRET=whsec_...`
7. **Redeploy** (Vercel dashboard → Deployments → "..." → Redeploy)

Now real payments via Stripe Checkout will auto-record in `payments` table + send receipt + flip lead status to `paid`. The "Mark paid (demo)" button becomes unnecessary on production.

---

## Step 6 — Send the URL to the recruiter

Demo URL to share:

```
https://<your-vercel-url>
```

Login credentials (provide to recruiter via DM, not email):

```
Email:    hello@lwl.com
Password: <your password>
```

OR create a separate **read-only viewer account** for them:

```sql
-- Run in Supabase SQL editor after creating a new user `recruiter@lwl.com` in Auth
insert into public.user_roles (user_id, role)
select id, 'viewer'::public.app_role
from auth.users where email = 'recruiter@lwl.com'
on conflict (user_id) do update set role = 'viewer';
```

---

## Things to test on production after deploy

- [ ] `/login` → sign in works
- [ ] `/` (home) renders with KPIs
- [ ] `/dashboard` shows funnel
- [ ] `/leads` shows existing leads
- [ ] `/m/fdf-test` (public page, no login) renders the landing
- [ ] Submit registration form on `/m/fdf-test` → confirmation email arrives
- [ ] Sidebar navigation works (active highlight)
- [ ] Sign out → back to /login

If something errors: Vercel → Deployments → click the deployment → **Functions** tab → see runtime logs.

---

## Rolling back

If something breaks: Vercel → Deployments → previous green deployment → **"..."** → **Promote to Production**. Instant rollback.
