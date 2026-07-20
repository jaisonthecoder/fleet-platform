# Workflow: Test Unit (React)

Authoritative slice-level workflow for unit-testing the pure React surface: utilities, hooks, validators, error mappers, reducers, and Zustand store factories. Cross-cutting QA coverage is owned by `adp-qa-tests`; this workflow owns what the React engineer authors inside the slice.

## Position in the chain

- **Pairs with:** `workflows/test-component.md`, `workflows/test-integration.md`, and feature implementation — runs alongside the build, not after.
- **Inputs from:** approved React architecture and LLD (`adp-fend-react-architecture`), Zod/Yup schemas, custom hook signatures, and the change's risk areas.
- **Successor:** handoff to `ai-quality-engineer` via `adp-qa-tests/workflows/test-feature-react.md`, then `ai-reviewer` (gate).

## Goal
Prove pure functions, hooks, utilities, and Zod/Yup validators in isolation, fast enough that the entire unit layer runs in well under thirty seconds per slice.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`.
- You can state the workflow goal in one sentence.
- The pure units in scope (utils, hooks, schemas, mappers, reducers, store factories) are listed.
- ACs that map to pure logic (validation rules, mappers, transition tables) are known.
- Vitest (preferred) or Jest is configured in `apps/<app>/package.json` and the `pnpm test` command resolves it.

If inputs are missing, write a short "waiting on" note and stop.

## References
- [`../references/testing.md`](../references/testing.md) — authoritative source for tool-per-layer table, `renderHook` patterns, QueryClient and Zustand factories, coverage policy, and anti-patterns. Load `## Unit testing`, `## Hook testing`, and `## State management testing` for this workflow.

## Steps

1. **Pick the runner per project.** Vitest + jsdom (preferred for Vite apps) or Jest + jsdom (legacy or Next.js apps). Do not mix both runners in one app.
2. **Pure functions, mappers, validators.** Import the unit and assert directly — no React render. Cover every branch (success, validation failure, server-error envelope shape, locale variants such as Arabic-Indic digits).
3. **Hooks via `renderHook`.** Call `renderHook(() => useMyHook(args), { wrapper })`. Drive inputs by calling returned actions; assert on the returned `{ data, isLoading, error }` shape. Use `rerender` for dependency-change behavior. Never extract hook logic out of the hook to "test it directly" — that proves the extracted function, not the hook.
4. **Build the wrapper from a factory.** Define `createTestWrapper(client?: QueryClient)` returning a component that mounts `QueryClientProvider`, `MemoryRouter`, `I18nextProvider`, and any feature context. Default `client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })`. Pass a fresh client per test.
5. **Zod / Yup validators.** Call `MySchema.safeParse(input)` and assert on `success`, `error.issues[].path`, and `error.issues[].code`. One test per rule (required, format, range, cross-field, async refine).
6. **Reducers and Zustand store factories as pure modules.** `reducer(state, action)` → next state; or `const store = createBookingStore(initial); store.getState().action(...); expect(store.getState()).toMatch(...)`. No React render.
7. **Fixtures via builders + Faker.** Define `buildVesselArrival(overrides?)` and call it per test with the minimum fields the assertion needs. Seed Faker with a stable seed (`faker.seed(1)`) per file so failures reproduce.
8. **Run with coverage.** `pnpm vitest run --coverage` (v8 reporter) or `pnpm jest --coverage --runInBand`. Confirm the slice clears the 70% line / 60% branch floor before pushing.

## Anti-patterns
- Extracting hook logic into a plain function to "make it testable" — you now test the plain function, not the hook lifecycle.
- `jest.mock('react')` or any other React internals mock — proves nothing about the slice.
- Over-mocking React Query (`vi.mock('@tanstack/react-query')`) — destroys the contract you depend on; use a fresh `QueryClient` per test instead.
- Importing a singleton Zustand store in a unit test — state from prior tests leaks in.
- Snapshotting whole reducer state — refactors flake; assert on the keys that matter.
- Skipped flaky tests without an owner and fix date.

## After you finish
- Definition of Done items below are met.
- Coverage delta recorded (line %, branch % before vs. after).
- Flaky/slow tests have an owner and fix path (no indefinite `test.skip`).
- Handoff package prepared for `ai-quality-engineer` and `ai-reviewer`.
- `git status` shows only intended changes.
- Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`.

## Definition of Done
- Traceability recorded: AC → unit under test → test file path.
- Every Zod/Yup rule has at least one passing and one failing case.
- Every hook is tested via `renderHook` with a fresh wrapper/QueryClient.
- Every Zustand store under test uses the factory pattern with a fresh instance per test.
- Reducer transitions are exhaustive against the declared action union.
- Coverage floor met for the touched files: ≥70% line / ≥60% branch.
- Unit suite for the slice runs in under thirty seconds locally.
