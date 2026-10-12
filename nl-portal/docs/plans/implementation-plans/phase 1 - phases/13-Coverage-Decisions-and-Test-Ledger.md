# Phase 1 coverage, decisions and test ledger

Version 1.0, 11.09.2026. Status: planning traceability only; all execution evidence pending. Use with the [stage index](README.md), [FR baseline](../../01-Functional-Requirements.md), [NFR baseline](../../02-Non-Functional-Requirements.md) and [decision register](../../README.md).

## 1. Coverage convention

The table accounts for every FR whose delivery column mentions P1, plus the first-upload requirement. This includes explicit boundaries such as future-module menus and the statement that quotation CO2 is not a P1 dependency. Listing such a row does not promote its later workflow into this release.

Each row maps to an owning stage and a minimum verification target. Detailed tests live with the slice. A row is not completed until actual test/build/reviewer evidence exists. No new FR IDs or changed baseline counts are introduced by this set.

## 2. Functional traceability

| Requirement | Stage owner | Phase 1 treatment / minimum evidence |
| --- | --- | --- |
| FR-IAM-001 | P1.02 | Two trusted Microsoft issuer paths; invalid token denial; no own auth |
| FR-IAM-002 | P1.02 | Concurrent eligible staff registration creates one identity with no business grant |
| FR-IAM-003 | P1.05 | Audited portal role/branch assignment and removal |
| FR-IAM-004 | P1.01/P1.02 | Controlled bootstrap, never first-login admin |
| FR-IAM-005 | P1.06 | Noatum first admin; own-customer colleague invitations only |
| FR-IAM-006 | P1.06/P1.07 | Hashed single-use invitations, configured expiry/resend/revoke tests |
| FR-IAM-007 | P1.06 | Domain enforcement; authorised internal exception only |
| FR-IAM-008 | P1.02/P1.06 | Issuer/subject binding; email change cannot relink identity |
| FR-IAM-009 | P1.02/P1.05/P1.06 | Portal permission union, route enforcement and no Azure-group grants |
| FR-IAM-010 | P1.02/P1.05/P1.06 | Same-token next-request denial after revocation/deactivation |
| FR-IAM-011 | P1.06 | External preset limits and concurrent last-admin protection |
| FR-IAM-012 | P1.06/P1.07 | Permission/reason/timebox/banner; impersonation cannot write |
| FR-ORG-001 | P1.06/P1.07 | Group/domains/tier/features and two-level hierarchy without region hard-coding |
| FR-ORG-002 | P1.04/P1.06 | Daily searchable source mirror; audited organisation-level links |
| FR-ORG-003 | P1.04/P1.06 | Source-qualified unique ownership and reassignment race protection |
| FR-ORG-004 | P1.02/P1.06 | Downward visibility foundation; no parent/sibling leakage; shipments populated P2 |
| FR-ORG-005 | P1.04 | OQ-3a organisation/address lookup; ambiguous reference quarantined |
| FR-ORG-006 | P1.06 | Linked office plus accepted admin activates; suspension blocks access, not ingestion |
| FR-ORG-007 | P1.04/P1.06 | Available quote/source exceptions now; shipment exception population P2 |
| FR-ORG-008 | P1.06 | Financial-office restriction configuration; fixture denial now, finance workflows P2 |
| FR-ORG-009 | All stages | Protected business/admin audit and privacy-safe analytics |
| FR-CFG-001 | P1.07 | Scoped settings view/change permissions and usable editor |
| FR-CFG-002 | P1.07 | Approved scope matrix, effective inheritance, override removal and conflicts |
| FR-CFG-003 | P1.07/P1.10 | Direct/CW1-confirmed mode independent from initial-request sync |
| FR-CFG-004 | P1.07/P1.09 | Independent approval settings, signed threshold/currency boundaries |
| FR-CFG-005 | P1.07/P1.09 | Configured claim expiry and authorised force-release; no lock bypass |
| FR-CFG-006 | P1.07/P1.09 | Approved commercial defaults/disclosure/cost capture, not cost access grant |
| FR-CFG-007 | P1.07/P1.10 | Approved templates/drafting/entitlements; no unreleased feature activation |
| FR-CFG-008 | P1.07-P1.11 | Versioned reasoned policy changes; no retroactive publication or lost approval |
| FR-NAV-001 | P1.03 | Five future-module menu definitions in EN/ES |
| FR-NAV-002 | P1.02/P1.05/P1.06 | Future view/action permission catalogue and assignment |
| FR-NAV-003 | P1.03/P1.07 | Entitlement/permission eligibility separate from release readiness |
| FR-NAV-004 | P1.03 | Direct URL and menu unavailable-state tests; no mock data/API calls |
| FR-NAV-005 | All API/UI stages | Independent route/API feature and access enforcement |
| FR-NAV-006 | P1.03 | Responsive shell, identity, locale and notification entry |
| FR-QTE-001 | P1.08 | Air/FCL/LCL wizard and complete server-validated requests |
| FR-QTE-002 | P1.08 | Optional doors/commodity/HS/temp; required DG UN/class associations |
| FR-QTE-003 | P1.08/P1.09 | Server calculations, approved rounding and FCL equipment counts |
| FR-QTE-004 | P1.08 | Autosave/reload and out-of-order/stale-save protection |
| FR-QTE-005 | P1.08 | Server-resolved authorised office/source organisation |
| FR-QTE-006 | P1.08 | Branch queue, optional atomic initial CW1 job, no rate dependency |
| FR-QTE-007 | P1.08 | Rate interface unconfigured; stub timeout/manual fallback only |
| FR-QTE-008 | P1.08/P1.10/P1.11 | Portal/source-originated quotes and explicit canonical lifecycle |
| FR-QTE-009 | P1.08/P1.11 | Saved Grid/Detail/Card, safe options/totals/history/disclosure |
| FR-QTE-010 | P1.09 | Exclusive claim, expiry and force-release concurrency |
| FR-QTE-011 | P1.09 | Manual selling charges and terms without rate tables |
| FR-QTE-012 | P1.09 | Required different-person approval, reasoned rejection and signed boundaries |
| FR-QTE-013 | P1.10 | One publication of recorded snapshot through selected policy |
| FR-QTE-014 | P1.10 | CW1 authority where applicable; direct/accepted collision protection |
| FR-QTE-015 | P1.09/P1.10 | Reconstruct claim/pricing/approval/publication/sync with snapshots |
| FR-QTE-016 | P1.09-P1.12 | No internal cost/margin/line leakage across any customer output |
| FR-QTE-017 | P1.10 | Other-team draft, template fallback, provenance/edit and explicit human send |
| FR-QTE-018 | P1.11 | Valid selected-option acceptance, immutability, mapped/local response distinction |
| FR-QTE-019 | P1.07/P1.11 | Configured rejection reason, next version and preserved history |
| FR-QTE-020 | P1.11 | Safe versioned PDF, independent copy/template and eligible cancellation |
| FR-TOL-001 | P1.08/P1.11 | Address/quote-template CRUD/share/use; booking extension remains P3 |
| FR-TOL-002 | P1.08 | Bounded safe CSV/XLSX mapping/report/commit and scoped XLSX export |
| FR-TRK-001 | P1.02/P1.03 | Menu/access/shared-visibility foundation only; tracking workflow P2 |
| FR-DOC-001 | P1.03/P1.04 | Menu/access/mapping foundation; customer document allow-list workflow P2 |
| FR-DOC-004 | P1.08/P1.12 | First-upload safeguards apply now to released uploads; operational document workflows later |
| FR-FIN-001 | P1.02/P1.03/P1.06 | Menu/finance grants/office restriction preparation; invoice workflow P2 |
| FR-BKG-001 | P1.03/P1.08/P1.11 | Menu and separate quote-number linkage contract; booking workflow P3 |
| FR-BKG-005 | P1.08/P1.11 | Distinct entities, no acceptance-created shipment or conversion call |
| FR-CLM-001 | P1.02/P1.03 | Menu and customer grants only; no invented claims engine; P3/D-05 |
| FR-NTF-001 | P1.11 | Quote centre/bell, authorised deep links and scoped read actions |
| FR-NEW-001 | P1.11 | Scoped news/banner/pop-up authoring, validity and show-once |
| FR-DSH-001 | P1.11 | Saved own layout and real authorised initial widgets |
| FR-RPT-002 | P1.02/P1.03/P1.06 | Permission/assignment boundary foundation; report-assignment workflow P2 |
| FR-RPT-005 | P1.11/P1.12 | Portal dashboard works without Power BI |
| FR-INT-006 | All action slices | Instrument events now; training/analytics views P4 |
| FR-ECO-003 | P1.01-P1.03 | Versioned OpenAPI/generated client; external issuance/API GA P5 |
| FR-ECO-005 | P1.01/P1.08 | Document PO/emissions adapter/model extension boundaries, no speculative machinery |
| FR-CO2-004 | P1.07/P1.08 | Explicit future/conditional boundary; no P1 calculator, fake result or submission dependency |
| FR-SYS-001 | P1.01/P1.04/P1.08/P1.10 | Canonical adapters and atomic business/job transactions |
| FR-SYS-002 | P1.01/P1.04/P1.12 | Explicit real/simulator contract selection; simulator forbidden in production |
| FR-SYS-003 | P1.04/P1.10 | Source/version/correlation, deduplication, retry and authorised replay |
| FR-SYS-004 | P1.04/P1.07/P1.10 | Configurable source mappings and unknown/wrong-owner quarantine |
| FR-SYS-005 | P1.04/P1.10 | Last consistent customer state and staff diagnostics on failure |
| FR-SYS-006 | P1.10 | Source quote adoption/reconciliation now; source bookings P3 |

