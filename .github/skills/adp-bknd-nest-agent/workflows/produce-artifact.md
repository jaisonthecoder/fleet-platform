# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
- Open `../SKILL.md`.
- Confirm the requested output matches this skill's owner role and primary artifact.
- Identify the upstream evidence the artifact depends on.
- Primary artifact: backend Nest source, backend tests

## Goal

Complete the requested backend Nest source, backend tests work so `ai-quality-engineer`, `ai-reviewer`, `ai-sre` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Confirm the target artifact path and create the smallest artifact that satisfies the request.
2. Trace each decision to a source input, ticket, acceptance criterion, operational signal, or stakeholder note.
3. Write assumptions explicitly when evidence is missing.
4. Add an evidence section with links to source material, commands, generated files, or review notes.
5. Prepare a short handoff note naming the downstream role that should consume the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.

## After you finish

- The artifact is stored at the standard path for adp-bknd-nest-agent.
- The output includes source evidence and assumptions.
- The handoff note names the next role and any open questions.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
