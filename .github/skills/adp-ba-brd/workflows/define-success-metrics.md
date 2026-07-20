# Workflow: Define Business Success Metrics


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (business outcome, sponsor agreement, baseline report, metric owner, target timeframe - whichever apply).
- [ ] You know **who the output is for** (`ai-business-analyst`, `ai-product-manager`, sponsor, or another named stakeholder).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] If writing to a repository, you are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Turn vague business goals into metrics that can be measured before and after the initiative to prove value.

## Steps

1. **Anchor to the business outcome.** Every metric must map to one of: revenue, cost, risk, compliance, or customer experience. If it doesn't, challenge whether it matters.

2. **For each metric, capture the exact BRD template fields:**
   - Linked objective (`OBJ-###`)
   - Name (e.g. "Vessel berth turnaround time")
   - Definition embedded in the metric wording where useful (precise: "time from pilot boarding to first line ashore, in minutes")
   - Current baseline (with date and source)
   - Target
   - Timeframe
   - Owner (who reports it)
   - Source/evidence in Annex B or Drivers for Change, without adding columns to the success-metrics table

3. **Leading vs lagging.** Consider at least one leading indicator the team can influence week-to-week plus the lagging outcome metric, but do not add metric-type columns to the BRD template.

4. **Counter-metrics.** Consider guardrails so the team does not game the system (e.g. reducing AHT should not tank CSAT). If a guardrail must be captured in the BRD, add it as its own `M-###` row using the same exact template columns.

5. **Review with sponsor.** Metrics are a commitment — do not finalize without the sponsor's explicit agreement.

## Anti-patterns

- Vanity metrics (logins, page views) unless tied to a business outcome.
- Metrics with no baseline — you can't prove improvement.
- One metric only — improvement in one dimension almost always costs another.

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The artifact is saved at its documented path and committed (or linked from the ticket/board).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): `ai-product-manager`, `ai-solution-architect`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

If you changed repository files, run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Every metric maps to revenue, cost, risk, compliance, or CX
- [ ] Each metric uses the exact BRD template columns: Metric ID, Linked Objective, Metric, Baseline, Target, Timeframe, Owner
- [ ] At least one leading indicator + one lagging outcome metric
- [ ] Counter-metric / guardrail considered and, when needed, represented as its own metric row without adding columns
- [ ] Sponsor sign-off captured
- [ ] Metrics committed at the agreed path and linked from the BRD
