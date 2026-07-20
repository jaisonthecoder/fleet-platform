# Workflow: Plan Feature (React)

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] UX flows, ACs, API contract, auth rules, and design-system guidance are available.
- [ ] User goal, persona, business process, and owning PM/UX source are known; if missing, route back before designing structure.
- [ ] The target file or destination is decided.
- [ ] Downstream QA/Reviewer expectations are known.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/react-architecture.md` — **Feature Module Structure**, routing, **Feature Hooks**, **Reactivity and State**, HTTP integration, forms, **UI states**.
- `references/i18n-and-locale.md` — translation library choice, RTL, date/time/timezone, GCC working week.
- `references/ui-primitives.md` — shadcn/ui + Lucide standard. **Read before naming any component.**
- `references/forms-patterns.md` — when the design includes a non-trivial form.
- `references/data-table.md` — when the design includes a data table.
- `references/frontend-security.md` — route guards, auth flows, token storage, credentials/CSRF, untrusted content.

## Goal
A feature-module React design that scales to many features and many devs, and is ready to implement.

> **plan-feature vs start-new-feature** — `plan-feature.md` is the **decisions phase**: state by kind, feature-hook decision, i18n choice, primitives identified. It produces no files. Use it for any new feature. `start-new-feature.md` is the **scaffolding phase**: it creates the folder, writes the public surface, and wires routes — it assumes the design from this file. Plan first, then start.

## Steps

1. **Feature module boundaries.** Per `references/react-architecture.md` §Feature Module Structure. Cross-feature imports go through each module's `index.ts` or `src/shared/`.
2. **Routing.** Per `references/react-architecture.md` §Routing. Each feature owns a `<feature>.routes.tsx`; the top-level router composes. Lazy-load, route-level auth guard, per-feature error boundary.
3. **State by kind.** Per `references/react-architecture.md` §Reactivity and State. Pick the tool per kind (local / feature-scoped / app-wide / server / URL); do not mix kinds in one store.
4. **Feature hook.** Decide if the feature warrants a `use<Feature>()` facade composing queries + mutations + local state. Skip when the page is a one-query read with no local state. Rules: `references/react-architecture.md` §Feature Hooks.
5. **API layer.** `features/<feature>/api/` with typed client wrapping the generated OpenAPI client, hierarchical `query-keys.ts`, zod `schemas.ts` validating at the response boundary.
6. **Design system: shadcn/ui + Lucide.** Identify which `@shared/ui/` primitives the design uses; flag any missing variants so the existing primitive can be edited (not forked). Tokens flow through Tailwind theme + CSS variables — never hard-coded. **Re-implementing primitives is a hard violation** — see `references/ui-primitives.md` ⛔.
7. **Accessibility.** Keyboard paths, focus management, ARIA only when semantics aren't enough, color contrast, `prefers-reduced-motion`, screen-reader labels. See `references/react-craft.md` §Accessibility quick-test runbook.
8. **i18n + RTL.** Pick `react-i18next` (default) or `react-intl` (ADR) — not both. Extract all user-visible strings from day one, plan locale-aware formatting and RTL icon mirroring. See `references/i18n-and-locale.md`.

## Anti-patterns

See `references/anti-patterns.md` §Module structure, §State, §Reuse violations, and §i18n / RTL for the canonical lists. The planning-phase traps:

- **Layer-first folders at repo root** (`components/`, `services/`, `models/`) instead of feature modules.
- **Picking a state tool for the whole feature** ("we'll use Zustand") instead of picking per kind.
- **i18n/RTL treated as a post-implementation sweep** — design strings, RTL, and locale-aware formatting in from day one.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Design notes are saved or linked for implementers.
- [ ] Assumptions and open questions are explicit.
- [ ] Backend/API, QA, Reviewer, and Security handoff is prepared.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done
- [ ] Traceability recorded: user goal -> AC -> UI states -> test strategy.
- [ ] Feature module layout documented (folders + public `index.ts`).
- [ ] Route plan with lazy boundaries, guards, and error boundaries.
- [ ] State kinds (local / feature / app / server / URL) are separated and each kind's tool is chosen.
- [ ] Feature hook shape defined, or explicitly skipped with reason.
- [ ] API client, query-keys, and zod schemas planned per feature.
- [ ] UI states and a11y needs captured.
- [ ] i18n library chosen (one, not both); string-extraction plan and RTL/icons approach documented.
- [ ] Design-system primitives identified; missing variants flagged for editing the shared primitive.
- [ ] Test strategy outlined.
