---
name: adp-gov-wiki-docs
description: "Use when creating, updating, versioning, reviewing, or publishing WAVE Azure DevOps Wiki pages, `.order` files, controlled artifact sets, version registers, frozen snapshots, or the wikiMaster publication baseline. Trigger on Wave.wiki, wiki version, .order file, version register, frozen snapshot, wikiMaster, or wiki baseline. Do not use to author BRD, PRD, HLD, or LLD source content — route those to the owning skill first."
---

# adp-gov-wiki-docs

## Metadata

- **kind:** skill
- **version:** 0.1.1
- **stability:** alpha
- **role:** ai-governance-lead
- **tiers:** advanced: should-have · enterprise: baseline
- **why_critical:** WAVE uses its Azure DevOps Wiki as the curated project knowledge base. Wiki changes must stay traceable, ordered, versioned, and publishable without creating parallel documentation copies.
- **default_prompt:** Use the adp-gov-wiki-docs skill. Open SKILL.md, choose the matching workflow, and complete the Wave.wiki change with evidence.
- **short_description:** WAVE Azure DevOps Wiki governance

**Owner role:** AI Governance Lead (`ai-governance-lead`)
**Primary artifact:** `Wave.wiki/`

## Why critical

WAVE readers use the wiki to understand business scope, architecture, operations, and release state. A wiki page that loses source evidence, ordering, or version context creates delivery drift. This skill keeps `Wave.wiki` readable, auditable, and aligned to the WAVE documentation model.

## Purpose

Create, update, review, and publish WAVE wiki pages and versioned artifact sets inside `Wave.wiki`. Preserve Azure DevOps Wiki navigation, controlled document metadata, source traceability, version registers, frozen snapshots, and branch publication evidence.

This skill governs the wiki layer. It does not replace the owning artifact skills for BRD, PRD, architecture, QA, security, release, or operational content. Use those skills to author the source artifact first, then use this skill to publish or curate the approved knowledge into `Wave.wiki`.

## Abu Dhabi Ports Group context

Apply this skill as AI Governance Lead delivery guidance for AD Ports work on the WAVE initiative management platform. `Wave.wiki` is the curated knowledge base for business intake, business requirements, current-state specification, domain rules, engineering guidance, operations, and project document control.

Use the current WAVE wiki pattern:

- `Wave.wiki/.order` controls top-level Azure DevOps Wiki order.
- Each multi-page section has a landing page, folder, and folder `.order`.
- Controlled multi-page artifacts use one set ID, one current version, one `Version-Register.md`, and one frozen snapshot per material baseline.
- Draft work happens on `dev`; published wiki baselines live on `wikiMaster`.
- Git history is the detailed record; frozen snapshots are business-readable baselines.

Keep outputs traceable to source evidence, tenant-aware, UAE-regulatory aware (NESA/PDPL), operationally resilient, and ready for audit handoff.

## Mental model

- **Protects:** wiki traceability and publication state.
- **Optimizes for:** clear navigation, stable baselines, and source-backed summaries.
- **Refuses to leave ambiguous:** source evidence, owner role, artifact set membership, current version, and restore path.
- **Primary artifact focus:** `Wave.wiki/`.
- **Default stance:** update the smallest wiki surface that keeps the section coherent.

## Hard rules

1. **Stay inside the WAVE wiki scope.** Create and update wiki content under `Wave.wiki/`. Record parent repository or submodule evidence only when it affects the wiki baseline.
2. **Keep source evidence visible.** Every curated page or artifact set must name the source path, owner role, status, and unresolved gaps when those facts exist.
3. **Version artifact sets as sets.** A multi-page controlled artifact has one ID, one current version, one register, and one frozen snapshot for each material baseline.
4. **Treat frozen snapshots as read-only evidence.** Update current pages for new work. Change a frozen snapshot only for an explicit approved correction note.
5. **Keep `.order` files synchronized.** When pages are added, removed, renamed, or re-ordered, update the matching `.order` file in the same change.
6. **Use portable Azure DevOps Wiki Markdown.** Use standard Markdown links, tables, images, and fenced Mermaid blocks. Avoid platform-only components or syntax.
7. **Summarize stable knowledge; link raw evidence.** Promote durable facts into wiki pages. Link long reports, generated outputs, test evidence, and working drafts rather than pasting them wholesale.
8. **Protect sensitive data.** Do not store secrets, credentials, production data extracts, private tokens, or database backups in the wiki.
9. **Validate with wiki-local evidence.** Check file presence, `.order` coverage, version register consistency, snapshot shape, branch, and Git status. Record any validation that could not be run.

