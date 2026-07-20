# Assess Risks

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for the risk section of `strategy-analysis.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm current-state, future-state, gap, dependency, constraint, or stakeholder evidence is available.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing risks.

## Steps
1. Identify business, operational, regulatory, security, data, vendor, adoption, delivery, dependency, and readiness risks.
2. For each risk, capture cause, impact, likelihood, severity, owner, mitigation, trigger, and downstream artifact affected.
3. Tie risks to evidence or mark them as assumptions.
4. Route risks owned by other roles to the correct downstream owner.
5. Identify risks that block BRD, PRD, roadmap, architecture, or delivery planning.

## After you finish
- Update the risk section of the artifact named in `SKILL.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Listing generic risks with no owner or mitigation.
- Treating compliance, security, data, or operational risk as product preference.
- Hiding blockers as low-priority open questions.
