# Email — provider, deliverability, warm-up

## Provider split

| Use case                                                                               | Provider         | Why                                                                                                                                                    |
| -------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cold outreach (invite, offer sequence, re-engagement)                                  | **Instantly.ai** | Built-in inbox rotation + automated warm-up; ESP designed for cold-outbound at exactly this volume. SendGrid/Mailgun get throttled fast on cold sends. |
| Transactional (registration confirmation, receipt, resource delivery, internal alerts) | **Resend**       | Cheap, reliable templating, easy DMARC story.                                                                                                          |
| Local dev                                                                              | **Mailhog**      | Captures all outbound; nothing leaves the machine.                                                                                                     |

See ADR-0001.

## Sending domain

Dedicated subdomain — recommended `outreach.learnwithleaders.com`. Keeps cold reputation isolated from the main domain.

## SPF / DKIM / DMARC

See `docs/dns.md`. DMARC starts at `p=quarantine`; escalate to `p=reject` after 30 days clean reports.

## Warm-up plan (the constraint)

| Week         | Daily volume   | Notes                                                                 |
| ------------ | -------------- | --------------------------------------------------------------------- |
| 1 (days 1-5) | <50            | Instantly auto-warm against partner inboxes only. No real recipients. |
| 1 (days 6-7) | 100            | First seed-inbox tests (mailmeteor / inbox tester).                   |
| 2            | 200-500        | Mixed real-recipient + warm pool.                                     |
| 3+           | up to plan cap | Live campaign sends begin.                                            |

**No cold campaign launches** until: warm-up complete + SPF/DKIM/DMARC pass on `mail-tester.com` (10/10) + bounce <2% on the seed-inbox set.

## Deliverability monitoring

- Daily inbox-placement test on a 10-seed-inbox set.
- Weekly Postmaster Tools (Google) review for the subdomain.
- **Bounce rate alert at >3%, auto-pause at >5%** — implemented in the admin's webhook handler (`app/api/webhooks/instantly/route.ts` flips `leads.status='lost'` on hard bounce).
- Reply rate tracked per template via the same webhook path.

## Idempotency

Every send computes `idempotency_key = sha256("<purpose>:<campaign_id|nil>:<lead_id>:<template_id|nil>")` and is stored on `email_sends`. The unique index on `email_sends.idempotency_key` makes retried sends safe.

## Templates

12 kinds per program (see `email_template_kind` enum). Renderer is in `packages/shared/email/render.ts` — minimal Handlebars-style with HTML-escape default + `{{{var}}}` raw + missing-variable reporting. Tests in `packages/shared/test/render.test.ts`.

## Pilot deliverability honesty

- For the Monday 2026-05-11 submission, the cold-send subdomain may **not** be fully warmed (warm-up takes 14 days, pilot runs 6). The Loom walkthrough explicitly states this and shows sends going to seed inboxes via Resend transactional + Mailhog dev.
- Live cold launch is T+14d from the pilot start of warm-up.
