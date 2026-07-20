# Workflow: Review Test Fit


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (PRD, ACs, design, data, access, credentials — whichever apply).
- [ ] You know **who the output is for** (which downstream role or stakeholder consumes it).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Confirm tests prove the AC + don't lie about coverage.

## Steps
1. **Trace tests to AC.** Every AC has a test that would fail if the code regressed.
2. **Edge + error coverage.** Spot-check a couple — invalid input, downstream failure, concurrency where relevant.
3. **No tautology.** A test asserting `mock.MethodCalled` and nothing about behavior is dead weight.
4. **No flake.** Look for `Sleep`, time-based asserts without freeze, network/DB races.
5. **Coverage delta.** PR shouldn't drop logic coverage. Tools: Cobertura/coverlet (.NET), v8 (FE).
6. **Test names.** Should describe what — readable as documentation.

## Anti-patterns
- 100% line coverage with no behavior tests.
- Tests that mock everything they touch.
- New flaky test added "we'll fix it later".

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The artifact is saved at its documented path and committed (or linked from the ticket/board).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): `platform-sre`, `security-engineer`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] AC → test mapping verified
- [ ] Edge + error spot-checked
- [ ] No tautology / flake introduced
- [ ] Coverage delta acceptable
