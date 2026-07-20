# React Testing Reference (authoritative)

Authoritative reference for unit, component, hook, integration, contract, end-to-end, and accessibility tests in AD Ports React apps. All `adp-fend-react-tests` workflows cite this file; the cross-cutting QA workflow [`../../adp-qa-tests/workflows/test-feature-react.md`](../../adp-qa-tests/workflows/test-feature-react.md) inherits from it.

## Table of Contents

- [Layer-by-tool table](#layer-by-tool-table)
- [Unit testing](#unit-testing)
- [Hook testing](#hook-testing)
- [Component testing](#component-testing)
- [Integration testing](#integration-testing)
- [Contract testing](#contract-testing)
- [End-to-end testing](#end-to-end-testing)
- [Accessibility testing](#accessibility-testing)
- [State management testing](#state-management-testing)
- [Coverage policy](#coverage-policy)
- [Anti-patterns catalog](#anti-patterns-catalog)
- [CI integration](#ci-integration)
- [See also](#see-also)

## Layer-by-tool table

Use a test pyramid that matches risk. Many small unit / component / hook tests, fewer integration tests, a focused E2E suite for top journeys.

| Layer | Default tool | Why | Speed | Coverage focus |
|---|---|---|---|---|
| **Unit** | Vitest (preferred) or Jest | Pure logic, no DOM | < 1 ms per test | Branches and error envelopes |
| **Component** | React Testing Library | Asserts user-visible DOM | 5–50 ms per test | Every rendered state |
| **Hook** | `renderHook` + provider wrapper | Hook lifecycle without a host component | 5–50 ms per test | Returned shape per state |
| **Integration** | RTL + full provider stack + MSW | Route + state + HTTP together | 50–500 ms per test | Routes, interceptors, transitions |
| **Contract** | Pact JS (consumer side); MSW seeded from OpenAPI | Frontend↔partner-API alignment | 100 ms per interaction | Request/response shape, error envelopes |
| **E2E** | Playwright | Real browser, real journey | 5–30 s per spec | Top journeys per persona |
| **Accessibility** | `vitest-axe`/`jest-axe` (component), `axe-playwright` (screen) | WCAG 2.2 AA | 50–500 ms per scan | 0 critical/serious violations |

## Unit testing

### Runner choice

- **Vitest + jsdom** for Vite-based apps (default). `pnpm vitest run --coverage` uses the v8 reporter.
- **Jest + jsdom** for legacy Next.js apps or repos that still ship `next/jest`. `pnpm jest --coverage --runInBand`.
- Do not mix runners in one app; the dual ecosystem of Babel/SWC configs becomes a maintenance trap.

### Pure-function patterns

- Import the function, call it, assert on the return value.
- One test per branch (success, every validation rule, every server-error envelope shape).
- Use Faker with a stable seed per file (`faker.seed(1)`) so failures reproduce.
- For locale-sensitive output (Arabic-Indic digits, Asia/Dubai dates), parameterise the test by locale.

### Validator tests

- For Zod: `const r = MySchema.safeParse(input); expect(r.success).toBe(false); expect(r.error.issues[0].path).toEqual(['vesselId']);`.
- For Yup: `await MySchema.validate(input, { abortEarly: false }).catch(err => expect(err.errors).toContain(...))`.
- Cover required / format / range / cross-field / async refine. One passing and one failing case per rule.

## Hook testing

### `renderHook` deep dive

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { createTestWrapper } from '@/test/wrapper';

const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const { result, rerender } = renderHook(
  ({ id }) => useVesselArrival(id),
  { initialProps: { id: 'V-1' }, wrapper: createTestWrapper({ queryClient: client }) },
);

await waitFor(() => expect(result.current.isSuccess).toBe(true));
expect(result.current.data).toMatchObject({ id: 'V-1' });

rerender({ id: 'V-2' });
await waitFor(() => expect(result.current.data?.id).toBe('V-2'));
```

### Wrapper factories

`createTestWrapper({ queryClient, store, locale })` mounts, in order: `QueryClientProvider`, Zustand `Provider`, theme provider, `I18nextProvider`. Default each input to a fresh instance per test. Never share a wrapper across tests.

### QueryClient injection

- One fresh `QueryClient` per `renderHook` call. `gcTime: 0` is optional but helpful for stricter isolation.
- `retry: false` for both queries and mutations so error states surface synchronously.

### Zustand store factory

- Export `createBookingStore(initial?: Partial<State>)` from `src/state/booking-store.ts`.
- Tests call `const store = createBookingStore({ ... })` for a fresh instance.
- Pass the store via `<BookingStoreProvider value={store}>` for React-bound tests.
- Drive via `store.getState().action(...)` and assert on `store.getState()`.

## Component testing

### RTL queries by role

Use the RTL query priority: `getByRole` (with `name`) → `getByLabelText` → `getByPlaceholderText` → `getByText` → `getByDisplayValue` → `getByAltText` → `getByTitle` → `getByTestId` (last resort).

```ts
screen.getByRole('button', { name: /save vessel arrival/i });
screen.getByRole('textbox', { name: /container number/i });
screen.getByRole('alert');           // error banner
screen.getByRole('status');          // live-region announcement
screen.getByRole('cell', { name: /MSC GAYANE/i });
```

### `userEvent` vs `fireEvent`

- `userEvent.setup()` returns a user. Use `await user.click(...)`, `await user.type(...)`, `await user.tab()`, `await user.keyboard('{Enter}')`.
- `userEvent` simulates pointer/focus/composition events that `fireEvent` skips, catching real bugs.
- Reserve `fireEvent` for events RTL does not model (custom `bubble`/`scroll` events, manual `dispatchEvent`).

### MSW integration

- Per-app handler set under `src/mocks/handlers/<feature>.ts`. Shared between tests and the dev runtime so dev never drifts from test.
- Per-test override via `server.use(http.get('/api/...', () => HttpResponse.json(...)))`.
- `afterEach(() => server.resetHandlers())` keeps tests isolated.
- Never `vi.mock('@/lib/http')` or `jest.mock('axios')` — that hides interceptor behavior.

### State matrix per component

Cover every visible state explicitly. The state matrix per touched component:

| State | Required test? | Typical assertion |
|---|---|---|
| Loading | Yes | `getByRole('status', { name: /loading/i })` |
| Empty | Yes (if applicable) | `getByText(/no vessel arrivals/i)` |
| Error (4xx) | Yes | `getByRole('alert')` content + recovery action |
| Error (5xx) | Yes | `getByRole('alert')` content + retry button |
| Success | Yes | rendered data + accessible name |
| Partial success | If applicable | banner + the rows that succeeded |

### RTL parameterization

- Add a `renderWithLocale(component, locale: 'en-AE' | 'ar-AE')` helper.
- For at least one test per component, render under `dir="rtl"` and the `ar-AE` i18next instance.
- Assert mirrored layout classes (`me-2` vs `ms-2`), Arabic-Indic numerals, and translated labels.

## Integration testing

### Route + page rendering

- TanStack Router: `createMemoryRouter([{ path: '/vessels/:id', element: <VesselDetail /> }])` + `<RouterProvider router={r} />`.
- React Router: `<MemoryRouter initialEntries={['/vessels/V-1']}><Routes>...</Routes></MemoryRouter>`.
- Render the actual route element so loaders, actions, and guards run.

### Full provider stack

`createTestWrapper({ queryClient, store, locale })` mounts the same providers as the production app entry, in the same order. Tests fail in the same way as production for missing providers — a feature, not a bug.

### State-transition assertions

- TanStack Query: `findByRole('status', { name: /loading/i })` → `findByRole('region', { name: /vessel arrivals/i })`. Read transitions through the DOM, not from `queryClient.getQueryData`.
- Mutations: wait for the success toast or the post-mutation row, not on `mutation.isSuccess`.
- Zustand: assert both `store.getState()` and the rendered DOM that reflects it.

### When to use Pact JS for consumer contracts

- Use Pact JS when the React slice contracts a partner API **directly** (no backend-for-frontend in between).
- Define interactions on `@pact-foundation/pact`'s mock provider, exercise the slice's HTTP client against the mock, publish the pact to the broker tagged with the consumer version.
- For React slices that call an AD Ports backend, defer comprehensive contract testing to the backend skill (`adp-bknd-net-api`, `adp-bknd-nest-api`, etc.) and rely on MSW handlers seeded from the OpenAPI spec for the frontend half.

## Contract testing

A lightweight Pact JS consumer suite proves the React side of the contract. Comprehensive cross-service contract testing (provider verification, contract-broker workflows, breaking-change gates) is owned by the backend skills and `adp-qa-tests`. The React engineer's job is to keep MSW handlers in sync with the OpenAPI spec and, where applicable, publish a consumer pact tagged with the app version.

## End-to-end testing

### Playwright project standard

- Playwright is the AD Ports default for React E2E. Project bootstrap, fixtures, page objects, AD Ports edges, and CI wiring live in [`../../adp-qa-playwright/SKILL.md`](../../adp-qa-playwright/SKILL.md).
- This reference documents the React-driven invocation only: spec authoring per route, axe-playwright invocation, RTL parity, trace/video evidence.

### axe-playwright

```ts
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page }).analyze();
const blocking = results.violations.filter(v =>
  ['critical', 'serious'].includes(v.impact ?? '')
);
expect(blocking).toEqual([]);
```

Zero critical/serious violations on the changed screen is a release gate.

### Trace evidence

- `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'` in `playwright.config.ts`.
- CI publishes the artefacts; the PR links to them so a reviewer can open the trace from the browser.

## Accessibility testing

### axe matrix

| Surface | Tool | When |
|---|---|---|
| Component | `vitest-axe` / `jest-axe` | Every critical component test |
| Screen | `axe-playwright` | Every E2E spec on a changed route |
| Manual | Keyboard pass, screen reader | Before release for new flows |

### Keyboard navigation

- `await user.tab()` reaches every interactive element in DOM order.
- `await user.keyboard('{Enter}')` activates focused buttons and links.
- `await user.keyboard('{Escape}')` closes dialogs and dismisses popovers.
- Assert focus order with `expect(document.activeElement).toBe(...)`.

### Screen-reader announcements

- Live regions: `getByRole('status')` (polite) or `getByRole('alert')` (assertive).
- Form errors are programmatically associated via `aria-describedby` and surfaced in a live region.
- Loading states announce via `<div role="status" aria-live="polite">Loading vessel arrivals…</div>`.

### RTL parity rules

- Every component test that asserts layout must have at least one RTL counterpart.
- Numeric fields render Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) when the locale is `ar-AE`.
- Labels and validation messages come from the `ar-AE` resource bundle, not from `en-AE` strings.
- Asia/Dubai dates render in the locale's calendar format; never assert on the raw rendered string — assert on the underlying `data-date` attribute or use a locale-aware regex.

## State management testing

### TanStack Query QueryClient factory pattern (anti-leak)

```ts
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
}
```

One fresh client per test. Never share. Never assert on `queryClient.getQueryData(...)` from the test; assert on the rendered DOM or the hook return shape.

### Zustand `createStore` factory pattern

```ts
// src/state/booking-store.ts
export function createBookingStore(initial?: Partial<BookingState>) {
  return createStore<BookingState>()((set) => ({
    vessels: [],
    status: 'idle',
    ...initial,
    addVessel: (v) => set((s) => ({ vessels: [...s.vessels, v] })),
  }));
}
```

```ts
// test
const store = createBookingStore({ vessels: [vessel('V-1')] });
store.getState().addVessel(vessel('V-2'));
expect(store.getState().vessels).toHaveLength(2);
```

For React-bound tests, mount via `<BookingStoreProvider value={store}>` so components consume the factory-built instance.

### Redux Toolkit (if used)

- Reducer tests: pure functions, `reducer(state, action)` → next state. Cover every action case.
- Thunk tests: dispatch the thunk against a fresh `configureStore({ reducer, middleware })`; assert on the resulting state and the actions captured by a mock middleware.
- Selector tests: pure functions, call with representative state, assert on output.

## Coverage policy

| Layer | Floor | Tool |
|---|---|---|
| Pure utils / schemas / reducers / stores | 90% line / 80% branch | Vitest v8 or Jest Istanbul |
| Custom hooks | 85% line / 75% branch | Vitest v8 or Jest Istanbul |
| Components | Every rendered state at least once | Vitest v8 or Jest Istanbul |
| Routed views (integration) | One happy + one auth-denied + one server-error per route | Vitest v8 or Jest Istanbul |
| Critical journeys (E2E) | 100% of business-critical journeys per persona | Playwright |
| Accessibility | 0 critical/serious axe violations on changed screens | `vitest-axe` / `axe-playwright` |

Slice-level minimum: **70% line / 60% branch** for the touched files; the higher per-layer floors above apply where they bite.

## Anti-patterns catalog

- **Class selectors** (`container.querySelector('.btn-primary')`) — markup refactors break tests that should not break.
- **`jest.mock('axios')` / `vi.mock('@/lib/http')`** — hides interceptor and contract drift; MSW is the single source of HTTP truth.
- **Shared `QueryClient` across tests** — cached success leaks into the next `isLoading` assertion.
- **Singleton Zustand store** — prior test state bleeds in.
- **`fireEvent.click` / `fireEvent.change` for user flows** — skips pointer/focus/composition; use `userEvent.setup()`.
- **Snapshot bloat on the whole DOM** — every refactor diffs hundreds of lines.
- **Missing RTL coverage** — slice ships looking correct in `en-AE`, breaks on `ar-AE`.
- **Double-mocked HTTP** (MSW + `vi.mock` for the same endpoint) — guaranteed drift between layers.
- **Asserting on TanStack Query internals** (`queryClient.getQueryData`, `mutation.isSuccess`) — couples to internals.
- **Skipped flaky tests without an owner and fix date** — indefinite `test.skip` is technical debt.

## CI integration

### Vitest

```bash
pnpm vitest run --coverage --reporter=junit --outputFile=./reports/vitest-junit.xml
```

- Coverage HTML at `./coverage/index.html`; JUnit XML at `./reports/vitest-junit.xml`.
- CI gate: fail the job if coverage falls below the per-layer floor.

### Jest

```bash
pnpm jest --coverage --runInBand --reporters=default --reporters=jest-junit
```

- Coverage HTML at `./coverage/lcov-report/index.html`; JUnit XML at `./junit.xml`.

### Playwright + axe-playwright

```bash
pnpm playwright test --reporter=junit,html --trace=on-first-retry
```

- Project list runs `chromium-en` and `chromium-ar` per `playwright.config.ts`.
- axe-playwright assertions run inside each E2E spec; the report is captured in the trace.

### Gate criteria

- Vitest/Jest exit code 0 with coverage ≥ slice floor (70% line / 60% branch).
- Playwright exit code 0 with trace/video published on retry; both locales pass.
- axe-playwright: zero critical/serious violations on changed screens.
- No `test.only` / `test.skip` without an owner and fix date in the PR body.

## See also

- [`../workflows/test-unit.md`](../workflows/test-unit.md) — slice-level unit workflow.
- [`../workflows/test-component.md`](../workflows/test-component.md) — slice-level component workflow.
- [`../workflows/test-integration.md`](../workflows/test-integration.md) — slice-level integration workflow.
- [`../workflows/test-e2e.md`](../workflows/test-e2e.md) — slice-level E2E workflow.
- [`../../adp-qa-playwright/SKILL.md`](../../adp-qa-playwright/SKILL.md) — Playwright project bootstrap, fixtures, page objects, CI wiring.
- [`../../adp-qa-tests/workflows/test-feature-react.md`](../../adp-qa-tests/workflows/test-feature-react.md) — cross-cutting QA workflow that inherits from this reference.
- [`/standards/test-plan.md`](/standards/test-plan.md) and [`/standards/definition-of-done.md`](/standards/definition-of-done.md).

## MSW 2.x handler

```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/vessels', ({ request }) => {
    const tenantId = request.headers.get('x-tenant-id') ?? 'default';
    return HttpResponse.json({ vessels: vesselsByTenant[tenantId] });
  }),
  http.post('/api/v1/vessels', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...body, id: 'vsl-001' }, { status: 201 });
  }),
];
```

**Forbidden:**

- `rest.get(...)` (v1).
- Calling `setupServer(...)` inside a test (`beforeAll` only, with `server.resetHandlers()` in `afterEach`).
- Inlining handlers in tests — always import from `src/mocks/handlers/`.

## Reuse MSW handlers in Playwright

```ts
import { test } from '@playwright/test';
import { handlers } from '@src/mocks/handlers';

test.beforeEach(async ({ router }) => {
  await router.use(...handlers);
});

test('vessel list shows tenant data', async ({ page, router }) => {
  await page.goto('/vessels');
  await expect(page.getByRole('row', { name: /MV Khalifa/i })).toBeVisible();
});
```

For one-off overrides per test, use `router.use(http.get(...))` inline.

## Vitest 4.x and submodule layouts

- Requires Vite >= 6, Node >= 20.
- `vitest.workspace.ts` (workspace) or `projects` in config enables multi-root.
- **Browser Mode** runs component tests in a real browser (Chromium/Firefox/WebKit) — use for components that depend on layout, CSS computed values, or browser APIs jsdom does not implement.
- **ARIA snapshots** capture the accessibility tree, preferable to DOM snapshots for a11y-sensitive components.
- OpenTelemetry export available for test runs (useful for CI flakiness analysis).

## Coverage gating

- Vitest v8 provider is default; Istanbul is also supported.
- Per-path thresholds in `vitest.config.ts`:

```ts
test: {
  coverage: {
    provider: 'v8',
    thresholds: {
      lines: 70,
      branches: 60,
      'src/features/**': { lines: 80, branches: 70 },
    },
  },
},
```

