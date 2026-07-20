# Update Artifact

## Before you start
- Confirm the request is for `frontend React test files (*.test.tsx, *.spec.tsx), MSW handlers, Pact/E2E suites, coverage and a11y evidence`.
- Confirm the work is owned by AI Frontend Engineer (React) (`ai-frontend-react`).
- Confirm the upstream business, product, architecture, security, or delivery input that justifies the work.
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing scope.

## Steps
1. Read `SKILL.md` and keep the `## Metadata`, owner role, primary artifact, and quality bar in view.
2. Identify whether the request is creation, update, or review work; continue only if it matches this workflow.
3. Update only the affected sections and preserve traceability to the prior artifact.
4. Tie every material decision to source evidence such as a backlog item, approved artifact, test result, telemetry, or stakeholder input.
5. Call out assumptions, risks, downstream handoffs, and open questions explicitly.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Producing an artifact for another skill's ownership boundary.
- Expanding scope because an upstream artifact is vague or missing.
- Marking work complete without evidence or validation.
