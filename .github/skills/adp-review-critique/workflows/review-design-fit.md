# Workflow: Review Design Fit


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
Confirm a non-code artifact is fit for downstream delivery, with deviations, weak evidence, and risks made explicit before another role builds on it.

## Steps
1. **Identify the artifact owner and decision point.** Confirm whether this is a PRD, UX artifact, LLD, release plan, runbook, or other owned artifact. If ownership is unclear, route to `ai-governance-lead`.
2. **Read source evidence first.** Pull the ticket, PRD, ADR, interview note, incident, telemetry, or previous review that justifies the artifact.
3. **Check standards fit.** Compare the artifact against the closest shared `/standards/` file and the owning skill's quality bar.
4. **Trace claims to evidence.** Flag unsupported requirements, design choices, risks, assumptions, dates, metrics, owners, or approvals.
5. **Check AD Ports edges.** Record whether Arabic/RTL, accessibility, tenant boundaries, UAE data residency, vessel/customs operations, SAP/Oracle windows, or maritime SLAs apply.
6. **Review downstream usability.** Confirm the next role can act without reconstructing intent: required inputs, decisions, open questions, risks, and acceptance criteria are explicit.
7. **Classify findings.** Use Blocking / Strong / Advisory, with location, evidence, owner, suggested fix, and downstream impact.
8. **State the decision.** End with `accepted`, `accepted with follow-ups`, or `rework required`.

## Anti-patterns
- Reviewing from taste or preference instead of source evidence and standards.
- Producing a long critique without owners, severity, or next actions.
- Letting hidden assumptions pass because the prose sounds complete.
- Treating AD Ports operational, regulatory, accessibility, or tenancy checks as optional.
- Asking downstream roles to infer what changed, what is risky, or what remains open.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The artifact is saved at its documented path and committed (or linked from the ticket/board).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): owning artifact role, `ai-quality-engineer`, and any role named in the findings.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Artifact owner and SDLC decision point are clear.
- [ ] Source evidence and applicable standards were checked.
- [ ] AD Ports edges were recorded or ruled out.
- [ ] Findings include severity, location, evidence, owner, and fix.
- [ ] Final decision and downstream handoff are explicit.
