# Workflow: Define UI Behavior


## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see above) and can state it in one sentence.
- [ ] The **inputs** listed in Steps are available (FR/NFR, Feature Inventory, API Wiring Map, UX Traceability Contract, ACs, design, data, access, credentials — whichever apply).
- [ ] You know **who the output is for** (which downstream role or stakeholder consumes it).
- [ ] The **target file / destination** is decided (path, repo, board, ticket).
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Any relevant AD Ports standard in `/standards/` has been skimmed.

If you are missing inputs, write a short "waiting on" note and stop. Do not invent inputs.

## Goal
Interaction specs precise enough that two engineers building the same screen produce the same result.

## Steps
1. **Lock traceability first.** For every screen or frame, record `screen/frame -> feature ID -> FR/NFR -> API operation -> UI states -> permissions`. If the screen adds something not in the Feature Inventory or API Wiring Map, mark it as `proposed`; if an inventory item has no screen, mark it as a design gap.
2. **Bind displayed data to API wiring.** For every API-backed field, action, table column, badge, and status, reference the operation/DTO/error state from the API Wiring Map. Do not create placeholder fields that engineering must interpret later.
3. **Per interactive element specify:**
   - Validation: when (blur/submit), what message, where it appears.
   - Keyboard: tab order, shortcuts, Enter/Esc behavior.
   - Focus: where it goes after action.
   - States: default / hover / active / focus / disabled / loading / error.
   - Touch targets: min 44×44 dp.
4. **Animation.** Duration, easing, what triggers it. Honor `prefers-reduced-motion`.
5. **Responsive rules.** Breakpoints + what changes at each.
6. **Micro-copy.** Buttons, errors, empty states, tooltips. Written, not left as a placeholder.
7. **Localization.** Verify pluralization + RTL impact.
8. **Tokens, not hex.** Color/spacing/type by token name.

## Anti-patterns
- "Make it feel snappy" — not a spec.
- Different validation timing across forms in the same product.
- Micro-copy left to the developer.
- Screens or fields that cannot be traced to a feature ID, FR/NFR, and API operation.
- Mocked data that does not match the API Wiring Map.

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
- [ ] Every interactive element fully specced
- [ ] Every screen/frame maps to feature ID, FR/NFR, API operation, states, and permissions
- [ ] Any extra UX idea is marked as proposed, and any missing feature is marked as a design gap
- [ ] Animation + reduced-motion specified
- [ ] Micro-copy written + localized
- [ ] Tokens (no raw colors/sizes)
