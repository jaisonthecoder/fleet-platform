# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/adr.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Confirm the requested output matches this skill's owner role and one of its LLD artifact types.
- Identify the upstream evidence the artifact depends on.
- Identify required values that would otherwise be `TBC`, `unknown`, or `[placeholder]`; ask the user to provide them before drafting the artifact.
- If entity, ERD, schema, data model, persistence model, or required-entity work is in scope, inspect repository persistence evidence before assuming a store.
- If any UI/API boundary, screen/API wiring, backend endpoint, or contract test is in scope, confirm the Backend/Frontend Contract Matrix is required and identify the source FR/NFR rows it must cover.
- Primary artifacts: foundation-lld.md, module-lld-*.md, lld.md, docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md, lld-*.drawio

## Goal

Complete the requested Foundational LLD, Module LLD pack, FR-level LLD, single-file LLD, or LLD diagram work so downstream delivery roles can proceed with traceable evidence, explicit AD Ports assumptions, and clear boundaries between architecture rules, module design, FR-specific design, and delivery specs.

## Steps

1. Choose the LLD shape before writing:
   - Foundational LLD only when the request is about shared engineering rules.
   - One Module LLD pack when the scope is a single module, service, capability, integration, or bounded component.
   - Multiple Module LLD packs when the scope spans multiple modules, services, capabilities, or technologies.
   - FR-level `docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md` when the request is scoped to one functional requirement package.
   - Single `lld.md` only when the repository already uses that convention or the scope is intentionally small.
2. Confirm the target artifact path and create the smallest artifact set that satisfies the request.
3. Run a clarification gate before drafting:
   - List required missing values by section or design pack.
   - Ask concise questions for values that would otherwise become `TBC`, `unknown`, or `[placeholder]`.
   - If the user cannot provide a value, record it as an open question with owner, due date, and impact instead of leaving a bare placeholder.
4. Keep HLD rationale in `adp-arch-hld`; keep user stories, acceptance criteria, test cases, implementation tasks, and AI/developer task prompts in delivery specs. Add trace links only when needed.
5. Trace each decision to a source input, ticket, acceptance criterion, operational signal, or stakeholder note.
6. For entity work, compare BRD/PRD required entities, domain model / ERD, current code models/entities/documents, storage mapping, migrations/schema/collections/tables, repository/data-access methods, service/use-case methods, API contracts/routes, tests, and frontend models where applicable.
7. Detect or confirm the persistence target: SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, In-memory/test repositories, event-sourced, or hybrid. If multiple stores exist, include a per-store entity map. If ambiguous, ask one concise clarification. Never hardcode MongoDB as the default.
8. Add the Entity Completion Matrix from `../SKILL.md` for every required entity. Missing implementation layers must be planned or listed as explicit blockers/residual risks.
9. For each Module LLD pack or FR-level LLD, decide whether sequence diagrams are required:
   - Required for implementation-critical flows where multiple components or services participate; a transaction, consistency, or state synchronization boundary exists; audit, authentication, authorization, or security decisioning occurs; file or object storage is involved; import, export, or batch processing is involved; retry, rollback, idempotency, or compensation behavior matters; an external identity, platform, or integration dependency participates; or operational fallback, manual recovery, or degraded-mode behavior affects implementation.
   - Optional for simple CRUD flows where one component performs a direct create, read, update, or delete without meaningful orchestration, security decisioning, persistence boundary, storage interaction, retry, rollback, compensation, external dependency, or operational fallback.
   - Add Mermaid sequence diagrams in the Module LLD, link Draw.io diagrams stored under `docs/03-architecture/LLD/`, or link FR package diagrams at `docs/02-product/FR/fr-<nnn>/sequence.mmd` and `sequence.drawio`.
   - If no sequence diagram is needed, record the explicit rationale in the Module LLD or FR-level LLD.
10. Write assumptions explicitly when evidence is missing.
11. Add the Backend/Frontend Contract Matrix when any feature crosses frontend/backend boundaries. For each row, record feature ID, source FR/NFR, frontend screen/workflow, backend capability/use case, API operation or event, request DTO, response DTO, validation and error states, permission claim, audit event, integration dependency, mock/MSW fixture need, backend owner, frontend owner, contract status, and test evidence expectation.
12. Write assumptions explicitly when evidence is missing.
13. Add an evidence section with links to source material, commands, generated files, or review notes.
14. Prepare a short handoff note naming the downstream role that should consume each artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Forcing a broad multi-module initiative into one long `lld.md`.
- Mixing shared engineering rules with business-module detail.
- Authoring delivery specs inside the LLD instead of linking to them.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Leaving `TBC`, `unknown`, or placeholders in required sections without first asking the user.
- Designing a backend/data slice that omits entities from BRD/PRD/domain-model/ERD without naming the gap.
- Omitting sequence diagrams for implementation-critical module flows or failing to state why diagrams are not needed.
- Updating an FR-level LLD without linking back to the FR package description file, acceptance criteria, draft test cases, and sequence files.
- Letting frontend, backend, or UX skills invent API operations, DTOs, permissions, errors, or audit events instead of consuming the Backend/Frontend Contract Matrix.

## After you finish

- The artifact or artifact pack is stored at the standard path for adp-arch-lld.
- The output includes source evidence and assumptions.
- The handoff note names the next role and any open questions.
- [ ] Notify the downstream role(s) that own the affected modules, technologies, data, platform, security, quality, or delivery specs.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] The chosen LLD shape is explicit: Foundational LLD, one Module LLD, multiple Module LLD packs, FR-level LLD, or single-file LLD.
- [ ] Foundation rules and module details are separated when both are needed.
- [ ] Delivery specs are referenced, not duplicated.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Required TBC or missing values were requested from the user before generation, or recorded as owned open questions with due date and impact.
- [ ] Each Module LLD pack or FR-level LLD includes required sequence diagrams for implementation-critical flows, or an explicit "not needed" rationale for simple CRUD/non-critical flows.
- [ ] Entity Completion Matrix is present when entities are in scope, including implementation gaps or residual risks.
- [ ] Backend/Frontend Contract Matrix is present when UI/API boundaries are in scope, including owners, contract status, and test evidence expectations.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
