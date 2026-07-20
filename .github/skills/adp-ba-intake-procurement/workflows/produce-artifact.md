# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Confirm the request is for `demand-intake-procurement.md`.
- Confirm the work is owned by AI Business Analyst (`ai-business-analyst`).
- Confirm the procurement source record, procurement need, commercial context, vendor role, security impact, and accountable owner.
- If required inputs are missing, stop and ask for the missing artifact instead of inventing procurement evidence.

## Steps
1. Read `SKILL.md` and keep the artifact contract, owner role, and quality bar in view.
2. Capture procurement need, source procurement record, commercial context, vendor role, security impact, approval path, owner, and target date, preserving the section order and table columns in `../templates/demand-intake-procurement-template.md.tmpl`.
3. Tie every material decision to source evidence such as procurement records, contracts, sourcing notes, vendor material, risk records, or sponsor confirmation.
4. Mark missing procurement, commercial, vendor, security, impact, or ownership facts as blockers, assumptions, or open questions.
5. Call out downstream handoffs, third-party risks, and the procurement decision gate explicitly.

## After you finish
- Output or update the artifact named in `SKILL.md` at the target-repository-root-relative numbered SDLC path from `/standards/artifact-path-routing.md`.
- Attach concrete evidence; do not rely on unsupported claims.
- Include a traceability line from request -> input evidence -> artifact change -> validation.
- Note the next owning role or reviewer when another handoff is required.

## Anti-patterns
- Treating vendor preference as a business requirement without procurement evidence.
- Omitting security, privacy, data, integration, or support impact.
- Starting implementation before the sourcing route and approval path are clear.
