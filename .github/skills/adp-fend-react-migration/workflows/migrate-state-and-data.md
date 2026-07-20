# Workflow: Migrate State, Forms, And Data

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
- [ ] Feature slice scope and current Angular behavior are known.
- [ ] Angular services, RxJS streams, stores, forms, validators, interceptors, and API calls are inventoried.
- [ ] Target React state-by-kind decision is known from `frontend-react`.
- [ ] Backend API contract and auth/error behavior are available.
- [ ] Test data and parity cases exist.

## Goal

Translate Angular state, forms, and data behavior into React patterns without changing business rules, validation, permissions, or data freshness semantics accidentally.

## Steps

1. **Classify state by kind.** Local UI state, route state, server state, cross-feature state, URL state, and persisted state.
2. **Map Angular patterns to React patterns.** Angular service/signals/RxJS local state -> React state/reducer/context where scoped; NgRx/SignalStore -> Zustand or context only when needed; HttpClient resource/server state -> TanStack Query.
3. **Preserve forms.** Reactive Forms validators, async validators, disabled/submitting behavior, dirty guards, server validation mapping, and error messages become react-hook-form + zod behavior.
4. **Preserve API behavior.** Request shape, response parsing, auth, 401/403 flow, retry, cancellation, cache/freshness, and error mapping stay stable.
5. **Preserve permissions.** Angular guards/resolvers/interceptors map to React Router guards/loaders, shared API interceptors, and server-enforced authorization.
6. **Preserve i18n/RTL and formatting.** Translation keys, date/number/currency formatting, direction-sensitive layout, and Arabic behavior are verified.
7. **Add parity tests.** Unit tests for reducers/stores/forms, component tests for visible states, MSW handlers for API flows, and Playwright journey tests for migrated behavior.

## Anti-patterns

- Turning every Angular service into a global React store.
- Replacing RxJS behavior without understanding cancellation, debounce, or error recovery.
- Rewriting validation messages and formats without UX/product approval.
- Caching server data in client state instead of using server-state tooling.

## After you finish

- [ ] State/data mapping note is saved.
- [ ] Tests cover the migrated state, form, and API behavior.
- [ ] Security-sensitive auth/token behavior is reviewed when changed.
- [ ] Handoff prepared for `validate-parity`.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Traceability recorded: Angular state/data behavior -> React state/data design -> parity tests.
- [ ] State mapped by kind, not by framework habit.
- [ ] Forms and validation preserve business behavior.
- [ ] API, auth, error, retry, and freshness behavior preserved or approved as changed.
- [ ] Tests cover state transitions, forms, and API outcomes.
