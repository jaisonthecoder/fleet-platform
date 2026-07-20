# Workflow: Harden Feature (React)

**Scope:** production-quality feature — composition, code-split, bundle, perf, telemetry, error reporting. For a single component's contract use `workflows/implement-component.md`.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] ACs, design, API contract, route plan, and state / feature-hook plan are available.
- [ ] The production hardening target is tied to a business-critical journey, release risk, or measurable NFR.
- [ ] Target files and feature-module boundaries are clear.
- [ ] Existing lint, typecheck, build, test, and bundle-size commands are known.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/react-architecture.md` — Feature Module Structure, Component Responsibility, Feature Hooks, **Rendering and Performance** (budget + defaults), smells to correct.
- `references/frontend-security.md` — read before using `dangerouslySetInnerHTML`, adding third-party scripts, or wiring telemetry.

## Goal
A production-quality feature module: small focused components, lazy-loaded, within perf budget, with telemetry and error reporting wired.

## Steps
1. **Build inside the module.** All feature work lives under `features/<feature>/`. Expose only the page(s), feature hook, and public types via `index.ts`. Do not import internal feature files from outside.
2. **Compose, don't drill.** Lift state only as far as needed; pass via composition (`children`, slots) or feature-scoped context. Avoid prop drilling > 2 levels; when you hit it, introduce the feature hook or a context provider.
3. **Keep components focused.** One responsibility per component. Split when unrelated state branches multiply, not by line count. Page components coordinate the feature hook + layout; feature components render UI and raise callbacks.
4. **Code-split at route boundaries.** `React.lazy` + `Suspense` or route `lazy` imports. Verify chunk split in the production build output.
5. **Bundle hygiene.** Track size in CI with `size-limit` (or equivalent). Fail on regressions beyond the project budget. Tree-shake; avoid full-library imports (`import { format } from 'date-fns'`, not `import * as DateFns`).
6. **Image strategy.** Responsive `srcset`, modern formats (AVIF/WebP), lazy below the fold. Use the DS image component.
7. **Memoize only with profiler evidence.** Open React DevTools Profiler on the changed page; identify any component flame-graph stripe > 16ms. Memoize only those components or values, and **record the before/after timing in the PR description**. New `useMemo` / `useCallback` / `React.memo` without recorded evidence is rejected at review. Rule and worked examples: `references/react-craft.md` §Memoization.
8. **Telemetry.** Page views and key user actions to the agreed analytics sink. PII-free — names, emails, tokens, addresses must not be sent. See `references/frontend-security.md` §Telemetry and Error Reporting.
9. **Error reporting.** Uncaught errors → Sentry (or equivalent) with release and anonymized user context. Configure `beforeSend` to strip query strings, bodies, and cookies.
10. **Run local checks.** Format, lint, typecheck, build, and targeted tests.
11. **Measure performance.** Run the project's bundle-size check and Lighthouse (or the team's agreed perf measurement) on the changed screens. Record before/after numbers in the PR. If either regresses beyond the budget, fix before merging.

## Anti-patterns

See `references/anti-patterns.md` §Performance, §Reuse violations, and §Security for the canonical lists. The hardening-phase traps:

- **Importing entire date / util libraries** for one function — tree-shake instead.
- **Lighthouse or bundle-size run only locally**, never in CI.
- **Memoization sprinkled without a profiler-identified hotspot.**
- **Logging PII or raw error bodies** to analytics / Sentry.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Evidence from checks (bundle diff, Lighthouse numbers) is captured in the PR.
- [ ] Assumptions and UX/API gaps are explicit.
- [ ] QA, Reviewer, and Security handoff is prepared.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## First-PR self-review checklist

Run through this before requesting review. Fixing these yourself is faster than a reviewer catching them.

### Top 5 — most-rejected violations

If you check nothing else, check these. Each catches a class of mistake reviewers reject on sight:

- [ ] **No parallel UI primitives.** Every `<Button>` / `<Dialog>` / `<Input>` / etc. is from `@shared/ui/`. No `MyButton.tsx`, no styled `<div role="button">`.
- [ ] **No `import { X } from 'lucide-react'`** inside a feature — every icon is `<Icon name="..." />`.
- [ ] **No data fetching in `useEffect`** — server state is TanStack Query.
- [ ] **No hard-coded user-visible strings** — every `>Text<` in JSX goes through `t()`.
- [ ] **No physical-direction Tailwind classes** (`ml-*`, `mr-*`, `left-*`, `right-*`) on layout-affecting elements — use logical properties.

The rest of the sections expand on these and add more.

### Reuse, do not recreate (hardest rule)
- [ ] Every UI primitive (`Button`, `Dialog`, `Input`, `Select`, `Popover`, `Tabs`, `Tooltip`, ...) is imported from `@shared/ui/`. No parallel primitives created in features.
- [ ] Every icon is `<Icon name="..." />` from `@shared/ui/icon`. No `import { X } from 'lucide-react'` inside features.
- [ ] No hand-rolled controlled inputs — forms go through shadcn `<Form>` + `<FormField>` + react-hook-form + zod.
- [ ] No raw `fetch` / `axios` in features — HTTP goes through the shared client + the feature's `api/<feature>.client.ts`.
- [ ] Reusable hooks searched in `@shared/hooks/` and the feature's `hooks/ui/` before writing new ones.
- [ ] If a primitive variant was missing, the shared primitive was edited (with a `// AD Ports edit:` marker), not forked.