## 3. Additional lookup and administration direction

| Agreed direction / proposal boundary | Owning slices | Required verification |
| --- | --- | --- |
| Dedicated lookup administration UI | P1.07-A | Category/item editor works with real API and approved ownership |
| Multilingual lookup content | P1.07-A/B | EN/ES completeness/fallback, stable IDs, additional locale without new data columns |
| Parent-child and dependent options | P1.07-B | Valid path, concurrent cycle prevention, safe deactivation and many-to-many applicability |
| Operating-structure administration | P1.05-A | Source versus portal fields protected; region model gated; two-branch rehearsal |
| Complete agreed staff/customer access lifecycle | P1.05-B/C; P1.06-A/B/C/D | Assignment/removal, invites, activation/suspension, last-admin and read-only support |
| Feature and all approved settings administration | P1.07-C/D/E | Finite owner/type/scope register; no unsupported arbitrary setting; permissions and audit |
| Easy administration UX | P1.03-C; P1.05-P1.07 | Search/filter, retained context, accessible editor, conflicts, long translations and clear source protection |
| UI mockups to follow | All UI slices | Revision-to-slice review; business changes separately approved |

## 4. NFR allocation

Every NFR family is accounted for below. Ranges are inclusive. Apply controls as soon as their data/feature appears; P1.12 consolidates evidence rather than introducing security at the end.

