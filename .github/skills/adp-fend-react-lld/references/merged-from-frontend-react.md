# Merged Legacy Guidance: frontend-react

This reference preserves the canonical guidance merged from the removed non-ADP source skill `frontend-react`.
The active ADP task skill is `adp-fend-react-lld`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.

## Original references/anti-patterns.md

~~~markdown
# Anti-patterns — Canonical List

The full forbidden-pattern catalog. Workflow files cite this; reviewers cite this. New anti-patterns land here first.

**Sections:** Reuse · Module structure · State · Data wiring · Components · Forms · i18n / RTL · Date / time / timezone · Tests · Performance · Security · Tables · Routing.

## How to cite

- **By section** is the stable form: `references/anti-patterns.md §State`. Sections are stable across edits.
- **By bullet** is fragile — bullet order can shift. If you need to cite a specific item, quote the lead phrase: e.g. _"see `references/anti-patterns.md` §State, 'Mixing server data into Zustand'"_.
- **Authors:** when adding a new bullet, append at the end of its section. Do not insert in the middle, which shifts every bullet below it and breaks any in-flight references in PRs.

## ⛔ Reuse violations (the top of the rejection list)

- **Creating a parallel UI primitive** in a feature (`MyButton`, `CustomDialog`, `<div role="button">` styled to look like a button) instead of importing from `@shared/ui/`.
- **Forking a shared primitive** because it's missing a variant. Edit the shared primitive in place — see `references/ui-primitives.md` §Customization rules.
- **`import { X } from 'lucide-react'`** inside a feature instead of `<Icon name="..." />` from `@shared/ui/icon`.
- **Hand-rolled controlled inputs** instead of shadcn `<Form>` + `<FormField>` + react-hook-form + zod.
- **Raw `fetch` / `axios.create`** in a feature instead of the shared HTTP client + the feature's `api/<feature>.client.ts`.
- **A second state library** introduced for one feature instead of the kind's chosen tool (see `references/react-architecture.md` §Reactivity and State).
- **Re-implementing a generic hook** (`useDebounce`, `useDisclosure`, `useLocalStorage`) instead of importing from `@shared/hooks/`.

## Module structure

- **Layer-first folders at repo root** (`components/`, `services/`, `models/`) instead of feature modules under `src/features/`.
- **Deep imports across features** (`@features/other/hooks/queries/...`). Cross-feature imports go through the other feature's `index.ts`.
- **Wildcard re-exports** in a feature `index.ts` (`export * from './...'`). The public surface is explicit pages + routes + feature hook + types only.
- **Registering routes inline in the top-level router** instead of via `<feature>.routes.tsx`.
- **Adding `state/` "because we might need it"** before the feature has cross-component UI state.
- **Promoting a feature-scoped Zustand store to app-level** because two features read from it. Usually a sign the data belongs in a server-state query.

## State

- Mixing **server data into Zustand** or Context — double-cache + manual invalidation bugs.
- `useState` that **mirrors a query result** (`const [data, setData] = useState(); useEffect(...fetch...)`).
- **Query keys built from object references** every render (`['x', filters]` where `filters` is a new object) — cache never hits.
- **`staleTime: 0`** on every query so the UI refetches on every mount.
- **`useEffect` with an `async` function directly** — returns a Promise, not a cleanup.
- A **feature hook that exposes raw query/mutation objects** — defeats the facade purpose.
- Picking a state tool **for the whole feature** ("we'll use Zustand") instead of picking per kind.
- **Inline query keys** (`['vessels', id]`) in components or hooks — always go through the feature's `query-keys.ts`.

## Data wiring

- Fetching in `useEffect` + `useState` instead of TanStack Query.
- Polling at < 5s on screens nobody's looking at — battery, network, and backend load.
- Silent `catch (e) {}` that leaves the UI stuck.
- Multiple components implementing the **same error mapping** instead of the shared mapper.
- Ad-hoc auth token handling **in components or feature code** — must live in the shared interceptor.

## Components

- **God components** that fetch, validate, transform, persist, and style everything.
- A single component holding **multiple unrelated state branches** "because it all belongs together" — split into page + feature hook + focused components.
- `<div onClick>` instead of `<button>` or `<a>`.
- Loading state that's a **frozen UI with no indicator**.
- Form errors that **disappear after one keystroke**.
- ARIA roles **slapped on without testing with a screen reader**.
- **Snapshot tests on rapidly changing UI**, or on **locale-dependent output** (dates, numbers, currency) — they will flake across `en` / `ar`.
- **Memoization** (`useMemo`, `useCallback`, `React.memo`) sprinkled without a profiler-identified hotspot.

## Forms

- `watch()` driving conditional rendering — re-renders the whole form on every keystroke. Use `useWatch`.
- `useEffect` syncing one field's value to another — use `setValue` from a change handler or a zod refinement.
- **Inline error strings** in JSX (`*ngIf`-style) — route through the central `validationMessage` helper.
- **Disabling fields while submitting** — disable the button only.
- **Async validation on every keystroke** — debounce or run on blur.
- **Auto-save without surfacing the save state** — users distrust silent saves.
- Storing uploaded `File` objects in cache or global state — keep server-issued ids/URLs.
- **Persisting wizard state in the URL** — URLs grow huge and break the share-a-link guarantee.

## i18n / RTL

- **Hard-coded English strings** with a "TODO: translate" comment.
- **Inline validator error strings** (`errors.name?.type === 'required' && 'This field is required'`) — route through `validationMessage`.
- **Physical-direction Tailwind classes** (`ml-*`, `mr-*`, `left-*`, `right-*`) on layout-affecting elements. Use logical properties.
- Icons that **point the same direction in both locales**.
- Formatting currency or dates with **string concatenation** instead of `Intl.*`.
- **Translation keys equal to the English sentence** (`t("Save and continue")`) — they break when copy changes.
- i18n/RTL treated as a **post-implementation sweep** — forces string extraction and RTL mirroring to be retrofitted into written templates.

## Date / time / timezone

- Storing a "date string" in the user's local format on the wire.
- `new Date(dateString).toLocaleString()` without specifying the timezone — falls back to the user's browser, which is wrong for port operations.
- Mixing display timezones on one screen without labels.
- Using `Date` arithmetic for "tomorrow at 09:00 in Asia/Dubai" — DST and offsets bite. Use `date-fns-tz` or Temporal.
- Formatting with template strings (`` `${d.getHours()}:${d.getMinutes()}` ``) — ignores locale, ignores Arabic digits.

## Tests

- `getByTestId` / `data-testid` as the **default query**.
- Tests asserting **component private fields**.
- **Asserting on TanStack Query internals** (`queryClient.getQueryState(...)`) instead of the feature hook's public surface.
- Over-mocking services so **broken templates still pass**.
- **`vi.mock` on the HTTP client** instead of letting MSW handle it — drifts from what dev sees.
- E2E tests that **assert arbitrary text without role/label** anchors.
- **Skipped flaky tests** without an owner and fix date.

## Performance

- **Single 500-LOC component** "because it all belongs together."
- **Importing entire date / util libraries** for one function.
- **Lighthouse or bundle-size run only locally**, never in CI.
- **Logging PII or raw error bodies** to analytics / Sentry.
- **Memoization sprinkled without a measured hotspot** — `useMemo` and `React.memo` cost CPU too.

## Security

- `dangerouslySetInnerHTML` with user content **without sanitization**.
- User-controlled `href` / `src` **without URL-scheme validation** (`safeHref` / equivalent).
- **Bearer tokens in `localStorage`** — accessible to any script that runs in the page; one XSS leaks every token.
- **Mixing cookie sessions and bearer tokens** in one app — error-prone, prefer one auth model per surface.
- **Logging URL query strings, request bodies, or user PII** to analytics / Sentry.
- **`?returnTo=...` redirects without same-origin validation** — known phishing vector.
- **Unsanitized Unicode bidi control characters** (U+202A–U+202E, U+2066–U+2069) in user-generated content.
- `eval`, `Function(...)`, `setTimeout(stringArg, ...)` — none should exist.

## Tables

- Hand-rolling table HTML in a feature instead of using `@shared/ui/table` + `@shared/ui/data-table`.
- Inlining column definitions inside the render function — re-creates on every render and TanStack re-instantiates the table.
- **Client-side pagination on tables backed by a paginated API** — UX feels broken.
- Sort icons that **don't mirror in RTL**.
- Storing the entire dataset in Zustand because "we want client-side filtering" — keep server data in TanStack Query and let the server filter.
- **`role="grid"`** on a non-editable table.

## Routing

- **Auth guards inside components** instead of at the route boundary. Components render after auth has already been decided; guards belong on `element` / `loader` of the route.
- **Treating client-side guards as authorization.** Guards are UX — the server still enforces access. A guard that hides a button is fine; a guard that's the only check is a vulnerability.
- **Hard-coded feature paths** in the top-level router (`<Route path="/vessels" element={<VesselListPage />} />`) instead of importing each feature's `<feature>.routes.tsx`.
- **Missing per-route error boundary.** One feature's render crash blanks the entire app. Every feature route gets an `errorElement`.
- **No loading boundary.** Lazy-loaded routes need a `Suspense` ancestor with a skeleton or `LoadingState` fallback. Without one, the user sees blank space while chunks load.
- **Routes not lazy-loaded** (`element: <BigPage />` instead of `lazy: () => import('./big.page.tsx')`). Initial bundle inflates with code the user may never run.
- **`Link` to a `string` from props** without scheme validation when the string can come from user input. See `references/anti-patterns.md` §Security (URL allowlist).
- **Mutating history outside the router** (`window.history.pushState`) instead of `useNavigate` — bypasses React Router's state and breaks the back button.
- **404 routes registered per feature** instead of one `*` catch-all at the app router level. Causes inconsistent fallbacks across features.
~~~

## Original references/ci-pipeline.md

~~~markdown
# CI Pipeline

The gates that run on every PR. The PR is not mergeable until all required gates pass.

## Required gates

| Gate | What it runs | Fails on |
|---|---|---|
| **Typecheck** | `tsc --noEmit` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) | Any type error. |
| **Lint** | ESLint with the plugin set in `references/coding-conventions.md`; warnings treated as errors. | Any lint error or unsuppressed warning. |
| **Format** | Prettier check (`pnpm prettier --check`). | Any unformatted file. |
| **Unit tests** | Vitest. | Any failing test; suite total > 30s. |
| **E2E tests** | Playwright on the top journeys per persona, headless. | Any failing test; suite total > 5 min. |
| **Accessibility** | `jest-axe` on critical components in unit; `axe-playwright` in E2E. Storybook a11y addon if Storybook is in CI. | Any axe violation. |
| **Bundle size** | `size-limit` (or equivalent). | Initial bundle regression beyond the project's budget. |
| **Lighthouse** | `@lhci/cli` (Lighthouse CI) on a representative page; pin a baseline in `lighthouserc.json`. | Performance score below project budget on changed pages. |
| **OpenAPI client** | Regenerate the client; fail if the generated diff isn't committed. | Stale client. |

## Optional gates (recommended)

- **Visual regression** — Playwright screenshot diffs on critical components. Skip on UI-churning teams; enable once the design system stabilizes.
- **Mutation testing** — **Stryker.js** (`@stryker-mutator/core`) on critical pure modules (validators, mappers). Slow; run nightly, not per PR.
- **License / supply-chain scan** — Snyk / `pnpm audit` / equivalent. High-severity findings open issues, not silent warnings.

## Speed budget

- Total CI wall time per PR: ≤ 10 min on a green pipeline.
- Cache typecheck and lint outputs by file hash; only re-run on changed files where possible.
- E2E parallelizes across workers — do not run journeys sequentially.

## When a gate fails

- **Author fixes**, then pushes a new commit. Reviewers do not merge red CI.
- **Quarantine** flaky tests with an issue link and an owner; do not silently skip.
- **Bundle / Lighthouse regressions** — diagnose with `source-map-explorer` (bundle) or the Lighthouse trace (perf) before relaxing the budget. Budgets relax with an ADR, not a one-off override.
- **Auth / security gate failures** (axe violations on auth flows, supply-chain high-severity) — escalate to the Security reviewer per `references/coding-conventions.md` §Review process before merging.
~~~

## Original references/coding-conventions.md

~~~markdown
# Coding Conventions (React)

Naming, imports, exports, aliases, linting, config — the shared rules that keep a codebase consistent across developers.

## Contents

