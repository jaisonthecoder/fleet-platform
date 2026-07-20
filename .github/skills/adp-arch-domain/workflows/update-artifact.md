# Update Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/adr.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Locate the current artifact and any previous decision record, review note, or approval trail.
- Confirm the change request, defect, scope update, or feedback item that justifies the update.
- If entities are in scope, re-check repository persistence evidence instead of carrying forward an assumed database.
- Primary artifact: docs/03-architecture/DOMAIN/domain-model.md, docs/03-architecture/DOMAIN/domain-*.drawio

## Goal

Complete the requested docs/03-architecture/DOMAIN/domain-model.md, docs/03-architecture/DOMAIN/domain-*.drawio work so `ai-backend-dotnet`, `ai-frontend-react`, `ai-data-engineer`, `ai-platform-engineer`, `ai-security-engineer` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Identify what must be preserved from the existing artifact: approved decisions, constraints, owners, and evidence.
2. Make the smallest update that satisfies the change request.
3. Preserve or convert the domain model into a UML/class-diagram style artifact: include classes/entities, key attributes, relationships, cardinality, aggregate roots where relevant, ownership boundaries, lifecycle states, and important invariants.
4. Prefer a Mermaid `classDiagram` inside `domain-model.md` for text-native output; create or update `domain-*.drawio` only when a visual diagram file is required.
5. When updating `domain-*.drawio`, convert generic boxes into UML-style class shapes with compartments for name/stereotype, attributes, and domain behaviors/invariants. Use labeled relationship connectors with multiplicity; reserve plain boxes for bounded-context/module containers only.
6. Reconcile required entities across BRD/PRD, domain model / ERD, current code models/entities/documents, storage mapping, migrations/schema/collections/tables, repository/data-access methods, service/use-case methods, API contracts/routes, tests, and frontend models where applicable.
7. Detect or confirm the persistence target and per-store entity map. Supported targets include SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, In-memory/test repositories, event-sourced, and hybrid stores. If ambiguous, ask one concise clarification. Never hardcode MongoDB as the default.
8. Update the Entity Completion Matrix from `../SKILL.md`; every entity in BRD/PRD/domain-model/ERD must be implemented downstream or listed as a blocker/residual risk.
9. Record each material change as added, changed, removed, or deferred.
10. Refresh evidence links, assumptions, risks, and downstream handoff notes.
11. Call out any breaking change, approval impact, or downstream role that must re-review the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Replacing the domain model with a process flow, component diagram, ERD-only view, or glossary when a class-diagram style model is required.
- Leaving Draw.io domain diagrams as generic labeled boxes instead of UML-style classes with compartments, attributes, multiplicity, and relationship semantics.
- Leaving a newly required entity out of implementation scope without a named blocker/residual risk.

## After you finish

- The artifact remains traceable to its prior version and source evidence.
- The change list explains what changed and why.
- Any required re-review or follow-up owner is named.
- [ ] Notify the downstream role(s): `ai-backend-dotnet`, `ai-frontend-react`, `ai-data-engineer`, `ai-platform-engineer`, `ai-security-engineer`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Domain model is represented as a class-diagram style model, preferably Mermaid `classDiagram` in Markdown unless a Draw.io file is required.
- [ ] Draw.io domain diagrams use UML-style class compartments, stereotypes, attributes, behaviors/invariants, and labeled multiplicity connectors rather than generic boxes.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Entity Completion Matrix is updated when entities are in scope, including implementation gaps or residual risks.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
