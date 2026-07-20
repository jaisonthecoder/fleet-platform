# Guidance

Use this reference for PRD-level decisions that do not fit cleanly inside a single workflow.

## Core Model

- `docs/02-product/PRD/prd.md` is the product contract and story index.
- Each user story has one dedicated file under `docs/02-product/PRD/user-stories/`.
- A story is not complete if it exists only inside the PRD.
- Story files carry acceptance criteria, user story scope verification, implementation checklist, and evidence placeholders.

## Story File Requirements

Each story file must include:

- Story ID, title, owner, priority, and BR mapping.
- Scope type: backend/API, UI, full-stack, or non-API/non-UI.
- "As a / I want / So that" statement.
- Given/When/Then acceptance criteria.
- Backend/API validation examples using runnable `curl` commands where backend/API behavior is expected.
- UI validation examples using a Playwright test outline where UI behavior is expected.
- Implementation validation checklist.
- Test evidence table with status and evidence/link placeholders.

If backend/API or UI validation is not applicable, state the rationale directly in the story file. The required verification depends on story scope: backend/API uses `curl`, UI uses Playwright, full-stack uses both, and non-API/non-UI uses an alternate evidence path.

## User Story Scope Verification

Every story needs an explicit verification path that matches its delivery surface:

- Backend/API scope: include runnable `curl` commands, expected HTTP status codes, expected response fields, and evidence placeholders.
- UI scope: include a Playwright test outline for the primary user journey, key locators/assertions, and evidence placeholders.
- Full-stack scope: include both backend/API `curl` checks and UI Playwright checks.
- Non-API/non-UI scope: state why API and UI checks are not applicable and provide the alternate evidence path.

Do not require backend/API verification for UI-only stories. Do not require UI verification for backend/API-only stories. Do require both when the feature crosses both layers.

## Granularity

- Break epics into stories that can be completed in <= 5 days.
- Split stories with mixed personas, mixed outcomes, or more than roughly six acceptance criteria.
- Do not split by technical layer. A story should deliver user or business value.
- Do not merge unrelated journeys just to reduce story count.

## Traceability

- Every story traces to one or more BRs.
- Every in-scope BR traces to one or more stories or a signed-off deferral/drop.
- PRD traceability uses explicit test IDs, for example `US-001.1, US-001.2, US-001.3, US-001.4`.
- Avoid ranges like `US-001.1 to US-003.4`; they overstate coverage and hide gaps.

## Acceptance Criteria Quality

- At least four scenarios per story: happy path, 2-3 edge cases where meaningful, and one error path.
- Scenarios use Given/When/Then.
- AC IDs are stable and do not renumber.
- Outcomes are observable by a user, API consumer, event stream, log, report, or operational role.
- Avoid vague language such as "fast", "easy", "correct", or "seamless" without measurable criteria.

## NFRs

Quantify NFRs. Cover performance, availability, security, accessibility, observability, scalability, data retention, and localization where applicable.

Every NFR needs:

- Target
- Measurement method
- Owner
- Evidence or test target

## Routing Things Out Of The PRD

If a request looks like a feature but is actually one of the following, route it elsewhere:

- Architecture decision -> `adp-arch-adr`
- Integration contract -> `adp-int-architecture`
- UX flow / wireframe -> `adp-ux-screens`
- Test plan -> `adp-qa-test-strategy`
- Operational runbook -> `adp-doc-ops-runbook` or `adp-sre-incident`

Do not turn out-of-scope manual processes into application features. If visibility is needed, represent it as reporting or handoff evidence without adding unsupported workflow scope.

## Review Checklist

- [ ] `docs/02-product/PRD/prd.md` includes problem, goals, non-goals, target users, dependencies, assumptions, and a linked user story index.
- [ ] Every story has a dedicated file under `docs/02-product/PRD/user-stories/`.
- [ ] Every story maps to one or more BRs.
- [ ] Every story file includes AC plus backend/API `curl` and/or UI Playwright scope verification or not-applicable rationale.
- [ ] Every story file includes evidence placeholders.
- [ ] NFRs have target, measurement method, and owner.
- [ ] Non-goals are explicit.
