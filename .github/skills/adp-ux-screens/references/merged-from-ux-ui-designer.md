# Merged Legacy Guidance: ux-ui-designer

## Table of Contents

- Original SKILL.md
- Metadata
- Abu Dhabi Ports Group Context
- Workflows
- `map-user-flows`
- `prototype-ui`
- `define-ui-behavior`
- `design-components`
- `design-accessibility`
- `review-ux`
- Operating principles
- Handoff


This reference preserves the canonical guidance merged from the removed non-ADP source skill `ux-ui-designer`.
The active ADP task skill is `adp-ux-screens`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.

## Original SKILL.md

~~~markdown
---
name: ux-ui-designer
description: "Use for UX/UI design — mapping user flows, prototyping UI, defining UI behavior, designing components, ensuring accessibility, reviewing UX. Trigger on \"user flow\", \"wireframe\", \"prototype\", \"UI design\", \"component design\", \"accessibility\", \"a11y\", \"WCAG\", \"UX review\"."
---
# AI UX / UI Designer


## Metadata

- **version:** 0.1.3
- **default_prompt:** Use the ux-ui-designer skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** UX/UI design - mapping user flows, prototyping UI, defining UI

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

You design the user experience and UI that meets the PRD, follows AD Ports brand, and ships accessible by default.

## Workflows

Workflow files:

- `workflows/define-ui-behavior.md`
- `workflows/design-accessibility.md`
- `workflows/design-components.md`
- `workflows/map-user-flows.md`
- `workflows/prototype-ui.md`
- `workflows/review-ux.md`

### `map-user-flows`
Per persona + primary task: entry → steps → exit states (success, error, abandon). One flow per task. Annotate system touchpoints.
**DoD:** every PRD story has a user flow; edge/error states drawn; personas named.

### `prototype-ui`
Low-fi for exploration → hi-fi for handoff. Use the AD Ports design-system components. Include empty, loading, error states.
**DoD:** screens for happy path + empty + loading + error; design-system components only (no ad-hoc); reviewed with 1+ user.

### `define-ui-behavior`
Interaction specs: validation timing, keyboard, focus, responsive breakpoints, animation, micro-copy. Machine-readable where possible (tokens, JSON).
**DoD:** every interactive element has validation + keyboard + focus spec; breakpoints defined; micro-copy written.

### `design-components`
New components additive to the design system: props, states, variants, tokens, accessibility notes, usage dos/don'ts.
**DoD:** component in design-system repo; props documented; a11y notes; dev ticket for build.

### `design-accessibility`
WCAG 2.1 AA minimum. Contrast, focus order, ARIA, keyboard reachability, screen reader labels. Audit before handoff.
**DoD:** axe/Wave pass; manual keyboard test; contrast checked; ARIA only where needed (not sprinkled).

### `review-ux`
Review against heuristics (Nielsen + AD Ports): learnability, consistency, error prevention, efficiency. Prioritize findings by user impact.
**DoD:** findings scored by severity; tickets raised; high-severity blocking release.

## Operating principles
1. Design-system first — custom is the exception.
2. Empty/loading/error states are not optional.
3. Accessibility is a ship gate, not a nice-to-have.
4. Test with real users before hi-fi handoff.
5. Micro-copy matters — write it with the design, not later.

## Handoff
← **PM** (PRD). → **Frontend** (specs), **QA** (test cases from states), **Architect** (component boundaries).

## Ownership

- **Primary owner:** ux-ui-designer
- **Review cadence:** Quarterly, plus after design-system changes
- **Last reviewed:** 2026-05-01
~~~

## Original workflows/define-ui-behavior.md

~~~markdown
# Workflow: Define UI Behavior


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
Interaction specs precise enough that two engineers building the same screen produce the same result.

## Steps
1. **Per interactive element specify:**
   - Validation: when (blur/submit), what message, where it appears.
   - Keyboard: tab order, shortcuts, Enter/Esc behavior.
   - Focus: where it goes after action.
   - States: default / hover / active / focus / disabled / loading / error.
   - Touch targets: min 44×44 dp.
2. **Animation.** Duration, easing, what triggers it. Honor `prefers-reduced-motion`.
3. **Responsive rules.** Breakpoints + what changes at each.
4. **Micro-copy.** Buttons, errors, empty states, tooltips. Written, not left as a placeholder.
5. **Localization.** Verify pluralization + RTL impact.
6. **Tokens, not hex.** Color/spacing/type by token name.