| Requirements | Owners | Phase 1 gate / later boundary |
| --- | --- | --- |
| NFR-SEC-001 through NFR-SEC-009 | P1.01-P1.07; all consumers | Identity, RLS, grants, protected data, secrets and transport/storage controls |
| NFR-SEC-010 | P1.08/P1.12 | Approved file limits/quarantine/scanning before first upload |
| NFR-SEC-011 | P1.01/P1.12 architecture | No public business tools in P1; public WAF/bot/restricted projection gate remains P2+ |
| NFR-SEC-012 through NFR-SEC-013 | All APIs/UI; P1.12 | Validation/encoding/CORS/headers plus assessed security release gate |
| NFR-PER-001 through NFR-PER-004 | P1.07-P1.12 | Quote lists/search/wizard/dashboard approved workload tests |
| NFR-PER-005 | P1.08 | Rate stub timeout; live performance only after source approval |
| NFR-PER-006 | P1.04/P1.10/P1.12 | Actual configured integration latency, no fake direct-mode confirmation |
| NFR-PER-007 | P1.04 architecture | Air milestone occurrence SLO and compliance population P2 |
| NFR-PER-008 through NFR-PER-009 | P1.01/P1.04/P1.07/P1.12 | Bounded resources and stateless design now; full event-volume measurement P2 |
| NFR-REL-001 through NFR-REL-006 | P1.01/P1.04/P1.07-P1.12 | Availability measurement setup, last-good state, atomicity, idempotency, concurrency and restore |
| NFR-DAT-001 through NFR-DAT-005 | All data slices; P1.12 | Purpose/retention/protected audit/provenance; erasure process now, automation later |
| NFR-UX-001 through NFR-UX-006 | Every UI/output slice | AA, EN/ES, dates/currencies, brand, states and compatibility evidence |
| NFR-ARC-001 through NFR-ARC-008 | P1.01-P1.12 | Simple apps/runtime, adapters, simulator isolation, multi-region, migrations and reproducibility |
| NFR-OPS-001 through NFR-OPS-006 | P1.01/P1.04/P1.12 | Correlated metrics, deployments, runbooks, background host and cloud governance |
| NFR-SAF-001 through NFR-SAF-003 | P1.10/P1.12 | Draft provenance/reasoned override, least external data, human send; future AI separately gated |
| NFR-CO2-001 through NFR-CO2-002 | Future CO2 release | Explicitly deferred with OQ-20; no P1 calculation implementation or acceptance claim |

