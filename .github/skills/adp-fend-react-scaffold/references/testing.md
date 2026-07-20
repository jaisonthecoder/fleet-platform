# React Testing Reference

> **Authoritative test reference now lives in [`../adp-fend-react-tests/references/testing.md`](../adp-fend-react-tests/references/testing.md).** This in-scaffold reference is retained as a quick pointer for scaffold-only users; the standalone skill is canonical.

Authoritative reference for unit, component, hook, integration, contract, end-to-end, and accessibility tests in AD Ports React apps. The workflow [`../workflows/test-frontend.md`](../workflows/test-frontend.md) cites this file; the QA cross-cutting workflow [`adp-qa-tests/workflows/test-feature-react.md`](../../adp-qa-tests/workflows/test-feature-react.md) inherits from it.

## Test categories

Use a test pyramid that matches risk. Prefer many small unit/component/hook tests, fewer integration tests, and a focused E2E suite for top journeys.

| Category | Scope | Default tool | When to use |
|---|---|---|---|
| **Unit** | Single function / pure module | Vitest (preferred) or Jest | Pure utils, error mappers, form schemas (Zod/Yup), reducers, Zustand store factories |
| **Component** | One component rendered in isolation | React Testing Library | DOM behavior, props contract, conditional render, accessibility, signal/state-driven updates |
| **Hook** | Custom hook or feature hook in isolation | `renderHook` + `renderWithProviders` | Returned `{ data, isLoading, error }`, action callbacks, refetch/mutation behavior |
| **Integration** | Component + hooks + router + MSW together | RTL + `renderWithProviders` + MSW | Route loaders/actions, form submission, store-to-view binding, interceptor behavior |
| **Contract** | Frontend code vs OpenAPI contract | MSW handlers seeded from spec | Request/response shape, status codes, error envelopes |
| **End-to-end (E2E)** | Real browser, UAT-like backend | Playwright | Top user journeys, tenancy isolation, `en`/`ar` parity, login + critical flow |
| **Accessibility** | Component or screen | `jest-axe`/`vitest-axe`, `axe-playwright`, manual keyboard pass | WCAG 2.2 AA, focus order, labels, contrast, RTL behavior |

## Tool-per-layer table

| Layer | Default tool | Notes |
|---|---|---|
| Pure utils / mappers / schemas | Vitest or Jest | No render; assert directly |
| Reducers | Vitest or Jest | Test as pure functions: `reducer(state, action)` → next state |
| Zustand stores | Vitest or Jest | Export a factory; one fresh instance per test; assert on `store.getState()` |
| Components | React Testing Library | Query by role/label/text; reserve RTL `container` queries for special cases |
| Forms | RTL + `userEvent` | Realistic interaction; assert validity, error display, disabled, submit |
| Custom hooks | `renderHook` + provider wrapper | Wrap in QueryClient (`retry: false`), router, i18n via `renderWithProviders` |
| HTTP | MSW (browser + node handlers shared) | Default. Do not `vi.mock` the HTTP client. |
| Routing | RTL + `MemoryRouter` (React Router) or `createRoutesStub` | Test loaders/actions, route params, guards |
| State (TanStack Query) | Test the feature hook surface | Avoid asserting on `queryClient` internals |
| E2E | Playwright | One tool per app. Trace + video on retry. |
| Accessibility | `jest-axe`/`vitest-axe` for components; `axe-playwright` for screens | Required on critical surfaces |

## What to test per kind

### Unit tests

- Pure utils, formatters, parsers, mappers.
- Error mappers: every server error envelope shape used by the app maps to a stable UI message.
- Form schemas (Zod/Yup): pass and fail cases per rule.
- Reducers: every action against representative state.
- Zustand store factories: initial state, action behavior, computed selectors.

### Component tests

- Renders all visible states (loading, empty, error, success, partial-success).
- Honors all declared props; emits all declared callbacks with the correct payload.
- Keyboard interaction (`Tab`, `Enter`, `Esc`, arrow keys for menus/lists).
- Conditional render driven by props, feature flags, or query state.
- Localization: text present in both `en` and `ar` and direction switches correctly.

### Hook tests

