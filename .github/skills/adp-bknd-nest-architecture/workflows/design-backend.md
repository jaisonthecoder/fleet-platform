# Workflow: Design Backend (NestJS)

## Position in the chain
- **Prerequisite:** an LLD from `solution-architect` plus PRD/ACs from `product-manager`. If either is missing, stop and request it.
- **Successor:** [`define-api`](define-api.md) — the API contract is locked once the design is approved.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] Required inputs are available: LLD, ACs, NFRs, data model, security classification, and integration contracts.
- [ ] Business goal, owning stakeholder, and PRD/ticket source are known; if not, route back to `product-manager` or `business-analyst`.
- [ ] You know who consumes the output.
- [ ] The target file or destination is decided.
- [ ] Persistence technology has been detected from the repository or the ambiguity is captured as one concise clarification.
- [ ] You are on the right branch.
- [ ] Relevant standards in the host project have been skimmed.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/nest-architecture.md`](../references/nest-architecture.md) — building blocks, request lifecycle, DI, error handling.
- [`../references/module-boundaries.md`](../references/module-boundaries.md) — module layout, cross-feature dependencies, shared modules.
- [`../references/security-baseline.md`](../references/security-baseline.md) — auth, secrets, audit, headers — required for any feature touching user data.

## Goal
A modular NestJS design that is testable, observable, secure, and ready to implement.

## Steps
1. **Confirm the slice.** Capture bounded context, actors, APIs, data ownership, dependencies, and acceptance criteria.
2. **Map modules.** Define Nest modules by feature or bounded context. Keep shared modules small and dependency direction explicit. See [`../references/module-boundaries.md`](../references/module-boundaries.md).
3. **Separate responsibilities.** Controllers handle transport; services/providers own behavior; repositories (where present) own data access. See [`../references/nest-architecture.md`](../references/nest-architecture.md) § Building blocks.
4. **Plan DTOs and validation.** Use the project's chosen validator (class-validator + class-transformer or Zod — see SKILL.md § Stack). Validate inbound DTOs at the edge and preserve domain invariants inside.
5. **Define cross-cutting concerns.** Guards for authz, interceptors for logging/serialization, pipes for validation, filters for ProblemDetails-style errors. See [`../references/nest-architecture.md`](../references/nest-architecture.md) § Request lifecycle.
6. **Plan configuration.** Use `@nestjs/config` with schema validation. Put cross-cutting config under `src/common/config/`, one concern per file: `app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, etc. Pull secrets from the project's managed secret store. No secrets in code or examples.
7. **Choose persistence boundary.** Inspect project files, packages, ORM/config, connection strings, migrations, Docker compose, repositories, and infrastructure modules before assuming a database. Support SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, In-memory/test repositories, and any event-sourced or hybrid store already used by the project. If multiple stores exist, document a per-store entity map. If ambiguous, ask one concise clarification. Never hardcode MongoDB as the default.
8. **Plan complete entity slices.** For each entity from BRD/PRD/domain-model/ERD, fill or link an Entity Completion Matrix covering source requirement, domain model, storage mapping, keys/identity, relationships, indexes/constraints, data access, service/use case, API contract, API endpoint, tests, frontend model, status, and residual risk.
9. **Apply persistence-specific checks.** Relational stores need table, primary key, foreign keys, unique/check constraints, indexes, migrations, ORM mapping/configuration, transaction boundaries, and seed/reference data when required. MongoDB/document stores need collection name, document identity, embedded vs referenced decision, indexes, query methods, and consistency handling. Event-sourced or hybrid stores need aggregate root, events, snapshots, projection/read model, idempotency, and replay behavior.
10. **Plan deployment readiness.** Health checks, metrics, structured logs, graceful shutdown, migrations, and startup checks.

## Anti-patterns
- God modules that import everything.
- Controllers containing business logic.
- ORM entities reused as public API DTOs.
- Required entities from BRD/PRD/domain-model/ERD omitted from the implementation plan without an explicit blocker/residual risk.
- Global mutable config or hidden environment assumptions.
- One catch-all config file or inline `main.ts` config for database, OpenAPI/Swagger, logging, and app settings.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) for the full PR-review citation catalog.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] The artifact is saved or linked where the next role can find it.
- [ ] Key decisions, assumptions, and open questions are explicit.
- [ ] Downstream roles are notified — the project's frontend role (`frontend-react` / `frontend-angular` / equivalent), `integration-engineer`, `qa-test-engineer`, `platform-sre`.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md`.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.

## Definition of Done
- [ ] Traceability recorded: business goal -> acceptance criteria -> backend module choices.
- [ ] Module map documented.
- [ ] Provider/repository/dependency plan documented.
- [ ] Validation, auth, error, logging, and config strategies chosen.
- [ ] Config concerns are split under `src/common/config/` with schema validation and no inline config objects in `main.ts`.
- [ ] Persistence technology, per-store entity map, Entity Completion Matrix, and migration/schema/collection approach documented.
- [ ] Missing required entities are either in the implementation plan or listed as explicit blockers/residual risks.
- [ ] Test plan identifies the narrowest relevant tests needed before generated backend work can be considered complete.
- [ ] Runtime readiness checks identified.
