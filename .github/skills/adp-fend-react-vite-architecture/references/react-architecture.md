# React Architecture

## Table of Contents

- [React Architecture](#react-architecture)
  - [Contents](#contents)
  - [Focus](#focus)
  - [Scope](#scope)
    - [React 19 — what changes](#react-19--what-changes)
    - [Brownfield migrations](#brownfield-migrations)
    - [Monorepos](#monorepos)
  - [Current React Direction](#current-react-direction)
  - [Default Architecture Rules](#default-architecture-rules)
  - [Feature Module Structure](#feature-module-structure)
    - [Default module layout](#default-module-layout)
    - [Module rules](#module-rules)
    - [Shared folder](#shared-folder)
    - [`src/app/` (composition layer)](#srcapp-composition-layer)
  - [Components](#components)
  - [Component Responsibility](#component-responsibility)
  - [Feature Hooks (the facade equivalent)](#feature-hooks-the-facade-equivalent)
  - [Reactivity and State](#reactivity-and-state)
    - [1. Local component state](#1-local-component-state)
    - [2. Cross-component feature state](#2-cross-component-feature-state)
    - [3. Cross-feature / app-wide client state](#3-cross-feature--app-wide-client-state)
    - [4. Server state (data fetched from APIs)](#4-server-state-data-fetched-from-apis)
    - [URL state](#url-state)
    - [State anti-patterns](#state-anti-patterns)
  - [Routing](#routing)
  - [Forms](#forms)
  - [HTTP Integration](#http-integration)
  - [UI states (Empty / Loading / Error / Unauthorized)](#ui-states-empty--loading--error--unauthorized)
    - [`EmptyState`](#emptystate)
    - [`LoadingState`](#loadingstate)
    - [`ErrorState`](#errorstate)
    - [`UnauthorizedState` (optional)](#unauthorizedstate-optional)
    - [Rules](#rules)
  - [Storybook and Component Documentation](#storybook-and-component-documentation)
  - [Environment and Configuration](#environment-and-configuration)
  - [Rendering and Performance](#rendering-and-performance)
    - [Performance budget (defaults — override per project in the ADR)](#performance-budget-defaults--override-per-project-in-the-adr)
  - [Internationalization, RTL, and Locale](#internationalization-rtl-and-locale)
  - [Testing](#testing)
    - [Stack — one tool per layer](#stack--one-tool-per-layer)
    - [Speed budget](#speed-budget)
    - [Guidelines](#guidelines)
  - [CI Pipeline](#ci-pipeline)
  - [Smells To Correct](#smells-to-correct)

## Focus

Use this reference when building or refactoring React code structure, feature modules, components, hooks, routing, state flow, forms, data fetching, rendering strategy, i18n, or tests.

## Scope

This skill targets **React SPAs** at the version recorded in `/standards/framework-baselines.md` § React (current recommended: React 19; absolute floor 18.2 for shadcn compatibility) built with Vite and React Router. Next.js App Router and Remix share most of these rules but have additional routing, server-component, and rendering concerns — for those apps, adapt rather than copy, and record the deviations in an ADR.

### React 19 — what changes

On React 19 most rules here still apply. Notable additions:

- **Actions and `useActionState`** — for form submissions you may write an action function (sync or async) and consume state via `useActionState`. Still wire it through react-hook-form where the app needs richer validation/field-level errors; Actions are a good fit for simple submits where the server owns validation.
- **`use()` hook** — reads a promise or a context conditionally. Useful inside `Suspense` boundaries for one-off async reads. Does not replace TanStack Query for cached server state.
- **`useOptimistic`** — built-in optimistic updates. Fine for small UI state; TanStack Query's optimistic mutations remain the right tool for server-state optimism because they also handle rollback and cache sync.
- **`forwardRef` is no longer required** for function components — `ref` is a regular prop. Existing `forwardRef` code still works; prefer the new form in new code on v19.
- **Document metadata** (`<title>`, `<meta>`) rendered inline in components instead of via `react-helmet`.

If the repo is on v19+, prefer these features when they simplify the code. Do not rewrite working v18 code just to adopt them.

### Brownfield migrations

For existing AD Ports apps that don't yet match this skill, plan migrations as **opportunistic** work, not big-bang rewrites. Rules:

- **Migrate when you touch.** A new feature in an old app is built per this skill (feature module, TanStack Query, shadcn). Old features stay until the next time they're touched.
- **React 18 → 19**: React 19 is the current LTS per `/standards/framework-baselines.md` § React and has been GA since late 2024. Existing React 18 apps should plan the upgrade as part of normal maintenance, paced by their dependency tree. Don't upgrade just to use Actions; sequence the cutover after upgrading routing, state, and any in-house libraries that pin React peers.
- **`useEffect` + `useState` data fetching → TanStack Query**: migrate per-feature when the feature is touched. The smallest unit is one query hook. Rip-and-replace for an old feature is a project, not a refactor — schedule it.
- **Hand-rolled UI library → shadcn**: do **not** rip out an existing UI library wholesale unless it's actively blocking. Migrate components gradually as you touch them. Keep the old library installed while shadcn is added; remove the old library when no imports remain.
- **CSS modules → Tailwind**: migrate per-component, not per-folder. Once a component is touched, port its styles to Tailwind classes. Remove the `.module.css` file in the same PR.
- **NgModule-style barrel files → narrow `index.ts` per feature**: drop wildcard re-exports as a one-shot lint rule + codemod. Cheaper than touching every file.
- **Document migration progress** in the repo's README (e.g. "Vessels, Bookings: TanStack Query. Customs, Manifests: legacy.") so reviewers know what to expect.

Big-bang rewrites of running AD Ports apps are almost always the wrong choice — they freeze feature work for months and the rewritten app starts behind. Opportunistic migration trades a longer total timeline for shipping features the whole way through.

### Monorepos

If the app lives in a monorepo (Nx, Turborepo, pnpm/yarn/npm workspaces), the feature-module structure still applies inside each app package. Extract genuinely cross-app utilities to a shared workspace package (`@adports/ui`, `@adports/http`) rather than inflating `src/shared/` in one app. Keep workspace packages small and focused — one concern each.

## Current React Direction

- Treat React concurrent features (`useTransition`, `Suspense` for data, `useDeferredValue`) as available by default at the React baseline in `/standards/framework-baselines.md` — use them when they solve a real UX problem, not as decoration.
- Treat `useEffect` as an escape hatch for side effects, not a data-fetching mechanism. Server state belongs in TanStack Query (or equivalent), not in `useEffect` + `useState`.
- Treat TypeScript strict mode as non-negotiable. No `any`. Prefer `unknown` at boundaries and narrow via zod.
- Treat function components + hooks as the default. Class components are legacy and should be migrated when touched.
- When in doubt about version-specific behavior (Server Components, Actions, new hooks), check the live React docs rather than relying on this file alone.

## Default Architecture Rules

- Organize by feature or domain, not by technical type alone.
- Keep route entry points, feature shells, feature hooks, and shared UI primitives clearly separated.
- Put bootstrapping in `src/main.tsx` and global providers in `src/app/providers/`.
- Keep one primary concept per file; colocate tightly-coupled helpers.
- Avoid top-of-feature barrel files (`src/features/<feature>/index.ts` exporting everything) — they slow the bundler and hide dependency direction. Export only the public surface (the page component, the feature hook, public types) via a narrow `index.ts` when needed.
- Keep shared UI primitives generic; keep business workflows inside feature areas.

## Feature Module Structure

Each feature is a **module**: a self-contained folder with its own pages, components, hooks, API layer, state, types, and tests. The module exposes a narrow public surface via `index.ts`.

### Default module layout

```text
src/features/<feature>/
  index.ts                          # Public surface: page(s), feature hook(s), public types
  <feature>.routes.tsx              # Route definitions for this feature (React Router data-router)

  pages/
    <feature>-list/
      <feature>-list.page.tsx
      <feature>-list.page.test.tsx
    <feature>-detail/
      <feature>-detail.page.tsx
      <feature>-detail.page.test.tsx

  components/                       # Feature-scoped presentational components
    <feature-specific-component>/
      <feature-specific-component>.tsx
      <feature-specific-component>.test.tsx

  hooks/
    queries/                        # TanStack Query hooks — one file per endpoint/resource
      use-<resource>.ts             # e.g. useVessel, useVessels
      use-<resource>-mutations.ts   # e.g. useCreateVessel, useUpdateVessel
    feature/                        # Feature-level composition hooks — the facade equivalent
      use-<feature>.ts              # e.g. useVesselBooking — composes queries + mutations + local state
    ui/                             # Small presentational hooks (useDisclosure, useClipboard, ...)

  api/
    <feature>.client.ts             # Typed client calls (wraps the generated OpenAPI client)
    query-keys.ts                   # Hierarchical query keys for this feature
    schemas.ts                      # zod schemas for response/request validation at the boundary

  state/                            # Client-only state — only when the feature has cross-component UI state
    <feature>-store.ts              # Zustand store (or React Context + reducer) scoped to this feature

  types/
    <feature>.types.ts              # Domain types not owned by the API schema

  i18n/                             # Feature-scoped translation files (if using lazy-loaded translations)
    en.json
    ar.json
```

### Module rules

- **One feature owns one domain workflow.** If a folder tries to do two things, split it.
- **`index.ts` is the public surface.** Only the page component(s), the feature hook, and public types are exported. Internal queries, stores, and components are imported via relative paths within the feature, never from outside.
- **Cross-feature imports go through `src/shared/`** or through another feature's `index.ts`. No deep imports like `features/a/hooks/queries/...` from feature B.
- **`query-keys.ts` is the single source of truth for cache keys** used by the feature. Never inline `['vessels', id]` in a component — use `vesselKeys.detail(id)` from the factory. Inline keys break invalidation (you can't `invalidateQueries({ queryKey: vesselKeys.lists() })` if the list query was registered with an ad-hoc array).
- **The feature hook is the facade.** Pages call the feature hook; they do not import raw queries, mutations, or the store directly. See §Feature Hooks.
- **Route files are part of the module.** A feature's `<feature>.routes.tsx` is imported into `src/app/router/`; the router does not hard-code feature paths inline.
- **No top-level `state/` folder** unless the feature actually needs one. For many features the feature hook + component state is enough.

### Shared folder

```text
src/shared/
  ui/            # Design-system wrappers, generic UI primitives (Button, Modal, ...)
  hooks/         # Generic hooks (useDebounce, useLocalStorage, ...)
  lib/           # Generic utilities (date formatting, formatters, http helpers)
  types/         # Cross-feature shared types
  api/           # Global HTTP client setup, interceptors, auth, error mapping
  i18n/          # i18n bootstrap, shared keys, language switcher
```

- Shared is for **domain-neutral** building blocks. A component used by one feature lives in that feature — promote to `shared/` only when a second feature actually needs it and the API can be generalized.
- No feature-specific cards, filters, tables, dialogs, stores, or types in shared.

### `src/app/` (composition layer)

```text
src/app/
  main.tsx
  App.tsx
  router/
    index.tsx                       # Combines feature routes, error boundaries, layouts
  providers/
    query-provider.tsx              # QueryClientProvider
    auth-provider.tsx
    i18n-provider.tsx
    theme-provider.tsx
```

- `src/app/` is the composition root. It imports from features and shared; it is not imported by features.

## Components

- Keep components focused on presentation and user interaction. Move data fetching, business rules, and cross-component state into hooks.
- Prefer function components with hooks. No class components in new code.
- Type all props explicitly. Prefer discriminated unions over optional flags (`type Props = { variant: 'primary' } | { variant: 'danger'; confirm: string }`).
- One responsibility per component. Split when you have unrelated state branches, unrelated UI regions, several independent loading/error states, or logic that takes more than a short scan to understand — not on line count alone. Line count is a weak proxy; size is a signal to *look*, not a rule.
- Memoize for a specific purpose, not reflexively. Full rules and worked examples in `references/react-craft.md` §Memoization. Default: don't memoize until the React DevTools Profiler shows a hotspot.
- Use the design system from the shared package. Do not re-implement primitives.

## Component Responsibility

- **Page components** (in `pages/`) coordinate route params, the feature hook, layout, and high-level UI state. They do not call queries or mutations directly.
- **Feature components** (in `components/`) render feature-specific UI and raise feature-level callbacks. They may accept typed data but should not fetch it.
- **Shared components** (in `src/shared/ui/`) are domain-neutral. They are configurable via typed props only, never via hidden context dependencies.
- Split a component when it has multiple unrelated UI regions, unrelated forms, several independent loading/error states, or logic that takes more than a short scan to understand.

## Feature Hooks (the facade equivalent)

A feature hook is the **public composition surface** of a feature. It wraps queries, mutations, and local state behind one narrow hook signature that pages consume.

A feature hook owns:

- Composing multiple query/mutation hooks into one feature operation.
- Exposing a typed, stable shape: `{ data, isLoading, error, actions: { create, update, delete } }`.
- Triggering the right cache invalidation after mutations.
- Bridging local UI state (selection, filters) with server state.

A feature hook does not own:

- Raw fetch calls — those belong in `api/<feature>.client.ts`.
- Durable business rules — those belong on the server.
- Route params or navigation — those belong in the page.
- DOM concerns.

When NOT to add a feature hook:

- The page uses one query with no local state. Let the page call the query hook directly.
- The feature has no mutations, no cross-component state, and no derived selections. A facade is overhead.

Add a feature hook when two or more of these are true: multiple queries feed one view, mutations must invalidate several reads, the feature has local UI state that relates to server state, or you are stitching together data across features.

## Reactivity and State

Keep four kinds of state separate. Pick the tool per kind. Do not reach for Zustand because "we might need it later."

### 1. Local component state

- `useState` / `useReducer` for state used inside one component.
- Lift to the parent only when a sibling needs it. Do not lift earlier "just in case."
- Use `useReducer` when the next state depends on the previous and transitions are non-trivial.

### 2. Cross-component feature state

- Default: **React Context + `useReducer`** scoped to the feature's page shell. Keeps the state co-located with the feature.
- Reach for **Zustand** when the context would cause excessive re-renders (selectors across many deep components), when actions are many, or when you need middleware (persist, devtools, logger).
- Store the Zustand store under `features/<feature>/state/<feature>-store.ts`. Do not promote to app-wide unless another feature actually needs it.

### 3. Cross-feature / app-wide client state

- Justify it before adding it. Most "global" client state is actually feature-owned or server-owned.
- Use a single app-level Zustand store (or a handful of scoped ones) under `src/app/` for concerns that cross features: auth session, feature flags, app-wide UI (sidebar open, active theme).
- **Do not use Redux in new apps.** Use Zustand for app-wide client state and TanStack Query for server state. Redux is allowed only when the team already runs on Redux at scale or genuinely needs time-travel debugging — record the decision in an ADR.

### 4. Server state (data fetched from APIs)

Treat as a distinct category with its own tool. Do not store it in `useState`, Context, or Zustand by default — you will re-implement caching, invalidation, and deduplication badly.

**AD Ports default: TanStack Query.** Alternatives (SWR, Apollo for GraphQL, RTK Query) require an ADR.

TanStack Query rules:

- **Query keys are hierarchical and centralized** in `features/<feature>/api/query-keys.ts`. Example: `vesselKeys.all`, `vesselKeys.list(filters)`, `vesselKeys.detail(id)`.
- **Stale times match data volatility.** Reference data: long (hours). User data: short (seconds to a minute). Real-time: `staleTime: 0` + polling or websockets.
- **Mutations invalidate the affected keys** on success. Optimistic updates only when the change is cheap to roll back.
- **Validate responses with zod at the boundary** in `api/schemas.ts`. Cheap safety net for API drift.
- **Retries off for non-idempotent calls.** Default `retry: 3` is fine for reads; for mutations, set `retry: 0`.
- Follow the §Current React Direction rule: do not fetch in `useEffect` — all server state flows through TanStack Query hooks.

### URL state

- Filters, pagination, sort, tab selection — keep in the URL via React Router search params. Users can share links; back/forward work.
- Typed helpers: wrap `useSearchParams` with a zod schema so the URL is parsed and validated on every read.

### State anti-patterns

See `references/anti-patterns.md` §State for the canonical list (rejection-citable).

## Routing

- Use React Router data-router (`createBrowserRouter` + `RouterProvider`). Enables loaders, actions, and route-level error boundaries.
- Lazy-load feature routes with `React.lazy` + Suspense, or via route `lazy` imports.
- Auth guards at the route boundary, not inside components. A `<RequireAuth>` route element or a loader that throws a redirect.
- Error boundaries per route + a top-level fallback.
- Keep route definitions inside the feature (`<feature>.routes.tsx`); the top-level router composes them.

## Forms

Standard: **shadcn `<Form>` + react-hook-form + zod**. Architectural rules:

- **Schema is the source of truth.** Define one zod schema per form; derive the TS type via `z.infer<typeof schema>`. Server validation, client validation, and field types all flow from the schema.
- **Schemas live next to the API client** (`features/<feature>/api/schemas.ts`) when they shape a request body, or next to the form component when they're UI-only.
- **Validation messages route through the central `validationMessage` helper** — never inline strings (`'This field is required'`) in components. See `references/i18n-and-locale.md`.
- **Server validation errors flow back through the shared HTTP error mapper** to `setError(field, ...)` — features never re-implement the mapping. Preserve user input on recoverable failures.

Full patterns (wizards, field arrays, conditional fields, server-driven schemas, dirty guards, auto-save, GCC-specific validation, mobile-first) live in `references/forms-patterns.md`.

## HTTP Integration

- **One HTTP client.** Typed from OpenAPI (`openapi-typescript` + `openapi-fetch`) and wrapped in `src/shared/api/`.
- **Interceptors centralized:** auth token attach, 401/403 handling, error normalization to `{ message, code, fieldErrors }`, logging/telemetry.
- **Components do not import the raw client.** Components → feature hook → query hook → `features/<feature>/api/<feature>.client.ts` → shared HTTP client.
- Regenerate the OpenAPI client in CI; commit the output so reviewers see the diff.

End-to-end wiring patterns (mutations, error mapping, MSW, auth flow) live in `workflows/wire-data.md`.

## UI states (Empty / Loading / Error / Unauthorized)

Three shared primitives in `@shared/ui/` standardize how we render non-success UI states. **Use these instead of hand-rolling per feature.**

### `EmptyState`

When a query returns zero results.

- Renders an icon, a title, an optional description, and an optional action.
- Action when the empty result is **filter-driven** ("Clear filters") or **action-driven** ("Create your first vessel"). No action when the empty state is genuinely terminal.
- Never just text on a blank page.

### `LoadingState`

For first-paint and route-level loading.

- **Skeletons over spinners** for first paint. Skeletons that match the destination layout (rows of the table, cards on the dashboard) — not a centered spinner.
- Spinners only for short, action-bound waits (button click → 200ms–2s mutation).
- Never block UI for > 200ms without feedback.
- The component accepts an optional `label` for screen readers (`aria-busy="true"` is set automatically).

### `ErrorState`

For query failures, route errors, and unrecoverable feature crashes.

- Renders a title, a user-facing message (mapped via the shared error mapper — never a raw API error), and a **retry action**.
- The retry button is required. Users must never end at a dead screen with no path forward.
- Pair with `Suspense` + Error Boundary at the route boundary (see `references/react-craft.md` §Error boundaries) — `ErrorState` is the visual; the boundary is the catch.

### `UnauthorizedState` (optional)

When a query returns 403 or the user lost permission. Shows a sign-in / contact-admin path. Do not silently redirect to login on 403 (that hides the cause); 401 is a redirect, 403 is a state.

### Rules

- Every page renders these states explicitly. The DoD checks for it.
- Tables and lists embed the state inside the body (spanning all columns), not above or below.
- For inline / partial states (one widget on a dashboard fails while others succeed), use a smaller variant of `ErrorState` rather than tearing down the whole page.

## Storybook and Component Documentation

Use Storybook for components whose states are hard to reach in the running app or that are reused across features. It is not a substitute for tests; it is a visual catalog + interaction sandbox.

- **What to document:** shared UI primitives (`src/shared/ui/`), every feature component that has non-trivial variants (loading, error, empty, disabled, RTL), and design-system wrappers.
- **What NOT to document:** page components (test them via RTL + Playwright; they change too often for stable stories), pure utilities.
- **File location:** colocate `*.stories.tsx` next to the component.
- **Stories per component:** at minimum Default, plus one per variant and one per edge state (empty, error). For i18n-heavy components, add an `RTL` story that wraps the component in `dir="rtl"`.
- **Interactions:** use `@storybook/test` (`play` functions) to drive user interactions when a story is worth exercising like a test — not as a replacement for component tests.
- **Accessibility addon:** enable `@storybook/addon-a11y` and treat violations as failures in CI.

Don't run Storybook and a duplicate "component gallery" page. Pick one.

## Environment and Configuration

- **Build-time config** via `import.meta.env.VITE_*` — validated at bootstrap with zod. Crash early on missing or malformed values.
- **Runtime config** (values that change per deployment without a rebuild) — fetch `/config.json` at bootstrap and validate with zod. Do not bake runtime config into the bundle.
- **Secrets never in `VITE_*`** — those ship to the browser.
- Centralize access to config in `src/shared/config/env.ts`; do not read `import.meta.env.*` scattered through feature code.

Full pattern and example in `references/coding-conventions.md` §Environment & configuration.

## Rendering and Performance

- Lazy-load routes at feature boundaries.
- Code-split large third-party libraries (date libs, rich editors, chart libs).
- Track bundle size in CI with `size-limit` or an equivalent — fail the PR on regressions beyond the budget.
- Prefer `Suspense` + skeletons for first paint; spinners for actions; never block UI for > 200ms without feedback.
- Memoization: see §Components for the rule and `references/react-craft.md` §Memoization for the worked examples.
- Image strategy: responsive `srcset`, modern formats (AVIF/WebP), lazy below the fold. Use the DS image component.

### Performance budget (defaults — override per project in the ADR)

- Lighthouse performance ≥ 80 on a representative page, run in CI.
- LCP ≤ 2.5s, CLS ≤ 0.1, TBT ≤ 200ms.
- Initial bundle regression > 5% (or > 10 KB gz, whichever is smaller) fails the build.

Record the agreed project budget in the repo's README or an ADR. If none is agreed, these defaults apply.

## Internationalization, RTL, and Locale

Translation library choice (`react-i18next` default), RTL layout, locale-aware text/dates/numbers, GCC working week, Hijri calendar, date/time/timezone discipline, and all anti-patterns: see `references/i18n-and-locale.md`.

## Testing

### Stack — one tool per layer

| Concern | Default tool | When to deviate |
|---|---|---|
| Unit tests (hooks, utils, schemas, mappers) | **Vitest** | Match the repo; do not introduce a second runner. |
| Component/DOM behavior | **React Testing Library** — query by role/label/text | Fall back to lower-level rendering only when RTL cannot express the interaction (rare). |
| TanStack Query in tests | Create a fresh `QueryClient` per test with `retry: false`, wrap in `QueryClientProvider`. Use `waitFor` for async states. | — |
| Feature hooks | `renderHook` from RTL with the feature's providers wrapped in a small test helper. | — |
| API mocking | **MSW** (Mock Service Worker) — one handler set shared between unit + dev. | `vi.mock` for pure-module mocks; never for HTTP. |
| End-to-end / critical journeys | **Playwright** (preferred) | Pick one E2E tool per app and stay with it. |
| Accessibility checks | `jest-axe` (via Vitest-compatible adapter) in unit + `axe-playwright` in E2E. | Manual keyboard verification for flows not yet covered. |
| Visual regression (optional) | Playwright screenshots on critical components. | Skip for internal dashboards where visual churn is high. |

**The standard test set is the table above** — Vitest + React Testing Library + MSW + Playwright + jest-axe / axe-playwright. Do not introduce additional mock/test libraries (`sinon`, `nock`, `enzyme`, `cypress` if Playwright is already chosen, ...) without a stated reason in the PR.

### Speed budget

- Unit suite < 30s.
- E2E suite < 5 min.
- Flake rate < 1%. Quarantine and fix on detection; do not merge known-flaky tests.

### Guidelines

- Test behavior, not implementation. Query by role/label/text, not `data-testid`.
- Do not unit-test design-system components — they are tested upstream.
- Do not unit-test trivial render output.
- Test feature hooks by driving inputs and asserting their exposed return value, not by inspecting private Query state.

## CI Pipeline

Required gates, optional gates, speed budget, and what to do when a gate fails: see `references/ci-pipeline.md`.

## Smells To Correct

- God components that fetch, validate, transform, persist, and style everything.
- Feature folders that import deeply into each other (`features/a/hooks/queries/...` from feature B).
- Query keys built from new object references on every render.
- Zustand stores holding server data.
- Shared folder used as a dumping ground for things that should live in a feature.
- CSS coupled to fragile DOM structure instead of component contracts.
- Memoization sprinkled without a measured hotspot.
