# Workflow: Define Non-Functional Requirements

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** are available: PRD, story/AC context, business outcome, user impact, architecture constraints, data/security classification, runtime assumptions.
- [ ] You know **who the output is for** (`ai-solution-architect`, `ai-platform-engineer`, `ai-security-engineer`, `ai-quality-engineer`, release approver).
- [ ] The **target location** is decided: cross-cutting NFRs in `docs/02-product/PRD/prd.md`; story-specific NFRs in the relevant file under `docs/02-product/PRD/user-stories/`.
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal

NFRs that are measured, owned, and gate the release.

## Steps

1. **Categories to consider:** performance (p95 latency, throughput), availability (SLO), scalability, security (classification, authn/authz, audit), accessibility (WCAG 2.1 AA), observability, data retention, localization, browser/device support.
2. **Per NFR capture:** target value, measurement method, owner, test/evidence where it is verified, and release-gate flag.
3. **Anchor to user impact.** "p95 vessel-search < 500 ms during peak (08:00–18:00 GST)" — not "fast queries".
4. **Don't over-specify.** If you don't have a real constraint, leave a sane default and note it.
5. **Loop in:** Architect (achievability), Security (classification), Platform (runtime), QA (test approach).
6. **Gate the release explicitly.** Mark each NFR as `Release gate? Yes` or `Release gate? No`. A `Yes` NFR failing means the release does not go without a documented exception.

## Anti-patterns

- "System should be performant."
- 99.999% SLO with no budget for change.
- Accessibility as a "phase 2" item.
- NFR without a test/evidence path.
- NFR marked as release-gating but no owner can verify it.

## After you finish

Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] NFRs are saved in the correct location (`docs/02-product/PRD/prd.md` for cross-cutting, dedicated story file for story-specific).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): `ai-solution-architect`, `ai-platform-engineer`, `ai-security-engineer`, `ai-quality-engineer` as applicable.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done

- [ ] Every NFR has target + measurement method + owner
- [ ] Anchored to user impact
- [ ] Architect/Platform/Security/QA reviewed
- [ ] Release gate explicit, including exception owner if the gate cannot be met
