# Workflow: Legacy Link Placeholder

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Open `../SKILL.md` and choose the active workflow before using this placeholder.
- [ ] Confirm whether the migrated link `design-backend.md` still represents real guidance.

## Goal

Preserve a migrated workflow link until the owner replaces it with a real workflow or removes the stale reference.

## Entity completion override

If the request mentions an ERD, data model, schema, backend entity implementation, persistence model, or required entities, do not treat this placeholder as sufficient. Apply `../SKILL.md` Entity Completion Contract before implementation: detect the persistence target from repository evidence, produce a per-store entity map when multiple stores exist, ask one concise clarification if ambiguous, and never hardcode MongoDB as the default.

Compare BRD/PRD required entities, domain model / ERD, current code models/entities/documents, storage mapping, migrations/schema/collections/tables, repository/data-access methods, service/use-case methods, API contracts/routes, tests, and frontend models where applicable. Implement missing layers for every required entity or list each gap as an explicit blocker/residual risk. Generated backend work is not complete until the narrowest relevant tests pass.

## Steps

1. Prefer the active workflows listed in `../SKILL.md`.
2. If this placeholder is still needed, replace it with a full workflow using `adp-skill-creator/assets/workflow.md.tmpl`.
3. Record why the legacy link was retained or retired.

## Anti-patterns

- Treating this placeholder as production-grade guidance.
- Keeping a stale link without owner review.
- Creating duplicate workflow behavior instead of routing to the active workflow.

## After you finish

- [ ] Notify the downstream role(s): `ai-reviewer`.

## Definition of Done

- [ ] The active workflow path is clear.
- [ ] The stale migrated link is replaced, removed, or explicitly retained with rationale.
