# Gaps and proposals register

Two lists. **A — Gaps**: things the platform needs that PRD v2.1 does not specify. **B — Proposals**: things we introduced beyond the PRD that need sponsor sign-off. Nothing here is built as "decided" until the Status column says so.

## A. Gaps in the PRD

| # | Gap | Where it surfaced | Interim decision | Owner | Status |
|---|---|---|---|---|---|
| 1 | Public T&T when a reference matches shipments of several customer groups | S2.03, KB-CW1 §8 | Identical minimal response regardless of match count; never reveal parties or count | Product | Open |
| 2 | Sailing-schedule data provider for FG-9.2 | S3.05 | None named; adapter interface only | IT + Ops | Open |
| 3 | Virus scanning and size limits for customer document uploads (FG-3.2) | S2.04, S3.03 | 25 MB limit, Defender for Storage scan before CW1 transfer | IT security | Open |
| 4 | Which CW1 party roles grant visibility (notify party?) | KB-CW1, LLD §7 | Global policy: local client, shipper, consignee | Product + Ops | Open |
| 5 | CW1 organisation code format (case, length, characters) and client/carrier category flag | LLD §3.2, §5.3 | Permissive regex, case-insensitive uniqueness | CW1 team (request items 3, 4) | Open |
| 6 | Human-in-the-loop for the AI data-quality merge in FG-1.3 | S2.10 | Provenance + override with reason (platform principle) | Product | Open |
| 7 | Rate-selection contract between the portal and the designated rate engine (OQ-1) | S1.09 | `RateEngineAdapter.price(request) → options[]`; portal stores what it receives | Pricing + IT | Open |
| 8 | Retention period for deactivated users and audit records | LLD §8.6 | 730 days, erasure job in Phase 2 | Legal | Open |
| 9 | Customer SSO federation | LLD v3 §8 | Configured in Entra External ID (federation), no code of ours in any phase | IT | Closed |
| 10 | Region master data for news targeting (FG-4.5 global/country/region) | S1.06 | Seeded region table, editable | Product | Open |
| 11 | CO2 methodology, provider and disclaimer (OQ-11); re-verify provider landscape at Phase 4 start | KB-CO2 | Local GLEC factors labelled "estimate" | Sustainability + Legal | Open |

## B. Proposals beyond the PRD

| # | Proposal | Documents | Recommendation | Owner | Status |
|---|---|---|---|---|---|
| P1 | Second-person approval for org-code mapping | ADR-003, LLD v3 §6.2 | **v3: not built.** Linking is one audited action with a confirm dialog; `approved_by` column is the seam. Build the approve step only if Mohamed asks | Mohamed | Open |
| P2 | Impersonation read-only | ADR-003, LLD v3 §10 | **v3: always read-only**, no toggle | — | Accepted |
| P3 | Per-customer visibility policy overrides | KB-CW1 §5.2 (v1) | Deferred; global policy only | — | Deferred |
| P4 | Customer hierarchy deeper than two levels | Design v1 | Reduced to parent → children per PRD FG-8.1 | — | Closed |
| P5 | Bulk invitation by CSV | Design v1 | Deferred to Phase 2 backlog | Product | Deferred |
| P6 | GDPR erasure job | LLD §8.6 | Phase 2 (retention period pending Legal) | Legal | Deferred |
| P7 | Public "Request access" form | Design §5.7 | Not built; creates a ticket only if approved | Mohamed | Open |
| P8 | Nightly visibility consistency sweep | LLD §7 | Job skeleton, scheduled off until Phase 2 | — | Gated |
| P9 | Per-customer login slug / local MFA accounts | LLD v2 §8.5 | **v3: removed** — Entra External ID handles local accounts and MFA | — | Closed |
| P10 | Own CO2 factor table instead of a paid provider (Phase 4) | KB-CO2 §7 | Proposal; depends on OQ-11 | Sustainability | Open |
