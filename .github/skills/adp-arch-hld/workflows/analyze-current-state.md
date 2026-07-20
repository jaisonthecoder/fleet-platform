# Workflow: Analyze Current State


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
A complete, evidenced picture of the systems you're about to change.

## Steps
1. **Scope.** What systems are in/out of analysis. Get sponsor agreement.
2. **C4 context diagram.** People + systems + external dependencies. One page.
3. **C4 container diagram.** For systems in scope, decompose into runtime containers (apps, DBs, queues).
4. **Inventory data flows.** What flows where, format, frequency, volume.
5. **Inventory ownership.** Who owns each system + interface. Escalation contacts.
6. **Capture pain.** From operators, support tickets, incident history. Cite — don't summarize.
7. **Capture constraints.** Tech debt, deprecated stacks, regulatory locks.
8. **Identify what to keep / replace / wrap.** With rationale per decision.

## Anti-patterns
- Architecture review based on docs alone — talk to operators.
- Diagrams that show wishful state, not actual.
- "Just ship a new system" without understanding how the old one is used.

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
- [ ] C4 context + container diagrams
- [ ] Data flow inventory
- [ ] Ownership table
- [ ] Pain points evidenced
- [ ] Keep/replace/wrap call per system
