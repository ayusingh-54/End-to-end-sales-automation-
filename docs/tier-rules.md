# School tier rules — FDF (USA)

> Phase 0 stub. The scoring rubric below is the **proposed** starting point. Phase 2 will calibrate against a 50-school manual audit.

## Goal

Filter the school universe to **premium-private US schools** only. Tuition USD 40,000+. Boarding schools, elite day schools. Public, charter, low-fee private, and community schools are out of scope.

Wrong-tier leads = quality failure (master prompt §8 quality gate).

## Rubric — `tier_match_score` (0–100)

| Signal                                                                                           | Points | Source                         |
| ------------------------------------------------------------------------------------------------ | ------ | ------------------------------ |
| Annual tuition ≥ $40k                                                                            | 35     | School admissions page or NCES |
| Annual tuition ≥ $60k                                                                            | +15    | same                           |
| NAIS member                                                                                      | 15     | nais.org member directory      |
| TABS (Boarding) member                                                                           | 10     | tabs.org member directory      |
| SSATB testing accepted                                                                           | 5      | school admissions page         |
| Boarding offered                                                                                 | 10     | school site                    |
| College matriculation list shows ≥3 of {Harvard, Yale, Stanford, Princeton, MIT} in last 3 years | 10     | school site                    |
| Endowment ≥ $50M (where disclosed)                                                               | 5      | 990 / school site              |
| Average class size ≤ 15                                                                          | 5      | school site                    |

**Threshold:** `tier_verified = true` if `tier_match_score >= 70` **AND** `tuition_usd >= 40000` (hard floor).

## Hard exclusions (regardless of score)

- Public school district
- Charter school
- For-profit
- "Career and technical" only
- Religious schools where tuition is structurally below $40k due to subsidy

## Calibration

Phase 2 manual audit: pick 50 schools, score them, then have a human review. Tune weights until manual reviewer agrees with `tier_verified` on ≥95% (the master prompt §8 quality gate).
