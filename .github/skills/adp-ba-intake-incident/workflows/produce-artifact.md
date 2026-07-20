# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-incident.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the incident or problem source, impact, root cause status, corrective action, and validation expectation.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing operational evidence.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Capture incident source, impact, affected users or process, root cause status, corrective action, validation expectation, owner, and due date, preserving the section order and table columns in `../templates/demand-intake-incident-template.md.tmpl`.
3. Tie every material decision to source evidence such as incident records, postmortems, support tickets, telemetry, complaints, or service-level evidence.
4. Mark missing incident, impact, root-cause, corrective-action, validation, or ownership facts as blockers, assumptions, or open questions.
5. Call out downstream handoffs, risks, and the follow-up decision gate explicitly.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Treating recurring support pain as a vague feature request.
- Omitting root cause status or validation expectation.
- Mixing immediate remediation with durable corrective action.
