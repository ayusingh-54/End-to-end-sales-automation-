# Loom walkthrough script (10–15 min)

Record this from the deployed admin panel. Time stamps are guides.

---

## 0:00 — Intro (30 sec)

> "Hi Gunjan, this is the FDF pilot — end-to-end sales automation from school discovery through to payment received. I'll walk you through the live system, then show how you'd clone it for the next program. Whole thing is about 12 minutes."

---

## 0:30 — Architecture overview (90 sec)

Open `docs/architecture.md` (the diagram).

> "Two execution planes. n8n owns long-running orchestration — scrape, send, reminders, payments. Next.js + Supabase own UI, auth, config. The dashboard never calls Apollo or sends mail directly; it writes config rows and triggers n8n via signed webhooks. That split keeps the UI fast and the long jobs reliable."

Mention: hosted on Cloudflare Pages (admin) + Railway (scraper + n8n + n8n's Postgres) + Supabase (primary DB).

---

## 2:00 — Data acquisition (90 sec)

Open admin → **Schools** page.

> "From zero. No pre-built list. Three seed sources: NAIS member directory, Boarding School Review, TABS. The scraper fetches them, dumps to `schools_raw`, then a tier-verification job scores each against a configurable rubric — tuition floor $40k, NAIS membership, boarding y/n, top-5 college matriculation. Score >= 70 promotes to `schools` with `tier_verified=true`. Here are the verified ones, ranked."

Click into a school → mention `tier_signals` JSONB (the audit trail).

---

## 3:30 — Lead enrichment (60 sec)

Open admin → **Leads** page.

> "Apollo finds people at each verified school matching the program's `target_roles`. Every lead has a deterministic idempotency key, so re-runs never duplicate. LinkedIn agent verifies role + employer. ZeroBounce verifies the email address. A lead only graduates to `verified` after all three checks pass. Here's the funnel."

Show a `verified` lead. Mention bounce + role-match accuracy targets (5% / 90% / 95%).

---

## 4:30 — Masterclass + registration (90 sec)

Open `/m/fdf-march-cohort` (or a real slug) in a new tab.

> "Public registration page generated from the masterclass row in the DB. Anonymous user fills the form, the server action calls a `SECURITY DEFINER` Postgres function — that's the only way an anon user touches the leads table. They get an ICS calendar invite + confirmation email immediately."

Show the **Logs** page filtered to `invite_send`.

---

## 6:00 — Reminders + attendance (60 sec)

Open `/api/jobs/reminders` (well, the n8n workflow `07 masterclass reminders`).

> "Workflow 07 fires every 30 min, finds registrations whose masterclass is in the 24h or 1h window, and sends. After the masterclass runs, workflow 08 pulls Zoom's attendance report and marks `attended` + `attendance_minutes`. >= 10 minutes counts as attended."

---

## 7:00 — 72-hour offer sequence (90 sec)

Open n8n → workflow `09 offer sequence (attendees)`.

> "Four-step sequence: D0 → D1 → D2 morning → D2 final 4h. Each step posts to the admin's offer-sequence route which creates a Stripe Checkout session — idempotent, with `client_reference_id = lead_id` and metadata for the webhook to read. Workflow 10 runs the parallel no-show sequence."

Click an `offered` lead → show the Stripe checkout URL field.

---

## 8:30 — Payment + resource delivery (90 sec)

Trigger a Stripe **test** checkout (use card 4242 4242 4242 4242).

> "Stripe webhook signature is verified inside the admin route. On `checkout.session.completed`: payments row inserted (idempotent on the payment intent ID), lead status → `paid`, receipt email sent via Resend, signed R2 URL to the resource pack sent (7-day expiry). Workflow 11 reconciles every 6h to catch any missed webhooks."

Show the resulting `payments` row + the welcome email in the inbox.

---

## 10:00 — Re-engagement (30 sec)

Open n8n → workflow `12 re-engagement`.

> "Daily cron. 14-30 days after offer expiry, fresh-angle email with a link to the next masterclass. Idempotency-keyed per offer so no one gets two."

---

## 10:30 — Funnel dashboard (45 sec)

Open admin → **Dashboard**.

> "Every funnel number — sent, opened, clicked, registered, attended, offered, paid, revenue — comes from a Postgres view called `campaign_funnel`. No app-side aggregation. So 'how are we doing on this campaign' is one query, sub-second."

---

## 11:15 — Cloning to a new program (90 sec)

Open admin → **Programs → New → Clone**.

> "Pick FDF as source, give the new program a slug + name. The clone copies target_roles, tier rules, and all 12 email templates as a starting point. Edit prices, edit copy, attach a masterclass, start a campaign. Total time: under a day for a non-engineer. No code changes. No redeploys. That's the entire point of the pilot."

Walk through `docs/replication-guide.md` if there's time.

---

## 12:45 — Honest scope notes (60 sec)

> "Three things to call out openly:
>
> 1. **Domain warm-up:** SPF/DKIM/DMARC are configured but the cold-send domain is mid-warmup — full-volume cold launch is T+14 days. Today's sends went via Resend transactional + Mailhog locally.
> 2. **The `register_for_masterclass` RPC** is the only anon-callable surface. Everything else is RLS'd or HMAC'd or service-role-only.
> 3. **Pen test** is out of scope for the pilot — recommend an external firm before scaling beyond FDF.
>
> Code is in [repo URL]. Credentials are in the LWL accounts per the handover checklist. Happy to extend the pilot to the next program once you give the signal."

---

## After recording

- Trim silences. Cut the Stripe test card waiting screen if it lingers.
- Upload to LWL Loom workspace, share with Gunjan + the LWL team allow-list.
- Paste the link into `docs/handover.md`.
