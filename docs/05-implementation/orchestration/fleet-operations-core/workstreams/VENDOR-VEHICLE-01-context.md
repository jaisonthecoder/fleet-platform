# Agent Context Pack - VENDOR-VEHICLE-01

| Field | Value |
|---|---|
| Parent program | Fleet Operations Core / Vendor-to-Vehicle dependency |
| Task type | Backend-first vertical implementation |
| Status | `VERIFIED` |
| Authorized first slice | VENDOR-1 Vendor document vault foundation - complete |
| UI authority | Approved Vendor mockups 01-08; UI implementation after backend contract passes |
| Implementer | Generic implementation agent using Opus, Sonnet 5, GPT-5.6 or GPT-5.5; never Haiku |

## Business Outcome

Allow an organization to create and approve Vendors in Wayfinder, maintain real lease contracts and versioned compliance evidence, and select governed Vendor/lease records in Vehicle Management. Booking remains an indirect consumer through Vehicle pool, lifecycle and compliance state.

## Controlling Sources

- `docs/05-implementation/orchestration/fleet-operations-core/VENDOR-VEHICLE-IMPLEMENTATION-PLAN.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/02-vendor-source-master-and-onboarding.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/mockups/mockup-review.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/mockups/derived-screen-contracts.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/mockups/mockup-implementation-spec.md`
- `docs/05-implementation/orchestration/fleet-operations-core/DECISION-REGISTER.md` decision D-SEQ-001

## Verified Starting Point

- Manual Vendor master, lifecycle, maker-checker approval and tenant isolation exist.
- Active Vendors can create real lease contracts.
- Vehicle onboarding consumes governed Vendor/lease IDs and revalidates them server-side.
- Integrated records are read-only; provider sync is future and fail-closed.
- Fresh migrations and idempotency pass through `0037`.
- Vendor/Vehicle integrations, frontend tests/build and independent closure review passed.
- Vendor documents are persisted, versioned, governance-restricted and human-confirmed.
- The cross-module fit remains `FIT_WITH_RECORDED_GAPS`: Booking lifecycle parity and Vendor activation completeness are closed; linked-Vehicle deterioration propagation remains open.

## First-Slice Scope

May edit:

- additive migration `0036_*` and migration journal;
- `app-api/src/common/database/schema/vendor.schema.ts`;
- `app-api/src/contracts/vendor.contract.ts`;
- `app-api/src/modules/vendors/**`;
- focused Vendor unit/HTTP/integration tests;
- contract manifest only via the contract guard update command when required;
- Vendor frontend documents UI only after backend acceptance passes;
- EN/AR Vendor catalog keys and focused tests for that UI.

Must not edit:

- Booking, Handover, Entitlement or policy behavior;
- external adapter implementation;
- organization provider settings;
- supplied mockup image files;
- unrelated dirty worktree files;
- raw full IBAN handling or payment flows.

## Required Backend Behavior

1. Persist immutable Vendor document versions with organization-safe Vendor linkage.
2. Validate document type through the lookup engine.
3. Accept manual metadata and an approved blob reference; do not claim OCR.
4. Require explicit human confirmation before evidence becomes valid.
5. Confirm/reject/supersede using guarded state transitions.
6. Record actor/time and append audit/outbox in one transaction.
7. Deny cross-organization and Integrated-record mutations.
8. Prevent duplicate current versions under concurrency.
9. Preserve historical versions and references.

## First Hypothesis and Discriminating Check

Hypothesis: an additive Vendor-document aggregate can use the existing repository/service/audit/outbox patterns without changing Vendor or Vehicle public behavior.

First check after the first substantive edit:

```powershell
pnpm --filter fleet-platform-api typecheck
pnpm --filter fleet-platform-api test -- vendor.controller.spec.ts
```

After migration/schema changes:

```powershell
# Run against a fresh throwaway database, then remove it.
pnpm --filter fleet-platform-api migration:test
pnpm --filter fleet-platform-api test:integration -- vendor.int-spec.ts
```

## Acceptance

- fresh migration/idempotency passes;
- contract, tenant, role and lifecycle negatives pass;
- Vendor create/approval/lease/Vehicle integration remains green;
- no fake OCR/integration status is introduced;
- independent review reports no Blocking/High finding;
- implementation evidence is appended to the active evidence register.

## Completion Handoff

- Migrations `0036` and `0037` implement the document aggregate and lineage/pending constraints.
- Full document evidence is limited to SystemAdmin, DataSteward and Procurement.
- Client input cannot claim OCR metadata and storage refs are opaque `vendor-documents/...` keys.
- Vendor document unit, integration, HTTP and frontend tests pass.
- Independent closure review reports no Blocking/High finding.
- VENDOR-2 is verified through migration `0038`: persisted reusable terms, server-owned field/document completeness, Draft recovery, unsaved-change protection and a five-step EN/AR/RTL wizard are operational.
- VENDOR-3 is verified through migration `0042`: the organization-scoped Procurement worklist, maker/submitter evidence, completeness/change summary, approve/reject/request-change decisions and immutable audit evidence are operational.
- VEH-VENDOR-HEALTH-1 is verified through migration `0043`: synchronous and hourly reconciliation apply idempotent Vehicle holds, preserve prior operational/pool state, deny manual bypass and restore only after both Vendor and lease recover with current Vehicle compliance.
- G-0020 and G-0021 are closed. Next implementation returns to live Booking consent/confirmation and My Bookings/change lifecycle.
- Organization provider configuration and external adapters remain deferred.

## Readiness Response

Before editing, inspect current uncommitted Vendor files because concurrent agents may have changed them. Restate the exact files, invariant, first edit and first executable check. Do not broaden into the five-step wizard until the backend document slice is verified.