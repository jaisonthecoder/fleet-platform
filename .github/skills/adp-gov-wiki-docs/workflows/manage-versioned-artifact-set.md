# Workflow: Manage A Versioned Wiki Artifact Set

## Before you start

Confirm:

- [ ] The artifact set is under `Wave.wiki/<Artifact-Set>/`.
- [ ] The artifact owner role is known.
- [ ] Source evidence exists.
- [ ] Current version, target version, status, and review state are known or can be derived.
- [ ] All pages included in the set are known.
- [ ] Existing frozen snapshots should remain read-only.

## Goal

Create or update a controlled multi-page WAVE wiki artifact set with one version register, one versions index, and one frozen snapshot per material baseline.

## Steps

1. Read `SKILL.md` and this workflow.
2. Inspect the current artifact pages, parent landing page, `.order`, existing register, versions index, and snapshots.
3. Decide the version action:
   - New controlled set: create starting version, usually `0.1` for draft.
   - Minor edit: update current pages and rely on Git history.
   - Material change: bump the set version and create a new frozen snapshot.
   - Restore: restore the whole set from one snapshot or one Git commit and explain the rationale.
4. Update current pages and current `.order`.
5. Update `Version-Register.md` with artifact set ID, current version, status, owner, included pages, history, and snapshot table.
6. Update `Versions.md` and `Versions/.order`.
7. For a material baseline, create `Versions/<version>.md`, `Versions/<version>/.order`, and frozen copies of all current content pages under `Versions/<version>/`.
8. Compare the frozen snapshot membership with the current set membership.
9. Run wiki-local validation: register links, `.order` coverage, snapshot file presence, and Git status.

## Required shape

```text
Wave.wiki/
|-- <Artifact-Set>.md
`-- <Artifact-Set>/
    |-- .order
    |-- <Current-Page>.md
    |-- Version-Register.md
    |-- Versions.md
    `-- Versions/
        |-- .order
        |-- <version>.md
        `-- <version>/
            |-- .order
            `-- <Current-Page>.md
```

## Snapshot membership rule

The snapshot folder contains the content pages that make up the baseline. It does not need to include `Version-Register.md`, `Versions.md`, or historical snapshot folders unless the owner explicitly asks for a fully recursive archive.

## Anti-patterns

- Bumping one page without bumping the artifact set.
- Creating a new snapshot but leaving `Version-Register.md` at the old current version.
- Copying only changed pages into the snapshot.
- Deleting old snapshots during normal updates.
- Restoring one page from an old snapshot without recording a mixed-version exception.

## After you finish

- State artifact set ID, previous version, current version, and status.
- List included pages.
- List snapshot paths created or intentionally unchanged.
- State source artifacts reviewed and owner role.
- State validation run and unresolved approval needs.

## Definition of Done

- [ ] Current artifact pages and `.order` are coherent.
- [ ] Version register is accurate.
- [ ] Versions index and version `.order` are accurate.
- [ ] Frozen snapshot exists for any new material baseline.
- [ ] Snapshot membership matches current page membership for the version.
- [ ] Restore or mixed-version exceptions are explicitly recorded.
