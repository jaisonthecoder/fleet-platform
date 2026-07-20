# Workflow: Start a New Feature (React)

**The scaffolding phase.** This workflow creates the feature module: folder, public surface, routes, first page. It assumes you've already done `workflows/plan-feature.md` (state-by-kind chosen, feature-hook decided, i18n approach, primitives identified). For extending an existing feature, see `workflows/plan-feature.md` + `workflows/harden-feature.md`.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] UX flows, ACs, and the OpenAPI contract are available.
- [ ] The feature maps to an approved user journey and business outcome; no speculative routes/screens are being created.
- [ ] The feature name is agreed with PM — singular domain noun (`vessels`, `bookings`), kebab-case.
- [ ] You have completed `workflows/plan-feature.md` (state by kind, feature-hook decision, i18n choice, primitives identified). If not, do that first.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `workflows/plan-feature.md` — **prerequisite.** Run plan-feature first; this workflow assumes its output (state-by-kind chosen, feature-hook decided, i18n approach, primitives identified).
- `references/react-architecture.md` — §Feature Module Structure, §Feature Hooks, §Reactivity and State.
- `references/coding-conventions.md` — naming, exports, aliases, **Search before creating** table.
- `references/ui-primitives.md` — shadcn + Lucide standard, before any component is named.

## Goal
A working feature module skeleton — folder, public surface, routes wired, one page rendering — that later workflows build on.

## Step ladder

> **Skeleton → Types → Schemas → Keys → Client → Queries → Feature Hook? → State? → Page → Routes → Register → Index → i18n → Test → Pipeline.**

The order matters. Each step assumes the previous artifacts exist. Don't jump ahead.

## Steps

### 1. Skeleton

Create the folder per `references/react-architecture.md` §Feature Module Structure. Leave `state/` out until §7 proves you need it.

### 2. Types

`types/<feature>.types.ts` — UI-only view models, filter shapes, anything the API schema doesn't own. API-derived types come from zod schemas in step 3.

### 3. Schemas

`api/schemas.ts` — one zod schema per request/response this feature touches. Derive TS types via `z.infer<typeof>`.

### 4. Query keys

`api/query-keys.ts` — hierarchical factory built from `as const` literals. See `references/react-architecture.md` §Reactivity and State §4.

### 5. Client

`api/<feature>.client.ts` — thin wrappers over the shared HTTP client (`@shared/api/`). Parse each response through its zod schema before returning. No React, no hooks.

### 6. Query hooks

`hooks/queries/use-<resource>.ts` and `hooks/queries/use-<resource>-mutations.ts`. Thin — keys + fetcher + invalidation. Composition lives in the feature hook (step 7).

### 7. Feature hook? (decision)

Add `hooks/feature/use-<feature>.ts` if **two or more** are true:
- Multiple queries feed one view.
- One mutation must invalidate multiple reads.
- Local UI state (selection, filters, steps) relates to server state.
- You're stitching data across features.

Otherwise skip — pages call query hooks directly. Rules and the `{ data, isLoading, error, actions }` shape: `references/react-architecture.md` §Feature Hooks. Define an explicit return type; do not return TanStack Query's shape.

### 8. Feature state? (decision)

If the feature has cross-component UI state (wizard steps, multi-component selection, drag), the **default is React Context + `useReducer`** scoped to the feature's page shell — wire that inline, no `state/` folder needed.

Add `state/<feature>-store.ts` (Zustand store) **only when** Context + reducer would cause re-render pressure across many deep consumers, when actions get numerous, or when you need middleware (persist, devtools). See `references/react-architecture.md` §Reactivity and State §2.

If neither applies, the feature has no cross-component state — skip both.

### 9. Page

`pages/<feature>-list/<feature>-list.page.tsx`. Compose from `@shared/ui/` (every primitive — see ⛔ Reuse, do not recreate). Render every state via `<LoadingState>` / `<EmptyState>` / `<ErrorState>`. No data fetching here, no `useEffect` for data.

### 10. Routes

`<feature>.routes.tsx` exports a `RouteObject[]`. Lazy-load each page (`React.lazy`), set a per-feature `errorElement`, wrap protected routes in an auth guard. The top-level router composes — paths are not hard-coded inline. See `references/react-architecture.md` §Routing.

### 11. Register routes

In `src/app/router/index.tsx`:

```ts
// Wire the feature's RouteObject[] into the top-level router so its pages become reachable.
import { vesselRoutes } from '@features/vessels';
// add to top-level router children
```

### 12. Public surface

`index.ts` — export only pages, routes, the feature hook (if any), and public types. No wildcard re-exports. No re-export of internal queries, mutations, components, or stores. See `references/react-architecture.md` §Module rules.

### 13. i18n

Seed `i18n/en.json` and `i18n/ar.json`, register the namespace. **No user-visible string in JSX without `t()`.**

### 14. First test

Use `renderWithProviders` (the project's helper that wraps `QueryClientProvider`, `I18nextProvider`, `MemoryRouter`). One loading-state assertion, one success-state assertion with an MSW handler in `src/mocks/handlers.ts`. See `references/react-architecture.md` §Testing.

### 15. Pipeline

`pnpm typecheck && pnpm lint && pnpm test` must pass. Then `pnpm dev` and walk the route in both `en` and `ar`.

## Anti-patterns

See `references/anti-patterns.md` §Reuse violations and §Module structure for the canonical lists. The greenfield-specific traps:

- **Writing the page before the query hook exists** — you'll fetch in `useEffect` and create the anti-pattern you're trying to avoid.
- **Adding `state/` "because we might need it"** before the feature has cross-component UI state.
- **Wildcard exports** in `index.ts` (`export * from './...'`). The public surface is explicit.
- **Registering routes directly in the top-level router** instead of via `<feature>.routes.tsx`.

## After you finish

- [ ] Definition of Done items below are met.
- [ ] PR description names the new feature folder and the routes added.
- [ ] Open questions (API gaps, UX unknowns) are listed explicitly.
- [ ] QA, Reviewer, and Security handoff is prepared.
- [ ] `git status` shows only intended changes.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- [ ] Traceability recorded: user journey -> AC -> route/page scaffold -> first test.
- [ ] **No parallel primitives.** Every UI element from `@shared/ui/`; every icon via `<Icon />`; HTTP via shared client + feature client; forms via shadcn `<Form>` + react-hook-form. (See SKILL.md ⛔ Reuse, do not recreate.)
- [ ] Folder skeleton matches `references/react-architecture.md` §Feature Module Structure.
- [ ] `index.ts` exports only pages, routes, feature hook (if any), and public types.
- [ ] Routes registered in `src/app/router/` via `<feature>.routes.tsx`.
- [ ] At least one page renders loading + success + error states.
- [ ] zod schemas validate responses at the API boundary.
- [ ] Query keys are centralized; no inline keys in hooks or components.
- [ ] i18n namespaces (`en.json`, `ar.json`) exist and are wired; no hard-coded strings.
- [ ] One passing test using `renderWithProviders`.
- [ ] `typecheck`, `lint`, and `test` all pass.
