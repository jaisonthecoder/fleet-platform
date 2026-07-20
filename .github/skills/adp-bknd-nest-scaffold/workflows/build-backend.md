# Workflow: Build Backend Feature (NestJS)

## Position in the chain

- **Prerequisite:** [`define-api`](define-api.md) — OpenAPI is committed and reviewed before implementation begins.
- **Pairs with:** [`test-backend`](test-backend.md) — runs **alongside** this workflow, not after. SKILL.md hard rule 2: no build without tests.
- **Triggers when needed:** [`update-persistence`](update-persistence.md) — invoke whenever the build needs a schema change.
- **Successor:** code-review gate, then handoff to `qa-test-engineer`, `code-reviewer`, `platform-sre`.

## OpenAPI ownership note

The contract is owned by [`define-api`](define-api.md). Inside `build-backend` you only update OpenAPI for **deltas discovered during implementation** (a new error case, a missing field, a corrected example). If the change is more than a delta, stop and complete `define-api` first — drift between code and spec is a release blocker (SKILL.md hard rule 1).

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] ACs, the OpenAPI contract from `define-api`, design notes from `design-backend`, data model, and runtime constraints are available.
- [ ] Business goal, owning stakeholder, and AC source are known; implementation is limited to that approved scope.
- [ ] The target files and module boundaries are clear.
- [ ] If the request touches an ERD, data model, schema, backend entity implementation, persistence model, or required entities, the persistence technology has been detected or one concise clarification has been asked.
- [ ] You are on the right branch.
- [ ] Project test/lint/typecheck commands are known.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult

- [`../references/nest-architecture.md`](../references/nest-architecture.md) — building blocks, request lifecycle, error handling.
- [`../references/module-boundaries.md`](../references/module-boundaries.md) — where each file goes.
- [`../references/api-conventions.md`](../references/api-conventions.md) — DTO and error shape rules.
- [`../references/security-baseline.md`](../references/security-baseline.md) — auth, secrets, audit, input handling, rate limits.
- [`../references/anti-patterns.md`](../references/anti-patterns.md) — what reviewers will reject.

## Goal

A NestJS implementation that satisfies the AC, respects module boundaries, and is ready for CI.

## Scaffold checklist — use before creating any file

Drift starts when someone creates `src/modules/<feature>/<feature>.controller.ts` instead of `src/modules/<feature>/controllers/<feature>.controller.ts`. Run this checklist **before** the first `git add` of any new file.

- [ ] The module is at `src/modules/<feature>/` (not `src/<feature>/`, not `src/infrastructure/<feature>/`).
- [ ] `<feature>.module.ts` is the **only** file at the module root. Anything else is in a subfolder.
- [ ] Each new file is placed at the path matched in the table below — even if it's the only file of its kind.
- [ ] Co-located `*.spec.ts` files sit in the **same subfolder** as the file they test (e.g. `services/<feature>.service.spec.ts`).
- [ ] No `infrastructure/` tree under the feature module. Cross-cutting infrastructure lives in a shared module — see [`../references/module-boundaries.md`](../references/module-boundaries.md) § Shared modules.
- [ ] DTO filenames end in `.dto.ts` — `current-user.response.dto.ts`, not `current-user.response.ts`.
- [ ] Any new cross-cutting config is placed under `src/common/config/<concern>.config.ts`; app, database, OpenAPI/Swagger, and logging config are separate files.
- [ ] Run `ls src/modules/<feature>` and confirm output is `<feature>.module.ts` plus subfolder names. Anything else is a layout violation — fix it before continuing.

If a file is already at the module root from a prior commit, **move it now** as part of this build. Don't add another file alongside it "just for this story" — that's how the project ends up flat.

## Steps

1. **Start with behavior tests where practical.** Add failing Jest/Supertest coverage for the acceptance scenario before implementation. See [`test-backend.md`](test-backend.md).
2. **Build inside the owning module, in the right subfolder.** Each new file goes into its layer's subfolder, never the module root. Use these exact paths:
   - Controller → `src/modules/<feature>/controllers/<feature>.controller.ts`
   - Service → `src/modules/<feature>/services/<feature>.service.ts`
   - Repository → `src/modules/<feature>/repositories/<feature>.repository.ts` (or a more specific name like `users.repository.ts`)
   - Request/response DTOs → `src/modules/<feature>/dto/<name>.dto.ts`
   - ORM entities → `src/modules/<feature>/entities/<name>.entity.ts`
   - Guards / interceptors / pipes / decorators / interfaces / enums → matching subfolder, created on first use
   - Module wiring → `src/modules/<feature>/<feature>.module.ts` (the **only** file allowed at the module root)
   - Co-locate `*.spec.ts` next to the file under test inside the same subfolder.

   Subfolders are mandatory from the first file — a flat layout (e.g. `<feature>.controller.ts` at the module root) is a layout violation, even for single-controller features. See [`../references/module-boundaries.md`](../references/module-boundaries.md) § Standard NestJS folder layout.
