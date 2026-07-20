# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-business-case.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the source business case, sponsor, funding owner, benefit measure, or portfolio evidence that justifies the work.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing investment rationale.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Capture the investment rationale, funding source, approval path, benefit measures, and source business case, preserving the section order and table columns in `../templates/demand-intake-business-case-template.md.tmpl`.
3. Tie every material decision to source evidence such as a business case, budget request, portfolio record, steering note, or sponsor confirmation.
4. Mark missing benefit, funding, approval, or evidence facts as blockers, assumptions, or open questions.
5. Call out downstream handoffs, risks, and the decision gate explicitly.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Treating an unfunded idea as an approved investment.
- Replacing business benefit measures with technical deliverables.
- Marking the intake ready without an approval path or benefit owner.
