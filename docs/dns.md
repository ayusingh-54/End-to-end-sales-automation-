# DNS records — outreach subdomain

Records to create in the LWL Cloudflare account once the sending subdomain is approved (default proposal: `outreach.learnwithleaders.com`).

## Required records

| Type                 | Name                     | Value                                                                                     | Why                                                                                                                                 |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| MX                   | `outreach`               | provider-supplied                                                                         | Receive bounces and forwarded replies                                                                                               |
| TXT (SPF)            | `outreach`               | `v=spf1 include:_spf.instantly.ai include:_spf.resend.com -all`                           | Authorise Instantly + Resend to send for the subdomain. `-all` means anything else is rejected — mandatory for cold deliverability. |
| TXT (DKIM)           | provider-supplied        | provider-supplied public key (one per provider)                                           | Cryptographic sender authentication                                                                                                 |
| TXT (DMARC)          | `_dmarc.outreach`        | `v=DMARC1; p=quarantine; rua=mailto:dmarc@learnwithleaders.com; aspf=r; adkim=r; pct=100` | Reject spoofed mail; collect reports. Start at `quarantine`, escalate to `reject` after 30 days clean.                              |
| TXT (BIMI, optional) | `default._bimi.outreach` | logo SVG URL                                                                              | Brand display in Gmail. Requires VMC certificate ($1500+/yr) for full support. Recommended only after the funnel is converting.     |

## Verification

After save:

```bash
dig +short TXT outreach.learnwithleaders.com
dig +short TXT _dmarc.outreach.learnwithleaders.com
```

Then run `mxtoolbox.com/SuperTool.aspx` against `outreach.learnwithleaders.com` — all three (SPF / DKIM / DMARC) should show green.

Final test: send one email through Instantly to `test@mail-tester.com`. Aim for **10/10** before any real campaign send.

## Process

1. LWL approves subdomain choice.
2. LWL Cloudflare admin (or LWL grants u2xai temporary scope) adds the records above.
3. Screenshot each record after save → commit to `docs/dns-screenshots/` (public DNS values only — no secrets).
4. Run the warm-up plan from `docs/email.md` for two weeks before any cold campaign.