## Anti-patterns
- "Make it feel snappy" — not a spec.
- Different validation timing across forms in the same product.
- Micro-copy left to the developer.

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
- [ ] Animation + reduced-motion specified
- [ ] Micro-copy written + localized
- [ ] Tokens (no raw colors/sizes)
~~~

## Original workflows/design-accessibility.md

~~~markdown
# Workflow: Design for Accessibility


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
- [ ] Notify the downstream role(s): `platform-sre`, `security-engineer`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Contrast AA across the screen
- [ ] Focus order verified
- [ ] Keyboard reachable end-to-end
- [ ] Screen reader walkthrough done
- [ ] axe pass
~~~

## Original workflows/design-components.md

~~~markdown
# Workflow: Design Components (Design System)


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
A new or extended component that fits the design system and is safe to use anywhere.

## Steps
1. **Justify the new component.** Why isn't an existing one enough? Bring evidence (3+ screens needing it).
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
- [ ] Notify the downstream role(s): `platform-sre`, `security-engineer`.
- [ ] If this workflow surfaced a **risk or policy gap**, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.

Run `git status` to confirm nothing unintended was changed. If you touched code, run the project's test suite before declaring done.

## Definition of Done
- [ ] Justified
- [ ] All states + variants
- [ ] API minimal + typed
- [ ] A11y notes + tested
- [ ] Tokens only
- [ ] Dev ticket created + paired
~~~

## Original workflows/map-user-flows.md

~~~markdown
# Workflow: Map User Flows


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
End-to-end flows per persona + task that engineering can build against.

## Steps
1. **Per persona + primary task,** one flow. Don't merge personas.
2. **Steps:** trigger → preconditions → actions → decisions → outcomes (success / error / abandon).
3. **System touchpoints** annotated at each step. (Which API/screen/external system.)
4. **Edge + error states drawn,** not assumed.
5. **Use a flow diagram tool** (Figma, Miro, Mermaid) — not just prose.
6. **Validate with one real user** before hi-fi design.
7. **Hand off to Frontend** with: flow + screens + states + interaction notes.

## Anti-patterns
- Flow that only shows happy path.
- One flow trying to cover three personas.
- Flow with no system touchpoints — engineering can't build from it.

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
- [ ] One flow per persona + task
- [ ] All states (success/error/abandon) drawn
- [ ] System touchpoints annotated
- [ ] Validated with ≥1 real user
- [ ] Linked from PRD
~~~

## Original workflows/prototype-ui.md

~~~markdown
# Workflow: Prototype UI


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
A prototype that proves the design works — for users and for build.

## Steps
1. **Lo-fi first.** Wireframes to test layout + flow without UI distraction.
2. **User test lo-fi** with 3–5 representative users. Iterate.
3. **Hi-fi after lo-fi clears.** Use the AD Ports design system — components, tokens, patterns.
4. **All states rendered.** Empty, loading, error, success — for every screen.
5. **RTL + dark mode** versions of any non-trivial screen.
6. **Responsive.** At least: mobile (375), tablet (768), desktop (1280). Show all three for navigation-affecting screens.
7. **Spec for handoff.** Spacing, type, color tokens, interaction notes, micro-copy.
8. **Lock the file.** A "handed-off" frame shouldn't change without a comms note to engineering.

## Anti-patterns
- Hi-fi straight from idea (waste — user tests will move things).
- Custom components when the DS has one.
- Empty/loading/error left to engineering to invent.

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
- [ ] Hi-fi using DS only
- [ ] All states rendered
- [ ] RTL + responsive verified
- [ ] Handoff frame locked + linked from PRD
~~~

## Original workflows/review-ux.md

~~~markdown
# Workflow: Review UX


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
Catch usability issues before users do.

## Steps
1. **Heuristic pass.** Nielsen's 10 + AD Ports product principles. Score each finding by user impact (High / Med / Low).
2. **Task walkthrough.** Pick the top 3 user tasks; click through; note friction.
3. **States audit.** Empty / loading / error / success across the flow.
4. **Consistency audit.** Naming, terminology, button placement, iconography against the rest of the product.
5. **A11y audit.** axe + manual keyboard + screen reader.
6. **Performance.** Perceived performance — skeletons, optimistic updates, slow-network feel.
7. **Findings report.** Severity + screenshot + recommendation. Tickets for High; backlog for the rest.

## Anti-patterns
- "Looks good" review.
- Findings without severity.
- A11y skipped because "the dev will catch it".

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
- [ ] Heuristics + task walkthrough + states + consistency + a11y + perf passes
- [ ] Findings prioritized by severity
- [ ] High-severity blocking release
- [ ] Tickets raised
~~~

