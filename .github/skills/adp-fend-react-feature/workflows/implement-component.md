# Workflow: Legacy Link Placeholder

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Open `../SKILL.md` and choose the active workflow before using this placeholder.
- [ ] Confirm whether the migrated link `workflows/implement-component.md` still represents real guidance.

## Goal

Preserve a migrated workflow link until the owner replaces it with a real workflow or removes the stale reference.

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
