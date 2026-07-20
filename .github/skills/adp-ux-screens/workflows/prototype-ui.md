# Workflow: Prototype UI


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
A prototype that proves the design works — for users and for build.

## Steps
1. **Build the prototype coverage matrix first.** List every Feature Inventory item and required screen/frame. Each row must include feature ID, FR/NFR, API operation, states, permissions, and prototype status.
2. **Lo-fi first.** Wireframes test layout + flow without UI distraction, but must still preserve the coverage matrix.
3. **User test lo-fi** with 3–5 representative users. Iterate. New findings that add scope must be marked as `proposed` and routed back to product/architecture.
4. **Hi-fi after lo-fi clears.** Use the AD Ports design system — components, tokens, patterns.
5. **All states rendered.** Empty, loading, error, success, unauthorized, and validation states from the API Wiring Map — for every screen.
6. **RTL + dark mode** versions of any non-trivial screen.
7. **Responsive.** At least: mobile (375), tablet (768), desktop (1280). Show all three for navigation-affecting screens.
8. **Spec for handoff.** Spacing, type, color tokens, interaction notes, micro-copy, API-backed field labels, DTO references, and error-state mapping.
9. **Lock the file.** A "handed-off" frame shouldn't change without a comms note to engineering.

## Anti-patterns
- Hi-fi straight from idea (waste — user tests will move things).
- Custom components when the DS has one.
- Empty/loading/error left to engineering to invent.
- Prototype frames that do not match the Feature Inventory and API Wiring Map.
- UX-only fields, statuses, filters, actions, or reports that are not marked as proposed scope.

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
- [ ] Lo-fi tested with users + iterated
- [ ] Prototype coverage matrix matches Feature Inventory and API Wiring Map
- [ ] Hi-fi using DS only
- [ ] All states rendered
- [ ] RTL + responsive verified
- [ ] Handoff frame locked + linked from FR/NFR and frontend architecture artifacts
