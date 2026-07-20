# Workflow: Update Persistence (Persistence-Agnostic)

## Position in the chain
- **Triggered by:** [`build-backend`](build-backend.md) — invoked whenever the build needs a schema change, or by a standalone schema-change story.
- **Pairs with:** [`test-backend`](test-backend.md) § Persistence tests with Testcontainers — every migration ships with a persistence test on a prod-shape clone.
- **Successor:** handoff to `database-engineer` (review), then `platform-sre` (deploy plan), then code-review gate.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see below) and can state it in one sentence.
- [ ] The **inputs** are available: schema-change requirement, ACs, data classification, BRD/PRD required entities, domain model / ERD, current storage snapshot, deploy/rollback window.
- [ ] Business reason for the data change, data owner, and affected user/business process are known.
- [ ] You know **who consumes the output**: `database-engineer` for review, `platform-sre` for deploy.
- [ ] The **target migration/schema destination** is decided for the detected store (migrations folder, schema file, collection bootstrap, repository fixture, or repo equivalent).
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Rule 3 (domain isolation) and Rule 9 (audit on state change) from the host project's governance file have been reviewed. See SKILL.md § Project rules referenced by this skill.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/anti-patterns.md`](../references/anti-patterns.md) § Persistence — every reviewer-cited persistence rule.
- [`../references/security-baseline.md`](../references/security-baseline.md) § Audit logging — required for any state-bearing entity.
- [`../references/module-boundaries.md`](../references/module-boundaries.md) § What goes where — entities and repositories layer rules.

## Goal
A persistence-agnostic entity slice that maps every required entity to its store, implementation, API surface, and tests without assuming MongoDB or any other default.

## Entity discovery and comparison

Detect persistence technology before implementation. Inspect project files, packages, ORM/config, connection strings, migrations, Docker compose, repository classes, and infrastructure modules. Supported targets include SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, and In-memory/test repositories where used by the project. If multiple stores exist, produce a per-store entity map. If the target store is ambiguous, ask one concise clarification before implementation.

Compare these inputs before changing code:
- BRD/PRD required entities.
- Domain model / ERD.
- Current code models/entities/documents.
- Storage mapping.
- Migrations/schema/collections/tables.
- Repository/data-access methods.
- Service/use-case methods.
- API contracts/routes.
- Tests.
- Frontend models where applicable.

Use this Entity Completion Matrix for each entity:
| Entity | Source Requirement | Domain Model | Storage Mapping | Keys/Identity | Relationships | Indexes/Constraints | Data Access | Service/Use Case | API Contract | API Endpoint | Tests | Frontend Model | Status | Residual Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Steps
1. **Detect persistence technology.** Record the evidence for each detected store and never hardcode MongoDB as the default.
2. **Build the per-store entity map.** For each required entity, identify the owning store, existing model/table/collection/repository, missing implementation layer, and residual risk.
3. **Categorize the change.** Additive, destructive, or data-shape for relational stores; collection/document/index shape for document stores; aggregate/event/projection shape for event-sourced or hybrid stores. Destructive and data-shape changes require `database-engineer` review.
4. **Apply store-specific checks.**
   - **Relational stores (SQL Server, PostgreSQL, Oracle, SQLite, MySQL/MariaDB):** table name, primary key, foreign keys, unique constraints, check constraints, indexes, migrations, ORM mapping/configuration, transaction boundaries, seed/reference data if required.
   - **MongoDB/document stores:** collection name, document identity, embedded vs referenced relationship decision, indexes, repository/query methods, consistency handling for cross-document references.
   - **Event-sourced or hybrid stores:** aggregate root, events, snapshots if any, projection/read model, idempotency and replay behavior.
   - **In-memory/test repositories:** fixture shape, identity behavior, relationship simulation, and parity with the production repository contract.
