# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `docs/01-discovery/demand-intake.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the upstream business, product, architecture, security, or delivery input that justifies the work.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing scope.
- Before creating a new document, ask the user whether there are additional requirements, constraints, clarifications, success measures, sponsor details, or AD Ports edge cases to capture.

## Steps
1. Read `SKILL.md` and keep the `## Metadata`, owner role, primary artifact, and quality bar in view.
2. Identify whether the request is creation, update, or review work; continue only if it matches this workflow.
3. Run a short clarification loop before drafting:
   - Ask only targeted questions needed to fill or validate sponsor, problem, users/process, expected benefit, priority, constraints, source evidence, and AD Ports checks.
   - Use a chat conversation to close open questions while generating the demand intake: ask the question, capture the user's answer, confirm the interpretation when needed, and immediately update the draft field, assumption, or open-question row.
   - Highlight unresolved open questions in the separate `## 8. Open questions` section; do not combine them with assumptions.
   - If the user says there are no more requirements or clarifications, proceed with the available evidence.
   - If the user cannot answer, proceed only when the gap can be safely carried as an explicit assumption or open question.
   - If a gap blocks accountability, value, or routing, stop and ask for that input instead of creating the document.
4. Draft the smallest viable artifact that satisfies the request and tier guidance while preserving the section order and table columns in `../templates/demand-intake-template.md.tmpl`.
5. Review the draft for every remaining `TBD`:
   - Group related missing fields into concise questions rather than asking one question per cell.
   - Ask the user to provide the missing business values before finalizing.
   - Replace answered fields with the provided values and source notes.
   - For unanswered fields, record `Pending`, `Not applicable`, an assumption ID, or an open question ID with an owner, needed-by date, blocker status, and latest-answer status; do not leave unexplained `TBD` values in a finalized artifact.
6. Tie every material decision to source evidence such as a backlog item, approved artifact, test result, telemetry, or stakeholder input.
7. Call out assumptions, risks, downstream handoffs, and open questions explicitly. Keep assumptions in the assumptions table and open questions in the highlighted open-questions table.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Producing an artifact for another skill's ownership boundary.
- Expanding scope because an upstream artifact is vague or missing.
- Creating a new intake document before asking for user requirements or clarifications.
- Finalizing an artifact with unexplained `TBD` placeholders.
- Hiding unresolved questions in an assumptions table or in narrative prose.
- Marking work complete without evidence or validation.
