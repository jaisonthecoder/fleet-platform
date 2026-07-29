# Superseded Agent Context Pack - FIX-FIXTURES-01

| Field | Value |
|---|---|
| Parent phase | CORE-0 |
| Outcome | Make integration fixtures independent of dev seed data and safe after partial setup. |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Status | `SUPERSEDED` by `FIX-FIXTURES-01A` and `FIX-FIXTURES-01B` after independent critique |
| Agent | Generic isolated implementation agent |

## Do Not Dispatch

This pack covered only four of nine known seed-dependent suites. Use the two replacement packs so all affected suites have explicit ownership and combined closure evidence.

## Historical Scope and Ownership

May edit only:

- `app-api/test/support/**` (new shared integration fixture helper);
- `app-api/test/vehicle.int-spec.ts`;
- `app-api/test/booking.int-spec.ts`;
- `app-api/test/handover.int-spec.ts`;
- `app-api/test/entitlement.int-spec.ts`.

Do not edit migrations, schemas, services, controllers, package files, other tests, UI or orchestration records.

## Required Behavior

1. Create/query the complete organization hierarchy needed by the four suites without relying on `seed-dev.sql`.
2. Use returned IDs and parent-derived valid paths; do not hardcode an absent parent.
3. Keep fixtures organization-consistent and unique per run.
4. Make cleanup conditional/idempotent and reverse dependency ordered after partial setup.
5. Preserve all hierarchy and FK constraints.

## First Hypothesis and Check

Hypothesis: provisioning the missing parent chain removes the primary setup failure; guarded cleanup removes secondary invalid-UUID errors.

First focused check after the first substantive edit:

```powershell
pnpm --filter fleet-platform-api exec jest --config ./test/jest-integration.json --runInBand --runTestsByPath test/vehicle.int-spec.ts
```

Then run Booking, Handover and Entitlement integration files individually. Do not run the full integration suite until all four pass.

## Acceptance

- Four focused suites pass from a migrated but unseeded database.
- No cleanup query receives an empty UUID.
- No valid constraint is removed or bypassed.
- Handoff records exact commands, counts and environment.

## Readiness Response

Before edits, report understanding, exact helper design, expected files, first falsifying check and any blocker. Edits are authorized only after orchestrator approval.
