# Analyze Current State

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for the current-state section of `strategy-analysis.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm current-state source evidence exists, including process, system, user, metric, incident, support, audit, or operational evidence.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing current state.

## Steps
1. Identify the current business process, users, systems, data, controls, integrations, policies, metrics, and operating constraints.
2. Capture pain points, failure modes, manual workarounds, delays, rework, service impacts, compliance exposure, and decision bottlenecks.
3. Tie every current-state claim to source evidence.
4. Separate observed fact from stakeholder opinion.
5. Record gaps in evidence as open questions with owner and impact.

## After you finish
- Update the current-state section of the artifact named in `SKILL.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Capturing current state from memory without evidence.
- Mixing future-state aspirations into current-state facts.
- Omitting operational windows, data, controls, or integration constraints.
