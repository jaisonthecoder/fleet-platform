# Workflow: Test Component (React)

Authoritative slice-level workflow for component-level tests in React: render a component in isolation, assert its props contract, drive realistic user events, and prove every visible state including the Arabic / RTL parity case.

## Position in the chain

- **Pairs with:** `workflows/test-unit.md`, `workflows/test-integration.md`, and feature implementation — runs alongside the build, not after.
- **Inputs from:** approved React architecture and LLD (`adp-fend-react-architecture`), UX handoff with state matrix (loading / empty / error / success / partial), design tokens, accessibility annotations, and the change's risk areas.
- **Successor:** handoff to `ai-quality-engineer` via `adp-qa-tests/workflows/test-feature-react.md`, then `ai-reviewer` (gate).

## Goal
Prove the component renders correctly across every declared state, responds to props, fires callbacks with the right payload, integrates with its hooks under MSW, and remains accessible in both `en-AE` and `ar-AE`.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`.
- You can state the workflow goal in one sentence.
- The component's prop contract, callback contract, and rendered state matrix (loading / empty / error / success / partial) are known.
- MSW handlers for any endpoints the component fetches are available or will be added.
- A `createTestWrapper(client)` factory exists for `QueryClientProvider` + `MemoryRouter` + `I18nextProvider` + theme.
- You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- [`../references/testing.md`](../references/testing.md) — authoritative source for RTL query priority, `userEvent` vs `fireEvent`, MSW policy, the state matrix, RTL parity rules. Load `## Component testing` and `## Accessibility testing` for this workflow.

## Steps

1. **Render with the shared wrapper.** `render(<MyComponent {...props} />, { wrapper: createTestWrapper(new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) })`. One fresh `QueryClient` per test.
2. **Query by role + accessible name.** `screen.getByRole('button', { name: /save vessel arrival/i })`, `screen.getByRole('textbox', { name: /container number/i })`, `screen.getByRole('alert')`. Fall back to `getByLabelText` then `getByText`; never default to `getByTestId` and never query by CSS class.
3. **Drive events with `userEvent`.** `const user = userEvent.setup();` then `await user.click(...)`, `await user.type(...)`, `await user.tab()`, `await user.keyboard('{Enter}')`. Use `fireEvent` only for synthetic events RTL does not model (scroll, custom events).
4. **Mock HTTP with MSW.** For components that fetch, declare per-test handlers via `server.use(http.get('/api/vessels', () => HttpResponse.json(fixture)))`. Do not `vi.mock('@/lib/http')`. Reset handlers between tests via `afterEach(() => server.resetHandlers())`.
5. **Cover every state explicitly.** One test per rendered state: `it('shows skeleton while loading')`, `it('shows empty state when no records')`, `it('shows error banner on 500')`, `it('renders the row list on success')`, `it('shows partial-success banner when one row fails')`. Map each test to a UX-handoff state.
6. **Test callback contracts.** `await user.click(saveButton); expect(onSave).toHaveBeenCalledWith({ vesselId: '...', eta: '...' })`. Assert on payload shape, not on call count alone.
7. **RTL / Arabic parity.** For at least one test per component, render under `dir="rtl"` and the `ar-AE` i18next instance. Assert that mirrored layout classes, Arabic-Indic numerals, and translated labels appear. Reuse a `renderWithLocale(component, 'ar-AE')` helper.
8. **Accessibility checks.** Use `vitest-axe` (or `jest-axe`) to scan critical components: `expect(await axe(container)).toHaveNoViolations()`. Assert focus order with `await user.tab()` and `expect(document.activeElement).toBe(...)`. Assert live-region announcements via `getByRole('status')` or `getByRole('alert')`.
9. **Snapshot small fragments only.** Never snapshot the whole DOM tree. Snapshot a stable subtree (`expect(container.querySelector('[data-testid="invoice-summary"]')).toMatchSnapshot()`) only when assertion-by-assertion is hostile to read.

## Anti-patterns
- Class selectors (`container.querySelector('.btn-primary')`) — markup changes break tests that should not break.
- Snapshotting whole DOM trees — every refactor diffs hundreds of lines and reviewers stop reading them.
- `fireEvent.click` / `fireEvent.change` for user flows — skips pointer/focus/composition, hides real bugs.
- Missing the error or empty state test — the slice ships with a happy-path-only suite.
- Asserting on internal hook state — assert on the rendered DOM, the only contract the user sees.
- Skipped flaky tests without an owner and fix date.

## After you finish
- Definition of Done items below are met.
- Coverage delta recorded; the touched component file clears 70% line / 60% branch.
- vitest-axe / jest-axe is green on the changed component.
- RTL parity test added and passing.
- Flaky/slow tests have an owner and fix path (no indefinite `test.skip`).
- Handoff package prepared for `ai-quality-engineer` and `ai-reviewer`.
- `git status` shows only intended changes.

## Definition of Done
- Traceability recorded: AC → component → test file path.
- Every prop branch is exercised at least once.
- Every rendered state (loading / empty / error / success / partial) has at least one passing test.
- All interactive flows are driven by `userEvent.setup()`, not `fireEvent`.
- All HTTP is mocked via MSW; no `vi.mock`/`jest.mock` on the HTTP client.
- At least one RTL parity test covers `dir="rtl"` and the `ar-AE` locale.
- `vitest-axe` / `jest-axe` shows zero violations on the component.
- Coverage floor met for the touched component file.
