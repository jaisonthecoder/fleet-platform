# Workflow: Map User Flows


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
End-to-end flows per persona + task that engineering can build against.

## Steps
1. **Per persona + primary task,** one flow. Don't merge personas.
2. **Steps:** trigger → preconditions → actions → decisions → outcomes (success / error / abandon).
3. **System touchpoints** annotated at each step. (Which API/screen/external system.)
4. **Edge + error states drawn,** not assumed.
5. **Use a flow diagram tool** (Mermaid preferred for repository Markdown; Figma or Miro acceptable when linked) — not just prose.
6. **Embed or link a journey diagram** for each material journey, using Mermaid `journey`, Mermaid `flowchart`, or an approved design-board link. Include success, error, and abandon paths when they affect downstream build or test work.
   - For Mermaid diagrams, use parser-safe labels: no semicolons, raw pipes, HTML-like angle brackets, or unmatched brackets/quotes; use ` - ` or `,` instead of `;`.
7. **Validate with one real user** before hi-fi design.
8. **Hand off to Frontend** with: flow + screens + states + interaction notes.

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
- [ ] User journey diagram embedded or linked for each material journey
- [ ] Mermaid journey or flow diagrams use parser-safe labels and parse cleanly
- [ ] All states (success/error/abandon) drawn
- [ ] System touchpoints annotated
- [ ] Validated with ≥1 real user
- [ ] Linked from PRD
