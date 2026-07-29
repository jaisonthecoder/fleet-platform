# Agent Context Pack - VEH-READ-AUTH-01

| Field | Value |
|---|---|
| Parent phase | CORE-1 prerequisite |
| Outcome | Close Vehicle detail/history organization and scope exposure without redesigning Vehicle Management. |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Status | `BLOCKED` |
| Agent | Generic isolated implementation agent |

## Scope and Ownership

May edit only:

- `app-api/src/modules/vehicles/controllers/vehicle.controller.ts`;
- Vehicle controller tests, creating a focused spec beside the controller if absent;
- `app-api/src/modules/vehicles/services/vehicle.service.ts` only if an existing organization/scope projection is insufficient.

Do not edit Booking, integration fixtures, migrations/schemas, import, telematics, UI or orchestration records.

## Blocking Decision

D-VEH-READ must define reader roles, field masking, sensitive-history auditing and opaque cross-organization `403/404` behavior. Existing `FLEET_WRITE_ROLES` must not be reused as the general read policy.

## Required Behavior After Unblock

1. Detail and history receive authenticated `Principal`.
2. Deny organization mismatch before returning data.
3. Authorize against active Vehicle scope using the approved read-role matrix, not write-role admission.
4. Preserve current list behavior in this slice; authorized-closure list/search is a later Vehicle task.
5. Do not change System Administrator write policy, Vehicle lifecycle or UI.
6. Do not claim full O4/O6 or complete V2 registry readiness.

## First Hypothesis and Check

Hypothesis: reusing existing `assertVehicleScope` for detail/history closes the immediate IDOR without repository or schema changes.

First focused check after the first substantive edit:

```powershell
pnpm --filter fleet-platform-api exec jest --runInBand --runTestsByPath src/modules/vehicles/controllers/vehicle.controller.spec.ts
```

If no controller spec exists, create the narrow spec first and run it. Then run Vehicle unit and integration tests when the fixture baseline is available.

## Acceptance

- Same-organization authorized detail/history succeeds.
- Cross-organization and outside-scope reads fail without returning projection/history.
- Existing write behavior is unchanged.
- Focused controller tests and typecheck pass, subject only to independently owned Booking failures until BOOK-AUTH-01 integrates.

## Readiness Response

Do not dispatch implementation until D-VEH-READ closes. After unblock, report understanding, exact files, approved policy mapping and first check. Edits require orchestrator approval.