### Code shape
- [ ] No `any`; `unknown` narrowed at boundaries with zod.
- [ ] No wildcard exports; feature `index.ts` exports only the public surface.
- [ ] No deep imports across features (`@features/other/hooks/queries/...`).
- [ ] No inline query keys (`['vessels', id]`) — all keys go through the feature's `query-keys.ts`.
- [ ] No `useEffect` + `useState` for data fetching.
- [ ] No hard-coded user-visible strings; all text goes through `t()`.
- [ ] No physical-direction CSS (`ml-*`, `mr-*`, `left-*`, `right-*`); use logical properties.
- [ ] No `dangerouslySetInnerHTML` on untrusted input; sanitized via DOMPurify if required.
- [ ] Every list render has a `key={item.id}` — not `key={index}`.
- [ ] Every `useEffect` with a subscription/timer/abort has a cleanup function.

### Behavior
- [ ] Empty, loading, error, and success states all render.
- [ ] Forms: server validation mapped to fields; submit disabled during mutation; input preserved on recoverable failure.
- [ ] Keyboard flow verified; focus trap in dialogs; focus restored on close.
- [ ] `axe` passes with zero violations on changed screens.
- [ ] Verified in both `en` (LTR) and `ar` (RTL).

### Performance
- [ ] Feature routes are lazy-loaded; chunk split verified in the build output.
- [ ] Bundle size diff recorded in the PR; within the project's budget.
- [ ] Lighthouse score on changed screens recorded in the PR.
- [ ] No memoization added without a profiler-identified hotspot.

### Tests and CI
- [ ] `typecheck`, `lint`, `test`, `build` all pass locally.
- [ ] MSW handlers added or updated for any new endpoint.
- [ ] New feature hook has a `renderHook` test exercising its public return shape.
- [ ] No `eslint-disable` without an inline comment explaining why.

## Definition of Done
- [ ] Hardening evidence maps to business-critical journey, release risk, or NFR.
- [ ] **No parallel primitives created.** All UI primitives imported from `@shared/ui/`; all icons through `<Icon />`; HTTP through shared client; forms via shadcn `<Form>` + react-hook-form. (See SKILL.md ⛔ Reuse, do not recreate.)
- [ ] Each component has a single responsibility; components with multiple unrelated state branches or UI regions are split.
- [ ] Feature module's public surface (`index.ts`) exposes only intended exports.
- [ ] Feature routes are lazy-loaded; chunks verified in build output.
- [ ] Initial bundle did not regress beyond the project budget (record before/after in the PR).
- [ ] Lighthouse performance score meets the project target on the changed screens, or matches/beats pre-change when no target exists. **Defaults (override per project):** Lighthouse ≥ 80, LCP ≤ 2.5s, CLS ≤ 0.1, TBT ≤ 200ms.
- [ ] Telemetry and error reporting wired; no PII sent.
- [ ] Lint, typecheck, build, and relevant tests pass.
