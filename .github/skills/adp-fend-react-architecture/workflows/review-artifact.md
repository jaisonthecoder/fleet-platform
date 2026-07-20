# Review Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- Open `../SKILL.md`.
- Locate the artifact, source inputs, and acceptance criteria being reviewed.
- Confirm whether the review is for completeness, correctness, risk, or release readiness.
- Locate the LLD Backend/Frontend Contract Matrix and compare it to the React API Wiring Map, mock data, and screen/workflow fields.
- Primary artifact: frontend LLD section in lld.md, diagrams/lld-frontend-*.drawio

## Goal

Complete the requested frontend LLD section in lld.md, diagrams/lld-frontend-*.drawio work so `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Check that the artifact matches this skill's owner role, purpose, quality bar, and standard path.
2. Verify traceability from claims and decisions back to source evidence.
3. Verify every React route/page/workflow, API client, query key, DTO, error state, permission, audit event, and MSW/mock fixture traces to the LLD Backend/Frontend Contract Matrix.
4. Identify gaps, contradictions, missing assumptions, weak evidence, and downstream risks.
5. Classify each finding as blocking, should-fix, or advisory.
6. End with an accept or rework decision and name the owner for each required fix.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Accepting frontend API wiring that diverges from the LLD Backend/Frontend Contract Matrix.

## After you finish

- Findings are specific, actionable, and tied to evidence.
- The review decision is explicit: accepted, accepted with follow-ups, or rework required.
- Open questions and downstream risks are assigned to owners.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] React API Wiring Map and UX Traceability Contract match the LLD Backend/Frontend Contract Matrix.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
