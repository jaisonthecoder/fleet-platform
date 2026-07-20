# Workflow: Test Integration (React)

Authoritative slice-level workflow for integration tests inside the React app boundary: routes, pages, feature state, providers, and API interaction via MSW. Includes notes on Pact JS consumer-contract testing where the React slice contracts a partner API directly.

## Position in the chain

- **Pairs with:** `workflows/test-unit.md`, `workflows/test-component.md`, `workflows/test-e2e.md`, and feature implementation — runs alongside the build, not after.
- **Inputs from:** approved React architecture and LLD (`adp-fend-react-architecture`), route map, OpenAPI contract, UX handoff, and the change's risk areas.
- **Successor:** handoff to `ai-quality-engineer` via `adp-qa-tests/workflows/test-feature-react.md`, then `ai-reviewer` (gate).

## Goal
Prove route + page + feature state + API interaction work together across the React app boundary, with MSW driving every HTTP response and a fresh provider stack per test.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`.
- You can state the workflow goal in one sentence.
- The route under test, its loaders/actions/guards, and its acceptance criteria are known.
- MSW handlers aligned to the OpenAPI contract are available or will be added.
- The Zustand store factory and `createTestWrapper` are available.
- You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- [`../references/testing.md`](../references/testing.md) — authoritative source for route rendering, full provider stack, state-transition assertions, MSW policy, Pact JS notes. Load `## Integration testing`, `## State management testing`, and `## Contract testing` for this workflow.

## Steps

1. **Render the full route.** For TanStack Router use `createMemoryRouter` + `RouterProvider`; for React Router use `MemoryRouter` with the route tree. Provide the actual route element under test so loaders, actions, and guards run.
2. **Wrap with the full provider stack.** Build a `createTestWrapper({ queryClient, store, locale })` factory that mounts, in order: `QueryClientProvider` (fresh client), `Provider` from the Zustand factory (`createBookingStore(initial)`), theme provider, `I18nextProvider` (parameterised by locale). Never reuse one wrapper across tests.
3. **Drive HTTP with MSW.** Realistic happy-path handlers live in `src/mocks/handlers/<feature>.ts` and are shared with dev. Per-test handlers use `server.use(http.get('/api/...', () => HttpResponse.json(...)))` for error envelopes (400 validation, 401, 403, 404, 409 optimistic-lock, 5xx). Reset between tests.
4. **Assert TanStack Query state transitions.** Use `findByRole('status', { name: /loading/i })` then `findByRole('region', { name: /vessel arrivals/i })` to assert the `isFetching → isSuccess` transition through the DOM, not via `queryClient.getQueryData(...)`. For mutations, wait for the success toast or the post-mutation row, not on `mutation.isSuccess`.
5. **Assert Zustand state after user actions.** After `await user.click(submit)`, assert on `store.getState().formStatus === 'submitted'` and on the rendered DOM that reflects it. Both halves matter; either alone is a regression magnet.
6. **Test the interceptor surface.** Auth header injection, correlation-ID forwarding, retry-on-5xx, and 401-routes-to-login behave the same in tests as in dev. Use MSW to simulate the 401 and assert the navigation to `/login`.
7. **Cover the AD Ports edges.** Tenancy header is set on every list request; Asia/Dubai date formatting renders in both locales; customs cut-off (16:00 GST) flow respects a fake clock (`vi.useFakeTimers({ now: new Date('2026-06-26T15:45:00+04:00') })`).
8. **Contract tests via Pact JS — light use.** Where the React slice contracts a partner API directly (not via a backend-for-frontend), add a Pact JS consumer test under `tests/contract/`. Define interactions on `@pact-foundation/pact`'s mock provider, exercise the slice's HTTP client against it, and publish the pact to the broker. Defer comprehensive contract testing to the backend skill (`adp-bknd-net-api`, `adp-bknd-nest-api`, etc.); the React side only proves its half.

## Anti-patterns
- Sharing one `QueryClient` across tests — cached success states leak into the next `isLoading` assertion.
- Importing a singleton Zustand store — `setState` from a prior test bleeds in.
- Double-mocking: MSW *and* `vi.mock('@/lib/http')` for the same endpoint — drift between layers is guaranteed.
- Asserting on `queryClient.getQueryData(...)` or `mutation.isSuccess` directly — couples to internals, not behavior.
- Forgetting the tenancy header assertion — the test passes against a single-tenant fixture and ships a leak.
- Skipped flaky tests without an owner and fix date.

## After you finish
- Definition of Done items below are met.
- MSW handler coverage delta recorded against the OpenAPI surface.
- Pact JS pacts (if any) published to the broker and tagged with the consumer version.
- Flaky/slow tests have an owner and fix path (no indefinite `test.skip`).
- Handoff package prepared for `ai-quality-engineer` and `ai-reviewer`.
- `git status` shows only intended changes.

## Definition of Done
- Traceability recorded: AC → route + feature state + endpoint → test file path.
- One happy + one auth-denied + one server-error test per route.
- All HTTP mocked via MSW; no `vi.mock` on the HTTP client; per-test handlers reset.
- TanStack Query state-transition assertions read from the DOM, not from `queryClient` internals.
- Zustand store state is asserted in both directions (rendered DOM and `store.getState()`).
- Interceptor behaviors (auth, correlation ID, 401, retry, 409) each have at least one test.
- AD Ports edges covered: tenancy header, Asia/Dubai timezone, customs cut-off.
- Where applicable, Pact JS consumer pact exists for partner-API integration.

## Handler reuse rule

Every integration test loads handlers from `src/mocks/handlers/index.ts` — same module used by dev runtime and Storybook. Local overrides go inline via `server.use(http.get(...))`.
