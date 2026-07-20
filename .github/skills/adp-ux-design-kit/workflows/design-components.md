# Workflow: Design Components (Design System)


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
A new or extended component that fits the design system and is safe to use anywhere.

## Steps
1. **Justify the new component.** Why isn't an existing one enough? Prefer evidence from 3+ screens. If fewer screens need it, record the reason it still belongs in the system, such as foundational reuse, accessibility consistency, regulatory need, or planned roadmap reuse.
2. **API.** Props with type + default + required. Avoid boolean explosion — prefer enum-like variants.
3. **States.** Default / hover / focus / active / disabled / loading / error.
4. **Variants.** Sizes, intents (primary/secondary/danger). Show every combination.
5. **Anatomy.** Slots, sub-elements, what's overridable.
6. **A11y notes.** Roles, ARIA, keyboard, focus. Tested with screen reader.
7. **Tokens.** All color/spacing/type via tokens.
8. **Usage.** Do / don't examples. Composition rules.
9. **Engineering ticket** with link to spec; design + dev pair on first build.

## Anti-patterns
- Component with 12 boolean props (combinatorial explosion).
- New component that overlaps an existing one.
- A11y added later.

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
- [ ] Justified, with evidence or an explicit approved exception
- [ ] All states + variants
- [ ] API minimal + typed
- [ ] A11y notes + tested
- [ ] Tokens only
- [ ] Dev ticket created + paired
