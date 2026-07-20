# Review Artifact

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/adr.md`, `/standards/definition-of-done.md`.
- Open `../SKILL.md`.
- Locate the artifact, source inputs, and acceptance criteria being reviewed.
- Confirm whether the review is for completeness, correctness, risk, or release readiness.
- Scan for `TBC`, `unknown`, and placeholder values; confirm each required gap was either asked before generation or recorded as an owned open question with due date and impact.
- When UI/API boundaries are in scope, locate the Backend/Frontend Contract Matrix before accepting frontend, backend, UX, or QA handoff readiness.
- Primary artifacts: foundation-lld.md, module-lld-*.md, lld.md, lld-*.drawio

## Goal

Complete the requested Foundational LLD, Module LLD pack, single-file LLD, or LLD diagram review so downstream delivery roles can proceed with traceable evidence, explicit AD Ports assumptions, and clear boundaries between architecture rules, module design, and delivery specs.

## Steps

1. Check that the artifact matches this skill's owner role, purpose, quality bar, and standard path.
2. Verify the LLD shape is correct:
   - Foundational LLD contains shared engineering rules only.
   - Module LLD packs contain business-module, service, capability, integration, or bounded-component detail.
   - A single `lld.md` is justified by repository convention or narrow scope.
   - HLD rationale and delivery specs are linked or routed, not duplicated.
3. Verify traceability from claims and decisions back to source evidence.
4. For Module LLD packs, verify sequence diagram coverage:
   - Confirm implementation-critical flows have sequence diagrams when multiple components or services participate; a transaction, consistency, or state synchronization boundary exists; audit, authentication, authorization, or security decisioning occurs; file or object storage is involved; import, export, or batch processing is involved; retry, rollback, idempotency, or compensation behavior matters; an external identity, platform, or integration dependency participates; or operational fallback, manual recovery, or degraded-mode behavior affects implementation.
   - Confirm simple CRUD flows either include diagrams where helpful or state an explicit "not needed" rationale.
   - Flag missing sequence diagrams as `should-fix` when the flow is implementation-critical. Escalate to `blocking` only when the missing flow makes transaction, security, audit, storage, integration, or recovery behavior impossible to implement safely.
5. Identify gaps, contradictions, missing assumptions, weak evidence, wrong artifact shape, unowned TBC/missing-value placeholders, and downstream risks.
6. Verify the Backend/Frontend Contract Matrix covers every UI/API feature with source FR/NFR, frontend screen/workflow, backend capability/use case, API operation or event, request/response DTOs, validation/errors, permission claim, audit event, integration dependency, mock fixture, owners, contract status, and test evidence expectation.
7. Classify each finding as blocking, should-fix, or advisory.
8. End with an accept or rework decision and name the owner for each required fix.

## Anti-patterns

- Producing a generic output that ignores AD Ports operating, regulatory, or tenancy constraints.
- Accepting a broad single `lld.md` without checking whether it should be split.
- Accepting business-module detail inside a Foundational LLD.
- Accepting user stories, acceptance criteria, test cases, or task prompts as LLD content instead of delivery specs.
- Skipping source evidence and leaving the next role to rediscover the rationale.
- Treating standards as optional when a shared `/standards/` file applies.
- Hiding assumptions, open questions, or risks inside prose instead of listing them.
- Accepting `TBC`, `unknown`, or placeholder values in required sections without an owner, due date, and impact.
- Accepting Module LLD packs that omit required sequence diagrams for implementation-critical flows without a "not needed" rationale.
- Accepting frontend/backend implementation readiness when the Backend/Frontend Contract Matrix is absent, incomplete, or not tied to FR/NFR evidence.

## After you finish

- Findings are specific, actionable, and tied to evidence.
- The review decision is explicit: accepted, accepted with follow-ups, or rework required.
- Open questions and downstream risks are assigned to owners.
- [ ] Notify the downstream role(s) that own the affected modules, technologies, data, platform, security, quality, or delivery specs.

## Definition of Done

- [ ] Output traces to a source request, artifact, ticket, or evidence.
- [ ] The LLD shape was reviewed: Foundational LLD, one Module LLD, multiple Module LLD packs, or single-file LLD.
- [ ] Foundation rules and module details are separated when both are present.
- [ ] Delivery specs are referenced, not duplicated.
- [ ] Relevant AD Ports standards and domain edges were checked.
- [ ] Assumptions, open questions, and risks are explicit.
- [ ] Required TBC or missing-value placeholders were either resolved or converted into owned open questions with due date and impact.
- [ ] Module LLD sequence diagrams are present for implementation-critical flows, or the artifact includes an explicit "not needed" rationale for simple CRUD/non-critical flows.
- [ ] Backend/Frontend Contract Matrix is complete when UI/API boundaries are in scope.
- [ ] Downstream role(s) are named and can act without reconstructing context.
- [ ] Evidence is linked or the validation gap is stated.
