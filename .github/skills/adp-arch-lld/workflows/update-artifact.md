# Update Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/adr.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Locate the current artifact and any previous decision record, review note, or approval trail.
- Confirm the change request, defect, scope update, or feedback item that justifies the update.
- Identify new or existing required values that would otherwise remain `TBC`, `unknown`, or `[placeholder]`; ask the user to provide them before updating the artifact.
- If entities are in scope, re-check repository persistence evidence instead of carrying forward an assumed database.
- If UI/API boundaries are in scope, re-check the Backend/Frontend Contract Matrix instead of carrying forward frontend or backend assumptions.
- Primary artifacts: foundation-lld.md, module-lld-*.md, lld.md, docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md, lld-*.drawio

## Goal

Complete the requested Foundational LLD, Module LLD pack, FR-level LLD, single-file LLD, or LLD diagram update so downstream delivery roles can proceed with traceable evidence, explicit AD Ports assumptions, and clear boundaries between architecture rules, module design, FR-specific design, and delivery specs.

## Steps

1. Identify what must be preserved from the existing artifact: approved decisions, constraints, owners, and evidence.
2. Re-check whether the current artifact shape is still correct:
   - Keep a Foundational LLD limited to shared engineering rules.
   - Keep business-module specifics in one or more Module LLD packs.
   - Keep single-FR implementation design in `docs/02-product/FR/fr-<nnn>/fr-<nnn>-lld.md` when the source requirement is already packaged as an FR folder.
   - Split an overloaded `lld.md` when the update adds multiple modules, services, capabilities, integrations, or technologies.
   - Keep single `lld.md` only when the repository convention or small scope justifies it.
3. Make the smallest update or split that satisfies the change request.
4. Run a clarification gate before updating:
   - List required missing values by section or design pack.
   - Ask concise questions for values that would otherwise remain `TBC`, `unknown`, or `[placeholder]`.
   - If the user cannot provide a value, record it as an open question with owner, due date, and impact instead of leaving a bare placeholder.
5. Keep HLD rationale in `adp-arch-hld`; keep user stories, acceptance criteria, test cases, implementation tasks, and AI/developer task prompts in delivery specs. Add trace links only when needed.
6. Reconcile required entities across BRD/PRD, domain model / ERD, current code models/entities/documents, storage mapping, migrations/schema/collections/tables, repository/data-access methods, service/use-case methods, API contracts/routes, tests, and frontend models where applicable.
7. Detect or confirm the persistence target and per-store entity map. Supported targets include SQL Server, PostgreSQL, Oracle, MongoDB, SQLite, MySQL/MariaDB, In-memory/test repositories, event-sourced, and hybrid stores. If ambiguous, ask one concise clarification. Never hardcode MongoDB as the default.
8. Update the Entity Completion Matrix from `../SKILL.md`; every entity in BRD/PRD/domain-model/ERD must be implemented downstream or listed as a blocker/residual risk.
9. Update the Backend/Frontend Contract Matrix when feature/API wiring changes; every UI/API feature must keep source FR/NFR, API operation or event, DTOs, errors, permissions, audit event, owners, contract status, and test evidence aligned.
10. Record each material change as added, changed, removed, or deferred.
11. Refresh evidence links, assumptions, risks, and downstream handoff notes.
12. Call out any breaking change, approval impact, artifact split, or downstream role that must re-review the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Keeping an overloaded single `lld.md` when the change should create a Foundational LLD or Module LLD packs.
- Mixing shared engineering rules with business-module detail.
- Authoring delivery specs inside the LLD instead of linking to them.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Leaving required `TBC`, `unknown`, or placeholder values in the updated artifact without first asking the user.
- Leaving a newly required entity out of implementation scope without a named blocker/residual risk.
- Leaving a newly required frontend/backend operation out of the Backend/Frontend Contract Matrix without a named blocker/residual risk.
- Updating an FR-level LLD without checking its package description file, acceptance criteria, draft test cases, sequence files, and index traceability.

## After you finish

- The artifact remains traceable to its prior version and source evidence.
- The change list explains what changed and why.
- Any required re-review or follow-up owner is named.
- [ ] Notify the downstream role(s) that own the affected modules, technologies, data, platform, security, quality, or delivery specs.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] The resulting LLD shape is explicit: Foundational LLD, one Module LLD, multiple Module LLD packs, FR-level LLD, or single-file LLD.
- [ ] Foundation rules and module details are separated when both are needed.
- [ ] Delivery specs are referenced, not duplicated.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Required TBC or missing values were requested from the user before updating, or recorded as owned open questions with due date and impact.
- [ ] Entity Completion Matrix is updated when entities are in scope, including implementation gaps or residual risks.
- [ ] Backend/Frontend Contract Matrix is updated when UI/API boundaries are in scope, including contract status and downstream owner impacts.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
