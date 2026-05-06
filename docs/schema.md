# Database schema (ER diagram)

> Phase 1 deliverable. SQL is in `packages/db/migrations/0001_init.sql` + `0002_rls.sql`. Seed is in `packages/db/seed.sql`.

## Mermaid ER diagram

```mermaid
erDiagram
    programs ||--o{ masterclasses : has
    programs ||--o{ target_roles : has
    programs ||--o{ school_tier_rules : has
    programs ||--o{ email_templates : has
    programs ||--o{ campaigns : runs
    programs ||--o{ offers : sold_as

    masterclasses ||--o{ registrations : captures
    masterclasses ||--o{ campaigns : powers

    schools ||--o{ leads : has
    schools_raw ||--o| schools : promoted_to

    leads ||--o{ email_sends : received
    leads ||--o{ registrations : registered
    leads ||--o{ offers : offered
    leads ||--o{ payments : paid
    leads ||--o{ pipeline_events : logged_against

    campaigns ||--o{ email_sends : drove
    campaigns ||--o{ offers : created
    campaigns ||--o{ pipeline_events : produced

    email_templates ||--o{ email_sends : rendered_from

    offers ||--o{ payments : settled_by

    auth_users ||--o| user_roles : has
    auth_users ||--o{ audit_log : actor

    programs {
      uuid id PK
      text slug UK
      text name
      int standard_price_cents
      int offer_price_cents
      int offer_window_hours
      program_status status
    }
    masterclasses {
      uuid id PK
      uuid program_id FK
      text mentor_name
      text topic
      timestamptz scheduled_at
      text registration_page_slug UK
      masterclass_status status
    }
    schools {
      uuid id PK
      text name
      text country
      int tuition_usd
      int tier_match_score
      bool tier_verified
      jsonb tier_signals
    }
    leads {
      uuid id PK
      uuid school_id FK
      citext email UK
      text linkedin_url UK
      bool email_verified
      bool role_verified
      lead_status status
      text idempotency_key UK
    }
    campaigns {
      uuid id PK
      uuid program_id FK
      uuid masterclass_id FK
      campaign_status status
      int daily_send_cap
    }
    email_sends {
      uuid id PK
      uuid lead_id FK
      uuid template_id FK
      uuid campaign_id FK
      text provider
      text provider_message_id UK
      text idempotency_key UK
    }
    offers {
      uuid id PK
      uuid lead_id FK
      uuid program_id FK
      int price_cents
      timestamptz expires_at
      text stripe_session_id UK
      offer_status status
    }
    payments {
      uuid id PK
      uuid lead_id FK
      uuid offer_id FK
      text stripe_payment_intent_id UK
      int amount_cents
      payment_status status
    }
    pipeline_events {
      uuid id PK
      uuid lead_id FK
      uuid campaign_id FK
      pipeline_stage stage
      event_status status
      jsonb payload_json
    }
```

## Key constraints

- `leads.idempotency_key` is unique — every external upsert path computes this from `(program_id, source, email)` so re-running enrichment never duplicates.
- `email_sends.idempotency_key` is unique — every send computes from `(lead_id, template_id, campaign_id)` so retried sends don't double-mail.
- `payments.stripe_payment_intent_id` is unique — Stripe webhook is naturally idempotent.
- `offers.stripe_session_id` is unique — enforces 1:1 with the Checkout session.
- `schools.website` is unique (case-insensitive) — same school across two seed sources collapses.
- `registrations(lead_id, masterclass_id)` is unique — re-registering the same lead is a no-op.

## Funnel view

`public.campaign_funnel` joins `campaigns → email_sends → registrations → offers → payments` and exposes:

`emails_sent · opened · clicked · registered · attended · offered · paid · revenue_cents`

The dashboard in Phase 8 reads from this view; no application-side aggregation. This is what makes "every funnel number answerable in <30s" honest.
