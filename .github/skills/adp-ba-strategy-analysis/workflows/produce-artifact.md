# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `strategy-analysis.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the strategy driver, current-state evidence, target outcome, sponsor, and destination.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing strategy context.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Capture current state, future state, gap analysis, risks, change strategy, assumptions, open questions, and decision gates.
3. Tie every material decision to source evidence such as demand intake, sponsor strategy, process evidence, telemetry, incidents, support trends, audit findings, or stakeholder notes.
4. Route gaps or risks that belong to product, architecture, security, UX, delivery, or operations to the owning role.
5. State whether the strategy analysis is ready for BRD, PRD, roadmap, architecture, or delivery-planning handoff.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Writing a BRD or PRD instead of strategy analysis.
- Defining future state only as a preferred solution.
- Hiding gap analysis inside general narrative.
