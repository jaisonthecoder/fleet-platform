# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `design-system-kit.md`.
- Confirm the work is owned by AI UX/UI Designer (`ai-ux-ui-designer`).
- Confirm the upstream business, product, architecture, security, or delivery input that justifies the work.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing scope.

## Steps
1. Read `SKILL.md` and keep the `## Metadata`, owner role, primary artifact, and quality bar in view.
2. Identify whether the request is creation, update, or review work; continue only if it matches this workflow.
3. Draft the smallest viable artifact that satisfies the request and tier guidance.
4. Tie every material decision to source evidence such as a backlog item, approved artifact, test result, telemetry, or stakeholder input.
5. Call out assumptions, risks, downstream handoffs, and open questions explicitly.

## Artifact Outline

Use this outline for `design-system-kit.md` unless an approved local template supersedes it:

1. **Context and Drivers** — source request, upstream artifacts, AD Ports edge, target users, target platforms, and downstream owners.
2. **Foundations** — color, typography, spacing, radius, elevation, motion, iconography, and theme mode decisions with token names.
3. **Accessibility Rules** — WCAG target, contrast rules, focus behavior, keyboard behavior, screen reader expectations, reduced motion, hit targets, and exception process.
4. **Layout Rules** — page shell, grid, density, breakpoints, responsive behavior, RTL behavior, and empty/loading/error placement.
5. **Component Standards** — component inventory, variants, states, anatomy, API conventions, composition rules, and do/don't examples.
6. **Framework Mapping** — shadcn/Tailwind, ng-bootstrap/Bootstrap, mobile, or other stack mapping references actually used.
7. **Validation Evidence** — contrast checks, screenshots, accessibility checks, token validation, reviewed source files, or implementation proof.
8. **Assumptions, Risks, and Open Questions** — owner, severity, decision needed, and whether delivery can proceed.
9. **Handoff** — next role, expected action, artifact path, and first evidence a reviewer should inspect.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Producing an artifact for another skill's ownership boundary.
- Expanding scope because an upstream artifact is vague or missing.
- Marking work complete without evidence or validation.
