# Workflow: Update A WAVE Wiki Section

## Before you start

Confirm:

- [ ] The target files are under `Wave.wiki/`.
- [ ] The change source and owner are known.
- [ ] The target section is uncontrolled, controlled, or part of a versioned artifact set.
- [ ] Existing snapshots are not being edited as current pages.
- [ ] The page change does not silently change approved scope, requirements, architecture, controls, release state, or operations.

## Goal

Update current WAVE wiki pages while preserving source evidence, navigation, and version traceability.

## Steps

1. Read `SKILL.md` and this workflow.
2. Inspect the target page, parent landing page, parent `.order`, and source evidence.
3. If the target belongs to a controlled set, inspect `Version-Register.md` and decide whether the update is minor, material, or a restore.
4. Update current pages only.
5. Update `.order` when pages are added, removed, renamed, or reordered.
6. Keep source evidence and owner role visible when the factual claim changes.
7. For material controlled changes, switch to `manage-versioned-artifact-set.md` and create the new baseline.
8. Run wiki-local validation: changed file review, `.order` coverage, link spot-check, register consistency when applicable, and Git status.

## Version decision

| Change type | Action |
|---|---|
| Typo, broken link, formatting | Update current page; rely on Git history. |
| Missing evidence link in a draft controlled page | Update current page; bump draft version if it changes review meaning. |
| Scope, decision, requirement, risk, approval, or handoff change | Bump set version and create a new frozen snapshot. |
| Restore from an old baseline | Restore the full set and document rationale in the register. |

## Anti-patterns

- Editing `Versions/<version>/` as if it were the current page.
- Updating a current controlled page and forgetting the register.
- Adding a page without `.order` coverage.
- Rewording a source claim without checking source evidence.
- Treating a material baseline change as a minor cleanup.

## After you finish

- State whether the change was minor, material, or restore.
- List changed current pages and `.order` files.
- Name the source evidence and owner role.
- State whether a version register or snapshot changed.
- Include validation evidence and remaining approval needs.

## Definition of Done

- [ ] Current pages reflect the requested change.
- [ ] Navigation remains coherent.
- [ ] Source evidence is still visible.
- [ ] Controlled artifact register and snapshot policy are followed.
- [ ] Frozen snapshots are untouched unless an approved correction was requested.
- [ ] Wiki-local validation passes or the blocker is recorded.
