# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-change-request.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the approved baseline, requested change, source evidence, and baseline owner.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing baseline impact.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Capture the affected baseline, requested change, rationale, impact, change-control route, and decision deadline, preserving the section order and table columns in `../templates/demand-intake-change-request-template.md.tmpl`.
3. Tie every material decision to source evidence such as a baseline artifact, ticket, steering note, defect, incident, or sponsor confirmation.
4. Mark missing baseline, impact, ownership, or approval facts as blockers, assumptions, or open questions.
5. Call out downstream handoffs, risks, and the decision gate explicitly.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Treating an unapproved scope change as already accepted.
- Describing the change without naming the impacted baseline.
- Hiding schedule, cost, risk, or operational impact.
