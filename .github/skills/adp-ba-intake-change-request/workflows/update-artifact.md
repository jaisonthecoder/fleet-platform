# Update Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-change-request.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the existing artifact plus the changed baseline, impact, decision, or source evidence.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing updates.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Update only the affected baseline, change, impact, decision, risk, or evidence sections.
3. Preserve prior decision traceability and record what changed.
4. Tie every material update to source evidence such as a baseline revision, change board note, ticket, or sponsor confirmation.
5. Refresh assumptions, open questions, downstream handoffs, and decision gate status.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Rewriting the whole artifact for style when only the decision status changed.
- Leaving stale impact analysis after the baseline changes.
- Updating scope without updating the change-control state.
