# Workflow: Write a PRD

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

Confirm you have what you need before doing the work. If any item is missing, pause and ask; do not fabricate.

- [ ] The approved `docs/01-discovery/brd.md` is available and stable, unless a capability-specific BRD path is recorded through `/standards/artifact-path-routing.md`.
- [ ] Sponsor, target users, success metrics, business constraints, and operational constraints are known or explicitly marked as open questions.
- [ ] You know who consumes the output: `ai-solution-architect`, `ai-ux-ui-designer`, `ai-quality-engineer`, `ai-delivery-planner`.
- [ ] The PRD target path is decided, normally `docs/02-product/PRD/prd.md`.
- [ ] The user story folder is decided, normally `docs/02-product/PRD/user-stories/`.
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If the BRD is not approved, stop and write a waiting-on-BRD-approval note.

## Goal

Take the BRD as input and produce a stack-neutral PRD with problem, goals and non-goals, target users, user story index, dependencies, and assumptions. The PRD must not contain user stories only as a large embedded section. Create one dedicated user story file per story and link those files from the PRD.

## Output shape

```text
docs/02-product/PRD/prd.md
docs/02-product/PRD/user-stories/
  US-001-short-name.md
  US-002-short-name.md
```

## Steps

### 1. Confirm BRD traceability

Read the BRD. List the BR IDs that are in scope. If a BR row, success metric, sponsor, or constraint is `TBD`, decide whether it blocks PRD work or can be carried as an assumption. Record blockers and assumptions in the PRD.

### 2. Generate `docs/02-product/PRD/prd.md`

Use `../templates/prd-template.md.tmpl`. Fill the PRD with:

- Problem statement linked to BRD evidence
- Goals and measurable targets
- Explicit non-goals
- Target users and personas
- User story index with one row per story and a link to the dedicated story file
- Dependencies
- Assumptions
- Constraints
- Open questions
- Cross-cutting NFR summary
- AD Ports checks
- Handoff and approvals

Keep the PRD stack-neutral. Do not create UI designs in the PRD.

### 3. Create one story file per user story

For every user story implied by the BRD, create a file under `docs/02-product/PRD/user-stories/`, for example:

```text
docs/02-product/PRD/user-stories/US-001-search-vessel-visit.md
```

Use `../templates/feature-template.md.tmpl` as the story-file template. Each file must include:

- Story ID, title, owner, priority, and BR mapping
- Scope type: backend/API, UI, full-stack, or non-API/non-UI
- "As a / I want / So that" statement
- Acceptance criteria
- User story scope verification
- Backend/API validation examples using runnable `curl` commands where backend/API behavior is expected
- UI validation examples using a Playwright test outline where UI behavior is expected
- Implementation validation checklist
- Test evidence table with status and evidence/link placeholders

Choose validation according to the story scope. Backend/API stories need `curl`; UI stories need Playwright; full-stack stories need both; non-API/non-UI stories need an alternate evidence path. If backend/API validation or UI validation does not apply, state "not applicable" with a clear rationale in the story file.

### 4. Populate the PRD story index

The PRD should summarize stories and link to the dedicated files. Do not duplicate full story detail in the PRD.

For each story row include:

- Story ID
- Title
- Priority
- BR mapping
- Owner
- Story file link
- Status

### 5. Splitting and merging rules

- Break epics into stories that can be completed in <= 5 days.
- Split stories with too many acceptance criteria or mixed personas.
- Merge stories only when persona, trigger, value, and acceptance criteria are materially the same.
- Do not split by technical layer. A backend-only or frontend-only item is not a user story unless it independently delivers user value.

### 6. Cross-check against the BRD

Every in-scope BR must map to at least one user story. Every user story must map to one or more BRs. Mismatches are defects unless explicitly accepted and recorded in the PRD deviation log.

### 7. Review with stakeholders

- BA confirms BR-to-story traceability.
- Architect confirms dependencies and NFR achievability.
- UX confirms personas and flows are usable inputs for UX work.
- QA confirms acceptance criteria and validation examples are testable.
- Sponsor signs off on goals, non-goals, and release scope.

## Anti-patterns

- Embedding all user stories in the PRD without dedicated story files.
- Creating UI designs in the PRD instead of routing to UX.
- Writing acceptance criteria as "should work correctly."
- Omitting non-goals.
- Creating stories that do not trace to a BR.
- Turning out-of-scope manual processes into application features; use reporting or handoff evidence if visibility is needed.

## After you finish

- [ ] `docs/02-product/PRD/prd.md` exists and links every dedicated story file.
- [ ] Every story file exists under `docs/02-product/PRD/user-stories/`.
- [ ] Every story maps to one or more BRs.
- [ ] Every story has a scope type and matching user story scope verification: backend/API `curl`, UI Playwright, both, or alternate evidence with explicit not-applicable rationale.
- [ ] Non-goals are explicit in the PRD.
- [ ] Downstream roles are notified: `ai-solution-architect`, `ai-ux-ui-designer`, `ai-quality-engineer`, `ai-delivery-planner`.
- [ ] Run `git status` and confirm only intended files changed.

## Definition of Done

- [ ] Every user story maps to one or more BRs.
- [ ] Every story has its own file.
- [ ] Every story file includes acceptance criteria plus scope-appropriate story verification: backend/API `curl`, UI Playwright, both, or alternate evidence.
- [ ] Story files include implementation validation checklist and test evidence table placeholders.
- [ ] The PRD summarizes or indexes stories and links to each story file.
- [ ] Non-goals are explicit in the PRD.
