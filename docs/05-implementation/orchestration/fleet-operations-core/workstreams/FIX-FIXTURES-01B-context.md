# Agent Context Pack - FIX-FIXTURES-01B

| Field | Value |
|---|---|
| Parent phase | CORE-0 |
| Outcome | Adopt the verified seed-independent hierarchy fixture in the seven collateral suites and close the combined failure classification. |
| Starting commit | Current integration worktree containing verified FIX-FIXTURES-01A |
| Status | `READY` |
| Agent | Generic isolated implementation agent |

## Dependency

FIX-FIXTURES-01A is verified and its helper API is frozen. This stream may begin after its readiness response passes.

## Scope and Ownership

May edit only:

- `app-api/test/auth-http.int-spec.ts`;
- `app-api/test/binding-load.int-spec.ts`;
- `app-api/test/dashboards.int-spec.ts`;
- `app-api/test/domain-decision-selector.int-spec.ts`;
- `app-api/test/fine.int-spec.ts`;
- `app-api/test/lookup-identity.int-spec.ts`.
- `app-api/test/policy-cache.int-spec.ts`.

The agent may read but must not modify the 01A helper. Do not edit domain source, migrations, schemas, package files, UI or orchestration records.

## Required Behavior

1. Consume the frozen 01A fixture helper instead of a dev-seed parent.
2. Make each suite's teardown conditional/idempotent after partial setup.
3. Preserve suite-specific data and assertions.
4. Classify any remaining failure as fixture, teardown, product, environment or performance; do not hide it.

## Validation Order

Run each owned suite individually against a migrated, unseeded database. After all eleven seed-dependent suites pass, run:

```powershell
pnpm --filter fleet-platform-api test:integration
```

Every residual failed suite receives a separate gap with its first error and owner.

## Acceptance

- Seven collateral suites pass individually from migrated, unseeded storage.
- Combined integration suite runs after all eleven fixture-dependent suites pass.
- Residual failures are not attributed to fixtures without evidence.
- Exact commands, commit, environment and counts are recorded.

## Readiness Response

Do not start until 01A is verified. Then report understanding, exact files, helper API assumptions, individual command order and first falsifying check.