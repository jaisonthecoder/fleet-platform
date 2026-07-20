# Update Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- Open `../SKILL.md`.
- Locate the current artifact and any previous decision record, review note, or approval trail.
- Confirm the change request, defect, scope update, or feedback item that justifies the update.
- Primary artifact: frontend React source, frontend tests

## Goal

Complete the requested frontend React source, frontend tests work so `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Identify what must be preserved from the existing artifact: approved decisions, constraints, owners, and evidence.
2. Make the smallest update that satisfies the change request.
3. Record each material change as added, changed, removed, or deferred.
4. Refresh evidence links, assumptions, risks, and downstream handoff notes.
5. Call out any breaking change, approval impact, or downstream role that must re-review the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.

## After you finish

- The artifact remains traceable to its prior version and source evidence.
- The change list explains what changed and why.
- Any required re-review or follow-up owner is named.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
