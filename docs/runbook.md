# Runbook

## Starting a campaign (the happy path)

1. Sign in to the admin panel (magic link).
2. **Programs → New** if the program doesn't exist (or **Clone** from FDF). Set prices + offer window.
3. **Programs → (your program)** add a masterclass (mentor, topic, scheduled-at, Zoom URL).
4. **Templates** — confirm 12 template kinds exist for the program. Edit subject + body if needed; preview rendering with a test lead.
5. **Campaigns → New** — pick program + masterclass + daily send cap.
6. **Campaigns → Resume** to flip status from `draft` to `running`. The admin signs a webhook to n8n's `/start_campaign` (workflow 06), which calls back into `/api/jobs/send-invites` — that's the actual sender.
7. Watch **Dashboard** for funnel drift. Watch **Logs** for `error`-status events.

## Daily operations

- **Mornings:** check Dashboard. If `bounce` count grows >3% of sent, **Pause** the campaign.
- **After each masterclass ends:** workflow 09 fires every 15 min and pushes the offer sequence (D0, D1, D2 morning, D2 final). Workflow 10 fires every 6h for no-shows.
- **After payment:** the Stripe webhook (admin route) inserts the payment, sends receipt + resource pack. Workflow 11 reconciles every 6h as a safety net.

## Common failures and fixes

| Symptom                                         | Likely cause                     | First action                                                                                                           |
| ----------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "discovery_failed" in logs                      | Seed-source HTML changed         | Update selectors in `apps/scraper/src/jobs/school-discovery.ts`; selectors are in 3 small functions, low blast-radius. |
| `apollo_429`                                    | Apollo daily quota hit           | Lower `APOLLO_DAILY_QUOTA` env or upgrade Apollo plan.                                                                 |
| `zerobounce_402`                                | Out of credits                   | Top up at zerobounce.net.                                                                                              |
| Bounce rate >5%                                 | Domain reputation drop           | Pause campaign, check Postmaster Tools, review last 24h sends. Consider lowering `daily_send_cap`.                     |
| Stripe webhook missed                           | Network blip                     | Workflow 11 catches within 6h. To force now, hit `/api/jobs/stripe-reconcile` with HMAC.                               |
| Reminders not firing                            | Workflow 07 stopped in n8n       | Open n8n editor, check `07 masterclass reminders` execution log.                                                       |
| "register_for_masterclass: unknown_masterclass" | Slug mismatch                    | Check `masterclasses.registration_page_slug` matches the URL.                                                          |
| Magic link not arriving                         | Resend rate limit / DKIM not set | Check Supabase Auth logs; verify DNS in `docs/dns.md`.                                                                 |

## Pause / stop a campaign mid-flight

- Admin → Campaigns → click **Pause**. The status flips to `paused` and `/api/jobs/send-invites` exits early on next call.
- Stripe Checkout sessions already created remain valid for 72h — that's by design (offer windows shouldn't be revoked retroactively).

## Rotating a credential

1. Generate new value in the vendor's dashboard.
2. Update env in **all** of: Cloudflare Pages, Railway (n8n + scraper).
3. Redeploy admin (Cloudflare) + restart n8n container.
4. Confirm next pipeline event is a `success` for the affected stage.

## Who to call

To be filled at handover with LWL on-call rotation.
