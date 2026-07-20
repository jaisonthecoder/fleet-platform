# Workflow: Design Target Architecture


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
A buildable target architecture that satisfies the PRD + NFRs and respects AD Ports constraints.

## Steps
1. **Constraints in.** PRD, NFRs, security classification, data residency, platform standards (Azure, .NET / React / Angular at the LTS recorded in `/standards/framework-baselines.md`, SQL Server/Postgres).
2. **Components.** Each: responsibility, tech, owner, public interface, dependencies. Smallest set that does the job.
3. **C4 container + key component diagrams.** Stop at component — code-level is LLD's job.
4. **Cross-cutting.** Auth (Entra ID), config (App Config + Key Vault), observability (App Insights), error handling, caching, messaging.
5. **Boundaries.** Bounded contexts; what's a service vs a module. Justify every new service (operational cost).
6. **Data architecture.** Owned-by-which-service, sharing pattern (API vs event vs replica), consistency expectations.
7. **NFR fit.** Walk each NFR; show where in the architecture it's satisfied.
8. **Trade-offs.** Document at least 2 alternatives considered + why rejected. ADR for each significant choice.

## Anti-patterns
- "Microservices" because it's modern — operational cost ignored.
- Skipping NFR walkthrough — NFRs become surprises.
- Single-author design — no peer review.

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
- [ ] Diagrams in repo
- [ ] Component table with responsibility + owner
- [ ] NFR walkthrough documented
- [ ] ADRs for significant choices
- [ ] Reviewed by Security + Platform + senior engineering
