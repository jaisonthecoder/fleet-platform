# Agent Context Pack - CORE0-DATA-TEST

| Field | Value |
|---|---|
| Program/phase | Fleet Operations Core / CORE-0 |
| Workstream | `CORE0-DATA-TEST` - Shared schema, migration and test baseline |
| Task type | Exploration/documented reconciliation |
| Status | `READY` |
| Starting commit | `e964ffc5760630c8976be473059b15c9f425449a` |
| Worktree/branch | Main workspace, read-only |
| Implementer | Generic isolated subagent |
| Independent reviewer | Assigned after reconciliation |

## Business Outcome

Separate real product defects from stale integration fixtures and teardown cascades, and map the existing database invariants to the operational core so future agents repair only the correct slice.

## Scope

- Inspect migrations `0000-0028`, schema ownership and tests relevant to Vehicle, Booking, Handover and Entitlement.
- Analyze the previously observed integration pattern: stricter hierarchy parent/path/organization constraints reject old fixtures, IDs remain unset, and cleanup then fails.
- Map DB-enforced invariants: organization consistency, hierarchy assignment, booking overlap, consent/provenance, allocation exclusivity, append-only evidence and audit/outbox.
- Identify reusable fixture builders and teardown ordering, if any.
- Produce a minimal test-baseline recovery plan without editing tests.

## Explicit Exclusions

- Do not edit migrations, schemas, fixtures or tests.
- Do not rerun the full integration suite unless necessary to distinguish a specific hypothesis; source-first analysis is preferred.
- Do not propose dropping or weakening valid constraints to make stale fixtures pass.
- Do not implement O4/O6 or frontend work.

## Controlling Sources

- `docs/implementation-plan/booking_and_vehiclemanagement/01-shared-domain-contracts-and-data-foundation.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/18-testing-rollout-and-cutover.md`
- `docs/implementation-plan/booking_and_vehiclemanagement/19-traceability-and-completion-matrix.md`
- `docs/05-implementation/orchestration/fleet-operations-core/EVIDENCE-REGISTER.md`
- `docs/05-implementation/orchestration/fleet-operations-core/DECISION-REGISTER.md`

## Current Implementation Anchors

- `app-api/drizzle/migrations/**`
- `app-api/src/common/database/schema/**`
- `app-api/test/**`
- `app-api/src/test/**` or shared fixture/bootstrap utilities if present
- `app-api/scripts/migration-test.mjs`

## Known Verified Facts

- All migrations through `0028` passed fresh apply and idempotency in this session.
- Booking overlap exclusion exists; do not report it missing.
- Current integration baseline is red: 8 suites passed, 11 failed; 51 of 88 tests failed.
- Initial hierarchy fixture rejection appears to cause empty IDs and secondary teardown failures; verify and classify rather than assuming every failure is independent.

## Required Output

1. Migration-to-core-capability map.
2. Invariant matrix identifying DB, service and test ownership.
3. Failure-cluster/root-cause matrix for current integration suites.
4. Proposed fixture/teardown repair slices with exclusive file ownership.
5. Narrow commands that validate each repair before running the full integration suite.
6. Any genuine schema/product defects discovered, clearly separated from fixture debt.

## Readiness Instruction

Begin by restating the outcome, boundaries and inspection strategy. Then perform the read-only investigation. Return evidence with workspace-relative file paths and line numbers where practical; do not edit.