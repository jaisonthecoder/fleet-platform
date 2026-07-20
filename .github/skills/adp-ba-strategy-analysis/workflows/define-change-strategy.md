# Define Change Strategy

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for the change-strategy section of `strategy-analysis.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm current state, future state, gap analysis, constraints, risks, and stakeholder impact are available.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing transition steps.

## Steps
1. Define the change approach: phased, pilot, parallel run, migration, process redesign, policy change, training, rollout, or retirement.
2. Sequence transition steps by dependency, risk, readiness, operational window, and decision gate.
3. Capture stakeholder impact, adoption needs, communications, training, support model, and operational readiness.
4. Map change strategy outputs to downstream BRD, PRD, roadmap, architecture, UX, delivery, and test needs.
5. Record assumptions, open questions, owners, decision gates, and fallback options.

## After you finish
- Update the change-strategy section of the artifact named in `SKILL.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Treating change strategy as a project schedule only.
- Ignoring adoption, process, data, controls, readiness, or support impacts.
- Skipping decision gates and fallback options.
