# Phase 19 — Traceability and Completion Matrix

## Objective

Prevent partial delivery from being reported as complete. Maintain this matrix during implementation with links to requirements, approved mockups, source, migrations, tests, screenshots, critique records and rollout evidence.

## Completion rule

A capability is complete only when DB, BE, FE, authorization, audit/provenance, tests, mockup evidence, operations and rollback are all complete or explicitly not applicable.

## Vendor & Lease Management matrix

| Capability | Business refs | Phase | DB | BE/API | FE | Source/integration | Tests/ops | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vendor Master list/detail | C13, FR-VEN-01 | S1 | Missing | Missing | Mockup only | I3/manual | Planned | Not started |
| Vendor source/identity onboarding | FR-VEN-01, I3 | S1 | Missing | Missing | Mockup only | D6 open | Planned | Not started |
| Manual vendor verification/approval | role matrix/SoD | S1 | Missing | Missing | Missing states | Platform | Planned | Not started |
| Vendor compliance documents/OCR | FR-INV-08, I10 | S1 | Missing | Missing | Mockup only | Document vault/OCR | Planned | Not started |
| Terms/SLA/integration/portal | C13 | S1 | Missing | Missing | Mockup only | I2/I3/portal | Planned | Not started |
| Lease contract master/version | FR-VEN-02 | S2 | Missing | Missing | Mockup list only | I3/manual | Planned | Not started |
| Contract vehicle coverage | FR-VEN-02 | S2/V1 | Missing | Missing | Missing | Platform | Planned | Not started |
| Renewal ladder/alerts | FR-VEN-03 | S2 | Missing | Missing | Mockup list | Scheduler/M365 | Planned | Not started |
| Contract-vs-invoice discrepancy | FR-VEN-06, I2 | S2/S3 | Missing | Missing | Mockup queue | Finance AP | Planned | Not started |
| Vendor scorecard | FR-VEN-05 | S3 | Missing | Missing | Mockup panel | Computed platform data | Planned | Not started |
| Off-hire workflow | FR-VEN-04 | S3/V3/H1 | Missing | Missing | Mockup progress only | I3/portal | Planned | Not started |
| Vendor portal isolation | C13 | S1/S3 | Missing | Missing | Missing action screens | Entra/vendor portal | Planned | Not started |

## Vehicle Management matrix

| Capability | Business refs | Phase | DB | BE/API | FE | Mockup | Tests/ops | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Owned onboarding | FR-INV-01/05 | V1 | Planned | Planned | Planned | Request | Planned | Not started |
| Leased onboarding/vendor | C13, FR-INV-05 | S1/S2/V1 | Planned | Planned | Planned | Vendor mockups supplied; vehicle mockups request | Planned | Not started |
| Transfer-in | FR-CLU-03, FR-INV-06 | V1/V3 | Partial | Partial | Missing | Request | Partial | Partial |
| Lease replacement/off-hire | C13 | S2/S3/V1/V3 | Partial | Partial | Missing | Vendor mockups supplied; vehicle mockups request | Planned | Partial |
| Bulk import/dedup/sign-off | P7, FR-INV-10 | V1 | Live partial | Live partial | Missing | Request | Partial | Partial |
| Vehicle registry/list/search | B3, FR-INV | V2 | Live | Live basic | Missing | Request | Partial | Partial |
| Vehicle detail/tabs | B3 | V2/V4 | Live data | Partial | Missing | Request | Planned | Partial |
| Booking-pool include/exclude | FR-INV-04/09 | V3 | Partial | Partial | Missing | Request | Planned | Partial |
| Lifecycle transitions | FR-INV-02 | V3 | Live | Live | Missing | Request | Partial | Partial |
| Hierarchy transfer | FR-INV-06 | V3 | Live | Live | Missing | Request | Partial | Partial |
| Maintenance/downtime | C1 | V3 | Gap | Gap | Missing | Request | Planned | Not started |
| Documents/compliance | C6 | V4 | Live | Live | Missing detail | Request | Partial | Partial |
| Device/GPS/odometer | C8 | V4 | Live | Live | Missing detail/map | Request | Partial | Partial |
| Key custody | C15 | V4/H1 | Partial | Partial | Missing | Request | Partial | Partial |

