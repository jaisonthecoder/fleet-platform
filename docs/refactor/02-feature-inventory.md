# Feature Inventory

All features required by the enhancement, grouped by capability. Each has an ID (`F-xx`), MoSCoW priority, mapped phase, and the scenarios it satisfies. This is the master checklist for the program.

Priority: **M** Must · **S** Should · **C** Could · **W** Won't (this program).

---

## A. Employee/Driver Credentials

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-01 | Person credential fields: licence no/expiry, Emirates ID no/expiry | M | P1 | S-01..S-08 |
| F-02 | Per-field provenance (`source`), `verificationStatus`, `lastHcmSyncedAt`, `updatedByPersonId` | M | P1 | S-09,S-10,S-83 |
| F-03 | Computed credential status: `Missing/Valid/ExpiringSoon/Expired` | M | P1 | S-05,S-06,S-07 |
| F-04 | `/me/credentials` (or extend `/me`) exposes status for autofill/warnings | M | P1 | S-05,S-07,S-60 |
| F-05 | Fail-closed `licence-missing` hard block | M | P1 | S-04 |
| F-06 | Configurable freshness SLA + trust-manual-when-HCM-off | M | P1 | S-11,S-81 |
| F-07 | Steward verification workflow (Unverified → Verified) | S | P1/P3 | S-10,S-02 |

## B. Employee Document Center (centralized)

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-10 | `person_document` table (licence, EID, medical, training, other) | M | P2 | S-12,S-13 |
| F-11 | Presigned-URL upload pipeline (private, scoped, size/type-limited) | M | P2 | S-04,S-12 |
| F-12 | Reusable Document panel/component (list, upload, replace, version) | M | P2 | S-12,S-62 |
| F-13 | Document surfacing across booking, dedicated, driver, profile, admin | M | P2/P5/P6 | S-12 |
| F-14 | Document expiry tracking + status chips | S | P2 | S-06,S-07,S-52 |
| F-15 | PII classification, RBAC scoping, audit, retention | M | P2 | S-14 |

## C. HCM Sync vs Manual (source of truth)

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-20 | Scheduled HCM sync (configurable interval) | M | P3 | S-80,S-84 |
| F-21 | Admin-triggered sync endpoint + status page | S | P3 | S-80 |
| F-22 | Real HCM adapter behind feature flag (stub retained) | M | P3 | S-01,S-81 |
| F-23 | Precedence/merge engine (HCM-authoritative-when-fresh; audited) | M | P3 | S-09,S-83 |
| F-24 | Sync health + staleness alert | S | P3 | S-82,S-84 |
| F-25 | HCM enable/disable config; app fully works disabled | M | P3 | S-03,S-81 |

## D. Driver Management

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-30 | Driver profile (licence, medical, training, endorsements, status) | M | P4 | S-50,S-52 |
| F-31 | Driver onboarding wizard (promote → professional driver) | M | P4 | S-50 |
| F-32 | Professional-driver register/directory (searchable, credential status) | M | P4 | S-54 |
| F-33 | Driver-to-vehicle assignment lifecycle (effective dates, exclusivity, history) | M | P4 | S-51,S-55 |
| F-34 | Substitute-driver temporary capture | S | P4 | S-53 |
| F-35 | Driver credential expiry → block assignments/driving | M | P4 | S-52 |

## E. Booking Flow Hardening

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-40 | Inline credential capture at consent when blocked (remediable) | M | P5 | S-04,S-06 |
| F-41 | Re-evaluate eligibility after in-place fix | M | P5 | S-04,S-06 |
| F-42 | Remediable-reason flag in eligibility response | M | P5 | S-04,S-06 |
| F-43 | Pre-consent eligibility pre-check (warn before user invests time) | S | P5 | S-60,S-07 |
| F-44 | Vehicle-doc/employment/block reasons surfaced with guidance | M | P5 | S-27,S-28,S-29 |

## F. Blocking Reasons & Messaging

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-50 | Surface most-specific reason (not generic) in booking & dedicated | M | P1 | S-27..S-29,S-41 |
| F-51 | EN/AR translations for all compliance/eligibility codes | M | P1 | all blocks |
| F-52 | Reason catalog (code → title/body/severity/guidance, scope-aware) | S | P8 | S-72 |
| F-53 | Admin-authored reason messages (no deploy) | C | P8 | S-74 |
| F-54 | Reason → help article deep link | S | P7/P8 | S-72 |

## G. Profile & Self-Service

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-60 | Profile hub page `/:lang/profile` | M | P6 | S-60..S-66 |
| F-61 | Eligibility summary ("what would block me now") | M | P6 | S-60,S-65 |
| F-62 | Credentials & documents self-service (view/upload/replace) | M | P6 | S-61,S-62 |
| F-63 | My bookings (active/upcoming/past) | M | P6 | S-63 |
| F-64 | My requests & decisions (approvals/rejections + reasons) | M | P6 | S-64 |
| F-65 | My issues/blocks with remediation links | M | P6 | S-65 |