## Pitfalls

- **Loose pages:** A controlled artifact is copied into wiki pages without a register or snapshot.
- **Mixed baseline:** One page is restored from an old version while the rest of the set remains current.
- **Invisible page:** A Markdown page exists but is missing from the relevant `.order` file.
- **Source drift:** The wiki states a business, architecture, or operational fact without naming source evidence.
- **Raw dump:** A long inspection report is pasted into the wiki instead of being summarized and linked.
- **Publication confusion:** A change is made on a draft branch but described as published without branch or commit evidence.

## Evidence expectations

- **Minimum evidence:** wiki files changed, source artifacts reviewed, owner role, current version or no-version rationale, `.order` files checked, and Git branch/status evidence.
- **When a controlled set changes materially:** include old version, new version, snapshot path, included pages, and register update.
- **When a minor edit is made:** explain why Git history is enough and why no new snapshot was created.
- **When publishing:** include source branch, target branch, commit or tag, and parent pointer status when the parent repository is present.
- **When risks remain:** record owner, impact, and whether the wiki can still be treated as current.
- **When using adp-gov-wiki-docs:** finish with the wiki files changed and the evidence a reviewer should inspect first.

## Decision checkpoints

- **Before creating a wiki section:** confirm the source evidence exists and choose a stable Pascal/Kebab wiki title.
- **Before editing a controlled artifact set:** decide whether the change is minor, material, or a restore.
- **Before adding a snapshot:** confirm the baseline is reviewable enough to be browsed directly by business or delivery stakeholders.
- **Before deleting or renaming pages:** check inbound links, `.order` entries, register membership, and snapshot history.
- **Before claiming publication:** confirm `wikiMaster`, commit/tag evidence, or explicitly state that the change is still draft.

## Escalation triggers

- **Business scope uncertainty:** route source content to `ai-business-analyst` or `ai-product-manager` before freezing the wiki baseline.
- **Architecture or NFR uncertainty:** route to `ai-solution-architect` before publishing architecture pages.
- **Security, privacy, or retention uncertainty:** route to `ai-security-engineer` before publishing claims or evidence.
- **Release baseline uncertainty:** route to `ai-delivery-planner` or `ai-platform-engineer` before recording release snapshots.
- **Ownership uncertainty:** keep the page in Draft and assign the next owner rather than publishing an orphaned claim.

## Review lens

- A reviewer should be able to see which source artifact supports each curated section.
- A reviewer should be able to follow the navigation from the root `.order` to every current page.
- A reviewer should be able to identify the current version and frozen baseline of each controlled set.
- A reviewer should be able to restore a full artifact set from a snapshot or a Git commit.
- A reviewer should be able to tell whether a change is draft, published, approved, or superseded.

## When to use

Trigger this skill when:

- A user asks to create, update, review, or reorganize `Wave.wiki`.
- A WAVE wiki section needs `.order` maintenance.
- A Business Intake, BRD, PRD, HLD, QA, security, operations, or release artifact needs to be published as wiki pages.
- A version register, frozen snapshot, wiki baseline, restore, or `wikiMaster` publication state is involved.
- The user asks for a WAVE wiki deep inspection, health check, or versioning review.

Do not use this skill to author the source business, product, architecture, security, QA, or release artifact. Route source authorship to the owning skill first.

## Inputs

- Target wiki root: `Wave.wiki/`.
- Source artifact paths or existing wiki pages.
- Artifact owner role, status, version, review date, and approval state when controlled.
- Existing `.order`, `Version-Register.md`, `Versions.md`, and snapshot folders.
- Git branch, commit, tag, or parent pointer evidence when publication state matters.

## Outputs

- Current wiki pages under `Wave.wiki/`.
- Top-level or section `.order` files.
- Controlled document metadata blocks when applicable.
- `Version-Register.md`, `Versions.md`, `Versions/<version>.md`, and frozen snapshot folders for controlled sets.
- Review or publication evidence summarizing branch, commit, version, source artifacts, and remaining risks.

## Naming conventions