3. **Keep controllers thin.** Bind, validate, authorize, delegate, map response. **No business rules in controllers** — Rule 2.
4. **Keep providers focused.** One use case per method or service area. Inject dependencies through constructors and interfaces/tokens.
5. **Validate boundaries.** Use the project's validation pipe or schema parser for inbound data. Reject unknown fields. Re-check domain invariants before persistence.
6. **Handle errors centrally.** Throw typed app exceptions from the service; the global exception filter maps them to ProblemDetails responses. See [`../references/nest-architecture.md`](../references/nest-architecture.md) § Error handling.
7. **Persist intentionally.** Detect the project's persistence technology from files, packages, ORM/config, connection strings, migrations, Docker compose, repositories, and infrastructure modules before assuming a database. Supported targets include SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, and In-memory/test repositories. If multiple stores exist, keep a per-store entity map. If ambiguous, ask one concise clarification. Never hardcode MongoDB as the default.
8. **Complete required entities vertically.** For any entity in BRD/PRD/domain-model/ERD, compare current code models/entities/documents, storage mapping, migrations/schema/collections/tables, repository/data-access methods, service/use-case methods, API contracts/routes, tests, and frontend models where applicable. Implement missing layers or list them as explicit blockers/residual risks in the Entity Completion Matrix.
9. **Use the right persistence checks.** Relational stores need table, PK/FK, unique/check constraints, indexes, migrations, ORM mapping/configuration, transaction boundaries, and seed/reference data where required. MongoDB/document stores need collection, document identity, embedded vs referenced relationship decision, indexes, repository/query methods, and cross-document consistency handling. Event-sourced or hybrid stores need aggregate root, events, snapshots, projections/read models, idempotency, and replay behavior.
10. **Invoke persistence workflow when needed.** Use the project's ORM/repository through the established boundary. Wrap multi-step writes in transactions or consistency controls appropriate to the store. If a schema/collection/index/projection change is needed, switch to [`update-persistence`](update-persistence.md).
11. **Audit state changes.** Every state-changing endpoint writes an audit-log row in the same transaction — Rule 9. See [`../references/security-baseline.md`](../references/security-baseline.md) § Audit logging.
12. **Add readiness hooks.** Health indicators, structured logs, metrics, graceful shutdown, and config validation where the change affects runtime. Keep runtime config in `src/common/config/` by concern; do not add large config objects to `main.ts` or feature modules.
13. **Run local checks.** Typecheck, lint, unit tests, relevant integration tests, and formatting. Generated backend work is not complete until the narrowest relevant tests pass for the entity slice touched.
14. **Verify layout.** Before finishing, confirm `ls src/modules/<feature>` shows only `<feature>.module.ts` plus subfolders (`controllers/`, `services/`, `dto/`, `entities/`, and any others added in this build). Any controller/service/repository/DTO/entity file at the module root is a layout violation and must be moved into the matching subfolder before opening the PR.

## Anti-patterns

- Direct database calls from controllers.
- Catch-all `any` DTOs or untyped request bodies.
- Swallowing downstream errors.
- Migrations generated without review.
- Audit-log writes outside the transaction that performed the state change.
- Inline OpenAPI/Swagger, database, logging, or app config in `main.ts` instead of separated files under `src/common/config/`.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) for the full PR-review citation catalog.

## After you finish

- [ ] Definition of Done items below are met.
- [ ] Evidence from tests/checks is captured in the PR or ticket.
- [ ] Open questions and runtime assumptions are explicit.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `qa-test-engineer`, `code-reviewer`, `platform-sre`.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.

## Definition of Done

- [ ] **OpenAPI is current** — any deltas discovered during implementation are reflected; the spec lints clean. (Hard rule 1.)
- [ ] **Unit tests cover the AC** — Jest tests on the service(s) for happy path, validation failures, auth failures, and any state-bearing transitions. PR is rejected without them. (Hard rule 2.)
- [ ] Traceability recorded: business goal -> AC -> API/module change -> tests.
- [ ] AC is implemented.
- [ ] Module boundaries remain clear.
- [ ] **Layout matches the standard.** Every controller/service/repository/DTO/entity sits in its named subfolder; only `<feature>.module.ts` is at the module root. See [`../references/module-boundaries.md`](../references/module-boundaries.md) § Standard NestJS folder layout.
- [ ] **Config layout matches Rule 10.** App, database, OpenAPI/Swagger, logging, and other runtime concerns are separated under `src/common/config/`.
- [ ] DTO validation and error mapping are in place.
- [ ] Persistence is isolated; if a schema change happened, `update-persistence` was completed and signed off.
- [ ] Required entities from BRD/PRD/domain-model/ERD are implemented through storage, repository/data-access, service/use-case, API contract, API endpoint, tests, and frontend model where applicable, or are listed as explicit blockers/residual risks.
- [ ] Audit rows written for every state change in the same transaction (Rule 9).
- [ ] Typecheck, lint, and the narrowest relevant tests pass.
