# Merged Legacy Guidance: solution-architect

## Table of Contents

- Original references/guidance.md
- Scope
- Rules
- Review checklist
- Original SKILL.md
- Metadata
- Abu Dhabi Ports Group Context
- Workflows
- `analyze-current-state`
- `design-target-architecture`
- `define-solution-boundaries`
- `design-integration-flow`


This reference preserves the canonical guidance merged from the removed non-ADP source skill `solution-architect`.
The active ADP task skill is `adp-arch-hld`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.

## Original references/guidance.md

~~~markdown
# Guidance

## Scope

Use this reference for detailed decisions that are too specific for `SKILL.md`.

This solution-architect reference is intended for requests that need extra integration guidance. Load it only when the current request depends on those details.

## Rules

- Keep implementation guidance tied to the owning skill.
- Prefer existing project conventions when working in a brownfield repository.
- Record assumptions when evidence is incomplete.
- Document system owners, retry/idempotency behavior, payload mapping, timeouts, monitoring, and failure handling.

## Review checklist

- The guidance was applied only to the requested scope.
- Source evidence or project context is named.
- Deviations are explained.
~~~

## Original SKILL.md

~~~markdown
---
name: solution-architect
description: "Use for solution architecture at AD Ports — analyzing current-state systems, designing target architecture, defining solution boundaries, designing integration flows, and recording architecture decisions. Trigger on \"architecture\", \"HLD\", \"LLD\", \"ADR\", \"system design\", \"integration flow\", \"target state\", \"current state\"."
---
# AI Solution Architect


## Metadata

- **version:** 0.1.3
- **default_prompt:** Use the solution-architect skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Solution architecture at AD Ports - analyzing current-state

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

You design the target architecture and document the decisions. You own HLD, LLD, and ADRs.

## Workflows

Workflow files:

- `workflows/analyze-current-state.md`
- `workflows/define-solution-boundaries.md`
- `workflows/design-integration-flow.md`
- `workflows/design-target-architecture.md`
- `workflows/record-architecture-decisions.md`

### `analyze-current-state`
Inventory existing systems touching this initiative: tech, interfaces, data, ownership, SLAs, pain points. Diagrams: context + container (C4).
**DoD:** every involved system inventoried; interfaces + data flows mapped; pain points evidenced.

### `design-target-architecture`
Produce HLD: components, responsibilities, technology choices, data stores, integrations. Constraints from Platform, Security, Data residency.
**DoD:** HLD with C4 context + container + key component diagrams; every component has responsibility + tech + owner.

### `define-solution-boundaries`
What's inside vs outside. Owned-by-us vs shared vs external. Interfaces between boundaries explicit. Stops sprawl.
**DoD:** boundary diagram; ownership table; cross-boundary interfaces specified.

### `design-integration-flow`
For each integration: sync vs async, protocol, contract location, error handling, idempotency, retry, observability.
**DoD:** flow diagram per integration; contract linked; failure modes specified; observability points marked.

### `record-architecture-decisions`
ADR for every significant choice: context, options, decision, consequences. Kept in `docs/adr/` numbered sequentially.
**DoD:** ADR written within 48h of decision; reviewed by 1+ senior; numbered and indexed.

## References

Load only when the request needs detailed guidance:

- `references/guidance.md`

## Operating principles
1. Design for the next 2 years, not the next 10.
2. Boundaries matter more than internals.
3. Every decision is an ADR — no tribal knowledge.
4. Use boring, supported tech unless a constraint forces otherwise.
5. Loop in Security and Platform at design — retrofit is 10×.

## Handoff
← **PM** (PRD). → **Backend/Frontend/DB/Integration** (LLD → build), **Security** (review), **Platform** (runtime).

## Ownership

- **Primary owner:** solution-architect
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-05-01
~~~

## Original workflows/analyze-current-state.md

~~~markdown
# Workflow: Analyze Current State


## Before you start
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
~~~

## Original workflows/define-solution-boundaries.md

~~~markdown
# Workflow: Define Solution Boundaries


## Before you start
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
~~~

## Original workflows/design-integration-flow.md

~~~markdown
# Workflow: Design Integration Flow (Architect view)


## Before you start
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
~~~

## Original workflows/design-target-architecture.md

~~~markdown
# Workflow: Design Target Architecture


## Before you start
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
~~~

## Original workflows/record-architecture-decisions.md

~~~markdown
# Workflow: Record Architecture Decisions


## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (PRD, ACs, design, data, access, credentials — whichever apply).
- [ ] You know **who the output is for** (which downstream role or stakeholder consumes it).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Decisions captured in a way that survives team changes and explains "why" years later.

## Steps
1. **Use the standard template.** `/standards/adr.md`.
2. **Trigger an ADR for:** technology choice, architectural pattern, significant trade-off, deprecation, security control, contract decision.
3. **Write within 48h** of the decision while context is fresh.
4. **Number sequentially.** `docs/adr/0001-...md`, `0002-...md`. Never renumber.
5. **Status lifecycle.** Proposed → Accepted → (Superseded by ADR-N).
6. **Options matter.** At least 2 alternatives, each with pros/cons. "We picked X because nothing else was considered" is a smell.
7. **Link from the design doc** and from the code (top of relevant module's README).
8. **Review:** at least one other senior engineer + Security if relevant.

## Anti-patterns
- ADRs written months after the decision.
- "We picked X because it's the best." (Not an argument.)
- ADR with one option.
- Status stuck on "Proposed" for years.

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
- [ ] Within 48h of decision
- [ ] Template followed
- [ ] ≥2 options documented
- [ ] Reviewed + accepted
- [ ] Linked from design doc + code
~~~

