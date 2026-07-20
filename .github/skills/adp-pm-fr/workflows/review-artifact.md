# Review Functional Requirements

## Before you start
- Open `../SKILL.md`.
- Read the functional requirements artifact and its upstream evidence if available.
- Confirm review scope: completeness, traceability, testability, routing, or readiness.

## Goal

Find gaps that would cause scope ambiguity, poor testing, implementation churn, or misplaced ownership.

## Steps

1. Check that every FR has stable ID, source trace, actor, trigger, behavior, outcome, exceptions, acceptance criteria, priority, owner, and status.
2. Check that every FR is atomic and observable.
3. Check that every FR package description merges linked user story context into the FR: story statement, feature objective, user or business value, primary scenario, story-derived constraints, and relevant story acceptance criteria.
4. Check traceability backward to BRD/PRD/business evidence and forward to output/story/test evidence, and confirm traceable IDs and output references are Markdown links when a target exists.
5. Identify NFRs, UX design, architecture, implementation, or test execution content that should be routed to other skills.
6. Check AD Ports edges and call out missing tenancy, Arabic/RTL, data residency, operational window, vessel/customs, SAP/Oracle, or maritime SLA considerations.
7. Return findings by severity with file and FR ID references.

## Anti-patterns

- Treating vague verbs as acceptable because the requirement sounds familiar.
- Treating the backlog/story link as enough feature context while the FR package lacks the story statement, objective, value, and scenario description.
- Reviewing only wording and missing traceability or acceptance gaps.
- Accepting solution design as product behavior.

## After you finish

- [ ] Findings are ordered by severity.
- [ ] Each finding references an FR ID or exact artifact section.
- [ ] Broken, missing, or plain-text traceability and output links are reported when link targets should exist.
- [ ] Missing or stale User Story Context is reported when a linked story/backlog item exists or is required for delivery readiness.
- [ ] Routing recommendations name the owning role.
- [ ] Residual risk or missing evidence is stated.

## Definition of Done

- [ ] The review tells the PM what must change before downstream roles rely on the artifact.
- [ ] No ownership gaps are left implicit.
