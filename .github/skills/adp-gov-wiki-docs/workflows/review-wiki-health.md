# Workflow: Review WAVE Wiki Health

## Before you start

Confirm:

- [ ] The review scope is `Wave.wiki/` or a named section under it.
- [ ] The user wants inspection, findings, or recommendations rather than content authorship.
- [ ] Any specific concern is known: versioning, `.order`, source evidence, snapshots, publication state, or stale content.

## Goal

Inspect WAVE wiki structure and governance health, then report concrete findings with file paths, impact, and recommended fixes.

## Steps

1. Read `SKILL.md` and this workflow.
2. Inventory target Markdown files, `.order` files, version registers, versions indexes, and snapshot folders.
3. Check `.order` coverage for current pages in the review scope.
4. Check controlled artifact sets for register, current version, included pages, history, versions index, and snapshot membership.
5. Check source evidence and owner/status visibility on landing pages and controlled pages.
6. Check branch, working tree, and parent pointer state when publication state is in scope.
7. Report findings by severity: broken navigation/versioning first, then traceability gaps, then hygiene improvements.

## Suggested checks

Use local shell, file search, or editor tools to answer:

- Which Markdown pages are missing from `.order`?
- Which `.order` entries point to missing pages?
- Which controlled sections have `Version-Register.md`?
- Do `Versions.md` and `Versions/.order` list the same available versions?
- Does each `Versions/<version>/` folder include the intended frozen pages?
- Are current page source evidence, owner, status, and review state visible?
- Is the checked-out wiki commit the same as the parent pointer when relevant?

## Anti-patterns

- Reporting style preferences before broken navigation or versioning defects.
- Treating every uncontrolled page as missing a document version.
- Recommending a snapshot for minor typo or link fixes.
- Reviewing source artifact correctness without routing to the owning skill.
- Producing a broad report without file-level evidence.

## After you finish

- List findings first, ordered by severity.
- Include file paths and observed evidence.
- Separate confirmed issues from recommendations.
- State validation commands or checks run.
- State residual risk and next owner.

## Definition of Done

- [ ] Scope is explicit.
- [ ] `.order` health is checked.
- [ ] Versioned artifact sets are checked when in scope.
- [ ] Publication state is checked when in scope.
- [ ] Findings include impact and recommended owner.
- [ ] No unrelated source artifact content is rewritten during review.