5. **Generate or edit the schema change through the project's toolchain.** Use the detected ORM/migration system (Prisma, TypeORM, MikroORM, EF-style SQL scripts, Knex, Flyway/Liquibase, hand-written SQL, Mongo index bootstrap, or project equivalent). Review generated output before commit. Never use push/sync shortcuts against shared environments.
6. **Edit if needed.** Generated artifacts are a starting point. Add explicit indexes, partition keys, batched backfill steps, online/concurrent clauses where supported, and clear rollback behavior.
7. **Backward-compatible by default: expand -> migrate -> contract.**
   - **Expand:** add the new column/table nullable; ship code that reads BOTH old + new shapes.
   - **Migrate:** backfill data in batches (idempotent, logged, throttled).
   - **Contract:** in a later release, remove the old code path, then drop the old column. Never combine "drop column" with "remove code that reads it" in the same release.
8. **Backfill scripts.** Idempotent, batched, logged with progress, restartable. Never update an entire production table/collection in one unbounded operation.
9. **Complete the vertical slice.** For every entity that appears in BRD/PRD/domain-model/ERD, implement or update storage mapping, repository/data-access methods, service/use-case methods, API contract, API endpoint, tests, and frontend model where applicable. If any layer cannot be completed, list it as a blocker/residual risk.
10. **Audit alignment (Rule 9).** If the change touches a state-bearing entity, confirm audit coverage for the new shape. Audit rows must capture before/after state where the project standard requires it.
11. **Test apply + rollback on a prod-shape clone when migrations exist.** Run forward, run backward, verify no orphaned rows, broken FKs, broken references, or projection drift. Capture timing; hot objects need an online strategy.
12. **`database-engineer` review** for anything beyond trivial additive changes. Sign-off recorded in PR.
13. **Never auto-migrate at app boot.** Migrations run via a separate pipeline step or one-shot job, not from `app.listen()`.
14. **Document** in the migration/schema header or PR: why, blast radius (tables/rows/collections/documents affected), expected duration, rollback steps, related ADR if applicable.

## Anti-patterns
- Auto-applying migrations on app start (`migrationsRun: true` in production, `prisma migrate deploy` in `bootstrap()`).
- Using `prisma db push` against staging/production.
- Dropping a column in the same release as removing the code that reads it.
- Seed data that mutates production records.
- ORM models leaking into API DTOs or domain types (Rule 3).
- Skipping audit-log coverage for state-bearing entities (Rule 9).
- Completing only a MongoDB document while required relational, event, or in-memory repository entities remain missing.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) § Persistence for the full citation catalog.

## After you finish
- [ ] All Definition of Done items below are met.
- [ ] The migration is committed at its documented path; the PR description records intent, blast radius, and rollback.
- [ ] A one-paragraph summary of what changed + key decisions is in the PR or ticket.
- [ ] Open questions / assumptions are explicitly listed, not hidden.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `database-engineer`, `platform-sre`, and `security-engineer` (if data classification changed).
- [ ] If this surfaced a risk or policy gap, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.
- [ ] `git status` shows only intended changes.

Run the project's test suite (including the persistence tests in [`test-backend.md`](test-backend.md)) before declaring done.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.

## Definition of Done
- [ ] Traceability recorded: business reason -> data owner -> affected process -> migration/rollback plan.
- [ ] Persistence technology detection evidence recorded; multiple stores have a per-store entity map.
- [ ] Entity Completion Matrix is filled for every entity from BRD/PRD/domain-model/ERD.
- [ ] Generated SQL/schema/index/bootstrap artifacts reviewed and edited where needed.
- [ ] Apply + rollback tested on a prod-shape clone when migrations exist.
- [ ] Backfill script (if needed) tested for idempotency and restartability.
- [ ] Expand -> migrate -> contract phases mapped to releases.
- [ ] `database-engineer` signed off.
- [ ] Migration header documents intent, blast radius, rollback.
- [ ] No auto-migrate on app boot.
- [ ] Audit-log coverage confirmed for state-bearing entities (Rule 9).
- [ ] Missing required entities are implemented or listed as explicit blockers/residual risks.
- [ ] The narrowest relevant tests pass for storage, repository/data-access, service/use-case, API, and frontend model changes touched by this entity slice.
