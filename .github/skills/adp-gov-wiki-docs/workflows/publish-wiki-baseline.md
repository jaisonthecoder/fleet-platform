# Workflow: Publish Or Inspect A WAVE Wiki Baseline

## Before you start

Confirm:

- [ ] The target repository is `Wave.wiki`.
- [ ] The publication state being inspected or updated is branch, commit, tag, or parent pointer evidence.
- [ ] The user has asked for publish evidence or baseline handling, not only page editing.
- [ ] The current working tree state is understood.

## Goal

Inspect or record the WAVE wiki publication baseline so readers can distinguish draft changes from the published `wikiMaster` state.

## Steps

1. Read `SKILL.md` and this workflow.
2. Inspect `Wave.wiki` branch, status, remotes, latest commit, and tags relevant to the request.
3. If the parent repository is present, inspect the recorded `Wave.wiki` submodule pointer and compare it with the checked-out wiki commit.
4. Confirm whether the content is draft, published on `wikiMaster`, tagged, or only checked out locally.
5. For a release or approved baseline, record the wiki commit or tag in the appropriate wiki release or version register page when requested.
6. Do not merge branches, tag, or change parent pointers unless the user explicitly asks for that operation.
7. Run wiki-local validation: branch/status evidence, commit comparison, and target page review.

## Evidence commands

Use the local equivalent of:

```bash
git -C Wave.wiki branch --show-current
git -C Wave.wiki status --short
git -C Wave.wiki log -1 --oneline --decorate
git submodule status Wave.wiki
git ls-tree HEAD Wave.wiki
```

Use only the commands relevant to the workspace state and the user's request.

## Anti-patterns

- Describing draft branch work as published.
- Updating release pages without a commit or tag.
- Moving a parent pointer silently.
- Treating a local checkout mismatch as an error without checking whether it is intentional.
- Publishing a controlled baseline before the owner approves the artifact status.

## After you finish

- State the branch, commit, tag, and parent pointer state if available.
- State whether the wiki baseline is draft, published, or mismatched.
- List any wiki files updated with baseline evidence.
- State remaining owner approval or merge actions.

## Definition of Done

- [ ] Branch and commit evidence are recorded.
- [ ] Parent pointer state is checked when the parent repository is present.
- [ ] Release or version pages include baseline evidence when requested.
- [ ] No branch, tag, or pointer mutation happened without explicit user request.
- [ ] Remaining publication actions are clear.
