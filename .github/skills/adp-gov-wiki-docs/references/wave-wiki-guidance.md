# WAVE Wiki Guidance

## Current WAVE Pattern

`Wave.wiki` is the curated WAVE project knowledge base. It uses Azure DevOps Wiki Markdown, `.order` files, Git history, branch publication, and controlled artifact-set versioning.

Core structure:

```text
Wave.wiki/
|-- Home.md
|-- .order
|-- Business-Intake.md
|-- Business-Requirements.md
|-- Project-Documents/
|   |-- Artifact-Register.md
|   `-- Wiki-Versioning.md
|-- Business-Intake/
|   |-- .order
|   |-- Version-Register.md
|   |-- Versions.md
|   `-- Versions/0.1/
`-- Business-Requirements/
    |-- .order
    |-- BRD.md
    |-- Version-Register.md
    |-- Versions.md
    `-- Versions/0.1/
```

## Source Of Truth Rules

| Situation | Source to trust first |
|---|---|
| Runtime behavior | Running code, database schema, configuration |
| Curated project knowledge | `Wave.wiki` |
| Wiki baseline and publication state | `Wave.wiki/Project-Documents/Wiki-Versioning.md`, Git history, and `wikiMaster` |
| Business requirements and intake | `wave-business-information/` |
| Source-grounded inspection evidence | `docs/2026-*` reports |
| Backend migration evidence | `wave-api/docs/postgresmigration/` |
| Historical discovery context | Older reference documents only when newer wiki or source-grounded docs do not conflict |

## Azure DevOps Wiki Ordering

Azure DevOps Wiki uses `.order` files. Keep these synchronized:

- Root `.order` lists top-level pages without `.md`.
- Section `.order` lists current pages in reading order.
- `Versions/.order` lists available version index pages.
- `Versions/<version>/.order` lists frozen snapshot content pages.

When adding a page, add it to the nearest `.order`. When deleting or renaming a page, remove or update the matching `.order` entry.

## Controlled Artifact Sets

Use a controlled artifact set when a group of pages represents one reviewable baseline, such as Business Intake or BRD.

Required elements:

- Top-level landing page, for example `Business-Requirements.md`.
- Current pages under the matching folder.
- Folder `.order`.
- `Version-Register.md`.
- `Versions.md`.
- `Versions/.order`.
- `Versions/<version>.md`.
- `Versions/<version>/.order`.
- Frozen copies of current content pages under `Versions/<version>/`.

The version belongs to the set. A material change to any page can require a new set version.

## Version Number Rules

| Version | Meaning |
|---|---|
| `0.x` | Draft or working version before approval |
| `1.0` | First approved baseline |
| `1.x` | Approved baseline with minor updates that do not change scope or decision intent |
| `2.0` | Major content change requiring renewed approval |

Minor typo, link, and formatting fixes usually rely on Git history only.

## Status Rules

| Status | Meaning |
|---|---|
| Draft | Work in progress; not approved for delivery decisions |
| In Review | Sent to owner or reviewer for validation |
| Approved | Accepted baseline; changes need controlled update |
| Superseded | Replaced by a newer page or version but retained for audit |

## Branch And Publication Model

| Branch | Purpose |
|---|---|
| `dev` | Drafting and review of wiki changes |
| `wikiMaster` | Published/main wiki branch |

Recommended flow:

```text
Wave.wiki/dev
  -> draft and review
  -> merge to wikiMaster
  -> record commit or tag when tied to a release or approved baseline
```

If the WAVE parent repository is present, compare the checked-out `Wave.wiki` commit with the parent pointer before claiming which baseline the parent records.

## Copy Versus Link Guidance

Copy or rewrite into wiki when the content is:

- Stable enough to be daily reference.
- Needed by developers, QA, support, or business stakeholders without opening raw source folders.
- A concise explanation of behavior, ownership, or operating process.

Link rather than copy when the content is:

- A long inspection report.
- A generated artifact.
- A pipeline output or test report.
- A large binary file.
- A working draft that may change frequently.

## Wiki-Local Validation Examples

Use the smallest set that matches the change:

```bash
find Wave.wiki -type f -name '*.md'
find Wave.wiki -type f -name '.order'
git -C Wave.wiki branch --show-current
git -C Wave.wiki status --short
git -C Wave.wiki log -1 --oneline --decorate
git submodule status Wave.wiki
```

For controlled sets, compare current content-page membership with the frozen snapshot membership. Exclude `Version-Register.md`, `Versions.md`, and historical snapshot folders unless the owner requested recursive archive validation.

## Review Checklist

- Root `.order` includes every intended top-level page.
- Each section `.order` includes every intended current page.
- Controlled artifact sets have a version register.
- `Versions.md`, `Versions/.order`, and `Versions/<version>.md` agree on available versions.
- Frozen snapshot pages match the included pages listed in the register.
- Landing pages name source evidence, owner role, status, and approval limits.
- Branch and commit evidence support any publication claim.
