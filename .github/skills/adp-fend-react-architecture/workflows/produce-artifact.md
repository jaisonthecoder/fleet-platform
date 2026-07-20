# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- Open `../SKILL.md`.
- Confirm the requested output matches this skill's owner role and primary artifact.
- Identify the upstream evidence the artifact depends on.
- Confirm the stack-neutral Backend/Frontend Contract Matrix from `adp-arch-lld` exists before defining React API wiring, mock data, MSW handlers, or server-state boundaries.
- Primary artifact: frontend LLD section in lld.md, diagrams/lld-frontend-*.drawio

## Goal

Complete the requested frontend LLD section in lld.md, diagrams/lld-frontend-*.drawio work so `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Confirm the target artifact path and create the smallest artifact that satisfies the request.
2. Derive the React Feature Inventory and API Wiring Map from the LLD Backend/Frontend Contract Matrix. Include feature ID, FR/NFR, route/page or workflow, API operation/event, DTOs, errors, permission claim, audit event, mock/MSW fixture, contract status, and evidence required.
3. Create the UX Traceability Contract: `screen/frame -> feature ID -> FR/NFR -> API operation -> UI states -> permissions`.
4. Define route/page composition, component boundaries, TanStack Query/server-state keys, local state, forms, loading/empty/error/unauthorized states, and tests from the API Wiring Map.
5. Trace each decision to a source input, ticket, acceptance criterion, operational signal, or stakeholder note.
6. Write assumptions explicitly when evidence is missing.
7. Add an evidence section with links to source material, commands, generated files, or review notes.
8. Prepare a short handoff note naming the downstream role that should consume the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Inventing React API clients, DTOs, query keys, mock data, or screen fields that are not backed by the LLD Backend/Frontend Contract Matrix.

## After you finish

- The artifact is stored at the standard path for adp-fend-react-architecture.
- The output includes source evidence and assumptions.
- The handoff note names the next role and any open questions.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] React API Wiring Map and UX Traceability Contract consume the LLD Backend/Frontend Contract Matrix.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
