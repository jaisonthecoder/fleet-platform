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
| 12 | Whether the integration team can supply API or test access early, which would reduce or remove the simulator (OQ-2a) | Integration team | Simulator scope only — platform is indifferent | Open |
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
| P11 | Internal quote pricing inside the portal, with write-back to CargoWise | Design-Internal-Quote-Pricing-in-Portal.md | **New business request after PRD v2.1.** Changes the stated non-goal about operational workflows, so it needs sponsor sign-off in writing. Design proposes CargoWise remains the record and wins all conflicts. Seven confirmations open in §12 of that note | Mohamed | **Pending sign-off** |

## C. Closed by the KT session of 09.09.2026

| # | Item | Outcome |
|---|---|---|
| 1 | Public critical-milestone set | Picked up, departed, ETA, arrived, delivered; loaded-at-export and unloaded-at-import for sea |
| 4 | Which party roles grant visibility — partly | Financial visibility resolves from the transaction addressee only. Shipment visibility policy still open, now including whether notify party counts (OQ-3b) |
| — | Carrier visibility provider | Not required: carrier data arrives through CargoWise's own carrier integrations. Provider stays optional |
| — | Booking cancellation gate | Blocked after pickup or off-site delivery; hard stop at the Shipped event |
| — | Portal roles versus CargoWise roles | Independent, explicitly agreed |

## D. New, from the KT session of 09.09.2026

| # | Item | Why it matters | Owner | Status |
|---|---|---|---|---|
| N1 | **Are shipment and invoice parties stored as organisation codes or address codes?** Addresses beneath an organisation each carry their own code | Tenant resolution matches organisation codes today. If parties carry address codes, resolution needs the address-to-organisation relationship in the master-data feed | CW1 team | **Open — highest technical risk** |
| N2 | Cross-trade billing means a notify party can be the paying customer. Should notify party grant shipment visibility, or only financial visibility through the addressee? | Current policy excludes notify party, so a cross-trade customer would not see their shipment | Product + Ops | Open |
| N3 | Categorised critical-path event list per mode, and the confirmed internal-only exclusions, from roughly 664 generic events | Event mapping in Phase 2 | Ops + Digital Products | Awaited |
| N4 | Document-type list with categories, and the confirmed customer-facing allow-list | Document visibility in Phase 2; typing is manual and unvalidated | Ops + Digital Products | Awaited |
| N5 | How a customer raises a claim today, and where staff re-key between systems | Phase 3 claims scope | Digital Products | Awaited |
| N6 | Head of Pricing appetite for pricing inside the portal; whether cost and margin are captured | Phase 1 stage F1.08 | Sponsor + Head of Pricing | Awaited |
| N7 | Whether the standardised quotation process starts with regions newly onboarding to CargoWise rather than retrofitting existing ones | Rollout order, not the build | Ops + Product | Open |
| N8 | Interface contract and availability of the AI email drafting service | Polish only; template fallback covers it | Digital Products | Awaited |
| N9 | Whether the master-data programme will supply organisation hierarchies, and when | Manual grouping is pluggable meanwhile | MDM programme | Open |
| N10 | Rate storage today, and whether an assisted rate suggestion is feasible from any existing source | Instant path only | Business + Digital Products | Open |
