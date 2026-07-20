# Workflow: Wire Data (React)

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] OpenAPI/API contract, auth behavior, error model, and data freshness expectations are available.
- [ ] The data being fetched/mutated supports a named user goal and acceptance criterion.
- [ ] State ownership per kind (local / feature / app / server) is clear; feature-hook shape is known.
- [ ] Test data or MSW handlers are available.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/react-architecture.md` — Reactivity and State (server-state rules, TanStack Query usage), Feature Hooks, HTTP Integration.
- `references/frontend-security.md` — read before designing interceptors, token handling, credentials mode, CSRF strategy, or error redaction.

## Goal
Server state correctly fetched, cached, invalidated, and observable. Mutations safe and auditable. Auth handled centrally.

## Steps
1. **Generate the client.** From OpenAPI via `openapi-typescript` + `openapi-fetch`. Regenerate in CI; commit the output.
2. **Wrap the client once.** One shared HTTP client in `src/shared/api/` with interceptors for auth-token attach, 401/403 handling, error normalization to `{ message, code, fieldErrors }`, and telemetry. Feature clients (`features/<feature>/api/<feature>.client.ts`) wrap this shared client — components never import the raw generated client.
3. **Centralize query keys.** One `features/<feature>/api/query-keys.ts` per feature with hierarchical keys: `vesselKeys.all`, `vesselKeys.list(filters)`, `vesselKeys.detail(id)`. Never inline `['vessels', id]` in a component.
4. **Write query hooks** in `features/<feature>/hooks/queries/`. One file per resource (`use-vessel.ts`, `use-vessels.ts`) and one for mutations (`use-vessel-mutations.ts`). Keep them thin — just `useQuery` / `useMutation` with key + fetcher + select.
5. **Stale times match data volatility.** Reference data: long (hours). User data: short (seconds to a minute). Real-time: `staleTime: 0` + polling or websockets. Record the choice in the query hook comment.
6. **Mutations invalidate or update.** On success, either `invalidateQueries` on the affected keys or `setQueryData` for optimistic/reversible updates. Roll back on error. `retry: 0` on mutations.
7. **Validate responses with zod** at the API-client boundary (`features/<feature>/api/schemas.ts`). Catch contract drift early.
8. **Handle auth centrally.** Interceptors attach tokens (or rely on `credentials: 'include'` + CSRF for cookie-session auth) and handle 401/403 according to product flow. See `references/frontend-security.md` §HTTP and Data Handling for credentials mode and CSRF rules.
9. **Map errors once.** Convert ProblemDetails (RFC 7807) or API error shapes to user-facing messages and field-level form errors in a single shared mapper. Do not show raw API errors.
10. **Build the feature hook.** Compose queries and mutations in `features/<feature>/hooks/feature/use-<feature>.ts`. Expose `{ data, isLoading, error, actions }` — never expose raw query results.
11. **Mock consistently.** MSW handlers in `src/mocks/` — one source of truth shared between unit tests and dev. Align fixtures with the OpenAPI contract.

## Anti-patterns

See `references/anti-patterns.md` §Data wiring and §State for the canonical list (rejection-citable). The most-common ones in this workflow:

- **Fetching in `useEffect` + `useState`** instead of TanStack Query.
- **Inline query keys** (`['vessels', id]`) instead of going through the feature's `query-keys.ts`.
- **Ad-hoc auth-token handling** in components — must live in the shared interceptor.
- **Feature hook exposing raw `useQuery` return objects** — defeats the facade purpose.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Contract assumptions and backend gaps are documented.
- [ ] Data-flow test evidence is captured.
- [ ] Backend, QA, Reviewer, and Security handoff is prepared.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done
- [ ] Data flow traces to user goal, AC, and API contract.
- [ ] Generated client is in the repo and regenerated in CI.
- [ ] Query keys centralized per feature.
- [ ] Query hooks thin; feature hook exposes a stable `{ data, isLoading, error, actions }` shape.
- [ ] Mutations invalidate or update the affected keys on success; roll back on error.
- [ ] Auth and 401/403 handled centrally in the shared interceptor.
- [ ] Errors mapped to user-friendly messages via one shared mapper.
- [ ] Responses validated with zod at the API boundary.
- [ ] MSW handlers cover the feature's endpoints and are shared with dev.