## H. Help Center

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-70 | Dedicated help center page + topic navigation | M | P7 | S-70 |
| F-71 | FAQ content model (bilingual, categorized) | M | P7 | S-70,S-73 |
| F-72 | Contextual "?" help affordances per screen | S | P7 | S-71 |
| F-73 | Reason-linked help articles | S | P7 | S-72 |
| F-74 | Admin-authored help content | C | P7 | S-74 |

## I. Notifications & Passengers & Cross-cutting

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-80 | In-app notification inbox (persisted) + bell wiring | S | P8 | S-66 |
| F-81 | Expiry reminders (licence/EID/medical/vehicle docs) via notifications | M | P8 | S-07,S-52 |
| F-82 | Approval-outcome notifications | S | P8 | S-64,S-66 |
| F-83 | Passenger identities (employee pick or guest) + capacity validation | S | P8 | S-23 |
| F-84 | Analytics: block-reason frequency, expiry funnel, sync health | C | P8 | ops |

## J. Explicitly out of scope (this program)

| ID | Item | Why |
|---|---|---|
| F-90 (W) | OCR/auto-extraction from uploaded documents | Phase-2 platform capability |
| F-91 (W) | External identity verification (UAE Pass) | Integration dependency |
| F-92 (W) | Mobile driver app changes | Separate track |
| F-93 (W) | Real-time HCM webhooks | Start with scheduled pull |

---

## K. Driver accountability — fines, blocks, consent (developer review; Phase 9)

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-100 | Driver-facing fines/tolls view + recovery path | M | P9 | S-90,S-95 |
| F-101 | Fine dispute (employee) + adjudication (Fleet) over existing status machine | M | P9 | S-91 |
| F-102 | Black-points balance + consequences view | S | P9 | S-92 |
| F-103 | Access-block explanation (source ref + contact) + driver visibility | M | P9 | S-93 |
| F-104 | Block lift with reason + **self-lift SoD** guard | M | P9 | S-94 |
| F-105 | "My consents" history + re-consent surfacing | M | P9 | S-96,S-97,S-98,S-99 |

## L. Vehicle & vendor compliance (symmetry)

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-110 | Vehicle document expiry alerts + booking hard-block (exists) surfaced with guidance | M | P5/P9 | S-100,S-102 |
| F-111 | Vendor/lease health hold reason surfaced in booking | S | P5 | S-101 |

## M. Delegation & on-behalf / substitute driver

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-120 | Delegation lifecycle surfaced (out-of-office) using DelegationModule | S | P6 | S-110 |
| F-121 | On-behalf driver credential capture (driver ≠ requester) | M | P5 | S-111 |
| F-122 | Substitute-driver time-bounded credential capture | S | P4/P5 | S-112 |

## N. Bulk onboarding & reference data

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-130 | Bulk import people/drivers/credentials via MigrationModule | S | P4 | S-120 |
| F-131 | Document/credential type reference data (lookups) | S | P2 | S-121 |

## O. Oversight & dashboards

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-140 | Credential + vehicle expiry dashboard (Fleet) | S | P8 | S-130 |
| F-141 | Block-reason analytics | C | P8 | S-131 |
| F-142 | HCM sync + compliance health widget | S | P3/P8 | S-132 |

## P. Cross-cutting engineering standards (mandatory, all phases)

See `09-engineering-standards-and-integration.md`. Not "features" but acceptance gates: idempotent commands, transactional outbox events, append-only audit, optimistic concurrency, policy-driven requirements, RBAC/SoD, PII + UAE residency, evidence-store reuse, feature flags, migration + rollback + guards.

## Q. Platform administration & feature management (developer addition)

| ID | Feature | Prio | Phase | Scenarios |
|---|---|---|---|---|
| F-150 | **Runtime feature flags** (per-org, DB-backed) + **admin Settings UI** to enable/disable features | M | P1b | S-140 |
| F-151 | Self-service credential/document capture **gated** by the `self-service-credentials` flag | M | P1b | S-04,S-141 |
| F-152 | Admin/DataSteward can also enter/upload a person's credentials/documents | M | P1b | S-02 |
| F-153 | **Force-upload**: admin requests a specific employee to upload/refresh a document (creates a `document_request` task) | M | P1b | S-142 |
| F-154 | **Email + in-app notification** for document requests and credential/document expiry | M | P1b/P8 | S-143 |
| F-155 | Document-request tracking (pending/fulfilled/cancelled) visible to admin + employee | S | P1b | S-142 |