- Returned shape per state (loading, success, error).
- Action callbacks trigger the right mutation/request.
- Refetch behavior on dependency change.
- Cache behavior across re-renders (use `renderHook`'s `rerender`).
- Error mapping from server envelope to consumer-friendly shape.

### Integration tests

- Routes: loader returns expected data; action handles form submission; redirects work.
- Form submission against MSW: client validation blocks submit; server error maps to field; success navigates or refreshes view.
- Interceptors: auth header added, retry on 5xx with backoff, correlation ID forwarded, 401 routes to login.
- Optimistic-locking conflicts: server `409` returns a stable banner and preserves user input.

### Contract tests

- MSW handler set generated from or seeded by the OpenAPI spec.
- The same handler set powers `dev` and `test` to prevent drift.
- Re-run contract checks on every spec change.

### E2E tests (Playwright)

- One smoke journey per persona (e.g., operations clerk creates a request; supervisor approves it).
- Tenancy isolation: user from tenant A cannot see tenant B data.
- `en`/`ar` parity: critical journey passes in both locales with RTL layout intact.
- Asia/Dubai timezone: any cut-off-window dependent flow uses local time correctly.
- Trace + video on retry; fail fast on flake.

### Accessibility

- `jest-axe`/`vitest-axe` on critical components in unit tests.
- `axe-playwright` on critical screens in E2E with zero violations.
- Keyboard-only navigation reaches all interactive elements; focus is visible.
- Form errors are announced via `aria-live` or equivalent.
- Color contrast meets WCAG 2.2 AA.

## Fakes vs mocks

- **Fakes preferred.** A fake is a small working implementation (e.g., an in-memory store, a `Clock` fake).
- **Mocks only at true seams.** External HTTP (MSW handles this), time, browser APIs, third-party SDKs.
- Do not verify private call choreography. Assert on observable outcomes (rendered DOM, hook return shape, store state).

## Forms

Cover for every form:

- Required, format, range, cross-field, and async validators (success and failure).
- Disabled state during submission.
- Server-side validation errors mapped to the right field.
- Submit button enabled/disabled rules.
- Reset behavior preserves untouched fields where intended.

## TanStack Query testing pattern

- Wrap test in a fresh `QueryClient` with `defaultOptions: { queries: { retry: false } }`.
- Assert on the feature hook's public surface, not on `queryClient` cache internals.
- Use MSW to control responses; switch handlers per test.
- For mutation tests, wait for the mutation's `isSuccess`/`isError` rather than arbitrary timers.

## Zustand testing pattern

- Export `createStore` factory; tests call it for a fresh instance.
- Never import a singleton store in tests — singletons leak state across tests.
- Drive via `store.getState().action(...)`; assert on `store.getState()`.
- For React-bound tests, pass the store via a Provider to keep tests isolated.

## Reducer testing pattern

- Treat reducers as pure functions: `reducer(state, action)` → next state.
- Cover every action case + invalid transitions.
- For wizards, test the transition graph as reducer cases (Next-when-invalid blocks, Back preserves earlier values).
- Reach for the rendered DOM only when asserting visible UX (focus, error display).

## Speed and isolation

- Unit + component suite target: under 30 seconds locally.
- E2E suite target: under 5 minutes per app, parallelised.
- Flake rate target: under 1%. Quarantine flaky tests behind an owner + fix date; no indefinite `test.skip`.
- Per-test setup only; no shared mutable module state. Reset stores, fixtures, and MSW handlers between tests.
- Avoid sleeps; use RTL `findBy*` queries and `waitFor`.

## Coverage policy

| Layer | Floor | Notes |
|---|---|---|
| Pure utils / schemas / reducers / stores | 90% lines / 80% branches | Pure logic must be exhaustively covered |
| Custom hooks | 85% lines / 75% branches | Test public surface |
| Components | Every rendered state at least once | Coverage % alone is misleading for JSX |
| Routed views (integration) | One happy + one auth-denied + one server-error per route | Mandatory |
| Critical journeys (E2E) | 100% of business-critical journeys per persona | Defined in PRD |
| Accessibility | Zero `axe` violations on changed screens | Build fails on regression |

## Anti-patterns

- `getByTestId` as the default query — coupling to markup.
- `vi.mock` on the HTTP client instead of MSW — drifts from what dev sees.
- Asserting on TanStack Query internals or `queryClient` cache shape.
- Sharing one Zustand store singleton across tests.
- Testing a store through the rendered component when the assertion is about a transition.
- Snapshot tests over locale-dependent output (dates, numbers, currency).
- Skipped flaky tests without an owner and fix date.
- E2E suites that drive every interaction the unit + component + hook layer already covers.

## See also

- [`../workflows/test-frontend.md`](../workflows/test-frontend.md) — slice workflow that consumes this reference.
- [`adp-qa-tests/workflows/test-feature-react.md`](../../adp-qa-tests/workflows/test-feature-react.md) — cross-cutting QA workflow that consumes this reference.
- [`/standards/test-plan.md`](/standards/test-plan.md) and [`/standards/definition-of-done.md`](/standards/definition-of-done.md).
