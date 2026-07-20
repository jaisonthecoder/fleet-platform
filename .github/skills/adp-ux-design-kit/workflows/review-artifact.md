# Review Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `design-system-kit.md`.
- Confirm the work is owned by AI UX/UI Designer (`ai-ux-ui-designer`).
- Confirm the upstream business, product, architecture, security, or delivery input that justifies the work.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing scope.

## Steps
1. Read `SKILL.md` and keep the `## Metadata`, owner role, primary artifact, and quality bar in view.
2. Identify whether the request is creation, update, or review work; continue only if it matches this workflow.
3. Produce findings with severity, evidence, and required follow-up.
4. Tie every material decision to source evidence such as a backlog item, approved artifact, test result, telemetry, or stakeholder input.
5. Call out assumptions, risks, downstream handoffs, and open questions explicitly.

## Review Checklist

- [ ] The artifact has the core sections from `workflows/produce-artifact.md` or documents a justified local template.
- [ ] Component states cover default, hover, focus, active, disabled, loading, empty, error, and success where applicable.
- [ ] Token usage avoids raw colors, unowned spacing, and one-off typography.
- [ ] Accessibility evidence covers contrast, focus, keyboard, labels, screen reader behavior, reduced motion, and touch targets where applicable.
- [ ] RTL, Arabic content, density, and operational workflow constraints are either addressed or explicitly marked not applicable.
- [ ] Framework references are loaded only for the relevant implementation stack.
- [ ] Handoff names the next role and action, not only a generic notification.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Producing an artifact for another skill's ownership boundary.
- Expanding scope because an upstream artifact is vague or missing.
- Marking work complete without evidence or validation.
