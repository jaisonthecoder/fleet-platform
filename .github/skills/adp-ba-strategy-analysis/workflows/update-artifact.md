# Update Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `strategy-analysis.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the existing artifact plus changed strategy, current-state, future-state, gap, risk, or change-strategy evidence.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing updates.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Update only the affected current-state, future-state, gap, risk, change-strategy, assumption, or decision-gate sections.
3. Preserve prior decision traceability and record what changed.
4. Tie every material update to source evidence.
5. Refresh downstream handoffs and readiness status.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Rewriting the whole artifact for style when only one strategy decision changed.
- Updating future state without updating gap analysis and risks.
- Leaving stale downstream handoffs after strategy changes.