- Skill ID: `adp-gov-wiki-docs`.
- Wiki section folder: Pascal/Kebab title, for example `Business-Requirements/`.
- Landing page: matching top-level Markdown page, for example `Business-Requirements.md`.
- Version register: `Version-Register.md`.
- Versions index: `Versions.md`.
- Frozen version path: `<Artifact-Set>/Versions/<version>/`.
- Page links: prefer wiki-root absolute links such as `/Business-Requirements/BRD` when matching existing WAVE style.

## Artifact path routing

This skill is an explicit exception to `/standards/artifact-path-routing.md`. Its primary artifact is `Wave.wiki/` (the WAVE Azure DevOps Wiki repository or submodule), not `docs/`.

- Write curated wiki output under `Wave.wiki/` only.
- Do not mirror wiki pages under `docs/00-governance/`, `docs/01-discovery/`, or other numbered SDLC folders in the parent repository; link to the wiki page instead.
- Do not create wiki content inside skill or catalog folders such as `.agents/skills/`, `.claude/skills/`, or `catalog/source/skills/`.
- If the user requests wiki-shaped output outside `Wave.wiki/`, record it as an explicit path exception and confirm before writing.

## Workflows

Load only the workflow file that matches the current request:

- `workflows/create-wiki-section.md` — create a new WAVE wiki section or current-page set.
- `workflows/update-wiki-section.md` — update existing WAVE wiki pages and navigation.
- `workflows/manage-versioned-artifact-set.md` — create or update version registers and frozen snapshots.
- `workflows/publish-wiki-baseline.md` — inspect or record `dev` to `wikiMaster` publication evidence.
- `workflows/review-wiki-health.md` — inspect wiki structure, ordering, versioning, and risks.

## Templates

Use these bundled templates when producing controlled wiki pages:

- `templates/artifact-index.md.tmpl` — top-level artifact set landing page.
- `templates/version-register.md.tmpl` — controlled artifact set version register.

## References

Load only when the request needs detailed WAVE wiki guidance:

- `references/wave-wiki-guidance.md` — current structure, versioning model, `.order` rules, restore rules, and validation examples.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/definition-of-done.md`
- `/standards/adr.md`
- `/standards/catalog-publishing.md`
- `/standards/artifact-path-routing.md` (this skill's `Wave.wiki/` exception is recorded above)

## Autonomous SDLC contract

- **SDLC stage:** Governance / Documentation control
- **Ordered by:** artifact owner role, `ai-governance-lead`, or delivery owner
- **Required inputs:** source evidence, owner role, target wiki section, change type
- **Generated artifact:** `Wave.wiki/` pages and wiki control metadata
- **Next roles:** source artifact owner, `ai-governance-lead`, release owner when publication state changes
- **Human gate:** artifact owner confirms baseline before Approved or Superseded status

## Handoff

- **Upstream:** Confirm source artifacts, owner role, status, and whether the change is draft, material, or publication-related.
- **Downstream:** Source artifact owner for content approval; `ai-governance-lead` for wiki/versioning approval; release owner when a wiki baseline is tied to a release.
- **Evidence:** Summarize changed wiki files, source evidence, version decision, `.order` updates, branch/commit state, validation result, and residual risks.

## Ownership

- **Primary owner:** `ai-governance-lead` (AI Governance Lead)
- **Supporting roles:** source artifact owner, `ai-context-engineer`, `ai-delivery-planner`
- **Review cadence:** Quarterly, plus after WAVE wiki structure, branch model, or controlled document rules change.
- **Last reviewed:** 2026-07-01

## Quality bar

- Source evidence named.
- Navigation works through `.order` files.
- Controlled artifacts have register and snapshot policy applied.
- Draft versus published state is explicit.
- No unrelated repository surfaces are changed by default.
- Evidence is attached, not claimed.

## Tier guidance

Per the AI Role Skills Tier Application Guide:

- Tier 1: include this skill only if its should-have trigger fires (a Wave.wiki change is in scope).
- Tier 2: include when publishing controlled artifacts, versioning, or `.order` maintenance is required.
- Tier 3: included by default (baseline) — WAVE wiki is the curated knowledge base for enterprise-tier delivery.

If unsure, default to producing the wiki change at the depth required by the baseline being touched (uncontrolled page vs. controlled artifact set vs. published baseline).
