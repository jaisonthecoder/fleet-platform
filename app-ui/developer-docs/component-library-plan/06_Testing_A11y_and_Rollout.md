# Phase 6 — Testing, Accessibility & Rollout

> **Goal.** Harden the component library and roll it into the app: a consistent test strategy, an
> accessibility pass, a living **showcase**, and a migration of existing screens onto the new
> components. This phase runs continuously alongside 1–5 and closes the library out.

Prereq: `00_Overview`.

---

## 6.1 Testing strategy (per component)

- **Unit / interaction (Vitest + Testing Library):** render, prop/variant matrix, keyboard path,
  controlled/uncontrolled behaviour, callbacks. For overlays: focus trap + restore, `Esc`.
- **Forms:** validation triggers, error messages, `aria-invalid`, submit gating, RHF + Zod integration.
- **MSW** for any async control (combobox/async select, upload).
- **Do not** snapshot-test styling; assert **behaviour + roles + a11y attributes**.
- Keep the existing coverage gate (lines 70 / branches 60) meaningful as logic grows.
- Verify types with `tsc -b --noEmit` (not just Vitest's lax compile).

## 6.2 Accessibility pass

- Keyboard-only walkthrough of every interactive component; visible `:focus-visible` everywhere.
- Screen-reader smoke test (roles, names, live regions for toasts, `aria-current`, `aria-invalid`).
- Contrast check in **both** themes (text ≥ 4.5:1, large/icons ≥ 3:1).
- Status never colour-alone (icon + label) — audit chips, alerts, toasts, chart legends.
- Charts: confirm each has a semantic table/`figcaption` fallback.
- Optional automated: add `axe` checks (e.g. `vitest-axe` or Playwright + `axe-playwright`) on the showcase.

## 6.3 Showcase (living documentation)

- Extend `/:lang/design` (or add `/:lang/design/components`) to render **every** primitive + pattern +
  chart in all states, both themes, and RTL. This is the manual QA surface and the onboarding doc.
- Group by phase (Feedback, Overlays, Forms, Data, Charts). Include copy-paste usage snippets.
- (Optional) evaluate **Storybook** later; for now the in-app showcase is the source of truth.

## 6.4 Rollout / migration order

1. **Foundations first:** Toaster + `useConfirm` mounted in `AppProviders` (used everywhere).
2. **Booking** screen: swap raw inputs → Form + fields; add consent step (checkbox + confirm), success toast.
3. **Handover & return:** segmented control, slider (fuel), file upload (damage), signature, confirm.
4. **Approval inbox / Entitlement / Fines:** DataTable, StatusChip parity, confirm (approve/decline), tabs.
5. **Policy authoring:** DataTable (decision table), dialogs, form controls.
6. **Executive dashboard / Command console:** KPI cards + charts (Phase 5) + (console) maplibre map.
7. Remove any bespoke one-off markup that a library component now covers.

## 6.5 Definition of Done (library-level)

- [ ] Every planned component exists in `components/ui|patterns|form|charts`, token-skinned, both themes.
- [ ] Showcase renders all of them in all states + RTL; keyboard + SR verified.
- [ ] Tests cover behaviour + a11y attributes; gate green (`tsc`, `oxlint`, `vitest`, `vite build`).
- [ ] `design-system.md` §8/§9 updated with any new pattern; `design-implementation-plan.md` phases ticked.
- [ ] Dependency additions recorded (catalog + lockfile) and reviewed; React-19 compatibility confirmed.
- [ ] Chart ADR merged; each chart has a data contract + semantic fallback.

## 6.6 Guardrails (carry forward)

- Tokens only; borders via `@layer base` token (never unlayered `*{border-color}`).
- Never pass a function `className`/children into a Radix `asChild`/Slot child.
- One font family; logical properties for RTL; i18n for all copy.
- Run tools via `./node_modules/.bin/<tool>`; do not let a stray `pnpm add` rewrite the lockfile.
