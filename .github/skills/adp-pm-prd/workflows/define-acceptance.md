# Workflow: Define Acceptance Criteria

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

Confirm you have what you need before doing the work. If any item is missing, pause and ask; do not fabricate.

- [ ] You know the story ID and dedicated story file path under `docs/02-product/PRD/user-stories/`.
- [ ] The story has a persona, business outcome, BR mapping, dependencies, and priority.
- [ ] You know the story scope type: backend/API, UI, full-stack, or non-API/non-UI.
- [ ] If writing to a repository, you are on the right branch.

If the story does not have a dedicated file, create or request it before writing acceptance criteria.

## Goal

For each user story, write Given/When/Then scenarios in that story's dedicated file: happy path, 2-3 edge cases, and 1 error path. Make each scenario measurable and testable by QA without asking follow-up questions.

## Steps

### 1. Write stable scenarios

Use stable IDs that do not renumber when new scenarios are added:

- `US-001.1` happy path
- `US-001.2` edge case
- `US-001.3` edge case
- `US-001.4` error path
- Add NFR-specific scenarios when needed

Use Given/When/Then. Avoid ambiguous language such as "fast", "easy", "correctly", or "seamless" unless paired with a measurable target.

### 2. Add user story scope verification per story

In the dedicated story file, add:

- Backend/API validation: runnable `curl` commands with expected status codes and response fields, or "not applicable" with rationale.
- UI validation: Playwright test outline for the primary user journey, or "not applicable" with rationale.
- Evidence placeholders: where the implementer must paste command output, test run links, screenshots, or CI links.

Match validation to the story scope. Backend/API stories need `curl`; UI stories need Playwright; full-stack stories need both; non-API/non-UI stories need an alternate evidence path. Do not require a validation type that is outside the story scope, and do not let a story pass with missing validation for a layer that is inside scope.

### 3. Cover core paths

Every story needs at least:

- One happy path
- Two to three edge cases where meaningful
- One error path
- Any release-gating NFR checks that apply

### 4. Keep scenarios domain-observable

Describe what the user, API consumer, event stream, log, report, or operational user can observe. Do not write acceptance criteria only as internal implementation details.

## Anti-patterns

- "System should feel fast."
- "User can submit form" without preconditions, input, outcome, and validation.
- Backend/API expected behavior without a `curl` command, status code, or response field.
- UI expected behavior without a Playwright journey or locator/test outline.
- Evidence placeholders missing from the story file.

## After you finish

- [ ] Acceptance criteria are saved in the dedicated story file.
- [ ] Backend/API scope verification is documented with `curl` or explicitly marked not applicable with rationale.
- [ ] UI scope verification is documented with Playwright or explicitly marked not applicable with rationale.
- [ ] Non-API/non-UI stories document the alternate evidence path.
- [ ] Evidence placeholders exist for command output, test links, screenshots, or CI links.
- [ ] QA can test the story without asking for clarification.
- [ ] Downstream route: send the updated story to `ai-quality-engineer` for test design and to the owning delivery role for implementation planning.
- [ ] Run `git status` and confirm only intended files changed.

## Definition of Done

- [ ] Every story has >=4 scenarios.
- [ ] No ambiguous language remains.
- [ ] Scenarios are testable by QA without asking.
- [ ] Scope-appropriate verification is documented per story: backend/API `curl`, UI Playwright, both, or alternate evidence.
- [ ] Implementation evidence placeholders exist per story.
