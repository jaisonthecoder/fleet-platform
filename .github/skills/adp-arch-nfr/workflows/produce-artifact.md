# Produce Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/adr.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Confirm the requested output matches this skill's owner role and primary artifact.
- Identify the upstream evidence the artifact depends on.
- Before generating the document, list the open questions that affect quality targets, measurement methods, thresholds, scope, evidence, or ownership.
- Treat every unresolved `TBD` needed for useful NFR generation as a question to ask before writing. If the requester cannot answer, carry it explicitly as an assumption, risk, production blocker, conditional blocker, or deferred open question with an owner and needed-by date.
- Ask the requester the blocking open questions first. Continue only after answers are provided, or explicitly record why each unanswered item can be carried as an assumption or risk.
- Primary artifact: nfr.md

## Goal

Complete the requested nfr.md work so `ai-backend-dotnet`, `ai-frontend-react`, `ai-data-engineer`, `ai-platform-engineer`, `ai-security-engineer` can proceed with traceable evidence and explicit AD Ports assumptions.

## Steps

1. Confirm the target artifact path and source evidence.
2. Run the clarification gate:
   - Identify missing NFR categories, target values, thresholds, workloads, operating windows, user volumes, data classification, availability expectations, measurement methods, and evidence owners.
   - Convert would-be `TBD` placeholders into concise questions for the requester before generation.
   - Ask only the open questions that block useful NFR generation.
   - If the requester cannot answer, record each item as an assumption, risk, or deferred open question before generating the document.
3. Create the smallest artifact that satisfies the request.
4. Trace each decision to a source input, ticket, acceptance criterion, operational signal, or stakeholder note.
5. Write assumptions explicitly when evidence is missing.
6. Add an evidence section with links to source material, commands, generated files, or review notes.
7. Prepare a short handoff note naming the downstream role that should consume the artifact.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Generating the NFR document before asking target-blocking open questions.
- Leaving `TBD` in an approved or ready-for-delivery artifact outside the assumptions, risks, open questions, production blockers, or evidence gaps.

## After you finish

- The artifact is stored at the standard path for adp-arch-nfr.
- The output includes source evidence and assumptions.
- Blocking open questions were asked before generation, or explicitly carried as assumptions, risks, or deferred open questions.
- No unresolved `TBD` remains outside explicit assumptions, risks, blockers, deferred scope, or evidence gaps.
- The handoff note names the next role and any open questions.
- [ ] Notify the downstream role(s): `ai-backend-dotnet`, `ai-frontend-react`, `ai-data-engineer`, `ai-platform-engineer`, `ai-security-engineer`.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
