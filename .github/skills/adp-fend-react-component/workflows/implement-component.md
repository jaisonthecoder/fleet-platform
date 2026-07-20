# Workflow: Implement Component (React)

**Scope:** a single component's contract — props, states, interaction, a11y, RTL. For feature-level concerns (code-split, bundle, perf, telemetry) use `workflows/harden-feature.md`.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] The UX spec, ACs, and relevant design-system component are identified.
- [ ] The component's user decision/action and acceptance state are known; decorative or speculative components are out of scope.
- [ ] The component's feature module is known (where it will live).
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/ui-primitives.md` — **read first.** Confirm which `@shared/ui/` primitives this component composes; never re-implement.
- `references/react-architecture.md` — Components, Component Responsibility, Forms, UI states.
- `references/i18n-and-locale.md` — RTL, locale-aware formatting, GCC working week (when the component renders dates/times/numbers).
- `references/react-craft.md` — props design, list keys, `useId`, refs/forwardRef, portals, composition patterns.
- `references/frontend-security.md` — read before using `dangerouslySetInnerHTML`, rendering URLs from user input, or embedding third-party widgets.

## Goal
A component that matches the UX spec, behaves correctly across every state, is accessible, and works in both locales and directions.

## Steps
1. **Compose from `@shared/ui/`.** Identify which primitives (`Button`, `Dialog`, `Input`, `Select`, ...) the component is built from. If the design needs a primitive that doesn't exist, **add a variant to the existing primitive** in `@shared/ui/` (or vendor a new shadcn primitive if absent) — never write a parallel one in the feature. See `references/ui-primitives.md`.
2. **Use `<Icon />` for every icon.** From `@shared/ui/icon`. Never `import { X } from 'lucide-react'`. Add new names to the icon registry as needed.
3. **Type the props.** Strict; no `any`. Prefer discriminated unions over optional flags. Distinguish required vs optional explicitly.
4. **Render every state.** Empty, loading, error, success, unauthorized (when applicable), disabled/submitting. None are optional. Use the shared `<EmptyState>` / `<LoadingState>` / `<ErrorState>` primitives — do not roll new ones per feature.
5. **Form behavior (if a form).** Use shadcn `<Form>` + `<FormField>` over react-hook-form, with a zod schema. Validate on blur or submit. Errors inline at the field and in a summary at the top. Map server validation errors via `setError`. Disable submit during mutation; preserve input on recoverable failures.
6. **Keyboard + focus.** Tab order matches visual order. `Esc` closes modals. Focus trap in dialogs. Visible `focus-visible` styles on every interactive element. Restore focus on close.
7. **A11y attributes.** Semantic HTML first; ARIA only where semantics aren't enough. Labels associated with inputs (`<label htmlFor>` or `aria-labelledby`). Live regions for async updates.
8. **Responsive.** Mobile-first. Test at agreed breakpoints. No horizontal scroll at mobile widths.
9. **Animation.** Respect `prefers-reduced-motion`. Do not block input during animation.
10. **RTL and locale.** Use Tailwind logical properties (`ms-*` / `me-*` / `ps-*` / `pe-*` / `start-*` / `end-*`). Never `ml-*` / `mr-*` / `left-*` / `right-*`. Mirror direction-sensitive icons via `<Icon mirrorInRTL />`. Set `dir="auto"` on free-text inputs. Verify in both `en` and `ar`.
11. **Dark mode** verified for the component if the app supports it.
12. **Security sanity.** No `dangerouslySetInnerHTML` from untrusted input. No user-controlled `href`/`src` without `safeHref`-style validation.

## Anti-patterns

See `references/anti-patterns.md` §Reuse violations, §Components, and §i18n / RTL for the canonical lists. The most-common ones in this workflow:

- **Building a parallel primitive in the feature** instead of importing from `@shared/ui/` — see SKILL.md ⛔ Reuse, do not recreate.
- **`import { X } from 'lucide-react'`** inside a feature instead of `<Icon name="..." />`.
- **`<div onClick>`** instead of `<button>` / `<a>`.
- **Hard-coded English strings**; inline validator error strings instead of the central `validationMessage` helper.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Test evidence (axe, keyboard walk-through, RTL screenshot) is captured.
- [ ] Open UX questions are explicit.
- [ ] QA and Reviewer handoff is prepared.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done
- [ ] Component behavior traces to a user goal and acceptance state.
- [ ] Built from `@shared/ui/` primitives; no parallel primitives created in the feature. Any missing variant was added to the shared primitive, not forked.
- [ ] All icons rendered via `<Icon />`; no direct `lucide-react` imports.
- [ ] Empty / loading / error / success / disabled states rendered (using `<EmptyState>` / `<LoadingState>` / `<ErrorState>`).
- [ ] Keyboard-navigable end to end; focus trap where appropriate.
- [ ] axe check passes with zero violations on the component.
- [ ] Verified in both `en` (LTR) and `ar` (RTL); no hard-coded strings.
- [ ] Dark mode verified if the app supports it.
- [ ] No `any`; props typed with discriminated unions where appropriate.
- [ ] No `dangerouslySetInnerHTML` on untrusted input.