## Pool Booking matrix

| Capability | Business refs | Phase | Current | Mockup gate | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| Employee self-booking | FR-BOOK-01 | B1/B2 | Backend partial; UI mock | Request wizard | DB/BE/FE/E2E |
| Fleet Manager on behalf | role matrix | B1 | Missing complete authority/UI | Request actor variant | Scope/SoD/E2E |
| Separate requester/driver | FR-CON/driver | B1 | Partial | Request controls | Contract/audit |
| Availability/buffer | FR-BOOK-08/09/10 | B2 | Backend live; UI mock | Request results | Concurrency/load |
| Eligibility hard gate | FR-BOOK-07/08 | B2 | Backend live | Request blocked states | Fail-safe tests |
| Consent before number | FR-BOOK-06/07, Ch26 | B2 | Backend live; UI missing | Request consent | Atomicity/legal |
| Approval/delegation | FR-BOOK-03/04, FR-DEL | B3 | Backend partial; UI missing | Request inbox | Workflow/SoD |
| Fleet preparation queue | M4/M6 | B3/H1 | Missing UI | Request queue | E2E |
| My Bookings | A2 | B4 | Missing | Request screens | Ownership/E2E |
| Modify/re-consent | FR-BOOK-23 | B4 | Backend live; UI missing | Request flow | Atomicity |
| Extension | FR-BOOK-18 | B4 | Backend partial | Request conflict | Downstream conflict |
| Cancel/early return | FR-BOOK-16/19 | B4 | Partial | Request actions | Release/waitlist |
| Waitlist | FR-BOOK-13 | B5 | Schema partial | Request flow | Fairness/race |
| Recurring | FR-BOOK-17 | B5 Phase 2 | Missing | Request series | DST/occurrences |
| Emergency | FR-BOOK-21 | B5 Phase 2 | Missing/D20 | Request break-glass | Abuse/post-review |
| Cross-node | FR-BOOK-22/CLU-05 | B5 | Missing/D24 | Request ownership | Scope/approval |
| No-show/late | FR-BOOK-15 | B4/B5 | Partial | Request evidence | Utilization/events |

## Dedicated Entitlement matrix

| Capability | Refs | Phase | Current | Mockup gate | Status |
| --- | --- | --- | --- | --- | --- |
| Long-term/temporary | C3 | D1 | Backend partial, UI missing | Request | Partial |
| With/without driver | C3 | D1 | Contract gap | Request | Missing |
| Self/on-behalf | role matrix | D1 | Partial | Request variants | Partial |
| Eligibility policy | FR-POL/D8 | D1 | Backend partial | Request trace | Partial |
| Approval to CEO | M5 | D2 | Backend partial, UI missing | Request decision | Partial |
| Dedicated consent | Ch26 | D2 | Backend partial | Request consent | Partial |
| Vehicle allocation | M5 | D2 | Backend live basic | Request picker | Partial |
| Pool exclusion | C3 | D2/V3 | Partial | State evidence | Partial |
| BSD windows | C3 | D2 | Backend partial, UI missing | Request calendar | Partial |
| Utilization review | C3 | D2 | Missing | Request review | Missing |
| Return/expiry/reassign | C3 | D2 | Partial | Request lifecycle | Partial |

## Handover/accountability matrix

Track identity/eligibility/consent, inspection, odometer/fuel, damage baseline/diff, signature, key issue/return/lost, trip attach, late/early, reconciliation, offline/degraded, audit/receipt under H1.

## Cross-cutting matrices

Maintain actor/capability, status/action, reason-code/localization, event/outbox, notification, data-retention, accessibility viewport, integration failure, selector/canary and rollout/rollback matrices.

## Phase gate checklist

- Detailed mockups requested and approved before that UI phase.
- Requirement and mockup differences recorded.
- Contracts frozen before code.
- DB/BE/FE implemented together.
- Focused/full tests pass.
- One rigorous critique completed; critical/high fixed.
- Docs and repository memory updated.
- Live browser evidence captured.
- Rollback proven.

## Program exit gate

Every applicable row is Complete with evidence; all mock UI/static data is removed from production routes; no capability relies on direct SQL/manual email unless explicitly approved with owner/date.
