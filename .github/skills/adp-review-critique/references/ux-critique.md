# UX Critique Reference

Use this reference only with `workflows/review-ux-critique.md`.

## Severity

- **P0 / Blocking:** Users cannot complete the primary task, a legal/accessibility gate fails, or the design creates an unsafe operational or data-risk outcome.
- **P1 / Strong:** Major friction, unclear decision, missing state, or design-system deviation likely to cause rework or failed QA.
- **P2 / Should-fix:** Noticeable usability, hierarchy, consistency, or microcopy issue that hurts quality but does not block delivery.
- **P3 / Advisory:** Polish, preference, or future improvement with low delivery risk.

## Evidence Package

Every critique should include:

- Artifact path, live URL, screenshot, commit, or design link reviewed.
- Source request, PRD, acceptance criteria, persona, or design goal used.
- Standards checked and AD Ports edge considered.
- Tooling used, command output, screenshots, or the reason a tool was not run.
- Assumptions, open questions, risks, owners, and downstream role.

## Tool Dependency Policy

`npx impeccable`, browser overlays, screenshots, accessibility scanners, and subagents are optional evidence helpers. They improve confidence but do not replace reviewer judgment.

- If a detector is installed, run it on markup files and include counts, locations, and false positives.
- If the target is only a URL, use browser inspection when available; otherwise record that live automation was unavailable.
- If a directory has more than 200 scannable files, narrow the scope or use `--fast`.
- Missing optional tooling is not a blocker. Missing artifact, primary task, or design goal can be a blocker.

## Heuristic Scoring

Score Nielsen's 10 heuristics from 0-4:

| Score | Meaning |
|---|---|
| 0 | Missing or actively harmful |
| 1 | Serious weakness |
| 2 | Basic coverage with meaningful gaps |
| 3 | Solid with minor issues |
| 4 | Excellent and evidenced |

Report the total out of 40. Most real interfaces land between 20 and 32.

## Cognitive Load Checks

- Primary action is visible without searching.
- Related controls are grouped and labeled.
- Decision points have four or fewer peer options unless grouping or search exists.
- Progressive disclosure hides advanced settings until needed.
- Empty, loading, error, and success states reduce uncertainty.
- Copy uses the user's language, not implementation language.
- Navigation makes location and next step obvious.
- The user can recover from mistakes without support.

## Persona Selection

Pick 2-3 personas that fit the product and task:

- **Operations power user:** Needs speed, dense scanning, keyboard support, and low interruption.
- **First-time external user:** Needs clear labels, onboarding through the task, and plain-language errors.
- **Arabic/RTL user:** Needs mirrored layout, readable Arabic copy, correct number/date handling, and non-icon-only cues.
- **Field/mobile user:** Needs large hit targets, resilient connectivity states, offline/retry clarity, and readable outdoor contrast.
- **Supervisor/approver:** Needs queue clarity, audit trail, confidence before approval, and reversible actions where possible.

For each persona, walk through the primary task and name exact UI breakpoints.

## Report Shape

Use this structure when the user asks for a full critique:

1. Design health score with Nielsen table.
2. Anti-pattern verdict, including detector results when available.
3. Overall impression and the single biggest opportunity.
4. What works.
5. Priority findings with severity, evidence, fix, owner, and downstream role.
6. Persona red flags.
7. Minor observations.
8. Assumptions, open questions, and final decision.
