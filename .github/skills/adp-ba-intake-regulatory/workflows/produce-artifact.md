# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-regulatory.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the obligation source, deadline, consequence, evidence expectation, and accountable owner.
- If required inputs are missing, stop and ask for the missing artifact instead of interpreting obligations without evidence.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Capture obligation source, deadline, consequence, evidence expectation, impacted data, impacted controls, owner, and risk level, preserving the section order and table columns in `../templates/demand-intake-regulatory-template.md.tmpl`.
3. Tie every material decision to source evidence such as a law, regulation, audit finding, risk record, policy, contract, or regulator note.
4. Mark missing obligation, deadline, evidence, impact, or ownership facts as blockers, assumptions, or open questions.
5. Call out downstream handoffs, risks, and the compliance decision gate explicitly.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Treating a compliance request as a generic feature idea.
- Omitting deadline, consequence, evidence expectation, or obligation owner.
- Designing controls before the obligation is traceable.