- [Package manager](#package-manager)
- [Search before creating](#search-before-creating)
- [File naming](#file-naming)
- [Export style](#export-style)
- [Component naming](#component-naming)
- [Path aliases](#path-aliases)
- [Import order](#import-order)
- [TypeScript](#typescript)
- [Linting](#linting)
- [Prettier](#prettier)
- [Styling - Tailwind (the AD Ports standard)](#styling--tailwind-the-ad-ports-standard)
- [Class composition](#class-composition)
- [Environment & configuration](#environment--configuration)
- [Commit messages](#commit-messages)
- [Pull request conventions](#pull-request-conventions)
- [Review process](#review-process)
- [Folder & file skeleton reminder](#folder--file-skeleton-reminder)

## Package manager

**pnpm is the AD Ports standard.** Workflow examples in this skill use `pnpm <script>`; if your repo uses `npm` or `yarn` swap accordingly, but do not mix package managers within an app. Lockfile (`pnpm-lock.yaml`) is committed.

## Search before creating

Before writing any new component, hook, util, or schema, search for an existing one. The codebase already has answers for most needs:

| Need | Search first |
|---|---|
| UI primitive (button, dialog, input, select, popover, table, tooltip, ...) | `@shared/ui/*` (shadcn-vendored). Deeper rules in `references/ui-primitives.md`. |
| Icon | `@shared/ui/icon` (`<Icon name="..." />`) — never `lucide-react` directly |
| Generic hook (debounce, disclosure, clipboard, local storage, intersection, ...) | `@shared/hooks/*` |
| Feature-internal hook | `features/<feature>/hooks/ui/*` |
| Format / parse / merge util | `@shared/lib/*` (`cn`, `formatCurrency`, `formatDate`, ...) |
| HTTP call | `@shared/api/http` + `features/<feature>/api/<feature>.client.ts` — never raw `fetch` / `axios` in features |
| Form scaffolding | shadcn `<Form>` + `<FormField>` (in `@shared/ui/form`) — never hand-rolled controlled inputs |
| Client state (local / feature / app) | The kind's chosen tool — see `references/react-architecture.md` §Reactivity and State. Never introduce a second state library. |
| Server state | TanStack Query via the feature's query hooks. Never `useEffect` + `useState` for data. |
| Validation message i18n | The central `validationMessage` helper (see `references/i18n-and-locale.md` and `references/react-architecture.md` §Forms) — never inline strings. |

**If it exists, import it.** If it almost-exists but is missing a variant, edit the existing one. **Do not** create `MyButton`, `CustomDialog`, `IconWrapper`, `useFetch`, or any parallel implementation. Forking primitives is a hard violation of the skill.

This is the single rule most new code violates. AI generators in particular need to see this rule before any other.

For the **primitive-specific** rules (customization, icon registry, dark-mode behavior, RTL verification, `// AD Ports edit:` markers), see `references/ui-primitives.md` ⛔ — it's the deeper dive on the same rule applied to `@shared/ui/`.

## File naming

- **Kebab-case for all files and folders**: `vessel-list.page.tsx`, `use-vessel-booking.ts`, `query-keys.ts`.
- Multi-word React components keep kebab-case in the file name; the export is PascalCase. File `vessel-list.page.tsx` → export `VesselListPage`.
- Suffixes communicate role:
  - `*.page.tsx` — route-level page component.
  - `*.component.tsx` — optional; most feature components omit the suffix and just use the name (`vessel-row.tsx`).
  - `*.test.tsx` — unit/component test.
  - `*.spec.tsx` — reserved for Playwright/E2E specs.
  - `*.stories.tsx` — Storybook stories.
  - `*.types.ts` — type-only module.
  - `*.schemas.ts` — zod schemas.
  - `*.routes.tsx` — feature route definitions.
  - `use-*.ts` — hooks.

## Export style

- **Named exports only.** No `export default` except where a framework demands it (`React.lazy(() => import('./x'))` — and even then, use a named `.then` re-map to keep the named export).
- One primary export per file. Colocate tightly-coupled helpers (`function helper() {...}`) in the same file if they're private to the module.
- Re-export through the feature's `index.ts`, never through a `components/index.ts` barrel.

```ts
// ❌
export default function VesselList() { ... }

// ✅
export function VesselList() { ... }
```

React.lazy exception:

```tsx
// Re-map the named export to React.lazy's required `default` shape — keeps the source file's named-only convention intact.
const VesselListPage = lazy(() =>
  import('./vessel-list.page').then((m) => ({ default: m.VesselListPage })),
);
```

## Component naming

- Components: `PascalCase` (`VesselList`, `BookingDialog`).
- Hooks: `camelCase` starting with `use` (`useVesselBooking`, `useDisclosure`).
- Utilities: `camelCase` (`formatCurrency`, `parseFilters`).
- Constants: `SCREAMING_SNAKE_CASE` for module-level immutable values (`DEFAULT_PAGE_SIZE`).
- Types and interfaces: `PascalCase` (`Vessel`, `VesselFilters`). Prefer `type` over `interface` unless you need declaration merging.
- Enums: avoid. Use a union of string literals (`type Status = 'available' | 'booked'`).
- Boolean props and state: `is*` / `has*` / `can*` / `should*` (`isLoading`, `hasError`, `canEdit`). Not `loading`, not `error`.

## Path aliases

Configure in `tsconfig.json` and the bundler. Preferred aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@app/*": ["src/app/*"]
    }
  }
}
```

Rules:
- Use `@/` for imports that cross top-level directories.
- Use relative paths (`./`, `../`) for imports within the same feature.
- **Never** deep-import into another feature: `@features/other/hooks/queries/...` is banned; go through `@features/other` (which resolves to its `index.ts`).

## Import order

Enforced by `eslint-plugin-import` `import/order` rule. One blank line between groups.

1. Node built-ins (rare in the browser).
2. External packages (`react`, `react-router-dom`, `@tanstack/react-query`).
3. Internal aliases (`@/shared/...`, `@/features/...`).
4. Parent relatives (`../../..`).
5. Sibling relatives (`./something`).
6. Type-only imports (`import type { ... }`) — **inline within their respective group** (external types alongside external values, internal types alongside internal values). Do not collect all type imports at the bottom.
7. Style imports (`./foo.module.css`).

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { http } from '@shared/api/http';
import type { Vessel } from '@features/vessels';

import { parseFilters } from '../lib/parse-filters';

import { vesselKeys } from './query-keys';
```

## TypeScript

- `strict: true` in `tsconfig.json`. Also `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`.
- **No `any`.** Use `unknown` at boundaries and narrow with zod or a type guard.
- Derive types from zod schemas (`type Vessel = z.infer<typeof vesselSchema>`) so the schema is the single source of truth.
- Use discriminated unions for props with mutually exclusive variants.
- Prefer `as const` on literal arrays/objects to get narrow tuple/readonly types.
- Do not use non-null assertions (`value!`) — narrow explicitly.

## Linting

Minimum plugin set, enforced in CI:

- `@typescript-eslint/recommended` (strict variant).
- `eslint-plugin-react-hooks` — rules of hooks.
- `eslint-plugin-jsx-a11y` — accessibility lints on JSX.
- `eslint-plugin-react-refresh` — catches code that breaks Fast Refresh.
- `eslint-plugin-import` — import order and no-cycle.
- `eslint-plugin-tailwindcss` — class order, no conflicting classes, no deprecated utilities (Tailwind projects).
- `eslint-plugin-testing-library` + `eslint-plugin-jest-dom` (or `vitest-globals`) — idiomatic test assertions.
- `@tanstack/eslint-plugin-query` — catches common TanStack Query pitfalls (missing `queryKey`, mutating cache directly, unstable keys).

Treat warnings as errors in CI. Zero `eslint-disable` without a comment explaining why and a date.

## Prettier

Use Prettier for formatting. Treat its output as canonical — do not hand-format around it.

- Single quotes, semicolons, trailing commas `all`, print width 100.
- Prettier and ESLint stylistic rules must not overlap — disable stylistic ESLint rules that Prettier handles.

## Styling — Tailwind (the AD Ports standard)

**Tailwind is the standard.** v4 is the preferred direction (CSS-first config, no `tailwind.config.js`); v3 is supported until apps upgrade. Do not introduce CSS modules in new code — they're tolerated only in legacy apps that pre-date the standard, and those apps should plan migration.

No inline `style={{}}` attributes except for runtime-computed values (e.g. dynamic positioning, animation `--vars`).

## Class composition

Use `clsx` for conditional classes and `tailwind-merge` to resolve Tailwind conflicts. For components with many variants, use `class-variance-authority` (`cva`).

```ts
// @shared/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge conditional Tailwind classes via clsx, then resolve conflicts (e.g. `p-2` vs `p-4`) via tailwind-merge so the last-wins rule produces the expected styling.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Rules:
- Every component that accepts `className` merges via `cn(baseClasses, className)`.
- Prefer `cva` over hand-rolled conditionals once a component has 3+ boolean/variant props.
- Always use logical properties in classnames (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) — never `ml-*` / `mr-*` / `left-*` / `right-*` on layout-affecting elements.

## Environment & configuration

- Use `import.meta.env.VITE_*` for build-time config. Prefix all exposed vars with `VITE_`.
- Validate env at bootstrap with zod. Crash early on missing or malformed values.

```ts
// src/shared/config/env.ts
import { z } from 'zod';

// Schema for build-time env vars — every VITE_* the app reads must be declared here.
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_APP_ENV: z.enum(['dev', 'uat', 'prod']),
});

// Validate at module load so a missing/malformed env crashes the app at boot, not at first call site.
export const env = envSchema.parse(import.meta.env);
```

- For runtime config (values that change per deployment without a rebuild), fetch `/config.json` at bootstrap and validate with zod. Don't bake runtime config into the bundle.
- Never put secrets in `VITE_*` vars — they ship to the browser.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`). Scope optional but recommended: `feat(vessels): add status filter`.

## Pull request conventions

- Title matches the commit style.
- Description names the feature module(s) touched and the user-visible change.
- Screenshot or short video for any UI change (both `en` LTR and `ar` RTL when applicable).
- Self-review checklist from `workflows/harden-feature.md` §First-PR self-review checklist completed before requesting review.
- Bundle-size diff and Lighthouse numbers for feature work that affects page-load pages.

## Review process

Who reviews what determines speed and signal. Default mapping:

| Change touches | Required reviewer |
|---|---|
| `@shared/ui/*` (primitive added or edited) | **Design-system owner** + one peer |
| `@shared/api/*` (HTTP, interceptors, auth) | **Security engineer** + backend partner |
| `@shared/config/env.ts` (env shape) | **Platform/SRE** + one peer |
| Feature code only (`features/<x>/...`) | One peer in the feature team |
| New feature module (`features/<new>/`) | One peer + **Design-system owner** (UI compliance) |
| CI / pipeline files | **Platform/SRE** |
| `tsconfig.json`, ESLint config, Vite config | One peer + governance lead (if standards-affecting) |

**Lead-time SLA**: first review within **1 working day** for feature PRs, **same day** for hotfixes. PRs older than 3 days without review get pinged in the team channel; older than a week, escalate to the **frontend tech lead** (or, if absent, the engineering manager). Repeated escalation across PRs is a process signal — fix the assignment / capacity, not just the individual PR.

**Merge gate**: green CI + at least one approving review + no unresolved threads. Author merges (squash by default; preserve commits only when the PR has clean atomic history).

**Author responsibilities**:
- Run the self-review checklist before requesting review. Reviewers should not catch trivia.
- Respond to threads within 1 working day; "I'll fix this in a follow-up" is not an acceptable resolution unless an issue is filed.
- Keep PRs ≤ 400 lines diff where possible. Larger PRs need a written reason in the description.

**Reviewer responsibilities**:
- Read the description first; read the code with the description in mind.
- Cite skill rules when rejecting (`SKILL.md ⛔`, `references/react-architecture.md §X`) — don't just say "this is wrong."
- Distinguish blocking comments (request changes) from suggestions (comment) clearly.

## Folder & file skeleton reminder

See `references/react-architecture.md` §Feature Module Structure for the canonical layout. Conventions above are what keep every module inside that layout consistent across developers.
~~~

## Original references/data-table.md

~~~markdown
# Data Tables

AD Ports apps are heavy on tables — vessels, bookings, manifests, customs declarations. Tables are not "just rows of data"; they have specific best practices around performance, accessibility, RTL, and reusability.

## Standard

**TanStack Table v8** is the AD Ports default for any non-trivial table. Reasons:

- Headless — works with any UI primitive (in our case, the shadcn `Table` family).
- Strong TypeScript ergonomics; columns are typed against the row type.
- Built-in sorting, filtering, pagination, row selection, expansion, column visibility — without you re-implementing them.

For trivial tables (≤ 20 fixed rows, no sort, no filter), a plain `<Table>` from `@shared/ui/table` is fine.

## Reuse, do not recreate (table edition)

Before building a table:

- The base table primitives (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`) live in `@shared/ui/table`. Import from there. Do not re-style raw `<table>` elements in features.
- The shared `<DataTable />` wrapper (TanStack-Table-bound, columns prop, pagination prop) lives in `@shared/ui/data-table`. Most feature tables consume this — they do not redo column rendering, sort UI, or pagination by hand.
- A feature table renders **column definitions and a row type**, not table HTML.

If `@shared/ui/data-table` does not yet exist in the app, build it once in shared, not per feature. After two features have a table, the shared wrapper is mandatory.

## Column definitions

- Define columns in `features/<feature>/components/<feature>-table.columns.ts` — separate from the rendering component. Keeps the column array stable (avoid re-creating it on every render — TanStack memoizes by reference).
- Each column has a stable `id` (use the field key by default; avoid relying on header text).
- `accessorFn` over `accessorKey` when the cell value is derived (joined fields, formatted strings) — keep formatting in the cell renderer, not in the accessor.
- `header` and `cell` go through `t()` and the design-system primitives (`<Icon />`, `<Badge>`, etc.). Never inline JSX strings.

## Sorting

- Use TanStack's built-in sorting state. Persist sort to the URL via `useTypedSearchParams` so links and back/forward work.
- Column-level `enableSorting: false` for columns that are derived or not meaningfully orderable (e.g. action columns, computed totals when the dataset is paginated).
- Sort indicators in the header: use the `<Icon name="chevron-up" />` / `<Icon name="chevron-down" />` from the icon registry. **Mirror in RTL** via `mirrorInRTL` or by swapping which direction means asc.
- Server-side sort (sets `manualSorting: true`) when the table is paginated — the server returns sorted slices; the client only renders.

## Filtering

- Filters live above the table, not in column headers, unless the column header is the natural place (e.g. status pill column with a small filter chip).
- Filter state lives in the URL (`useTypedSearchParams`) — same reason as sort.
- Server-side filtering for paginated tables; client-side only when the full dataset is in memory.

## Pagination

- Default to **server-side pagination** (`manualPagination: true`). Client-side only for known-small datasets.
- Page size choices: 10 / 25 / 50 / 100 by default. Persist the user's choice in localStorage keyed by table id (so users don't reset on every visit).
- Show total count when the API provides it. Don't fake "Page X of ?" — show "Page X · 25 per page" if the count isn't known.
- Keyboard: page-up / page-down navigates pages; Home / End jump to first / last.

## Virtualization

- Required when row count routinely exceeds ~200 visible rows (or the table is the primary content of a page and scrolling lags).
- Use **TanStack Virtual** alongside TanStack Table — they pair without surprises.
- Fix row heights when possible; dynamic-height virtualization is an order of magnitude harder.
- Virtualization changes how screen readers announce — verify with NVDA / VoiceOver after enabling.

## Row selection

- Use TanStack's built-in selection state.
- Selection persists across pagination only when the API supports "select all matching filters" — otherwise selection is per-page and the user is told so explicitly.
- Bulk action buttons appear in a sticky bar above the table when ≥ 1 row is selected. Disabled state when zero selected; never hide.
- Keyboard: `Shift+Click` for ranges, `Space` to toggle the focused row, `Cmd/Ctrl+A` to select all on the current page.

## RTL

- Column order does **not** flip in RTL. The first column is still the first column visually — it's the column the user reads first in their reading order.
- Sort icons mirror via `mirrorInRTL`.
- Pagination controls (Prev / Next) mirror visually: in RTL, "Next" points left. Use direction-aware icons (`chevron-right` with `mirrorInRTL`) or swap the icon by direction.
- Sticky-column shadows: verify the shadow falls on the correct side under `dir="rtl"`.

## Accessibility

- Wrap with a `<table>` (the shadcn `Table` primitive does this) — never reach for `role="grid"` unless you are building a true editable spreadsheet.
- `<caption>` (visually hidden) describes what the table contains. Screen-reader users hit this first.
- `<th scope="col">` / `<th scope="row">` set on header cells — required for screen-reader navigation.
- Sortable column headers are `<button>` inside `<th>` so they are reachable by keyboard.
- Interactive cells (action menus, inline edits) are reachable by Tab and the focus-visible style is unmistakable.
- Selection announcements: when a row is selected, an `aria-live="polite"` region announces "Row X selected, Y total selected."

## Empty / loading / error states

- Loading: skeleton rows that match the column layout (not a centered spinner that destroys the layout).
- Empty: `EmptyState` primitive (see `references/react-architecture.md` §UI states) inside the table body, spanning all columns. Include an action ("Clear filters") when the empty result is filter-driven.
- Error: `ErrorState` primitive with retry. Spans all columns.

## Performance

- Memoize the column array. A new column reference re-creates the table instance.
- Avoid inline `cell: ({ row }) => <ComplexComp />` for hot rows — extract to a named component and `React.memo` it.
- Server-paginate above ~500 rows. Client-side filtering of 10k rows is the wrong solution.
- Don't put queries inside cells. The data is already loaded; the cell renders, that's it.

## Anti-patterns

See `references/anti-patterns.md` §Tables for the canonical list (rejection-citable).
~~~

## Original references/forms-patterns.md

~~~markdown
# Forms Patterns

Forms are the dominant UI in AD Ports apps (vessel intake, bookings, customs declarations, manifests). The basics are in `references/react-architecture.md` §Forms. This file covers the patterns devs hit most often beyond the basics.

## Schema-first foundation

- One zod schema per form. Derive the form value type via `z.infer<typeof schema>`.
- Connect to react-hook-form via `zodResolver(schema)`.
- Default values: pass `defaultValues` to `useForm` to keep TypeScript narrow and prevent uncontrolled→controlled warnings.
- For partial / conditional shapes, prefer `z.discriminatedUnion(...)` over `z.union(...)` — better error messages and narrower types.

## Wizard / multi-step forms

- One schema per step. The wizard's combined schema is a `z.intersection` (or per-step schemas validated independently).
- Persist step values in a feature-scoped store (Zustand) or a `useReducer` in the wizard parent — not in the URL. The URL holds only the active step number.
- Validate step-by-step on "Next" (`form.trigger(['fieldA', 'fieldB'])`), not the whole form.
- Allow free navigation backwards (preserve already-entered values) but block forward navigation past invalid steps.
- A draft / resume pattern lives in localStorage or the backend, not in component state.
- The final submit POSTs the merged payload; the server is the source of truth, not the wizard's local store.

## Field arrays (repeating sections)

- Use `useFieldArray` from react-hook-form for repeating groups (manifest items, line items, contacts).
- Keep an explicit `id` field per row (react-hook-form provides one); never key by index.
- Add / remove buttons live next to the row, not in a top toolbar — users tend to lose track in long lists otherwise.
- Validate per row (each row has its own zod sub-schema) so errors point at the offending row.
- Preserve row order on submit; some backends rely on it.

## Conditional fields

- Conditional rendering is fine, but keep the field's value in the schema as `z.string().optional()` (or `z.literal('').or(...)`) so submit doesn't choke on missing keys.
- Use `useWatch` to drive conditional rendering — do not subscribe to the entire form via `watch()` (re-renders the whole form on every keystroke).
- When a parent field changes, **reset dependent children** (`form.resetField('child')`) so stale values don't sneak through the schema.
- Cross-field validation belongs in zod's `.refine` or `.superRefine`, not in `useEffect` syncing one field to another.

## Server-driven schemas

When the backend owns validation rules (length, regex, allowed values), choose one of:

1. **Generate a zod schema from the OpenAPI contract** at build time (e.g. `openapi-zod-client`). Single source of truth; schema regenerates with the contract.
2. **Server returns a metadata document** (`/api/forms/<name>/schema`) and the client builds the zod schema at runtime. Use when forms change without a frontend release.

Pick one per form family; do not mix.

For (2), validate the schema document itself with a meta-zod schema before constructing fields — never trust an unvalidated schema document.

## Async validation

- For "is this value taken?" checks, use `mode: 'onBlur'` or a debounced async resolver. Never validate async on every keystroke.
- Show a loading indicator beside the field while the async check is in flight.
- Treat 5xx errors as "could not validate" — let the user submit; the server validates again. Do not block submit on a transient async-validation failure.

## Server validation errors

- The shared HTTP error mapper produces `{ message, code, fieldErrors }`. The form's `onSubmit` catches the rejected mutation and walks `fieldErrors` calling `form.setError(field, { type: 'server', message })`.
- Show a top-of-form summary (`role="alert"`, `aria-live="assertive"`) with a count of errors and a link to the first invalid field.
- Field errors stay until the user edits the field — don't clear them on the next keystroke; clear on `change` of that specific field.

## Disabled / submitting state

- Disable the submit button while the mutation is pending. Show a spinner or label change ("Saving...").
- Do **not** disable the form fields — users may still want to correct values.
- After successful submit: redirect, toast, or reset depending on the UX spec. Reset only when the user is expected to enter another record immediately.

## Preserve user input on recoverable failures

- A network error or 5xx must not blow away the form. The form keeps its values; an error region appears at the top with retry.
- A 4xx with `fieldErrors` maps the errors to fields; values stay.
- Only a successful 2xx clears the form (or navigates away).

## Dirty-form navigation guards

- React Router `unstable_useBlocker` (or `useBlocker` once stable) for in-app navigation when the form is dirty.
- `beforeunload` for closing the tab / hard navigation (browser limits the message).
- Use `formState.isDirty` from react-hook-form as the dirty flag.
- The block prompt should let the user discard or stay — never silently navigate away.
- Disable the guard after a successful submit.

## Auto-save / draft recovery

- Auto-save on a debounce (typically 1–2s after the last edit), not on every keystroke.
- Save to the backend (preferred — survives device loss) or to localStorage (keyed by user + form id) when the backend has no draft endpoint.
- Surface the save state visually: "Saving…" → "Saved 12s ago" → "Save failed. Retry."
- On mount, check for a draft and offer "Restore draft" / "Discard" — never silently overwrite the user's empty form.
- Clear the draft after successful final submit.

## Files / uploads

- Use the design-system file-upload primitive (don't roll one).
- Validate type and size with zod (`z.instanceof(File).refine(...)`) before upload.
- Show progress, support cancel, and surface server-side virus-scan or rejection errors as field errors.
- Do not store uploaded `File` objects in TanStack Query cache or Zustand — keep references (URLs / ids returned by the upload endpoint) instead.

## GCC-specific field validation

AD Ports apps collect data from users across the GCC. Common form-field rules that fail under default Western validation:

- **Arabic names** include the Arabic Unicode range (`؀-ۿ`, plus diacritics `ؐ-ؚ`, `ً-ٟ`, presentation forms `ﭐ-﷿`, `ﹰ-﻿`) and may contain spaces. Do not enforce a min-2-words / max-3-words rule — Arabic naming conventions vary widely.
- **Latin transliteration of Arabic names** allows characters like `'` (apostrophe in `Al-Sa'id`), hyphens, and varying word counts. Allow letters + space + apostrophe + hyphen.
- **Phone numbers** — accept E.164 format; do not assume UAE-only. GCC users routinely have multi-country numbers. Validate via `libphonenumber-js` or accept any `+<digits>` and validate server-side.
- **Emirates ID** has a specific 15-digit format with a Luhn checksum (`784-YYYY-NNNNNNN-N`). Client-side validate the **format** with the regex `/^784-\d{4}-\d{7}-\d$/` (strip dashes before checking length = 15). Verify the **checksum** on the server. Do not roll a checksum implementation in the browser — bugs there leak into auth flows.
- **Postal addresses** in the GCC are often unstructured (no postal code in some areas, PO boxes more common than street addresses). Make street/zip optional; require city + emirate/region.
- **Hijri dates** in date pickers — see `references/i18n-and-locale.md` §Hijri calendar. Always render alongside Gregorian.

## Mobile-first

GCC web usage skews mobile-heavy in many AD Ports surfaces (port workers, customs agents on the move). Forms must work on mobile first:

- Touch targets ≥ 44×44 px (iOS HIG / Apple) or ≥ 48 dp (Android Material).
- Use the right `inputmode` (`numeric`, `decimal`, `tel`, `email`) so mobile keyboards open correctly.
- One column on mobile; multi-column only at `md:` breakpoint and above.
- Auto-zoom on iOS triggers when input `font-size < 16px`. Two ways to prevent it: (a) use `text-base` (16 px) on mobile inputs — preferred, preserves user pinch-zoom; (b) set `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">` in the HTML shell — disables user pinch-zoom, an accessibility regression. Prefer (a) unless the design literally cannot use 16 px.
- Test on a real mid-tier device (not just Chrome DevTools), at least once per release.

## Accessibility

- Every input has an associated `<label>` (via `htmlFor` or `aria-labelledby`). The shadcn `<FormLabel>` does this when wired through `<FormField>`.
- Errors are programmatically associated with the field via `aria-describedby`, and the field carries `aria-invalid` when in error.
- The error summary at the top of the form is an `aria-live` region. Screen-reader users hear it on submit.
- Required fields are marked visually **and** semantically (`aria-required="true"` or `required`).
- Tab order matches visual order. The first invalid field receives focus on submit failure.

## Anti-patterns

See `references/anti-patterns.md` §Forms for the canonical list (rejection-citable).
~~~

## Original references/frontend-security.md

~~~markdown
# Frontend Security (React)

## Focus

Use this reference when the task involves route protection, authentication UX, HTTP access patterns, rendering untrusted HTML, external scripts, CSP, storage decisions, or security review of a React frontend.

## Baseline Rules

- Treat every browser-side control as user experience, not final enforcement.
- Enforce authentication, authorization, and data access on the server even when React route guards or hidden UI states exist.
- Treat JSX as trusted executable code. Do not construct JSX or HTML dynamically from untrusted input.
- Prefer safe defaults over escape hatches.

## React Security Rules

- React escapes string children by default. Do not undo this. Avoid `dangerouslySetInnerHTML` unless you control the source and have sanitized it (DOMPurify or equivalent) at the boundary.
- When `dangerouslySetInnerHTML` is unavoidable (rendering user-generated HTML, embedding a trusted rich-text field), sanitize with a vetted library — never with regex.
- Treat `href` / `src` values built from user input as dangerous. Reject `javascript:`, `data:`, and unknown schemes. Use a small allowlist helper in `src/shared/lib/url.ts`.
- Prefer Content Security Policy and (where available) Trusted Types. Configure CSP nonce handling in the HTML shell and align with server headers.
- Never use `eval`, `Function(...)`, or `setTimeout(stringArg, ...)`. Lint for these.
- Third-party React components that accept `children` as HTML, or that bypass sanitization, are a trust boundary — review before adopting.

## Auth and Routing

- Use route guards to improve navigation UX, not as the sole access-control boundary.
- Keep token refresh, expiry, and logout behavior explicit and centralized in `src/shared/api/` interceptors.
- Prefer `HttpOnly` secure cookies for session-style auth when the backend supports them.
- If bearer tokens are required, keep them in memory (module scope or a Zustand store), not `localStorage` or `sessionStorage`. `localStorage` is accessible to any script that runs in the page — a single XSS leaks every token.
- 401 → redirect to login + preserve return URL in a search param. Do not show a silent "session expired" banner without a way back in.
- Do not scatter auth decisions across unrelated interceptors, components, and route guards.

## HTTP and Data Handling

- Centralize HTTP concerns (base URL, credentials mode, CSRF strategy, auth headers, error normalization) in `src/shared/api/`.
- **Credentials mode** — set `credentials: 'include'` only when the backend uses cookie sessions and CORS is configured for the origin. Default to `'same-origin'` or `'omit'`.
- **CSRF** — when the backend uses cookie-based sessions, include a CSRF token on state-changing requests (double-submit cookie or header token per backend spec). Bearer-token APIs over HTTPS do not need CSRF protection, but mixing both auth models in one app is error-prone — prefer one per surface.
- Validate untrusted data at the boundary with zod before it enters state or UI.
- Never trust client-provided role flags, prices, permissions, or workflow states.
- Redact secrets and sensitive identifiers from logs, client errors, and analytics telemetry.

## Third-Party Scripts and Rendering

- Scrutinize analytics, chat widgets, editors, maps, and ad scripts for DOM mutation and data leakage.
- Load third-party scripts via `<script defer>` or after hydration; never in blocking head scripts for a React app.
- Review iframe, script, and HTML embed points as explicit trust boundaries.
- Sanitize Unicode bidirectional control characters (U+202A–U+202E, U+2066–U+2069) in user-generated content before rendering to prevent Trojan-Source-style visual spoofing. Applies especially to comments, filenames, profile fields, and any mixed-script UI.

### Subresource Integrity (SRI)

Pin third-party script and stylesheet hashes when loading from a CDN you do not control:

```html
<script
  src="https://cdn.example.com/widget.v3.js"
  integrity="sha384-<hash>"
  crossorigin="anonymous"
></script>
```

- Generate hashes from the exact bytes you reviewed; do not trust the CDN to be honest tomorrow.
- If the third party doesn't publish stable URLs (or rotates content silently), self-host instead.
- Skip SRI only when the resource is on your own origin under your build pipeline.

## Content Security Policy (baseline)

Set CSP via response headers from the server (preferred) or `<meta http-equiv="Content-Security-Policy">` (fallback). A reasonable starting point for an SPA:

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-<random>' 'strict-dynamic';
  style-src 'self' 'nonce-<random>';
  img-src 'self' data: https:;
  connect-src 'self' https://api.adports.example;
  font-src 'self' data:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

Rules:

- **Generate a fresh nonce per request** server-side; pass it through to the HTML shell and the bundler so inline scripts/styles produced by Vite are tagged. Tools like `vite-plugin-csp` automate this.
- `'unsafe-inline'` and `'unsafe-eval'` are banned. If a dependency requires them, replace the dependency.
- `frame-ancestors 'none'` (or a strict allowlist) prevents clickjacking.
- `connect-src` lists only the APIs the app actually calls — narrow it.
- For Trusted Types, add `require-trusted-types-for 'script'` and `trusted-types default;` once the app is audited and ready.
- Report-only mode (`Content-Security-Policy-Report-Only`) for rollouts; collect violations before flipping to enforce.

## URL allowlist helper

User-controlled `href` / `src` is dangerous (`javascript:`, `data:` text/html, weird custom schemes). Centralize a small helper:

```ts
// src/shared/lib/url.ts
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Returns true only if the input parses as a URL whose scheme is on the allowlist — blocks `javascript:`, `data:text/html`, and other XSS vectors.
export function isSafeUrl(input: string): boolean {
  try {
    const url = new URL(input, window.location.origin);
    return ALLOWED_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

// Wraps every user-controlled href/src; returns undefined for unsafe input so the attribute is omitted entirely instead of rendering a dangerous URL.
export function safeHref(input: string | undefined): string | undefined {
  return input && isSafeUrl(input) ? input : undefined;
}
```

Rules:

- **Every** user-controlled `href` / `src` flows through `safeHref`. No exceptions.
- Lint rule (custom or via `eslint-plugin-security`) catches `href={user.something}` patterns that bypass the helper.
- For redirects from query strings (`?returnTo=...`), additionally validate the URL is **same-origin** before navigating — `safeHref` allows `https:` to anywhere; redirecting to an attacker domain is a known phishing vector.

## Dependency and Supply-Chain Hygiene

- Prefer well-maintained dependencies with clear ownership.
- Avoid adding packages for trivial helpers (use a 20-line util instead of adding `lodash.isequal`).
- Review transitive dependency cost, bundle size, and security posture before introducing new UI dependencies.
- Run `pnpm audit` / Snyk / equivalent in CI; track high-severity findings as issues, not silent warnings.

## Telemetry and Error Reporting

- Never send PII (names, emails, tokens, addresses) to analytics or error reporting.
- Use `beforeSend` (Sentry) or equivalent to strip URL query strings, request bodies, and user-identifying cookies from reports.
- Capture release and anonymized user id for correlation — not the user's email or name.

## Security Review Checklist

> Catalog of forbidden patterns (rejection-citable) is `references/anti-patterns.md` §Security. The checklist below is what a **reviewer actively checks** — overlapping but more procedural.

- Check for `dangerouslySetInnerHTML` — sanitized at the boundary? from a trusted source?
- Check for user-controlled `href` / `src` without URL-scheme validation.
- Check for secrets, tokens, or API keys in `localStorage`, `sessionStorage`, logs, query strings, or global variables.
- Check for guards being mistaken for authorization.
- Check for missing CSRF, clickjacking, CSP, or Trusted Types alignment.
- Check that `credentials` and CSRF configuration are centralized and match the backend's auth model.
- Check for unsanitized Unicode bidi control characters in user-generated content rendered into the DOM.
- Check `eval`, `Function(...)`, `new Function(...)`, `setTimeout(string, ...)` — none should exist.
- Check that third-party scripts loaded into the page are reviewed, **subresource-integrity-pinned** where possible, and not running before hydration.
- Check that **CSP** is set, includes a `script-src` nonce strategy, and bans `'unsafe-inline'` / `'unsafe-eval'`.
- Check that user-controlled `href` / `src` flows through `safeHref` (or equivalent allowlist).
- Check that `?returnTo=...` style redirects validate same-origin before navigating.
- Check whether error messages or telemetry leak sensitive backend detail or user PII.
~~~

## Original references/i18n-and-locale.md

~~~markdown
# Internationalization, RTL, and Locale

AD Ports apps ship in Arabic and English. i18n, RTL, and locale-aware date/time/number formatting are load-bearing requirements, not a polish pass.

## Translation library choice

- **`react-i18next`** (via `i18next`) — the AD Ports default. Mature, supports lazy-loaded namespaces, plays well with Suspense.
- **`react-intl`** (FormatJS) — justified when the app needs ICU MessageFormat-heavy content or integrates with an existing FormatJS pipeline. Record the decision in an ADR.
- **`lingui`** — not the default; do not introduce without ADR.

Pick one per app and stay with it. Do not mix libraries.

## Setup for Arabic + English

The default `react-i18next` setup needs explicit configuration to handle Arabic correctly. These pieces matter for AD Ports apps:

### Locale detection

Use `i18next-browser-languagedetector`. Detection order: `localStorage` → `navigator` → `htmlTag`. Persist the user's choice in `localStorage` so it survives reloads. Do not detect from `Accept-Language` server-side and bake into the bundle — locale is a runtime decision.

### Resource loading

Use `i18next-http-backend` (or `i18next-resources-to-backend` for bundled JSON) with **lazy-loaded namespaces**. One namespace per feature module + a `common` namespace for shared strings.

```text
src/features/vessels/i18n/
  en.json          # namespace: "vessels"
  ar.json
```

Load namespaces on demand from each feature's page component (`useTranslation('vessels')` triggers lazy load).

### Pluralization (Arabic has six forms)

Arabic plural rules: `zero`, `one`, `two`, `few`, `many`, `other`. Most teams under-use this and ship `one`/`other` only — wrong for Arabic. Define all six forms whenever the string varies by count.

```json
{
  "items": {
    "zero":  "لا توجد عناصر",
    "one":   "عنصر واحد",
    "two":   "عنصران",
    "few":   "{{count}} عناصر",
    "many":  "{{count}} عنصرًا",
    "other": "{{count}} عنصر"
  }
}
```

```ts
// Translate a count-aware key — i18next selects zero/one/two/few/many/other automatically.
t('items', { count });   // i18next picks the form by CLDR rules for the active locale
```

English has only `one` / `other`; do not assume Arabic does.

### Direction switching

When the user toggles locale, update both `lang` and `dir` on `<html>`:

```ts
/*
 * Sync <html lang> and <html dir> with the active locale on every language change.
 * Drives Tailwind RTL utilities, screen-reader pronunciation, and CSS logical properties.
 */
document.documentElement.lang = locale;
document.documentElement.dir  = locale === 'ar' ? 'rtl' : 'ltr';
```

Do this in the i18n provider's `languageChanged` handler, not per page.

### Interpolation safety

i18next escapes by default. Do not disable it (`escapeValue: false`) globally — only per-call when rendering known-safe HTML, and even then prefer `<Trans>` with React components.

### Suspense

Enable `react: { useSuspense: true }` so namespace loading suspends rendering instead of flashing untranslated keys. Pair with a `Suspense` boundary at the route level.

### What the AD Ports default config looks like (sketch)

```ts
// src/app/providers/i18n-provider.tsx
/*
 * Initialize the AD Ports default i18next instance once at app boot:
 * detect locale from localStorage, fetch namespaces over HTTP, and bind to React (Suspense).
 */
i18n
  .use(LanguageDetector)
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    ns: ['common'],
    defaultNS: 'common',
    detection: { order: ['localStorage', 'navigator', 'htmlTag'], caches: ['localStorage'] },
    interpolation: { escapeValue: true },
    react: { useSuspense: true },
  });
```

## Text, dates, numbers

- Never hard-code user-visible strings in JSX or component code. Every string routes through the translation library from day one.
- Translate **form validation messages** centrally. Do not hard-code `"This field is required"` in each component — map zod error codes to translation keys via a single `validationMessage` helper.
- Use `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat` with explicit locale. Wrap in shared hooks (`useFormatDate`, `useFormatNumber`) for consistency.
- Arabic digits: respect the user/app preference. `Intl.NumberFormat('ar-AE')` emits Arabic-Indic digits; pass `numberingSystem: 'latn'` for Western digits on dashboards and financial figures.
- Hijri dates: treat as an explicit dual-calendar concern. Render alongside Gregorian, do not replace silently. Use `Intl.DateTimeFormat('ar-SA-u-ca-islamic')` or a vetted library.

## RTL layout

- Set `dir` at the document level from the active locale (`<html lang="ar" dir="rtl">`) — do not toggle per component.
- Use Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`). Never `ml-*` / `mr-*` / `left-*` / `right-*` on layout-affecting elements.
- Icons with direction (back arrows, chevrons, breadcrumb separators) must mirror. Use `<Icon mirrorInRTL />` from `@shared/ui/icon`, or `rtl:scale-x-[-1]` for raw SVG.
- Design-system primitives must be RTL-verified before use. Do not assume correctness from LTR screenshots.
- Bidirectional text in form inputs: set `dir="auto"` on free-text inputs (names, addresses, comments).

## Testing i18n

- Run critical journey tests in both `en` and `ar` locales — not LTR only.
- Add an RTL smoke check per persona: keyboard navigation order, modal close-button position, dropdown anchor direction.

## Date, time, timezone

A common source of bugs in AD Ports apps (vessel ETAs across ports, customs deadlines, shift-aware timestamps). Treat date/time as a discipline, not a formatting concern.

### Storage

- The wire and the database speak **UTC ISO 8601** (`2026-04-25T08:30:00Z`). The frontend never sends a local-time string.
- Server payloads carry UTC; the client displays in the user's timezone.

### Display timezone

- **Default display timezone is the user's browser timezone** (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- When the domain requires a fixed operational timezone (e.g. port operations always shown in `Asia/Dubai` regardless of where the user is), set it explicitly per format call. Document the choice in the feature.
- Allow user override (profile setting) when both views matter.
- Mixed-timezone screens (one column local, one column port-time) must label which is which — never leave the user guessing.

### Weekend and working week (GCC)

- The default GCC working week varies by country; the AD Ports operational default is **Sunday–Thursday** (off: Friday/Saturday). Some entities now run **Monday–Friday** for compliance with international counterparts.
- Do not hard-code `[0, 6]` (Sun/Sat) or `[6, 0]` (Sat/Sun) as "weekend." Read the working-week config from the backend or feature flag, default to **Friday/Saturday off**.
- Ramadan affects working hours in some entities — leave room for date-aware shift adjustments rather than hard-coded times.

### Formatting

- Default to `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` for display. Wrap in shared hooks (`useFormatDate`, `useFormatRelative`, `useFormatDateTime`) so locale + timezone resolution is consistent across the app.
- Pass `timeZone` explicitly to `Intl` when rendering operational times.
- Never format dates with string concatenation or `.toString()`.

### Date library choice (when `Intl` isn't enough)

- **`date-fns`** (default) — tree-shakable, immutable, no monkey-patching. Use when you need parsing, arithmetic, or relative-time helpers beyond `Intl`. Pair with `date-fns-tz` for timezone-aware operations.
- **`dayjs`** — smaller bundle than `date-fns`, plugin-based. Acceptable when bundle size dominates; document in an ADR.
- **Temporal (TC39)** — the future. Polyfill is large; adopt when browser support lands across AD Ports' supported list.
- **Moment** — do not introduce. Migrate when touching code that uses it.

### Hijri calendar

- When the domain needs Hijri (some customs / regulatory contexts), render it **alongside** Gregorian, never replacing it silently.
- Use `Intl.DateTimeFormat('ar-SA-u-ca-islamic')` for display; do not roll your own conversion.
- Storage stays UTC ISO 8601 — Hijri is presentation only.

## Anti-patterns

See `references/anti-patterns.md` §i18n / RTL and §Date / time / timezone for the canonical lists (rejection-citable).
~~~

## Original references/react-architecture.md

~~~markdown
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
~~~

## Original references/react-craft.md

~~~markdown
# React Craft

Everyday React patterns that separate high-quality code from code that technically works. Read this when writing or reviewing components and hooks.

## Table of Contents

- [React Craft](#react-craft)
  - [Contents](#contents)
  - [Rules of Hooks](#rules-of-hooks)
  - [Keys in lists](#keys-in-lists)
  - [Derived state — don't store it](#derived-state--dont-store-it)
  - [`useState` type narrowing](#usestate-type-narrowing)
  - [Effect cleanup](#effect-cleanup)
    - [Legitimate `useEffect` use-cases](#legitimate-useeffect-use-cases)
  - [Memoization — three distinct tools](#memoization--three-distinct-tools)
    - [`useMemo` — cache an expensive value](#usememo--cache-an-expensive-value)
    - [`useCallback` — stable function identity](#usecallback--stable-function-identity)
    - [`React.memo` — skip re-renders of a child](#reactmemo--skip-re-renders-of-a-child)
  - [`useId` for accessibility](#useid-for-accessibility)
  - [Accessibility quick-test runbook](#accessibility-quick-test-runbook)
  - [Refs and imperative handles](#refs-and-imperative-handles)
  - [Portals](#portals)
  - [Error boundaries](#error-boundaries)
  - [Suspense](#suspense)
  - [Context — avoid re-render storms](#context--avoid-re-render-storms)
    - [Split by concern](#split-by-concern)
    - [Stabilize the value](#stabilize-the-value)
  - [Controlled vs uncontrolled inputs](#controlled-vs-uncontrolled-inputs)
  - [Composition patterns](#composition-patterns)
    - [Slots / `children`](#slots--children)
    - [Compound components](#compound-components)
    - [Headless hooks](#headless-hooks)
  - [Props design](#props-design)
  - [`className` merging](#classname-merging)
  - [Async state in event handlers](#async-state-in-event-handlers)
  - [Common anti-patterns — bad → good](#common-anti-patterns--bad--good)
    - [God component](#god-component)
    - [`useEffect`-driven fetch](#useeffect-driven-fetch)
    - [Unstable query keys](#unstable-query-keys)
    - [Hard-coded user-visible strings](#hard-coded-user-visible-strings)
    - [Physical-direction CSS](#physical-direction-css)
  - [Quick-reference: when to reach for what](#quick-reference-when-to-reach-for-what)

## Rules of Hooks

Non-negotiable. Violations are undefined behavior, not style issues.

- Call hooks at the top level of a component or another hook — never inside conditions, loops, `try`/`catch`, or after early returns.
- Only call hooks from React components or custom hooks (names starting with `use`).
- Enable `eslint-plugin-react-hooks` and treat its warnings as errors in CI.

## Keys in lists

- Always provide `key` when rendering a list.
- **Key by stable domain id**, not by array index.
- `key={item.id}` is right. `key={index}` is wrong when the list can reorder, insert, or delete — it causes lost input state, lost focus, and incorrect animations.
- `key` must be unique among siblings, not globally.

```tsx
// ❌ Wrong — reorder or delete corrupts state
{items.map((item, i) => <Row key={i} item={item} />)}

// ✅ Right
{items.map((item) => <Row key={item.id} item={item} />)}
```

## Derived state — don't store it

If a value can be computed from props or other state, do not put it in state.

```tsx
// ❌ Wrong — duplicated source of truth
const [fullName, setFullName] = useState(`${first} ${last}`);
useEffect(() => setFullName(`${first} ${last}`), [first, last]);

// ✅ Right — derive on render
const fullName = `${first} ${last}`;

// ✅ Right when the derivation is expensive
const fullName = useMemo(() => expensiveCompute(first, last), [first, last]);
```

The same applies to filtered/sorted lists — derive, don't cache in state.

## `useState` type narrowing

Always type `useState` explicitly when the initial value is `null`, `undefined`, or `[]`.

```tsx
// ❌ Infers `undefined`, breaks when you try to set a value
const [user, setUser] = useState();

// ✅
const [user, setUser] = useState<User | null>(null);
const [vessels, setVessels] = useState<Vessel[]>([]);
```

## Effect cleanup

Every subscription, timer, observer, and abort controller started in `useEffect` must be cleaned up.

```tsx
// ✅ Interval
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);

// ✅ Fetch with abort (rarely needed — prefer TanStack Query)
useEffect(() => {
  const ac = new AbortController();
  fetch('/api/x', { signal: ac.signal }).catch(/* ignore abort */);
  return () => ac.abort();
}, []);

// ❌ Async directly — returns a Promise, not a cleanup
useEffect(async () => { /* ... */ }, []);

// ✅ Async inside
useEffect(() => {
  let cancelled = false;
  (async () => {
    const data = await load();
    if (!cancelled) setData(data);
  })();
  return () => { cancelled = true; };
}, []);
```

Server state belongs in TanStack Query, not `useEffect`.

### Legitimate `useEffect` use-cases

The "no `useEffect` for data" rule is not "no `useEffect`." Use it for genuine side effects:

- **Subscribing to non-React event sources** — websockets, `BroadcastChannel`, browser events (`resize`, `online/offline`), `IntersectionObserver`, `MutationObserver`. Every subscription returns a cleanup.
- **Imperative APIs** — focus management after navigation, scroll restoration, programmatic `dialog.showModal()` calls, integration with non-React libraries (charts, maps, editors) that need a DOM node.
- **Browser-only side effects** — analytics page-views, document title (pre-React-19), favicon swaps, syncing component state out to localStorage/sessionStorage (debounced).
- **Tearing down resources** — timers, intervals, abort controllers (when not using TanStack Query for the request).

If your `useEffect` is doing any of these, it's correct. If it's calling `fetch` or syncing one piece of state to another piece of state in the same component, it's almost certainly wrong — convert to a query or a `useMemo`/`computed`.

## Memoization — three distinct tools

Don't collapse these. Each solves a different problem.

### `useMemo` — cache an expensive value

Use when computation is measurably expensive and inputs change rarely.

```tsx
const sortedVessels = useMemo(
  () => vessels.slice().sort(byDepartureDate),
  [vessels],
);
```

Do not wrap cheap computations. `useMemo(() => a + b, [a, b])` costs more than `a + b`.

### `useCallback` — stable function identity

Use when the function is a dependency of another hook (effect, memo, child `React.memo`).

```tsx
const onSelect = useCallback((id: string) => setSelected(id), []);

useEffect(() => {
  subscribe(onSelect);
  return () => unsubscribe(onSelect);
}, [onSelect]); // Without useCallback, this re-subscribes every render.
```

Not needed when the function is just a handler on a DOM element.

### `React.memo` — skip re-renders of a child

Use when a child is pure, renders often, and its props are referentially stable.

```tsx
export const VesselRow = React.memo(function VesselRow({ vessel }: Props) {
  return <tr>{/* ... */}</tr>;
});
```

`React.memo` does nothing if you pass new object/array/function references every render — pair with `useMemo` / `useCallback` on the parent, or it's a no-op.

**Default: don't memoize.** Measure first (React DevTools Profiler). Memoize the hotspot.

## `useId` for accessibility

Use `useId` for unique ids tied to a component instance — never `Math.random()`, never a module-level counter.

```tsx
const id = useId();
return (
  <>
    <label htmlFor={id}>Name</label>
    <input id={id} />
  </>
);
```

**Why `useId` exists:** under SSR or hydration, `Math.random()` and module counters generate different ids on the server vs the client, causing hydration mismatches. `useId` produces ids that match across both render passes — that's the whole point of the hook. Even in pure CSR apps it's better than ad-hoc counters because Strict Mode double-invocation breaks counters.

## Accessibility quick-test runbook

`jest-axe` and `axe-playwright` catch a lot in CI, but they don't catch logic-flow bugs (a modal that traps focus on the wrong element, a screen reader announcing a stale region). Run this 5-minute check before declaring a screen done. If you can't fix what you find, document it in the PR.

1. **Keyboard-only walk.** Unplug your mouse. Tab through the page. Can you reach every action? Does focus stay visible at every stop? Does Tab order match visual order?
2. **`Esc` on every overlay.** Open every dialog, drawer, dropdown, popover, tooltip. Press `Esc`. Does it close? Where does focus return? (It must return to the trigger.)
3. **Zoom to 200%.** `Ctrl/Cmd + +` four times. Does any control overflow off-screen, become unreachable, or hide critical text?
4. **Forced colors / high contrast.** Toggle the OS or browser high-contrast mode. Are buttons still distinguishable? Are focus rings still visible?
5. **Screen reader sweep.** macOS: `Cmd+F5` for VoiceOver, then `Ctrl+Opt+→` to walk. Windows: NVDA, then arrow keys. Navigate by headings (`H` in NVDA, `Ctrl+Opt+Cmd+H` in VoiceOver). Do the headings make sense without the rest of the page?
6. **Live regions.** Trigger an async action (form submit, mutation success). Does the screen reader announce the result, or does it stay silent?
7. **Color contrast.** DevTools → Inspect → Accessibility panel → Contrast ratio. Aim for AA on text (4.5:1), AAA where labelled (7:1). The Figma palette should be pre-validated, but custom one-off classes drift.
8. **`prefers-reduced-motion`.** Toggle in OS settings. Animations should reduce to a 1-frame fade or disappear; never block input.
9. **RTL pass.** Switch to `ar` locale. Are direction-sensitive icons mirrored? Is the modal close button on the correct side? Do dropdowns anchor correctly?

If the answer to any of these is "no" or "I don't know," fix it before review. Reviewers run the same checklist.

## Refs and imperative handles

- `useRef` — hold a mutable value that doesn't cause re-renders (DOM node, timer id, mutable cache).
- `forwardRef` — let a parent focus/measure/scroll the DOM node of a child.
- `useImperativeHandle` — expose a narrow imperative API from a child (`ref.current.focus()`, `ref.current.reset()`). Use sparingly; declarative props are usually better.

```tsx
type InputHandle = { focus: () => void };

/*
 * Exposes a narrow imperative API (`focus()`) to the parent ref while keeping the underlying input encapsulated.
 * Use this only when declarative props can't express the need (e.g. focusing on a parent-driven event).
 */
export const TextInput = forwardRef<InputHandle, Props>(function TextInput(props, ref) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => inner.current?.focus() }), []);
  return <input ref={inner} {...props} />;
});
```

## Portals

Use `createPortal` for modals, tooltips, toasts, and dropdowns that must escape their parent's stacking context, overflow, or transform.

```tsx
return createPortal(<Modal />, document.body);
```

Without a portal, a modal rendered inside a `overflow: hidden` ancestor is clipped.

## Error boundaries

- Place one at the top of the app (catches crashes that escape everything else).
- Place one per route (so one feature's bug doesn't blank the app).
- Place one around a third-party widget you don't trust.

Use `react-error-boundary`:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

/*
 * Catches render-time crashes inside <Feature/>. FallbackComponent renders the recovery UI;
 * onError forwards the original error to Sentry so the stack trace isn't lost when the user retries.
 * Note: this does NOT catch async/event-handler errors — handle those with try/catch + toast.
 */
<ErrorBoundary
  FallbackComponent={({ error, resetErrorBoundary }) => (
    <ErrorScreen
      message={error.message}
      onRetry={resetErrorBoundary}
    />
  )}
  onError={(error) => reportToSentry(error)}
>
  <Feature />
</ErrorBoundary>
```

Error boundaries only catch render, lifecycle, and constructor errors — not event handlers or async code. For those, use try/catch + toast/state.

## Suspense

- `Suspense` boundaries define loading UI for lazy components and (with TanStack Query's `useSuspenseQuery`) data fetching.
- Place a boundary **where it makes sense to show a skeleton** — usually the content area of a page, not the whole app.
- Co-locate with an error boundary: Suspense handles "still loading," Error Boundary handles "failed to load."

```tsx
// Co-locate Suspense (handles "still loading") inside an ErrorBoundary (handles "failed to load") — the boundary order matters: errors thrown during suspense fall through to the outer boundary.
<ErrorBoundary FallbackComponent={ErrorScreen}>
  <Suspense fallback={<PageSkeleton />}>
    <VesselDetailPage />
  </Suspense>
</ErrorBoundary>
```

## Context — avoid re-render storms

Context re-renders every consumer when its value changes. Two mitigations:

### Split by concern

```tsx
// ❌ One context — every consumer re-renders when anything changes
<AppContext.Provider value={{ user, theme, cart }}>

// ✅ Split
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
    <CartContext.Provider value={cart}>
```

### Stabilize the value

```tsx
// ❌ New object every render; every consumer re-renders
<UserContext.Provider value={{ user, updateUser }}>

// ✅
const value = useMemo(() => ({ user, updateUser }), [user, updateUser]);
<UserContext.Provider value={value}>
```

If splitting and memoizing aren't enough, reach for Zustand (selectors prevent re-renders of components that don't depend on the changed slice).

## Controlled vs uncontrolled inputs

- **Controlled** (`value` + `onChange`) when you need to read, transform, or reset the value while the user types.
- **Uncontrolled** (`defaultValue`, read via `ref` on submit) when the value is only read on submit. Faster; less re-rendering.
- In forms, let react-hook-form own this — it defaults to uncontrolled with register().

## Composition patterns

### Slots / `children`

Pass JSX down through props or `children` instead of accepting config objects.

```tsx
// ❌
<Dialog title="Confirm" body="Are you sure?" actions={[{ label: 'OK', ... }]} />

// ✅
<Dialog>
  <Dialog.Header>Confirm</Dialog.Header>
  <Dialog.Body>Are you sure?</Dialog.Body>
  <Dialog.Actions><Button>OK</Button></Dialog.Actions>
</Dialog>
```

### Compound components

Group related pieces under a namespace. Parent provides context; children consume it.

```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
    <Tabs.Trigger value="specs">Specs</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="overview">...</Tabs.Content>
  <Tabs.Content value="specs">...</Tabs.Content>
</Tabs>
```

### Headless hooks

Encapsulate behavior as a hook; let the consumer render whatever they want.

```tsx
const { isOpen, open, close, triggerProps, contentProps } = useDisclosure();
```

Good when behavior is reused but UI differs across features.

## Props design

- Prefer **discriminated unions** over optional flags. The compiler enforces valid combinations.

```tsx
// ❌ Any combination is legal
type Props = { variant?: 'primary' | 'danger'; confirm?: string };

// ✅ `confirm` is required only on 'danger'
type Props =
  | { variant: 'primary' }
  | { variant: 'danger'; confirm: string };
```

- Accept `children` for slot-like composition rather than a `content` prop.
- Accept `className` and `...rest` on presentational components so callers can extend styling.
- Mark handlers with `on*` (`onClick`, `onSelect`), state props without a prefix (`disabled`, `isOpen`).

## `className` merging

Use `clsx` for conditional classes and `tailwind-merge` to resolve Tailwind conflicts (`px-2 px-4` → `px-4`).

```tsx
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

<button className={cn('px-4 py-2', isDanger && 'bg-red-600', className)} />
```

For components with many variants, use `class-variance-authority` (`cva`).

## Async state in event handlers

Event handlers are not wrapped by React. Errors escape. Show a message.

```tsx
async function onSubmit() {
  try {
    await save();
    toast.success('Saved');
  } catch (err) {
    toast.error(extractMessage(err));
    reportToSentry(err);
  }
}
```

With TanStack Query mutations, use `onError` instead of try/catch.

## Common anti-patterns — bad → good

> The **catalog** of forbidden patterns (rejection-citable) is `references/anti-patterns.md`. The pairs below are **worked examples** for the highest-leverage cases — read both: catalog for citation, this for understanding.

### God component

```tsx
// ❌ 400 LOC, fetches, filters, sorts, renders a table, handles a dialog
function VesselManager() { /* ... */ }

// ✅ Feature hook + page + feature components
function VesselListPage() {
  const { vessels, filters, actions } = useVesselBooking();
  return (
    <>
      <VesselFilters filters={filters} onChange={actions.setFilter} />
      <VesselTable vessels={vessels} onSelect={actions.selectVessel} />
      <BookingDialog />
    </>
  );
}
```

### `useEffect`-driven fetch

```tsx
// ❌ Re-fetches on every mount, no cache, no request cancellation
const [vessels, setVessels] = useState<Vessel[]>([]);
useEffect(() => {
  fetch('/api/vessels').then((r) => r.json()).then(setVessels);
}, []);

// ✅ TanStack Query
const { data: vessels, isLoading, error } = useVessels(filters);
```

### Unstable query keys

```tsx
// ❌ `filters` is a new object each render — cache never hits
function useVessels() {
  const filters = { status: 'available' };
  return useQuery({ queryKey: ['vessels', filters], queryFn: ... });
}

// ✅ Pass primitives through the key factory
function useVessels(filters: VesselFilters) {
  return useQuery({ queryKey: vesselKeys.list(filters), queryFn: () => api.list(filters) });
}
```

### Hard-coded user-visible strings

```tsx
// ❌
<button>Save and continue</button>

// ✅
const { t } = useTranslation('vessels');
<button>{t('actions.saveAndContinue')}</button>
```

### Physical-direction CSS

```tsx
// ❌ Breaks in Arabic/RTL
<div className="ml-4 pr-2 left-0">

// ✅ Logical properties
<div className="ms-4 pe-2 start-0">
```

## Quick-reference: when to reach for what

| Need | Reach for |
|---|---|
| Shared state inside one component | `useState` |
| State that depends on previous state | `useReducer` |
| Expensive computed value | `useMemo` |
| Stable function identity | `useCallback` |
| Skip child re-renders | `React.memo` (+ the above) |
| Unique accessible id | `useId` |
| Imperative handle to a child | `forwardRef` + `useImperativeHandle` |
| Escape the stacking context | `createPortal` |
| Catch a render crash | Error Boundary |
| Load boundary + skeleton | `Suspense` |
| Cross-component feature state | Context + reducer → Zustand if re-render pressure |
| Server state | TanStack Query |
| URL state (filters, tabs) | React Router search params + zod |
| Class composition | `clsx` + `tailwind-merge` (or `cva` for variants) |
| Mark a non-urgent state update | `useTransition` (keep the UI responsive while expensive renders complete) |
| Defer rendering of an expensive computation | `useDeferredValue` (let urgent updates win) |
| Subscribe to an external (non-React) store | `useSyncExternalStore` |
| Re-render only when one slice of a store changes | Zustand selector (`useStore((s) => s.slice)`) — or `use-context-selector` if Context is forced |
| UI primitive (button/dialog/input/select/...) | `@shared/ui/<primitive>` (shadcn-vendored) — never re-implement |
| Icon | `<Icon name="..." />` from `@shared/ui/icon` — never `import from 'lucide-react'` directly |
~~~

## Original references/ui-primitives.md

~~~markdown
# UI Primitives — shadcn/ui + Lucide

The AD Ports React standard for **UI primitives** (button, dialog, input, select, popover, ...) is **shadcn/ui**. The standard for **icons** is **Lucide** (`lucide-react`), accessed through a small `<Icon />` wrapper.

This reference describes the rules. **It does not include install or init commands** — use the official tools in your repo when adopting; the rules below apply once the tooling is in place.

## Why these choices

- **shadcn/ui** is a *vendored-source* component set, not a dependency. You own the code in your repo, so you can customize tokens, add RTL behavior, change a11y semantics, and never wait on a third-party release. Built on Radix UI primitives — accessibility is correct by default.
- **Lucide** is a focused, tree-shakable icon set with a consistent visual language. `lucide-react` exports per-icon components so unused icons don't ship.

The vendored-source model is the reason the next rule is non-negotiable: when you own the source, "the existing one doesn't fit" is never an excuse to fork — you can always change it.

## ⛔ Reuse, do not recreate

This is the load-bearing rule of the entire skill. Read it twice.

- **Every UI primitive must come from `@shared/ui/*`.** If `@shared/ui/button` exists, you import `Button` from it. You do not write `MyButton`, `PrimaryButton`, `AppButton`, `<button className="...">` styled to look like a button, or any other parallel construct.
- **Every icon comes through `<Icon name="..." />`** from `@shared/ui/icon`. You do not `import { Search } from 'lucide-react'` inside a feature, ever. If the icon you need is not in the registry, add the name to the registry — do not bypass the wrapper.
- **If a primitive variant is missing** (the existing `Button` doesn't have a `loading` state, the existing `Dialog` doesn't support an alternate header), **edit the existing primitive in `@shared/ui/`** to add the variant. Do not fork it inside a feature.
- **If the primitive does not exist in `@shared/ui/` at all**, vendor it from shadcn (CLI emits it into `@shared/ui/`). Do not hand-roll a competing implementation.
- **Promotion rule:** a feature-scoped component is promoted to `@shared/ui/` only after a second feature actually needs it and the API can be made domain-neutral.

A code generator (human or AI) that creates a parallel `MyButton.tsx` next to an existing `button.tsx` has violated the most important rule in this skill. Reviewers reject such PRs without further discussion.

The broader **Search before creating** table (covering hooks, utils, HTTP, forms, state, validation messages) is in `references/coding-conventions.md` §Search before creating. This file is the primitive-specific deep dive on the same rule.

## Folder convention

shadcn primitives live in `src/shared/ui/`. This is the same folder used for the rest of the design-system layer in this skill — there is one home for UI primitives, period.

```text
src/shared/ui/
  button.tsx          # shadcn primitive (vendored)
  dialog.tsx          # shadcn primitive
  input.tsx           # shadcn primitive
  select.tsx          # shadcn primitive
  popover.tsx         # shadcn primitive
  ...
  icon.tsx            # Lucide wrapper (see below)
  empty-state.tsx     # AD Ports composite primitives
  loading-state.tsx
  error-state.tsx
```

Configure the shadcn CLI in your repo to write to `src/shared/ui/` (do not accept the default `src/components/ui/`). The CLI's `aliases` block in `components.json` should map `ui` → `@shared/ui`.

## Customization rules

You own the source. Treat shadcn output the way you treat any other code in `shared/ui/`.

- **Edit primitives in place** when the AD Ports design system needs different tokens, sizes, RTL handling, or a11y wording. Do not wrap a primitive in a second component just to add a class — change the primitive.
- **Tailwind tokens and CSS variables** drive theming. Set the project palette in `globals.css` (or the shadcn-generated theme file). Do not hard-code colors in primitives.
- **Re-running the shadcn CLI for an existing primitive** overwrites local edits. Coordinate updates: keep a small `CHANGES.md` in `shared/ui/` listing local modifications per primitive, or commit a `// AD Ports edit:` marker comment so re-runs are merged consciously, not blindly.
- **A primitive that exists in shadcn must not be re-implemented**. If the available variant doesn't fit, edit the existing primitive — do not create `MyButton.tsx` next to `button.tsx`.

## When to add a new primitive

Before adding to `shared/ui/`:

1. **Compose first.** Most needs are met by composing existing primitives (e.g. a confirm dialog = `Dialog` + `Button` + your text). Do not add a new primitive for a one-feature use.
2. **Two real consumers.** Promote a feature-scoped component to `shared/ui/` only when a second feature actually needs it and the API can be made domain-neutral.
3. **shadcn first.** If the primitive exists in shadcn's catalog, vendor it via the CLI — do not hand-write a competing version.
4. **No domain leakage.** A primitive in `shared/ui/` knows nothing about vessels, bookings, or any AD Ports domain term. If it does, it belongs in a feature.

## Icons — the `<Icon />` wrapper

Use a single `Icon` wrapper, not direct `lucide-react` imports scattered through features.

```tsx
// src/shared/ui/icon.tsx
import {
  Anchor,
  ChevronRight,
  Search,
  Filter,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@shared/lib/cn';

const icons = {
  anchor: Anchor,
  'chevron-right': ChevronRight,
  search: Search,
  filter: Filter,
  close: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  /** Mirror the icon under [dir="rtl"] — for direction-sensitive icons (back arrows, chevrons). */
  mirrorInRTL?: boolean;
  className?: string;
  'aria-label'?: string;
};

/*
 * Single entry point for every Lucide icon used in the app.
 * Looks the icon up in a curated registry (the allowlist), defaults to aria-hidden,
 * and applies `rtl:scale-x-[-1]` for direction-sensitive icons under RTL.
 */
export function Icon({ name, mirrorInRTL, className, ...rest }: Props) {
  const Cmp = icons[name];
  return (
    <Cmp
      aria-hidden={rest['aria-label'] ? undefined : true}
      className={cn(
        'size-4 shrink-0',
        mirrorInRTL && 'rtl:scale-x-[-1]',
        className,
      )}
      {...rest}
    />
  );
}
```

### Icon rules

- **Always use `<Icon />`**, never `import { Search } from 'lucide-react'` in a feature.
- **Add a name to the registry** when a new icon is needed. The registry is the icon allowlist for the app.
- **Mirror direction-sensitive icons** in RTL via `mirrorInRTL`. Default off; opt in when the icon points (chevrons, arrows, breadcrumb separators).
- **Decorative icons are `aria-hidden`** by default. Pass `aria-label` only when the icon is the *only* label (e.g. an icon-only button — and even then prefer a visible label).
- **Sizing via Tailwind size utilities** (`size-4`, `size-5`, `size-6`). The wrapper defaults to `size-4`; override per usage.
- **Do not re-color icons inline**. Use `currentColor` (Lucide's default) and let the parent set color via `text-*` classes.

### Icon-only buttons

Always pair an icon-only button with `aria-label`. The icon stays decorative.

```tsx
<button aria-label={t('actions.close')} onClick={close}>
  <Icon name="close" />
</button>
```

## Dark mode

shadcn ships with a CSS-variable-based theme that supports dark mode out of the box. Rules:

- Toggle dark mode via the `class` strategy (`<html class="dark">`), not the `media` strategy — users override system preference.
- Do not write `dark:` Tailwind variants on primitives. The primitive consumes CSS variables; the variables flip in `.dark`. The variant goes on consumers only when a feature needs to deviate.
- Verify every `shared/ui/` primitive in both light and dark before promoting.

## RTL

Most shadcn primitives work in RTL out of the box because Radix uses logical placement. Two things to verify when vendoring or editing:

- **Floating elements** (Popover, Dropdown, Tooltip) anchor correctly under `dir="rtl"`.
- **Icons inside primitives** (e.g. dropdown caret, breadcrumb separator) use `mirrorInRTL` if direction-sensitive.

If a primitive fails RTL, edit it — do not work around it from the consumer side.

## Forms integration

shadcn provides `form.tsx` (built on react-hook-form). Use it. It owns:

- `<Form>` provider wrapping a react-hook-form context.
- `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` — accessible field wiring.

Combine with the project's central `validationMessage` helper (see `references/i18n-and-locale.md`) to translate validator error keys instead of hard-coding them in templates.

## Testing primitives

- Do not write unit tests for shadcn primitives themselves (Radix is tested upstream and the vendored component is a thin wrapper).
- Do test compositions of primitives that own behavior (e.g. a confirmation dialog with custom keyboard handling).
- Stories: every primitive in `shared/ui/` gets a `*.stories.tsx` (Default + variant + RTL + dark — see `references/react-architecture.md` §Storybook and Component Documentation).

## Anti-patterns

See `references/anti-patterns.md` §Reuse violations and §Components for the canonical list. Primitive-specific items not in the canonical list:

- **Hard-coded hex colors** in a primitive — use CSS variables / Tailwind tokens.
- **`dark:` variants on primitives** — let CSS variables flip; consumers may use `dark:` only when deviating.
- **Direction-sensitive icons** (chevrons, arrows) without `mirrorInRTL`.
- **Icon-only buttons without `aria-label`.**
- **Re-running the shadcn CLI** on a primitive without reviewing the diff against local edits.

## Quick reference

| Need | Reach for |
|---|---|
| Standard UI primitive (button, input, dialog, ...) | `@shared/ui/<primitive>` (vendored from shadcn) |
| New primitive that doesn't exist in shadcn | Add to `@shared/ui/` only after two real consumers; otherwise compose |
| Icon | `<Icon name="..." />` from `@shared/ui/icon`; add the name to the registry if missing |
| Direction-sensitive icon | `<Icon name="chevron-right" mirrorInRTL />` |
| Icon-only button | `<button aria-label={t('...')}><Icon name="..." /></button>` |
| Form field | shadcn `<Form>` + `<FormField>` (react-hook-form) |
| Dark-mode aware primitive | Drive via CSS variables; toggle with `.dark` class on `<html>` |
| Empty / Loading / Error state | `@shared/ui/empty-state`, `@shared/ui/loading-state`, `@shared/ui/error-state` (see architecture §UI states) |
~~~

## Original SKILL.md

~~~markdown
---
name: frontend-react
description: "Use for React frontend engineering at AD Ports — feature-module architecture, shadcn/ui + Lucide as the design-system standard, TanStack Query server state, Context+reducer/Zustand client state, react-hook-form + zod, react-i18next + RTL, accessibility, Storybook, env validation, forms patterns, data tables, CI gates, security. Trigger on \"AD Ports React\", \"feature module\", \"@shared/ui\", \"shadcn\", \"lucide-react\", \"TanStack Query\", \"Zustand\", \"react-hook-form\", \"zod\", \"Vite\", \"Vitest\", \"Playwright\", \"MSW\", \"RTL\", \"a11y\", \"plan-feature\", \"start-new-feature\", \"harden-feature\", \"data table\", \"wizard\", \"stepper\", \"Hijri\", \"GCC working week\"."
---
# Frontend Engineer (React)


## Metadata

- **version:** 0.1.4
- **default_prompt:** Use the frontend-react skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** React frontend engineering at AD Ports - feature-module

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

You are acting as a Senior Frontend Engineer for AD Ports building React + TypeScript UIs: feature-module architecture, design-system components, typed API clients, accessible, tested, and maintainable.

## Business alignment gate

Before planning or building UI, confirm the work traces to a **business-approved user outcome**:

- PRD, story, or ticket with acceptance criteria from `product-manager`.
- User flow, screen behavior, or component expectation from `ux-ui-designer`.
- API contract or stub from the backend role before wiring real data.
- Accessibility, locale, and authorization expectations for the affected user groups.

If the work cannot be traced to a user goal or acceptance criteria, pause and ask instead of inventing a product flow. For narrow implementation, debugging, or cleanup tasks, infer the traceability line from the user's request and the existing code, then state the assumption. Do not create screens just because a component can be built. Every frontend output must include a traceability line: **user goal -> acceptance criteria -> UI states -> tests**.

## Repo-first guardrail

Read the target app before applying this skill. Existing repo conventions, ADRs, package manager, routing model, design system, state/data libraries, i18n setup, and test stack win over these defaults unless the task explicitly asks for a migration or the existing pattern violates reuse, security, accessibility, or data-boundary rules.

This skill defines the AD Ports default for new or intentionally modernized React apps. In brownfield work, migrate opportunistically when touching code. Do not add folders, libraries, wrappers, or primitives solely because this skill names them.

## Business-facing artifacts

- Feature plan covering route, states, data needs, accessibility, and i18n.
- Feature module scaffold or component implementation tied to a user journey.
- Data-wiring note linked to the API contract.
- Test evidence for acceptance states, accessibility, and RTL/i18n where relevant.
- Handoff package for QA, review, security, and platform.

## Where do I start?

### Workflows — pick the phase you're in

> Workflows are mostly independent. **Exception: `workflows/plan-feature.md` runs before `workflows/start-new-feature.md`** — start assumes plan's output (state-by-kind, feature-hook decision, i18n choice, primitives identified).

| Phase | File |
|---|---|
| **Plan** structure, routing, state, forms, API, a11y, i18n (decisions, no files) | `workflows/plan-feature.md` |
| **Start** scaffolding the feature module — folder, routes, first page | `workflows/start-new-feature.md` |
| **Implement** a single component (props, states, a11y, RTL) | `workflows/implement-component.md` |
| **Wire** data — TanStack Query, mutations, auth, MSW | `workflows/wire-data.md` |
| **Test** (unit, component, hook, journey, a11y, state stores) | `workflows/test-feature.md` |
| **Harden** for production — composition, perf, telemetry | `workflows/harden-feature.md` |

### References — pick the topic you're working on

| If you're working on... | File | What's inside |
|---|---|---|
| Any button, dialog, input, select, dropdown, modal, icon | `references/ui-primitives.md` | shadcn/ui + Lucide standard, `<Icon />` wrapper, customization, dark mode, RTL — **do not recreate** |
| A non-trivial form (wizards, field arrays, server schemas) | `references/forms-patterns.md` | Schema-first, async validation, dirty guards, auto-save, file uploads, GCC field validation, mobile-first |
| A data table beyond ~20 fixed rows | `references/data-table.md` | TanStack Table v8, columns, sort/filter/pagination, virtualization, RTL, a11y, perf |
| Translation, dates, numbers, Hijri, GCC week, RTL | `references/i18n-and-locale.md` | Translation libraries, Arabic setup (plural rules, namespaces), locale-aware formatting, timezone discipline |
| An everyday React problem (hooks, refs, portals, Suspense, memo, a11y check) | `references/react-craft.md` | Rules of Hooks, derived state, memoization 3-way split, refs/forwardRef, portals, error boundaries, Suspense, context re-renders, composition, a11y runbook, bad→good pairs |
| Naming, exports, aliases, lint, env, Tailwind, review process | `references/coding-conventions.md` | pnpm standard, **Search before creating** table, naming, ESLint plugins, Tailwind standard, env validation, **review process** (SLA, escalation) |
| CI gates, bundle budgets, Lighthouse, OpenAPI regen | `references/ci-pipeline.md` | Required + optional gates, speed budget, what to do when a gate fails |
| Auth, tokens, CSP, `dangerouslySetInnerHTML`, third-party scripts | `references/frontend-security.md` | URL-scheme allowlist (`safeHref`), token storage, CSP baseline, SRI, Trojan Source sanitization, security review checklist |
| Architecture decisions — feature modules, state-by-kind, routing | `references/react-architecture.md` | Scope, React 19, brownfield migration, feature module structure, feature hooks, reactivity, routing, HTTP, env/config, Storybook, UI states, perf budget, testing table, smells |
| A code-review citation ("why is this rejected?") | `references/anti-patterns.md` | Canonical forbidden-pattern catalog by domain — **the PR-review citation source** |

## ⛔ Hard rule — Reuse, do not recreate

Before writing any new component, hook, util, or schema, **search the codebase for an existing one**. This rule overrides any other guidance in this skill.

The canonical map of "what to search for what need" is the **Search before creating** table in `references/coding-conventions.md` §Search before creating.

- **If it exists** → import it.
- **If it almost exists** (missing a variant) → edit the existing one in place. Edits to `@shared/ui/*` require a Design-system-owner review (see `references/coding-conventions.md` §Review process).
- **If it doesn't exist** → compose existing primitives. Promote to shared only after a second real consumer.

A reviewer or AI generator that writes `MyButton`, `CustomDialog`, `IconWrapper`, `useFetch`, or any parallel implementation of something the codebase already has has violated the most important rule in this skill. PRs are rejected without further discussion.

## Stack

Default for new AD Ports React apps: target the React baseline recorded in `/standards/framework-baselines.md` § React (current recommended: **React 19**; absolute floor 18.2 for shadcn) · **TypeScript strict** · **Vite** · **Tailwind** (v4 preferred, v3 supported) · **shadcn/ui** + **Lucide** (`<Icon />`) · **TanStack Query** · **TanStack Table v8** · **Context + `useReducer`** / **Zustand** · **React Router** data-router · **react-hook-form + zod** · **react-i18next** · OpenAPI via **openapi-typescript** + **openapi-fetch** · **Vitest** + **React Testing Library** + **MSW** + **Playwright** + **jest-axe** / **axe-playwright** · **pnpm**

Decisions and rationale live in the references — see the cheat sheet above.

## Operating principles

1. **Feature modules**, not layer-first. Each feature owns its pages, components, hooks, API, state, types, tests.
2. **TypeScript strict.** No `any`. Narrow `unknown` at boundaries with zod.
3. **Reuse, do not recreate** — see ⛔ above.
4. **Every UI state is explicit** — empty, loading, error, unauthorized, success, partial, offline/retry.
5. **State by kind.** Pick the tool per kind (see `references/react-architecture.md` §Reactivity and State); do not mix kinds in one store.
6. **Server state = TanStack Query.** Never `useEffect` + `useState` for data fetching.
7. **Accessible by default.** Not a post-hoc pass.
8. **Treat client-side guards as UX**, not authorization. Server enforces access.

## Handoff

← **UX/UI** (flows + specs), **Backend** (OpenAPI contract). → **QA** (acceptance-criteria validation, regression suite, RTL/i18n smoke), **Reviewer** (code review), **Security** (client controls), **Platform/SRE** (hosting, CSP headers, bundle/CDN).

## Ownership

- **Primary owner:** `frontend-react` (frontend tech lead is the steward; design-system owner co-owns `references/ui-primitives.md` and any `@shared/ui/*` rules).
- **Review cadence:** Quarterly, plus on any major React/shadcn/Tailwind/TanStack Query release.
~~~

## Original workflows/harden-feature.md

~~~markdown
# Workflow: Harden Feature (React)

**Scope:** production-quality feature — composition, code-split, bundle, perf, telemetry, error reporting. For a single component's contract use `workflows/implement-component.md`.

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] ACs, design, API contract, route plan, and state / feature-hook plan are available.
- [ ] The production hardening target is tied to a business-critical journey, release risk, or measurable NFR.
- [ ] Target files and feature-module boundaries are clear.
- [ ] Existing lint, typecheck, build, test, and bundle-size commands are known.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/react-architecture.md` — Feature Module Structure, Component Responsibility, Feature Hooks, **Rendering and Performance** (budget + defaults), smells to correct.
- `references/frontend-security.md` — read before using `dangerouslySetInnerHTML`, adding third-party scripts, or wiring telemetry.

## Goal
A production-quality feature module: small focused components, lazy-loaded, within perf budget, with telemetry and error reporting wired.

## Steps
1. **Build inside the module.** All feature work lives under `features/<feature>/`. Expose only the page(s), feature hook, and public types via `index.ts`. Do not import internal feature files from outside.
2. **Compose, don't drill.** Lift state only as far as needed; pass via composition (`children`, slots) or feature-scoped context. Avoid prop drilling > 2 levels; when you hit it, introduce the feature hook or a context provider.
3. **Keep components focused.** One responsibility per component. Split when unrelated state branches multiply, not by line count. Page components coordinate the feature hook + layout; feature components render UI and raise callbacks.
4. **Code-split at route boundaries.** `React.lazy` + `Suspense` or route `lazy` imports. Verify chunk split in the production build output.
5. **Bundle hygiene.** Track size in CI with `size-limit` (or equivalent). Fail on regressions beyond the project budget. Tree-shake; avoid full-library imports (`import { format } from 'date-fns'`, not `import * as DateFns`).
6. **Image strategy.** Responsive `srcset`, modern formats (AVIF/WebP), lazy below the fold. Use the DS image component.
7. **Memoize only with profiler evidence.** Open React DevTools Profiler on the changed page; identify any component flame-graph stripe > 16ms. Memoize only those components or values, and **record the before/after timing in the PR description**. New `useMemo` / `useCallback` / `React.memo` without recorded evidence is rejected at review. Rule and worked examples: `references/react-craft.md` §Memoization.
8. **Telemetry.** Page views and key user actions to the agreed analytics sink. PII-free — names, emails, tokens, addresses must not be sent. See `references/frontend-security.md` §Telemetry and Error Reporting.
9. **Error reporting.** Uncaught errors → Sentry (or equivalent) with release and anonymized user context. Configure `beforeSend` to strip query strings, bodies, and cookies.
10. **Run local checks.** Format, lint, typecheck, build, and targeted tests.
11. **Measure performance.** Run the project's bundle-size check and Lighthouse (or the team's agreed perf measurement) on the changed screens. Record before/after numbers in the PR. If either regresses beyond the budget, fix before merging.

## Anti-patterns

See `references/anti-patterns.md` §Performance, §Reuse violations, and §Security for the canonical lists. The hardening-phase traps:

- **Importing entire date / util libraries** for one function — tree-shake instead.
- **Lighthouse or bundle-size run only locally**, never in CI.
- **Memoization sprinkled without a profiler-identified hotspot.**
- **Logging PII or raw error bodies** to analytics / Sentry.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Evidence from checks (bundle diff, Lighthouse numbers) is captured in the PR.
- [ ] Assumptions and UX/API gaps are explicit.
- [ ] QA, Reviewer, and Security handoff is prepared.
- [ ] `git status` shows only intended changes.

## First-PR self-review checklist

Run through this before requesting review. Fixing these yourself is faster than a reviewer catching them.

### Top 5 — most-rejected violations

If you check nothing else, check these. Each catches a class of mistake reviewers reject on sight:

- [ ] **No parallel UI primitives.** Every `<Button>` / `<Dialog>` / `<Input>` / etc. is from `@shared/ui/`. No `MyButton.tsx`, no styled `<div role="button">`.
- [ ] **No `import { X } from 'lucide-react'`** inside a feature — every icon is `<Icon name="..." />`.
- [ ] **No data fetching in `useEffect`** — server state is TanStack Query.
- [ ] **No hard-coded user-visible strings** — every `>Text<` in JSX goes through `t()`.
- [ ] **No physical-direction Tailwind classes** (`ml-*`, `mr-*`, `left-*`, `right-*`) on layout-affecting elements — use logical properties.

The rest of the sections expand on these and add more.

### Reuse, do not recreate (hardest rule)
- [ ] Every UI primitive (`Button`, `Dialog`, `Input`, `Select`, `Popover`, `Tabs`, `Tooltip`, ...) is imported from `@shared/ui/`. No parallel primitives created in features.
- [ ] Every icon is `<Icon name="..." />` from `@shared/ui/icon`. No `import { X } from 'lucide-react'` inside features.
- [ ] No hand-rolled controlled inputs — forms go through shadcn `<Form>` + `<FormField>` + react-hook-form + zod.
- [ ] No raw `fetch` / `axios` in features — HTTP goes through the shared client + the feature's `api/<feature>.client.ts`.
- [ ] Reusable hooks searched in `@shared/hooks/` and the feature's `hooks/ui/` before writing new ones.
- [ ] If a primitive variant was missing, the shared primitive was edited (with a `// AD Ports edit:` marker), not forked.

### Code shape
- [ ] No `any`; `unknown` narrowed at boundaries with zod.
- [ ] No wildcard exports; feature `index.ts` exports only the public surface.
- [ ] No deep imports across features (`@features/other/hooks/queries/...`).
- [ ] No inline query keys (`['vessels', id]`) — all keys go through the feature's `query-keys.ts`.
- [ ] No `useEffect` + `useState` for data fetching.
- [ ] No hard-coded user-visible strings; all text goes through `t()`.
- [ ] No physical-direction CSS (`ml-*`, `mr-*`, `left-*`, `right-*`); use logical properties.
- [ ] No `dangerouslySetInnerHTML` on untrusted input; sanitized via DOMPurify if required.
- [ ] Every list render has a `key={item.id}` — not `key={index}`.
- [ ] Every `useEffect` with a subscription/timer/abort has a cleanup function.

### Behavior
- [ ] Empty, loading, error, and success states all render.
- [ ] Forms: server validation mapped to fields; submit disabled during mutation; input preserved on recoverable failure.
- [ ] Keyboard flow verified; focus trap in dialogs; focus restored on close.
- [ ] `axe` passes with zero violations on changed screens.
- [ ] Verified in both `en` (LTR) and `ar` (RTL).

### Performance
- [ ] Feature routes are lazy-loaded; chunk split verified in the build output.
- [ ] Bundle size diff recorded in the PR; within the project's budget.
- [ ] Lighthouse score on changed screens recorded in the PR.
- [ ] No memoization added without a profiler-identified hotspot.

### Tests and CI
- [ ] `typecheck`, `lint`, `test`, `build` all pass locally.
- [ ] MSW handlers added or updated for any new endpoint.
- [ ] New feature hook has a `renderHook` test exercising its public return shape.
- [ ] No `eslint-disable` without an inline comment explaining why.

## Definition of Done
- [ ] Hardening evidence maps to business-critical journey, release risk, or NFR.
- [ ] **No parallel primitives created.** All UI primitives imported from `@shared/ui/`; all icons through `<Icon />`; HTTP through shared client; forms via shadcn `<Form>` + react-hook-form. (See SKILL.md ⛔ Reuse, do not recreate.)
- [ ] Each component has a single responsibility; components with multiple unrelated state branches or UI regions are split.
- [ ] Feature module's public surface (`index.ts`) exposes only intended exports.
- [ ] Feature routes are lazy-loaded; chunks verified in build output.
- [ ] Initial bundle did not regress beyond the project budget (record before/after in the PR).
- [ ] Lighthouse performance score meets the project target on the changed screens, or matches/beats pre-change when no target exists. **Defaults (override per project):** Lighthouse ≥ 80, LCP ≤ 2.5s, CLS ≤ 0.1, TBT ≤ 200ms.
- [ ] Telemetry and error reporting wired; no PII sent.
- [ ] Lint, typecheck, build, and relevant tests pass.
~~~

## Original workflows/implement-component.md

~~~markdown
# Workflow: Implement Component (React)

**Scope:** a single component's contract — props, states, interaction, a11y, RTL. For feature-level concerns (code-split, bundle, perf, telemetry) use `workflows/harden-feature.md`.

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] The UX spec, ACs, and relevant design-system component are identified.
- [ ] The component's user decision/action and acceptance state are known; decorative or speculative components are out of scope.
- [ ] The component's feature module is known (where it will live).
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/ui-primitives.md` — **read first.** Confirm which `@shared/ui/` primitives this component composes; never re-implement.
- `references/react-architecture.md` — Components, Component Responsibility, Forms, UI states.
- `references/i18n-and-locale.md` — RTL, locale-aware formatting, GCC working week (when the component renders dates/times/numbers).
- `references/react-craft.md` — props design, list keys, `useId`, refs/forwardRef, portals, composition patterns.
- `references/frontend-security.md` — read before using `dangerouslySetInnerHTML`, rendering URLs from user input, or embedding third-party widgets.

## Goal
A component that matches the UX spec, behaves correctly across every state, is accessible, and works in both locales and directions.

## Steps
1. **Compose from `@shared/ui/`.** Identify which primitives (`Button`, `Dialog`, `Input`, `Select`, ...) the component is built from. If the design needs a primitive that doesn't exist, **add a variant to the existing primitive** in `@shared/ui/` (or vendor a new shadcn primitive if absent) — never write a parallel one in the feature. See `references/ui-primitives.md`.
2. **Use `<Icon />` for every icon.** From `@shared/ui/icon`. Never `import { X } from 'lucide-react'`. Add new names to the icon registry as needed.
3. **Type the props.** Strict; no `any`. Prefer discriminated unions over optional flags. Distinguish required vs optional explicitly.
4. **Render every state.** Empty, loading, error, success, unauthorized (when applicable), disabled/submitting. None are optional. Use the shared `<EmptyState>` / `<LoadingState>` / `<ErrorState>` primitives — do not roll new ones per feature.
5. **Form behavior (if a form).** Use shadcn `<Form>` + `<FormField>` over react-hook-form, with a zod schema. Validate on blur or submit. Errors inline at the field and in a summary at the top. Map server validation errors via `setError`. Disable submit during mutation; preserve input on recoverable failures.
6. **Keyboard + focus.** Tab order matches visual order. `Esc` closes modals. Focus trap in dialogs. Visible `focus-visible` styles on every interactive element. Restore focus on close.
7. **A11y attributes.** Semantic HTML first; ARIA only where semantics aren't enough. Labels associated with inputs (`<label htmlFor>` or `aria-labelledby`). Live regions for async updates.
8. **Responsive.** Mobile-first. Test at agreed breakpoints. No horizontal scroll at mobile widths.
9. **Animation.** Respect `prefers-reduced-motion`. Do not block input during animation.
10. **RTL and locale.** Use Tailwind logical properties (`ms-*` / `me-*` / `ps-*` / `pe-*` / `start-*` / `end-*`). Never `ml-*` / `mr-*` / `left-*` / `right-*`. Mirror direction-sensitive icons via `<Icon mirrorInRTL />`. Set `dir="auto"` on free-text inputs. Verify in both `en` and `ar`.
11. **Dark mode** verified for the component if the app supports it.
12. **Security sanity.** No `dangerouslySetInnerHTML` from untrusted input. No user-controlled `href`/`src` without `safeHref`-style validation.

## Anti-patterns

See `references/anti-patterns.md` §Reuse violations, §Components, and §i18n / RTL for the canonical lists. The most-common ones in this workflow:

- **Building a parallel primitive in the feature** instead of importing from `@shared/ui/` — see SKILL.md ⛔ Reuse, do not recreate.
- **`import { X } from 'lucide-react'`** inside a feature instead of `<Icon name="..." />`.
- **`<div onClick>`** instead of `<button>` / `<a>`.
- **Hard-coded English strings**; inline validator error strings instead of the central `validationMessage` helper.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Test evidence (axe, keyboard walk-through, RTL screenshot) is captured.
- [ ] Open UX questions are explicit.
- [ ] QA and Reviewer handoff is prepared.
- [ ] `git status` shows only intended changes.

## Definition of Done
- [ ] Component behavior traces to a user goal and acceptance state.
- [ ] Built from `@shared/ui/` primitives; no parallel primitives created in the feature. Any missing variant was added to the shared primitive, not forked.
- [ ] All icons rendered via `<Icon />`; no direct `lucide-react` imports.
- [ ] Empty / loading / error / success / disabled states rendered (using `<EmptyState>` / `<LoadingState>` / `<ErrorState>`).
- [ ] Keyboard-navigable end to end; focus trap where appropriate.
- [ ] axe check passes with zero violations on the component.
- [ ] Verified in both `en` (LTR) and `ar` (RTL); no hard-coded strings.
- [ ] Dark mode verified if the app supports it.
- [ ] No `any`; props typed with discriminated unions where appropriate.
- [ ] No `dangerouslySetInnerHTML` on untrusted input.
~~~

## Original workflows/plan-feature.md

~~~markdown
# Workflow: Plan Feature (React)

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] UX flows, ACs, API contract, auth rules, and design-system guidance are available.
- [ ] User goal, persona, business process, and owning PM/UX source are known; if missing, route back before designing structure.
- [ ] The target file or destination is decided.
- [ ] Downstream QA/Reviewer expectations are known.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/react-architecture.md` — **Feature Module Structure**, routing, **Feature Hooks**, **Reactivity and State**, HTTP integration, forms, **UI states**.
- `references/i18n-and-locale.md` — translation library choice, RTL, date/time/timezone, GCC working week.
- `references/ui-primitives.md` — shadcn/ui + Lucide standard. **Read before naming any component.**
- `references/forms-patterns.md` — when the design includes a non-trivial form.
- `references/data-table.md` — when the design includes a data table.
- `references/frontend-security.md` — route guards, auth flows, token storage, credentials/CSRF, untrusted content.

## Goal
A feature-module React design that scales to many features and many devs, and is ready to implement.

> **plan-feature vs start-new-feature** — `plan-feature.md` is the **decisions phase**: state by kind, feature-hook decision, i18n choice, primitives identified. It produces no files. Use it for any new feature. `start-new-feature.md` is the **scaffolding phase**: it creates the folder, writes the public surface, and wires routes — it assumes the design from this file. Plan first, then start.

## Steps

1. **Feature module boundaries.** Per `references/react-architecture.md` §Feature Module Structure. Cross-feature imports go through each module's `index.ts` or `src/shared/`.
2. **Routing.** Per `references/react-architecture.md` §Routing. Each feature owns a `<feature>.routes.tsx`; the top-level router composes. Lazy-load, route-level auth guard, per-feature error boundary.
3. **State by kind.** Per `references/react-architecture.md` §Reactivity and State. Pick the tool per kind (local / feature-scoped / app-wide / server / URL); do not mix kinds in one store.
4. **Feature hook.** Decide if the feature warrants a `use<Feature>()` facade composing queries + mutations + local state. Skip when the page is a one-query read with no local state. Rules: `references/react-architecture.md` §Feature Hooks.
5. **API layer.** `features/<feature>/api/` with typed client wrapping the generated OpenAPI client, hierarchical `query-keys.ts`, zod `schemas.ts` validating at the response boundary.
6. **Design system: shadcn/ui + Lucide.** Identify which `@shared/ui/` primitives the design uses; flag any missing variants so the existing primitive can be edited (not forked). Tokens flow through Tailwind theme + CSS variables — never hard-coded. **Re-implementing primitives is a hard violation** — see `references/ui-primitives.md` ⛔.
7. **Accessibility.** Keyboard paths, focus management, ARIA only when semantics aren't enough, color contrast, `prefers-reduced-motion`, screen-reader labels. See `references/react-craft.md` §Accessibility quick-test runbook.
8. **i18n + RTL.** Pick `react-i18next` (default) or `react-intl` (ADR) — not both. Extract all user-visible strings from day one, plan locale-aware formatting and RTL icon mirroring. See `references/i18n-and-locale.md`.

## Anti-patterns

See `references/anti-patterns.md` §Module structure, §State, §Reuse violations, and §i18n / RTL for the canonical lists. The planning-phase traps:

- **Layer-first folders at repo root** (`components/`, `services/`, `models/`) instead of feature modules.
- **Picking a state tool for the whole feature** ("we'll use Zustand") instead of picking per kind.
- **i18n/RTL treated as a post-implementation sweep** — design strings, RTL, and locale-aware formatting in from day one.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Design notes are saved or linked for implementers.
- [ ] Assumptions and open questions are explicit.
- [ ] Backend/API, QA, Reviewer, and Security handoff is prepared.
- [ ] `git status` shows only intended changes.

## Definition of Done
- [ ] Traceability recorded: user goal -> AC -> UI states -> test strategy.
- [ ] Feature module layout documented (folders + public `index.ts`).
- [ ] Route plan with lazy boundaries, guards, and error boundaries.
- [ ] State kinds (local / feature / app / server / URL) are separated and each kind's tool is chosen.
- [ ] Feature hook shape defined, or explicitly skipped with reason.
- [ ] API client, query-keys, and zod schemas planned per feature.
- [ ] UI states and a11y needs captured.
- [ ] i18n library chosen (one, not both); string-extraction plan and RTL/icons approach documented.
- [ ] Design-system primitives identified; missing variants flagged for editing the shared primitive.
- [ ] Test strategy outlined.
~~~

## Original workflows/start-new-feature.md

~~~markdown
# Workflow: Start a New Feature (React)

**The scaffolding phase.** This workflow creates the feature module: folder, public surface, routes, first page. It assumes you've already done `workflows/plan-feature.md` (state-by-kind chosen, feature-hook decided, i18n approach, primitives identified). For extending an existing feature, see `workflows/plan-feature.md` + `workflows/harden-feature.md`.

## Before you start
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
~~~

## Original workflows/test-feature.md

~~~markdown
# Workflow: Test Feature (React)

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] ACs, changed components / hooks / forms / routes, and risk areas are known.
- [ ] Top user journeys and business-critical failure modes are identified from PM/UX input.
- [ ] Project test tools and CI commands are known.
- [ ] MSW handlers or fixtures are available.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References
- `references/react-architecture.md` — §Testing (tool-per-layer table, speed budget, TanStack Query testing pattern) and §Reactivity and State (what state behavior to test per kind).
- `references/frontend-security.md` — read when tests touch auth flows, interceptors, sanitization, or token storage.

## Goal
Behavior-focused tests that catch regressions without coupling to implementation details.

## Steps
1. **Map ACs to tests.** Cover user-visible behavior, route behavior, form validation, and API/state outcomes.
2. **Component tests with React Testing Library.** Query by role/label/text users perceive — not `data-testid`, not internal state. Fall back to lower-level rendering only when RTL cannot express the interaction.
3. **Test feature hooks with `renderHook`.** Wrap in the feature's providers (QueryClient with `retry: false`, router, i18n) via a small `renderWithProviders` helper. Drive inputs by calling returned actions; assert on the returned `{ data, isLoading, error }` shape — not on internal TanStack Query state.
4. **Test forms deeply.** required / format / range / cross-field / async validators, server error mapping, disabled state, submit behavior. Use RTL's `userEvent`, not `fireEvent`, for realistic interaction.
5. **Test state stores directly when warranted.** Most state is tested through the feature hook (step 3). When you need to test a store directly:
   - **Zustand store** — export a factory (`createBookingStore`) so each test gets a fresh instance; never share a singleton across tests. Drive via `store.getState().action(...)` and assert on `store.getState()`. No React rendering needed.
   - **Context + reducer** — test the reducer as a pure function (`reducer(state, action)` → next state). That's the whole point of `useReducer`. Use `renderWithProviders` only when the test asserts the full Provider → consumer dispatch flow.
   - **Wizard step transitions** — test the transition graph as reducer cases (Next-when-invalid blocks, Back preserves earlier values). Reducer tests run ~100× faster than DOM-driven equivalents; reach for the rendered DOM only when asserting visible UX (focus, error display).
6. **Mock APIs with MSW.** One handler set shared between unit and dev (`src/mocks/handlers.ts`). Align fixtures to the OpenAPI contract. Do not `vi.mock` the HTTP client.
7. **Cover accessibility.** Keyboard navigation, focus behavior, labels, live-region announcements. Run `jest-axe` on critical components in unit tests; `axe-playwright` on critical screens in E2E.
8. **Add journey tests.** Playwright for the top user journeys per persona. Run against a deployed UAT-like build. Pick one E2E tool per app and stay with it.
9. **Visual regression (optional).** Playwright screenshots on critical components when the UI is stable enough to justify the flake cost.
10. **Keep tests stable.** No arbitrary sleeps, no brittle CSS selectors, no snapshots over locale-dependent output. Unit suite < 30s; E2E < 5 min; flake rate < 1% — quarantine and fix on detection.

## Anti-patterns

See `references/anti-patterns.md` §Tests for the canonical list. The most-common ones in this workflow:

- **`getByTestId` everywhere** — coupling to markup.
- **Asserting on TanStack Query internals** instead of the feature hook's public surface.
- **`vi.mock` on the HTTP client** instead of letting MSW handle it — drifts from what dev sees.
- **Testing a store via the rendered component** when the assertion is about a transition. Test the reducer / store factory directly.
- **Sharing one store instance across tests** instead of using a factory.
- **Snapshot tests on locale-dependent output** (dates, numbers) — they flake across `en` / `ar`.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Test evidence and uncovered risks are documented.
- [ ] Flaky/slow tests have an owner and fix path.
- [ ] QA and Reviewer handoff is prepared.
- [ ] `git status` shows only intended changes.

## Definition of Done
- [ ] Traceability recorded: business-critical user journeys -> ACs -> test coverage.
- [ ] Unit tests cover custom hooks, feature hooks, form schemas, utils, and error mappers.
- [ ] Component tests cover every rendered state of changed components.
- [ ] State stores (Zustand factories, reducers, wizard transitions) are tested as pure modules where possible — DOM-driven tests reserved for visible UX.
- [ ] MSW handlers cover the touched endpoints and are shared with dev.
- [ ] Playwright E2E covers the top journeys affected by the change.
- [ ] axe runs in CI with zero violations on changed screens.
- [ ] Unit suite < 30s and E2E < 5 min; no flaky tests merged.
~~~

## Original workflows/wire-data.md

~~~markdown
# Workflow: Wire Data (React)

## Before you start
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
~~~

