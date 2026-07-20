# Workflow: Design Integration Flow (Architect view)


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
Architectural-level integration design that the Integration Engineer will then build.

## Steps
1. **Identify the integration.** Which systems, which direction, what trigger.
2. **Sync vs async.** Sync if caller blocks on result + acceptable latency; async otherwise. Document trade-off.
3. **Pattern.** Request/response, event-carried state transfer, event notification, change data capture, file transfer, batch.
4. **Consistency.** Eventually consistent vs strongly consistent. Acceptable lag.
5. **Failure model.** What happens when each side fails. Order of recovery.
6. **Capacity.** Peak rate, burst handling, backpressure.
7. **Observability hooks.** What to measure. Where alerts fire.
8. **Hand off to Integration Engineer** for contract + adapter build.

## Anti-patterns
- Sync chains > 3 hops (latency + failure compound).
- Event-carried state without versioning strategy.
- "We'll figure out failure later."

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
- [ ] Pattern chosen + justified
- [ ] Consistency expectations documented
- [ ] Failure model captured
- [ ] Capacity sized
- [ ] Hand-off doc to Integration Engineer