## 5. Decision gates and unresolved scope

Reuse the existing D/OQ/LM decision IDs. Assign named owners and evidence links during readiness; do not invent answers to get a green checklist.

| Gate | Needed before | Required decision / evidence |
| --- | --- | --- |
| D-01 | P1.02/P1.06 | Staff eligibility/bootstrap and Microsoft-managed customer provisioning/acceptance |
| D-02/D-10 | P1.03 and each UI/output | Future-menu UX, supported devices, locale/brand/formatting and mockup revision |
| D-03 / OQ-2/2a/3/3a/3b | P1.04 real integration | Source namespace, org/address/party rules, branch feed, quote/ack/reconciliation samples |
| D-04 | P1.02/P1.05-P1.07/P1.09 | Full current/future grants, cross-branch/cost/claim-release/settings scope and presets |
| D-05 | Future P3 only | Non-CRM claims ownership/lifecycle; P1 menu grants do not implement handlers |
| D-06 | Before real personal data/pilot | Legal/residency/retention/erasure process, RPO/RTO and restore evidence |
| D-07/D-08 | Relevant exposure and P1.12 | Workload/percentile, security profile, alert thresholds/responders and release findings policy |
| D-09 | First upload in P1.08 | Approved scanner/provider, limits, malformed-file/scan-failure and import commit policy |
| D-11 / OQ-25 | External drafting in P1.10 | Safe external data/contract/evaluation; unavailable service uses template |
| D-12 / OQ-11/12 | P1.07/P1.09 | Cost capture, approval thresholds/currency and pricing operating sign-off |
| D-13 | P1.06/P1.07 | Link approval policy, domain exceptions, tier defaults and carrier disclosure |
| D-14 | Future P2 | Event exclusions/document allow-list and report/alert rules; no speculative P1 editor |
| D-15 / OQ-20 | Future features | Source/language priorities and CO2 methodology/phase; not a P1 quotation blocker |
| D-16 | P1.05/P1.06/P1.12 | Pilot branches/customers, operating ownership and future MDM boundaries |
| D-17 | Shared-host provisioning | App Service versus Container Apps and SPA hosting; background execution supported |
| D-18 | P1.07-P1.11 | Scope precedence/defaults, multi-branch routing, snapshot revision, option cardinality, direct collision/response and later CW1 handover |
| LM-D01 through LM-D08 | P1.07 and affected consumers | Lookup sources/ownership/locales/relationships/RLS, enum reconciliation and operational targets |

