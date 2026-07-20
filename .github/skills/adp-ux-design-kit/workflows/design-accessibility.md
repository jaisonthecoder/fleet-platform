# Workflow: Design for Accessibility


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
Designs that meet WCAG 2.1 AA before they reach engineering.

## Steps
1. **Color contrast.** AA: 4.5:1 text, 3:1 large text + UI components. Check every text-on-background pairing.
2. **Don't rely on color alone.** Status, errors, required fields — pair with icon, text, or pattern.
3. **Focus order.** Matches visual order. Visible focus state on every interactive element (no `outline: none` without replacement).
4. **Keyboard reachability.** Every action available without a mouse. Modals trap focus; Esc closes.
5. **Labels.** Every input has a programmatic label. Placeholder is not a label.
6. **Hit targets.** ≥ 44×44 dp on touch.
7. **Motion + autoplay.** Respect reduced-motion. No autoplay video with sound.
8. **Screen reader pass.** Walk through with VoiceOver/NVDA at design stage. Note announce text.
9. **Audit tools.** axe / Wave / contrast checkers — required before handoff.

## Anti-patterns
- Color-only error states.
- Placeholder-as-label.
- Custom widget without ARIA + keyboard.
- "We'll a11y after launch."

## After you finish
Before you mark this workflow complete, verify the output and set up the handoff.

- [ ] All **Definition of Done** items below are met.
- [ ] The artifact is saved at its documented path and committed (or linked from the ticket/board).
- [ ] A one-paragraph **summary** of what you produced + key decisions is written somewhere the next role can find it (PR description, ticket comment, handoff doc).
- [ ] **Open questions / assumptions** are explicitly listed, not hidden.
- [ ] Notify the downstream role(s): `ai-frontend-react`, `ai-frontend-angular`, `ai-mobile-rn`, `ai-mobile-ios`, `ai-mobile-android`, `ai-mobile-flutter`, `ai-quality-engineer`, or the implementation owner named in the request.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Contrast AA across the screen
- [ ] Focus order verified
- [ ] Keyboard reachable end-to-end
- [ ] Screen reader walkthrough done
- [ ] axe pass
