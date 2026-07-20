# Workflow: Test Frontend (React)

Authoritative slice-level workflow for unit, component, integration, hook, and end-to-end testing of a React app or feature scaffolded by this skill. The cross-cutting QA workflow [`adp-qa-tests/workflows/test-feature-react.md`](../../adp-qa-tests/workflows/test-feature-react.md) owns the final test-evidence handoff; this workflow governs what the React engineer authors before that handoff.

## Position in the chain

- **Pairs with:** [`shadcn-build-showcase`](shadcn-build-showcase.md) and feature implementation — runs alongside the build, not after.
- **Inputs from:** approved React architecture and LLD (`adp-fend-react-architecture`), API contract (OpenAPI), UX handoff, and the change's risk areas.
- **Successor:** handoff to `ai-quality-engineer` via [`adp-qa-tests/workflows/test-feature-react.md`](../../adp-qa-tests/workflows/test-feature-react.md), then `ai-reviewer` (gate).

## Before you start

- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md`; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`.
- [ ] You can state the workflow goal in one sentence.
- [ ] ACs, changed components/hooks/forms/routes, and risk areas are known.
- [ ] Project test tools and CI commands are known.
- [ ] MSW handlers or fixtures aligned to the OpenAPI contract are available.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References

- [`../references/testing.md`](../references/testing.md) — **authoritative source** for tool-per-layer choices, what to test per kind, RTL patterns, hook testing with `renderHook`, TanStack Query / Zustand / reducer patterns, MSW handler policy, and coverage floor.
- A frontend-security references file (when added to the repo) for tests touching auth, fetchers, sanitization, or token storage. Today, lean on `adp-sec-checkmarx/references/typescript-secure-patterns.md` for the equivalent shift-left guidance.

## Categorisation of tests

The React test pyramid for AD Ports apps:

| Category | Scope | Default tool | What you test |
|---|---|---|---|
| **Unit** | Single function / pure module | Vitest (preferred) or Jest | Pure utils, error mappers, form schemas (Zod/Yup), reducers, Zustand store factories |
| **Component** | One component rendered in isolation | React Testing Library | DOM behavior, props contract, accessibility, conditional rendering, form interaction |
| **Hook** | Custom hook or feature hook in isolation | `renderHook` + provider wrapper | Returned `{ data, isLoading, error }` shape, action callbacks, refetch/mutation behavior |
| **Integration** | Component + hooks + router + MSW | RTL + `renderWithProviders` + MSW | Route loaders/actions, form submission against MSW, store-to-view binding, interceptor behavior |
| **Contract** | Frontend code against the OpenAPI contract | MSW handlers seeded from spec | Request/response shape, status codes, error envelopes |
| **End-to-end (E2E)** | Real browser, real or UAT-like backend | Playwright | Top user journeys, tenancy isolation, `en`/`ar` parity, login + critical flow |
| **Accessibility** | Component or screen | `jest-axe` / `vitest-axe` for components, `axe-playwright` for screens | WCAG 2.2 AA, focus order, labels, contrast |

## Goal

Behavior-focused tests that catch regressions without coupling to implementation details, organized by the categories above.

## Steps

1. **Map ACs to tests by category.** For each AC decide which categories must hold. Name tests after observable behavior, not implementation.
2. **Author unit tests** for pure utils, error mappers, form schemas (Zod/Yup), reducers, and Zustand store factories. Reducers and store factories should run as pure modules — no React render needed.
3. **Author component tests** with React Testing Library. Query by role/label/text users perceive — not `data-testid`, not internal state. Use `userEvent`, not `fireEvent`.
4. **Author hook tests** with `renderHook` wrapped in the feature's providers (QueryClient with `retry: false`, router, i18n) via a small `renderWithProviders` helper. Drive inputs by calling returned actions; assert on the returned `{ data, isLoading, error }` shape — not on internal TanStack Query state.
5. **Author integration tests** that exercise routes, loaders/actions, forms, and feature hooks together against MSW. Do not `vi.mock` the HTTP client; let MSW handle it.
6. **Test forms deeply.** Required / format / range / cross-field / async validators, server error mapping, disabled state, submit behavior.
7. **Test state stores directly when warranted.**
   - **Zustand store** — export a factory (`createBookingStore`) so each test gets a fresh instance; never share a singleton across tests. Drive via `store.getState().action(...)` and assert on `store.getState()`.
   - **Context + reducer** — test the reducer as a pure function. Use `renderWithProviders` only when the test asserts the full Provider → consumer dispatch flow.
   - **Wizard step transitions** — test the transition graph as reducer cases.
8. **Add contract checks.** MSW handlers are seeded from the OpenAPI spec; the same handler set powers `dev` and `test`.
9. **Add E2E journey tests.** Playwright for the top user journeys per persona. Cover tenancy isolation, `en`/`ar` parity, Asia/Dubai timezone where the flow depends on time. One E2E tool per app.
10. **Cover accessibility.** `jest-axe`/`vitest-axe` on critical components; `axe-playwright` on critical screens; keyboard-only navigation reaches all interactive elements.
11. **Keep tests stable.** No arbitrary sleeps, no brittle CSS selectors, no snapshots over locale-dependent output. Target: unit suite under 30s; E2E under 5 min per app; flake rate under 1%.

## Anti-patterns

- `getByTestId` everywhere — coupling to markup.
- Asserting on TanStack Query internals instead of the feature hook's public surface.
- `vi.mock` on the HTTP client instead of letting MSW handle it — drifts from what dev sees.
- Testing a store via the rendered component when the assertion is about a transition. Test the reducer / store factory directly.
- Sharing one store instance across tests instead of using a factory.
- Snapshot tests on locale-dependent output (dates, numbers) — they flake across `en` / `ar`.
- Skipped flaky tests without an owner and fix date.

## After you finish

- [ ] Definition of Done items below are met.
- [ ] Test evidence and uncovered risks are documented.
- [ ] Flaky/slow tests have an owner and fix path (no indefinite `test.skip`).
- [ ] Handoff package prepared via [`adp-handoffs/workflows/handoff-to-next-role.md`](../../adp-handoffs/workflows/handoff-to-next-role.md) for `ai-quality-engineer` and `ai-reviewer`.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-reviewer`, `ai-quality-engineer`, `ai-platform-engineer`, `ai-sre`.

## Definition of Done

- [ ] Traceability recorded: business-critical user journeys → ACs → test coverage per category.
- [ ] Unit tests cover custom hooks, feature hooks, form schemas, utils, reducers, and error mappers.
- [ ] Component tests cover every rendered state of changed components.
- [ ] State stores (Zustand factories, reducers, wizard transitions) are tested as pure modules where possible — DOM-driven tests reserved for visible UX.
- [ ] MSW handlers cover the touched endpoints and are shared with dev.
- [ ] Playwright E2E covers the top journeys affected by the change.
- [ ] `axe` runs in CI with zero violations on changed screens.
- [ ] Unit suite under 30s and E2E under 5 min; no flaky tests merged.
