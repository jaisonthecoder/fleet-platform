# Workflow: Assess Change Risk


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
A risk score that drives review depth, gating, and rollback planning.

## Steps
1. **Blast radius.**
   - Hot path? (auth, payments, vessel ops core)
   - Shared module? (used by many features)
   - Migration? (data-shape change)
   - Integration? (external dependency)
   - Public API change? (breaking?)
2. **Score Low / Medium / High** on impact + likelihood of regression.
3. **Per level:**
   - **Low:** standard review, normal release.
   - **Medium:** ≥2 reviewers, integration tests required, rollback path documented.
   - **High:** Architect review, feature flag, canary deploy, explicit rollback rehearsed.
4. **Document on the PR.** Risk + mitigations in PR description.
5. **Hand off** to Release Engineer for high-risk staging.

## Anti-patterns
- Risk assessed only at release time.
- "Low risk" stamped on a migration.
- High-risk merged without flag/canary.

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
- [ ] Risk score on PR
- [ ] Mitigations matched to score
- [ ] Release informed for High
