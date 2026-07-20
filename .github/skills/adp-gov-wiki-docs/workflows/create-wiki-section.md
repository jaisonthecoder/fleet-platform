# Workflow: Create A WAVE Wiki Section

## Before you start

Confirm these facts before writing files:

- [ ] Target wiki root is `Wave.wiki/`.
- [ ] Source evidence exists or the user explicitly accepts a placeholder with an open gap.
- [ ] Owner role, status, and review expectation are known.
- [ ] The new section title follows the existing WAVE Pascal/Kebab page style.
- [ ] Root or parent `.order` placement is known.
- [ ] The section is either uncontrolled wiki knowledge or a controlled artifact set.

If source evidence is missing for a factual page, stop and ask for the source instead of inventing content.

## Goal

Create a new WAVE Azure DevOps Wiki section that is discoverable, source-backed, ordered, and ready for future versioning if it becomes controlled.

## Steps

1. Read `SKILL.md` and this workflow.
2. Inspect the existing root `.order`, neighboring landing pages, and related source evidence.
3. Choose the section slug and landing page name, for example `Business-Requirements.md` and `Business-Requirements/`.
4. Create the top-level landing page with source evidence, owner role, status, reading order, and approval limits or open gaps.
5. Create the section folder and current pages.
6. Create the section `.order` in the intended reading order.
7. Add the section landing page to the root `.order` or parent `.order`.
8. If the section is controlled, switch to `manage-versioned-artifact-set.md` before finishing.
9. Run wiki-local validation: file existence, `.order` coverage, link spot-check, and Git status.

## Required shape

```text
Wave.wiki/
|-- <Section>.md
`-- <Section>/
    |-- .order
    |-- <Current-Page>.md
    `-- <Current-Page>.md
```

For controlled artifacts, add the version register and frozen snapshot shape from `manage-versioned-artifact-set.md`.

## Anti-patterns

- Creating a folder without a top-level landing page.
- Creating pages that are missing from `.order`.
- Copying a raw source artifact without summarizing source, owner, and status.
- Adding a controlled artifact set without a register.
- Creating a page title that does not match the existing WAVE naming style.

## After you finish

- List source artifacts reviewed.
- List wiki files created.
- State where the new section appears in `.order`.
- State whether the section is controlled or uncontrolled.
- State validation run and remaining approval owners.

## Definition of Done

- [ ] Landing page exists.
- [ ] Section folder and current pages exist.
- [ ] `.order` files include the new pages.
- [ ] Source evidence, owner role, and status are visible.
- [ ] Controlled sections have moved through the versioned artifact workflow.
- [ ] Wiki-local validation passes or the blocker is recorded.
