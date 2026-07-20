# Update Functional Requirements

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md`.
- Open `../SKILL.md`.
- Read the existing functional requirements artifact and the new source evidence.
- Confirm whether changes add, modify, deprecate, or split FRs.

## Goal

Update functional requirements without breaking traceability, stable IDs, or downstream review context.

## Steps

1. Preserve existing FR IDs; add new IDs only for new behavior.
2. Mark changed, deprecated, or superseded FRs explicitly instead of deleting context silently.
3. Convert Section 2 scope to the scope table when it still uses bullets; assign stable `SCOPE-IN-*` and `SCOPE-OUT-*` reference IDs and link each row to source trace and related FRs or rules.
4. Add or refresh the Delivery Readiness Gate with backlog/ticket, sponsor/owner, security/legal policy, test owner, and ready-for-delivery status.
5. Update user story context, acceptance criteria, exceptions, outputs/state changes, traceability, readiness status, blocking dependencies, policy/legal dependency, data source dependency, backlog/story link, test readiness, sequence diagrams, and evidence placeholders for changed FRs. Render traceability IDs and output references as Markdown links to same-document anchors or relative artifact paths; if a link target is unknown, keep the ID visible and record the missing target as an evidence gap.
   - Merge the linked user story statement, objective, user/business value, primary scenario, story-derived constraints, and relevant story acceptance criteria into the changed FR package description.
   - If the linked story changed, refresh the FR Behavior Detail and Acceptance Criteria so the FR remains the authoritative behavior contract.
   - If no linked story exists, record the missing story as an evidence gap, blocker, or open question instead of leaving feature context blank.
6. Ensure every changed FR has a package folder at `docs/02-product/FR/fr-<nnn>/` with `fr-<nnn>-description.md`, `fr-<nnn>-test-cases.md` from `templates/fr-test-cases-template.md.tmpl`, `sequence.mmd` from `templates/fr-sequence-template.mmd.tmpl`, `sequence.drawio` when required, and `fr-<nnn>-lld.md`. If an older flat FR section, inline test-case matrix, or flat `fr-<nnn>-sequence.drawio` exists, preserve history through links or change log notes while moving the current authoritative content into the package folder.
7. Refresh report/export definition and sensitive-data handling tables in changed FR package description files when the behavior includes reports, exports, regulated data, personal data, or privacy/security-heavy handling; otherwise explicitly record `Not applicable` with rationale.
8. Add or refresh the sequence diagram block for every changed FR package description file. Use `sequence.mmd` as MermaidJS `sequenceDiagram` source and create or update `docs/02-product/FR/fr-<nnn>/sequence.drawio` from `templates/fr-sequence-drawio-template.drawio.tmpl` when the behavior is multi-actor/system, integration-heavy, audit/security-relevant, report/export/handoff-oriented, or has material exception paths. Prefer rendering the Mermaid source to SVG and embedding it in the template's `mermaid-render` image cell. If rendering is unavailable, create an editable native Draw.io sequence diagram with participant headers, dashed lifelines, ordered message arrows, return arrows, `alt`/`opt` branch boxes, branch separators, audit interactions, outputs, and exception paths. The final Draw.io file must match `sequence.mmd` and must not contain note-box-only summaries, prose-only SVGs, cramped hand-built layouts, generic actors, or unresolved `{{...}}` placeholders. Otherwise explicitly record `Not required - single-step behavior`.
   - Sanitize Mermaid sequence text before finalizing: do not use semicolons in message text, raw pipes, HTML-like angle brackets, or unmatched brackets/quotes. Use ` - ` or `,` instead of `;`, and quote participant labels that contain punctuation, slashes, parentheses, or leading punctuation.
9. Add or refresh each changed FR package `fr-<nnn>-test-cases.md` with draft test cases mapped to current acceptance criteria, test data needs, automation suitability, owner, QA handoff, and Playwright artifact handoff paths for UI-capable cases.
10. Add or refresh each changed FR package `fr-<nnn>-lld.md` with status, trace links, backend/frontend contract notes when applicable, data/integration/security considerations, open architecture questions, and `ai-solution-architect` / `adp-arch-lld` review owner.
11. Do not mark any changed FR `Ready for delivery` or `Approved` when its only story/backlog trace is an `FR-Q-*` blocker, open question, or `TBD`, or when policy/legal, data source, architecture review, or test readiness is unresolved.
12. Record the change reason and source evidence for every updated FR.
13. Recheck FR/NFR/UX/architecture/implementation boundaries.
14. Summarize downstream impact by role.

## Anti-patterns

- Renumbering FRs after inserting a new requirement.
- Updating behavior without updating acceptance criteria or test traceability.
- Updating only the backlog/story link while leaving the FR package without the story statement, objective, user value, scenario context, and story-derived acceptance focus.
- Deleting old behavior without a deprecation note or source decision.
- Letting a defect fix become unapproved scope expansion.
- Marking an FR delivery-ready while its backlog/story, policy/legal, data source, or test target is still unresolved.
- Updating only the index while the FR package description, test cases, sequence files, or LLD becomes stale.

## After you finish

- [ ] Changed FR IDs and reasons are listed.
- [ ] Changed FRs have current package folders at `docs/02-product/FR/fr-<nnn>/`.
- [ ] Changed FR package description, test cases, `sequence.mmd`, `sequence.drawio` when required, and LLD files are current.
- [ ] The Delivery Readiness Gate reflects current backlog/ticket, sponsor/owner, security/legal policy, test owner, and ready-for-delivery status.
- [ ] In-scope and out-of-scope boundaries use the scope table with stable reference IDs.
- [ ] Traceability, outputs, and acceptance criteria remain current, with clickable links for source, FR package description, AC anchors, business-rule, backlog, output, report/export, notification, audit, draft test case, sequence, Draw.io, LLD, evidence, or validation targets when targets exist.
- [ ] Changed FR package descriptions include current User Story Context from the linked story/backlog evidence, or an explicit evidence gap/blocker when no story exists.
- [ ] Changed FRs include readiness status, blocking dependencies, policy/legal dependency, data source dependency, backlog/story link, test readiness, and `Cannot proceed until`.
- [ ] Report/export and sensitive-data tables are current when applicable, or explicitly marked `Not applicable` with rationale.
- [ ] No changed FR is `Ready for delivery` or `Approved` while its story/backlog, policy/legal, data source, or test readiness still depends on `FR-Q-*`, an open question, or `TBD`.
- [ ] Every changed FR package has a current sequence diagram block, either embedded or linked Mermaid plus a Draw.io companion file or `Not required - single-step behavior`.
- [ ] Every changed Mermaid sequence uses parser-safe text and avoids semicolons in message text.
- [ ] Every changed Draw.io companion either embeds its FR package's rendered Mermaid SVG in the `mermaid-render` image cell or uses editable native Draw.io sequence shapes with lifelines, messages, returns, branches, audit interactions, and outputs that match `sequence.mmd`.
- [ ] Every changed FR package has an updated `fr-<nnn>-lld.md` with architecture status and owner.
- [ ] Every changed FR package has an updated `fr-<nnn>-test-cases.md` with draft test cases mapped to acceptance criteria.
- [ ] Every UI-capable changed test case includes Playwright artifact paths under `output/playwright/fr-<nnn>/` without embedding Playwright CLI command flows by default.
- [ ] Deprecated or superseded requirements are explicit.
- [ ] Downstream roles and review needs are named.
- [ ] Run `git status` and confirm only intended files changed.

## Definition of Done

- [ ] The artifact reflects the new evidence.
- [ ] Stable IDs, linked outputs, and linked traceability are preserved.
- [ ] Reviewers can see what changed and why.
- [ ] Updated Mermaid diagrams parse cleanly in MermaidJS.
- [ ] Updated FR package LLD files are ready for `adp-arch-lld` review or explicitly approved by architecture.
- [ ] Updated FR package test case files are ready for `ai-quality-engineer` review.
