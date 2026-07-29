# Agent Context Pack - FIX-FIXTURES-01A

| Field | Value |
|---|---|
| Parent phase | CORE-0 |
| Outcome | Create a seed-independent hierarchy fixture contract and repair the four core operational suites. |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Status | `VERIFIED` - implemented, focused evidence passed, High findings repaired, independent re-review closed |
| Agent | Generic isolated implementation agent |

## Scope and Ownership

May edit only:

- `app-api/test/support/core-fixtures.ts` or one equivalently named new helper under `app-api/test/support/`;
- `app-api/test/vehicle.int-spec.ts`;
- `app-api/test/booking.int-spec.ts`;
- `app-api/test/handover.int-spec.ts`;
- `app-api/test/entitlement.int-spec.ts`.

Do not edit migrations, schemas, services, controllers, package files, collateral suites, UI or orchestration records.

## Required Behavior

1. Provision/query the complete organization hierarchy needed by tests without relying on `seed-dev.sql`.
2. Use returned IDs and parent-derived valid ltree paths.
3. Keep fixtures organization-consistent and unique per run.
4. Make cleanup conditional/idempotent and reverse dependency ordered after partial setup.
5. Preserve all hierarchy and FK constraints.
6. Expose a small stable helper API for FIX-FIXTURES-01B; do not create a broad test framework.

## First Hypothesis and Check

Hypothesis: provisioning the missing parent chain removes primary setup failures; guarded cleanup removes secondary invalid-UUID errors.

After the first substantive helper/core-suite edit, run:

```powershell
pnpm --filter fleet-platform-api exec jest --config ./test/jest-integration.json --runInBand --runTestsByPath test/vehicle.int-spec.ts
```

Then run Booking, Handover and Entitlement individually.

## Acceptance

- Four core suites pass from a migrated, unseeded database.
- No cleanup query receives an empty UUID.
- No valid constraint is removed or bypassed.
- Helper API and data lifecycle are documented in the handoff.
- Exact commands, commit, environment and counts are recorded.

## Readiness Response

Before edits, report understanding, helper API, exact files, database baseline assumptions and first falsifying check. Await explicit authorization.
