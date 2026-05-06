# n8n workflows

Exported workflow JSONs land here in Phase 9. Each file is named `NN_workflow_name.json` matching the master prompt §6 Phase 9 list:

```
01_school_discovery.json
02_tier_verification.json
03_contact_enrichment.json
04_linkedin_verification.json
05_email_validation.json
06_send_invites.json
07_masterclass_reminders.json
08_attendance_sync.json
09_offer_sequence_attendees.json
10_offer_sequence_noshows.json
11_stripe_webhook_handler.json
12_reengagement.json
13_bounce_reply_handler.json
```

## Conventions

- Every node carries a sticky note explaining what it does.
- Credentials reference n8n's encrypted credential store by name — never inline.
- Workflows are exported with `n8n export:workflow --all --output=infra/n8n/` and committed.
- Local dev: workflows are mounted read-only at `/workflows` in the n8n container; import via the editor UI when iterating.
