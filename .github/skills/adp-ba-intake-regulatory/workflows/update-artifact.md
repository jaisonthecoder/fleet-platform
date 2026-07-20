# Update Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-regulatory.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the existing artifact plus the changed obligation, deadline, evidence expectation, impact, or owner evidence.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing updates.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Update only the affected obligation, deadline, evidence, impact, risk, or owner sections.
3. Preserve prior decision traceability and record what changed.
4. Tie every material update to source evidence such as an updated regulation, audit note, risk record, policy, contract, or owner confirmation.
5. Refresh assumptions, open questions, downstream handoffs, and decision gate status.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Rewriting the whole artifact for style when only the deadline changed.
- Leaving stale control or evidence expectations after the obligation changes.
- Updating scope without routing legal, audit, privacy, or security uncertainty.
