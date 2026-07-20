# Workflow: Review Code


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
Catch correctness, readability, security, and performance issues before merge.

## Steps
1. **Read the PR description first.** No description? Send back.
2. **Pull the change locally** for non-trivial PRs. Diff-only review misses context.
3. **Use the standard checklist.** `/standards/code-review-checklist.md`.
4. **Per finding:** severity (Blocking / Strong / Nit), location (`file:line`), suggested fix. Use code-suggest comments where possible.
5. **Praise patterns** worth replicating — short, specific, public.
6. **Author responds to every Blocking + Strong** before merge. Nits author's discretion.
7. **Re-review on push.** Fast — author is blocked on you.

## Anti-patterns
- "LGTM" without checklist.
- Blocking comments with no suggested fix.
- 50-comment review on a 100-line PR — was the design wrong?

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
- [ ] Checklist executed
- [ ] Findings labeled by severity
- [ ] Fix suggestions for Blocking
- [ ] Author responses on Blocking + Strong
- [ ] Praise included where deserved
