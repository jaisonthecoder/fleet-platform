# Workflow: Define Solution Boundaries


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
Crisp lines around what we own, what we share, and what's external — so teams don't sprawl.

## Steps
1. **Identify the bounded contexts.** From the domain, not the tech.
2. **Per context: what's inside?** Entities, behaviors, data store. The "interior" the team owns end-to-end.
3. **What's at the boundary?** Public interface — APIs, events, contracts.
4. **What's external?** Other systems, partners. Document the integration shape.
5. **Ownership matrix.** Each component → one team. No "shared" without a named owner.
6. **Cross-boundary rules.** No reaching into another team's DB. No shared mutable libraries without a maintainer.
7. **Anti-corruption layer** between domains with different language (e.g. SAP integration translates SAP terms → AD Ports terms at the edge).

## Anti-patterns
- Shared "common" library that everyone owns and nobody owns.
- Cross-team DB access "just for now".
- Boundaries drawn around tech (frontend/backend) instead of domain.

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
- [ ] Boundary diagram
- [ ] Ownership matrix
- [ ] Public interfaces documented
- [ ] ACL where languages differ
- [ ] Cross-boundary rules signed off by all owning teams
