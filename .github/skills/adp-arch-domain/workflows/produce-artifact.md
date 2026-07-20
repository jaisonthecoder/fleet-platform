# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/adr.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Confirm the requested output matches this skill's owner role and primary artifact.
- Identify the upstream evidence the artifact depends on.
- If the request asks for an ERD, data model, schema, persistence model, or required entities, inspect repository persistence evidence before assuming a store.
- Primary artifact: docs/03-architecture/DOMAIN/domain-model.md, docs/03-architecture/DOMAIN/domain-*.drawio

## Goal

Complete the requested docs/03-architecture/DOMAIN/domain-model.md, docs/03-architecture/DOMAIN/domain-*.drawio work so `ai-backend-dotnet`, `ai-frontend-react`, `ai-data-engineer`, `ai-platform-engineer`, `ai-security-engineer` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Confirm the target artifact path and create the smallest artifact that satisfies the request.
2. Trace each decision to a source input, ticket, acceptance criterion, operational signal, or stakeholder note.
3. Build the domain model as a UML/class-diagram style artifact: include classes/entities, key attributes, relationships, cardinality, aggregate roots where relevant, ownership boundaries, lifecycle states, and important invariants.
4. Prefer a Mermaid `classDiagram` inside `domain-model.md` for text-native output; create or update `domain-*.drawio` only when a visual diagram file is required.
5. When generating `domain-*.drawio`, render each domain concept as a UML-style class with compartments for name/stereotype, attributes, and domain behaviors/invariants. Use labeled relationship connectors with multiplicity; reserve plain boxes for bounded-context/module containers only.
6. For entity work, compare BRD/PRD required entities, existing domain model / ERD, current code models/entities/documents, storage mapping, migrations/schema/collections/tables, repository/data-access methods, service/use-case methods, API contracts/routes, tests, and frontend models where applicable.
7. Detect or confirm the persistence target: SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, In-memory/test repositories, event-sourced, or hybrid. If multiple stores exist, include a per-store entity map. If ambiguous, ask one concise clarification. Never hardcode MongoDB as the default.
8. Add the Entity Completion Matrix from `../SKILL.md`. Any entity in BRD/PRD/domain-model/ERD that is missing downstream implementation must be named as a blocker/residual risk for the backend/data owner.
9. Write assumptions explicitly when evidence is missing.
10. Add an evidence section with links to source material, commands, generated files, or review notes.
11. Prepare a short handoff note naming the downstream role that should consume the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Replacing the domain model with a process flow, component diagram, ERD-only view, or glossary when a class-diagram style model is required.
- Generating Draw.io domain diagrams as generic labeled boxes without class compartments, attributes, multiplicity, or relationship semantics.
- Producing an ERD or required-entity list that does not state the detected persistence target or downstream implementation gaps.

## After you finish

- The artifact is stored at the standard path for adp-arch-domain.
- The output includes source evidence and assumptions.
- The handoff note names the next role and any open questions.
- [ ] Notify the downstream role(s): `ai-backend-dotnet`, `ai-frontend-react`, `ai-data-engineer`, `ai-platform-engineer`, `ai-security-engineer`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Domain model is represented as a class-diagram style model, preferably Mermaid `classDiagram` in Markdown unless a Draw.io file is required.
- [ ] Draw.io domain diagrams use UML-style class compartments, stereotypes, attributes, behaviors/invariants, and labeled multiplicity connectors rather than generic boxes.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Entity Completion Matrix is present when entities are in scope, including implementation gaps or residual risks.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
