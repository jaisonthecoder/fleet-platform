# Review Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-change-request.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the artifact under review plus the approved baseline, requested change, source evidence, and change-control route.
- If required inputs are missing, stop and ask for the missing artifact instead of guessing.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Check whether affected baseline, requested change, impact, change-control route, and source evidence are complete.
3. Produce findings with severity, evidence, required follow-up, and downstream impact.
4. Identify unsupported change claims, missing baseline owners, weak impact analysis, and unclear decision gates.
5. State whether the artifact is ready for BRD, PRD, architecture, or delivery-planning handoff.

## After you finish
- Output findings or update the artifact named in `SKILL.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Approving an artifact whose baseline cannot be found.
- Treating missing impact analysis as a minor wording issue.
- Reviewing only format while ignoring change-control evidence.
