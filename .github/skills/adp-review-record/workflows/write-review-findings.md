# Workflow: Write Review Findings


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
Findings the author can act on without guessing intent.

## Steps
1. **Per finding:**
   - Severity: Blocking / Strong / Nit.
   - Location: `file:line`.
   - Problem: one sentence.
   - Suggested fix: code or pattern.
   - Why: rationale (only when not obvious).
2. **Group related findings.** Same root cause across multiple files → one comment, list locations.
3. **Use code-suggest comments** for trivial fixes — author one-clicks accept.
4. **Tone.** Review the change, not the author. Avoid "you" — "this function" is enough.
5. **Praise** notable good patterns. Reviewers shape culture; positive feedback is a tool.

## Anti-patterns
- "This is wrong." (Wrong how? Fix it how?)
- Severity-laden review on a 5-line PR.
- All findings as Blocking → loses signal.

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
- [ ] Every finding labeled + located + with fix
- [ ] Related findings grouped
- [ ] Code-suggest used where possible
- [ ] Praise included
