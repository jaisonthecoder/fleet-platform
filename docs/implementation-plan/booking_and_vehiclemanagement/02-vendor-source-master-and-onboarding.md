# Phase 2 (S1) — Vendor Source, Master and Onboarding

## Objective

Deliver the authoritative Vendor Master and five-step onboarding journey shown in the approved mockups, establishing valid lessor, repair, telematics, fuel and other suppliers before leased vehicles or contracts can be onboarded.

## Mandatory mockup gate — supplied set

The supplied mockups cover:

1. Vendor Master list and selected-vendor scorecard/active contracts panel.
2. Source & identity onboarding.
3. Compliance & commercial documents.
4. Terms & SLA.
5. Integration & access.
6. Review & submit to Procurement.

Before implementation, request missing states: empty/loading/error, manual-vendor verification, Fusion lookup no-match/multiple-match, document upload/OCR proposals, Procurement approval/rejection/request-change, duplicate vendor merge, suspended vendor, EN/AR/RTL, tablet/mobile.

Do not edit supplied mockup artifacts. Build new Wayfinder application routes/components.

## Business ownership and source of truth

| Data | Authoritative source | Platform behavior |
| --- | --- | --- |
| Fusion supplier ID, supplier status, legal name, registered address, payment supplier status | Oracle Fusion Procurement I3, once integration is approved | Read/sync; platform stores source ID, source revision and sync timestamp; no silent local overwrite |
| Trade licence, emirate, TRN/tax registration, primary contact | I3 where present; otherwise Procurement-entered | Manual values require Data Steward verification and evidence |
| Vendor category | Procurement-approved platform classification | Stable lookup/code: LESSOR, REPAIR_MAINTENANCE, TELEMATICS, FUEL_SUPPLIER, OTHER |
| Bank/payment details | Finance/AP I2 or I3 | Masked outside Finance; never exposed in general vendor DTOs/logs |
| Compliance documents | Versioned platform document vault | Upload asynchronously; OCR is proposal-only; human confirmation required |
| Terms/SLA defaults | Procurement-approved platform record or source contract | Versioned; contract may override defaults |
| Scorecard values | Computed from platform operations | Never accepted as vendor self-report |
| Portal users/access | Platform identity/access administration | Contract/vendor scoped; least privilege; effective dated |

**D6 source decision remains a human gate:** confirm whether Oracle Fusion Procurement is authoritative in the target environment, source keys, sync direction, conflict precedence and outage fallback. Until signed, implement a pluggable `VendorSource` port with `ManualVendorSource` and a contract-tested Fusion adapter stub; never fabricate I3 responses.

### D6 implementation decision record — required before I3 code

Record and approve all fields below in the project ADR/decision register:

| Decision field | Required answer |
| --- | --- |
| Authoritative system | Oracle Fusion Procurement I3, another procurement system, or Platform Manual Mode |
| Vendor source key | Supplier ID and organization/business-unit mapping |
| Contract source key | Contract/PO/agreement IDs and version/change sequence |
| Sync direction | Inbound only, outbound commands, or bidirectional |
| Conflict precedence | Source wins, platform wins for explicitly owned fields, or manual reconciliation |
| Deletion/status semantics | Suspend/retire mapping; never hard-delete referenced vendor history |
| Freshness/SLA | Poll/webhook schedule, stale threshold and alert ownership |
| Outage fallback | Queue/retry, read-only last-known-good, or dual-controlled manual exception |
| SoD during bypass | Second approver required; requester/creator cannot approve their own source bypass |
| Reconciliation evidence | Source snapshot hash/version, before/after, actor, reason and correlation |

I3 integration and automatic activation remain disabled until this record is signed. Manual Mode may proceed with explicit source label, Data Steward verification and Procurement dual control.

## Actors and SoD

- System Admin: configure integration/profile and initiate a record, but cannot approve their own vendor.
- Procurement: owns vendor onboarding, classification, commercial terms and approval.
- Data Steward: validates manual/non-Fusion records and duplicate resolution.
- Finance: validates payment/AP identity and sees unmasked finance fields.
- Internal Audit: read-only history/evidence.
- Vendor Portal user: only own vendor/contracts/document requests/disputes.
- Fleet Manager: read vendors relevant to managed fleet; no vendor approval/payment access.

Dual control: creator cannot be final Procurement approver. Manual vendors remain `PendingVerification` until Data Steward and Procurement gates pass. Missing required documents may allow draft submission but block activation, matching the mockup.

## Lifecycle

`Draft -> PendingDataStewardVerification (manual only) -> PendingProcurementApproval -> Active -> Suspended -> Retired`

Additional outcomes: `Rejected`, `ChangesRequested`, `DuplicateMerged`. Published history is append-only.

### Suspension semantics

- Suspended vendors cannot receive new contracts, renewals, vehicle onboarding links or portal grants.
- Existing contracts and historical vehicles remain visible/read-only and are not silently cancelled.
- Existing active contracts enter Procurement review; renewal work is paused, not discarded.
- Booking is not automatically blocked solely by vendor suspension unless an approved compliance policy says the vehicle/contract is unsafe. Operational safety/compliance remains the booking gate.
- Reactivation requires reason, current compliance evidence, source reconciliation where applicable and dual control.
- Suspension reason/effective time/approver and impacted contracts/vehicles are captured in impact evidence before commit.

