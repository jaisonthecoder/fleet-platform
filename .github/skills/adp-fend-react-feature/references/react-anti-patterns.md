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
