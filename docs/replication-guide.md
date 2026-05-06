# Replication guide — adding the next program

> Audience: a smart non-engineer at LWL. Target: under 2 days end-to-end.

## TL;DR

You will:

1. Click **Programs → Clone** in the admin panel and pick FDF as the source.
2. Edit the cloned program's prices + name + slug.
3. Add a masterclass (mentor + topic + Zoom URL + date).
4. Edit the cloned email templates so the copy matches the new audience.
5. Create + start a campaign.

**No code changes. No redeploys.**

---

## Step-by-step

### 1. Decide the basics (15 minutes)

Write down:

- Program slug (e.g. `edge-club`) — lowercase, hyphens
- Display name (e.g. "Edge Club")
- Standard price (in USD cents — `85000` for $850)
- Offer price (e.g. `40000` for $400)
- Offer window (`72` hours is the FDF default; change if your funnel differs)
- Masterclass topic, mentor name + bio, scheduled date/time UTC, Zoom join URL
- Resource pack URL — upload the PDF to R2 and paste the path

### 2. Clone the program (5 min)

- **Programs → New** → "Clone an existing program"
- Source: **Future Doctors Fellowship**
- New slug, new name → Clone

This copies: `target_roles`, `school_tier_rules`, all `email_templates`. Edit afterwards.

### 3. Update target roles + tier rules (15 min)

- **Programs → (new) → Target roles** — add/remove role titles. Roles are matched by Apollo, so use the canonical job-title strings the platform recognises (e.g. "College Counselor" not "CC").
- **Tier rules** — adjust `min_tuition_usd`, `country`, `school_types`. The default scoring weights are sensible for elite US private schools; only change if your program targets a different tier.

### 4. Add a masterclass (5 min)

- **Programs → (new) → Masterclasses → New**
- Fill mentor, topic, scheduled-at, Zoom URL, registration-page slug (URL-safe).
- The public registration page is now live at `https://your-domain/m/<slug>`. Test it from a private window.

### 5. Edit email templates (60-90 min)

- **Templates** — there are 12 kinds per program. Each has a subject + body + declared variables.
- Edit copy to fit the new audience. Available variables are listed in the right column; the renderer HTML-escapes by default.
- Send each template to a seed inbox (mailmeteor / your own work email) and confirm rendering.

### 6. Create + start a campaign (5 min)

- **Campaigns → New** — pick program + masterclass + daily send cap (start at 50 for the first 5 days, ramp up to 200+).
- **Resume** to start the pipeline.

### 7. Daily check-in (5 min/day until the masterclass)

- Watch the **Dashboard** funnel.
- Watch **Logs** for `error`-status events.
- If bounce >3% — pause and investigate.

---

## What if something is missing?

| Missing                              | Where it shows up                         | Fix                                                      |
| ------------------------------------ | ----------------------------------------- | -------------------------------------------------------- |
| Email template for the program       | "template_missing" in `pipeline_events`   | Add it from **Templates**.                               |
| Masterclass attached to the campaign | Offer-sequence step says `no_masterclass` | Edit campaign, attach masterclass.                       |
| Tier rules for the new country       | Discovery scrapes nothing                 | Add a `school_tier_rules` row from **Programs → (new)**. |

## Things that DO require an engineer (rare)

- Adding a brand-new pipeline stage (e.g., a workshop between masterclass and offer).
- Adding a brand-new email provider beyond Instantly/Resend.
- Onboarding a new geography that needs a new seed-source scraper.

These are <1 day of engineering each. Everything else is config.