## Database

Create additive tables:

- `vendor`: organization, stable vendor code, source type, external supplier ID, legal/trade names, category, trade licence/emirate, TRN, primary contact reference, status, source revision/sync time, optimistic revision.
- `vendor_contact`: role/email/phone, effective dates and privacy classification.
- `vendor_document`: document type, blob reference, version, expiry, OCR proposal/confidence, confirmed fields, status.
- `vendor_terms_profile`: currency, payment terms, default off-hire notice, penalty model, renewal options, escalation/replacement clauses, effective dates/version.
- `vendor_integration_profile`: I2/I3/OCR/portal linkage and status; no credentials in DB payloads.
- `vendor_portal_access`: linked user, vendor scope, permissions, validity.
- `vendor_portal_dispute`: vendor/off-hire/contract reference, rationale, attachments, status, vendor actor and internal owner.
- `vendor_change_event`: append-only lifecycle/source/merge/approval history.

Constraints: organization+vendor code unique; organization+external supplier ID unique when non-null; normalized TRN/trade licence uniqueness by jurisdiction; valid windows; source consistency; no Active status without approved required evidence.

## Backend/API

Create `VendorModule` with source adapter, repository, domain service and controllers:

- `GET /api/v1/admin/vendors` paged/filter/search.
- `GET /api/v1/admin/vendors/:id` detail, evidence, scorecard projection and contract summary.
- `POST /api/v1/admin/vendors/drafts` create manual/import draft.
- `POST /api/v1/admin/vendors/source-lookup` I3 lookup through adapter, not direct UI integration.
- `PATCH /api/v1/admin/vendors/:id` optimistic draft update.
- `POST /api/v1/admin/vendors/:id/documents` metadata + async upload ticket.
- `POST /api/v1/admin/vendors/:id/submit`.
- `POST /api/v1/admin/vendors/:id/verify` Data Steward.
- `POST /api/v1/admin/vendors/:id/approve|reject|request-changes` Procurement.
- `POST /api/v1/admin/vendors/:id/suspend|reactivate|retire`.
- `POST /api/v1/admin/vendors/:id/merge` guarded duplicate merge.

Every command writes state, append-only event, hash-chain audit and outbox atomically. RFC-7807 stable reasons; idempotency keys on submit/approval/source-sync.

### Vendor Portal boundary

Use a separate `/api/v1/vendor-portal` surface and vendor-scoped identity claim/grant; never reuse broad admin controllers.

- `GET /vendor-portal/contracts` — contracts for the authenticated vendor only.
- `GET /vendor-portal/contracts/:id` — vendor-owned contract detail and requested documents.
- `GET /vendor-portal/off-hire` and `/:id` — own cases only.
- `POST /vendor-portal/off-hire/:id/acknowledge` — signed acknowledgement with timestamp/evidence.
- `POST /vendor-portal/off-hire/:id/dispute` — rationale plus versioned attachments.
- `POST /vendor-portal/document-requests/:id/upload` — upload ticket scoped to one request.

Every query filters organization + vendor ID derived from authentication, not path/body. Admin impersonation is prohibited; support-assisted actions use explicit on-behalf-of audit. Portal actions log source, vendor, actor, IP/device, correlation and evidence hash.

## Frontend

Routes:

- `/{lang}/admin/vendors` with Vendor Master tab, dense list and detail/scorecard panel.
- `/{lang}/admin/vendors/new` five-step onboarding wizard.
- `/{lang}/admin/vendors/:id` inspector/history/approval detail.

Follow the mockup closely: source cards, supplier lookup, category segmented control, compliance document rows, terms/SLA fields, integration status cards, review checklist and Procurement submission. Add production states absent from mockup. EN/AR/RTL, keyboard wizard, unsaved changes, responsive detail sheet.

## Integration/events

- `VendorSource` port: manual and Fusion I3 implementations.
- Inbound `VendorMasterChanged`; outbound `VendorApproved`, `VendorSuspended`, `VendorMerged`.
- I2 payment identity validation is separate from general vendor sync.
- OCR runs in worker/queue; API never waits for OCR.
- Source outage leaves last-known-good data marked stale; activation requiring source validation fails safe or requires documented manual exception.

## Tests

Source contract tests, duplicate races, manual/Fusion conflict, required documents, OCR confidence/human confirmation, dual control, role/cost masking, portal isolation, cross-org denial, optimistic concurrency, audit/outbox atomicity, source outage/replay/idempotency, EN/AR/RTL/a11y/browser.

Include vendor suspension with active contracts/vehicles, blocked new contract/renewal, dual-controlled manual source bypass, cross-vendor portal enumeration, dispute attachment isolation and stale-source activation denial.

## Rollback

Disable vendor write/sync capabilities; retain drafts/events/documents. Active vendors remain referenceable. Rollback never deletes approved vendor history or exposes masked fields.

## Mandatory critique

Inspect source-authority ambiguity, duplicate/merge integrity, approval self-service, bank/contact leakage, stale I3 data, OCR trust, portal overreach, document retention and Vehicle Onboarding reference gaps.

## Exit gate

Vendor Master and onboarding are live, source-labelled, dual-controlled, audited, scope/organization safe, browser-tested and contract-tested. Leased vehicle onboarding cannot activate without an Active vendor.