Additional explicit questions to resolve within these owners: source-inactive organisation eligibility; link reassignment historic ownership/cutover; staff claim disposition after role/branch loss; cancellation rules and partial-option confirmation; approved editable profile fields; quotation attachment scope. A displayed mockup control is not an answer.

## 6. Integrated acceptance journeys

| Journey | Minimum scenario | Stage evidence |
| --- | --- | --- |
| E2E-01 | Eligible employee sign-in -> access pending -> admin branch/roles -> immediate revocation | P1.02/P1.05 |
| E2E-02 | Source import -> create/link customer -> first-admin invite -> acceptance/activation -> colleague invite/roles | P1.04/P1.06 |
| E2E-03 | Parent/child/unrelated groups, conflicting org link and source-address lookup; no inherited user-admin authority | P1.02/P1.04/P1.06 |
| E2E-04 | Suspend/reactivate customer; stale token denied; ingestion retained; support impersonation read-only/timeboxed | P1.06 |
| E2E-05 | EN/ES lookup -> valid hierarchy/dependency -> consumer selection -> deactivate -> old record readable/new save revalidated | P1.07/P1.08/P1.11 |
| E2E-06 | Scoped feature/policy change with reason -> effective values -> new request revision; existing work unchanged | P1.07-P1.10 |
| E2E-07 | Address import/template -> Air/FCL/LCL draft/autosave/calculation -> authorised office/manual branch queue | P1.08 |
| E2E-08 | Full request -> concurrent claim -> manual alternatives -> independent approval/rejection -> protected snapshot | P1.09 |
| E2E-09 | Eight publication/request-sync/approval combinations, real CW1 business confirmation and direct no-job assertion | P1.10/P1.12 |
| E2E-10 | Source-created/duplicate/wrong-owner quote and direct/accepted collision -> safe reconciliation/quarantine/replay | P1.04/P1.10 |
| E2E-11 | Published comparison -> valid accept or reasoned reject -> history/PDF/copy/cancel, no booking creation | P1.11 |
| E2E-12 | External draft failure -> template -> human edit/send; deterministic notification separate; no internal data | P1.10/P1.11 |
| E2E-13 | Scoped news/show-once -> own saved dashboard -> future menus safe in EN/ES/mobile | P1.03/P1.11 |
| E2E-14 | Second-region configuration, dependency outage, restore/pending-job recovery and real pilot sign-off | P1.12 |

All journeys are planned, not executed. Include role/entitlement/RLS denial and concurrency tests in the owning stages, not only positive walkthroughs.

## 7. Evidence template and update rules

| Field | Record during implementation |
| --- | --- |
| Requirement / slice / journey | Stable IDs from this set and baseline |
| Decision and mockup revision | Approved inputs used by the implementation |
| Environment / build / fixture | Distinguish simulator, real UAT and production |
| Command / test / manual procedure | Reproducible steps and scope |
| Expected and actual result | State the actual outcome, not just a checkbox |
| Evidence and reviewer | Test artefact/location, reviewer, date and approval |
| Open issue / owner / status | Blocked/partial/verified/accepted delivery label; no invented business status |

When mockups arrive, map each screen to a slice and compare fields/actions/states before editing this plan. If behaviour changes, update affected slice tests, this ledger and approved decisions together. Preserve earlier source documents and research evidence; no silent FR renumbering, blanket scope expansion or claims of implementation.
