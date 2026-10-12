# Data layer

How the SPA talks to a server: the clients, the four authentication paths, the
TanStack Query conventions, and the public-API stand-in.

---

## 1. Three clients, not one

| Client | File | Auth | Types from |
|---|---|---|---|
| **Authenticated** | `src/features/auth/api/current-user.ts` | Four branches (§2) | Generated OpenAPI |
| **Public** | `src/api/public/client.ts` | **None, ever** | Hand-written zod |
| **Local auth** | `src/features/local-auth/api/local-auth.ts` | Cookie + CSRF | Generated OpenAPI |

All three are built on `openapi-fetch` or bare `fetch`, and all three apply the
same URL hardening (§4).

---

## 2. `authenticatedClient(audience)`

```ts
authenticatedClient(audience: 'customer' | 'staff')
  : Promise<ReturnType<typeof createClient<paths>>>
```

Calls `apiOrigin()` first, so a bad base URL fails before any branch. Then picks
**one** of three, in order:

| # | Condition | Headers | Credentials |
|---|---|---|---|
| 1 | `csrfToken()` returns a token from `localStorage['noatum.csrf']` | `x-csrf-token` | **`include`** |
| 2 | `devAuthEnabled && getDevIdentity()` | `X-Dev-User-Subject`, `-Email`, `-Name` | `omit` |
| 3 | fallthrough | `Authorization: Bearer <token>` | `omit` |

Branch 1 is the **portal session** (ADR-006). The session lives in an HttpOnly
cookie; its presence is *inferred* from the CSRF token, which is the only part
script can read. This is the only branch that sends cookies.

Branch 2 is the **dev bypass**. `devAuthEnabled` requires both
`import.meta.env.DEV` **and** `VITE_DEV_AUTH === 'true'`. The API enforces the
same rule independently and refuses to boot with its flag set in production.

Branch 3 is **Entra ID** via MSAL. Any MSAL failure collapses to
`AccessError('signInRequired')`.

Every branch sets `cache: 'no-store'` and `redirect: 'error'`.

### `AccessError`

```ts
class AccessError extends Error {
  constructor(readonly kind: 'signInRequired' | 'accessDenied' | 'accessUnavailable')
}
```

| Kind | Thrown when |
|---|---|
| `signInRequired` | `accessToken()` rejected |
| `accessDenied` | `/api/me` returned 401 or 403 |
| `accessUnavailable` | Config fault, `!response.ok`, missing body, or malformed `permissions` |

### `currentUser(audience, signal)`

`GET /api/me` with a 10 s ceiling composed onto the caller's signal. Two
normalisations that matter:

- **`features` degrades closed** — a malformed value becomes `[]`, hiding
  controls rather than showing ones the guard would refuse.
- **`settings` degrades open** — a malformed value becomes `{}`, so every
  `getSetting` call falls back to the caller's stated default.

---

## 3. The public client

`src/api/public/` serves the anonymous surface: the landing page, public track
and trace, the CO₂e calculator and the access-request form.

```ts
publicGet<T>(path, schema: ZodType<T>, options?: { query?, signal? }): Promise<T>
publicPost<T>(path, body, schema: ZodType<T>, options?: { signal? }): Promise<T>
```

**Anonymous by security rule** — `credentials: 'omit'` always. A surface that
reveals nothing about which customers exist must not identify its caller either.

### Every response is parsed

The contracts in `src/api/public/contracts.ts` are **zod schemas with the types
inferred from them**, not interfaces. They describe endpoints that do not exist
in the OpenAPI document yet, so an unchecked `as` cast would turn the first
disagreement into a blank page. `publicGet`/`publicPost` `safeParse` every 2xx
body.

Three error classes:

| Class | Meaning |
|---|---|
| `PublicApiError(status, body)` | Non-2xx. `body` is **deliberately unparsed** — it carries 404 recovery data. `.notFound` getter |
| `PublicContractError(path, issues)` | A 2xx body that failed the schema. Its own class because the fix is different: somebody changed the contract |
| `PublicApiConfigError()` | `VITE_API_BASE_URL` unusable |

### The transport seam

```ts
const useMock = import.meta.env.VITE_PUBLIC_API_MOCK === 'true';
const transport: typeof fetch = useMock ? mockFetch : (i, init) => fetch(i, init);
```

One line separates "no backend" from "backend". `mockFetch` answers with **real
`Response` objects** — real status codes, real JSON, real latency (260 ms), real
abort handling — so every caller above it runs the same code in both worlds,
including its 404 and failure paths.

**The flag is opt-in.** An environment that has not been told to use the stand-in
gets the real API and an honest failure state. The alternative default would
mean one forgotten variable is all it takes to show a deployed customer a
shipment that does not exist.

Going live: drop `VITE_PUBLIC_API_MOCK`. Finishing: delete `src/api/public/mock`,
the import and the ternary. No hook, component or query key changes either way.

### What the stand-in serves

| Path | Statuses |
|---|---|
| `/api/public/landing` | 200 |
| `/api/public/tracking` | 200 · 400 (blank reference) · 404 (unknown, or filed under another `kind`, with `suggestedKind`) |
| `/api/public/emissions/reference` | 200 |
| `/api/public/emissions/estimate` | 200 · 400 · 404 · 405 · 409 |
| `/api/public/access-request` | 201 · 405 · 422 (`{ problems: {…} }`) |
| anything else | 404 |

Matching is **whole-reference only** after case and punctuation are stripped. An
earlier substring version made the not-found screen unreachable; the test *"does
not match on a fragment"* pins the current behaviour.

`src/api/public/public-api.test.ts` drives `mockFetch` against the same schemas
the app parses with, so the two cannot drift.

---

## 4. URL hardening

Both clients validate `VITE_API_BASE_URL` before use and reject:

- credentials in the URL (`username` / `password`)
- a query string or fragment
- any protocol other than `https:`, **unless** `import.meta.env.DEV` and the URL
  is `http://localhost` or `http://127.0.0.1`

Only `url.origin` is kept — path, query and fragment are discarded.

One difference: the authenticated client **throws** when `VITE_API_BASE_URL` is
absent; the public client **falls back to `window.location.origin`**.

---

## 5. TanStack Query conventions

`AppProviders` creates `new QueryClient()` with **no `defaultOptions`**. Every
option below is therefore per-hook, and the global `staleTime` is `0`.

### Query key shapes

| Shape | Example |
|---|---|
| Entity list | `['customers', filters]` |
| Entity detail | `['customer', id]` |
| Namespaced | `['public', 'tracking', kind, reference]` |
| Team (hierarchical) | `['account', 'team', 'users']` under `TEAM_KEY` |

A hierarchical base key lets one `invalidateQueries({ queryKey: TEAM_KEY })`
cover every list under it. Prefer that to invalidating everything.

### House pattern

Almost every authenticated hook:

```ts
queryFn: async ({ signal }) => {
  const client = await authenticatedClient('staff');
  const { data, response } = await client.GET('/api/…', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!data) throw new StaffError(response.status === 403 ? 'denied' : 'unavailable');
  return data;
},
retry: false,
```

- **`retry: false`** is the norm. A 403 is an answer, not a flake.
- **Timeouts are explicit**, composed onto the caller's signal: 10 s or 15 s for
  reads, 20 s for pricing, 15 s for publish, **120 s** for the synchronous
  organisation import.
- `enabled: Boolean(id)` guards detail queries.

### Cache tuning actually in use

| Hook | Setting | Why |
|---|---|---|
| `useReference` | `staleTime`/`gcTime` 1 h, no refetch on focus, **failure returns `[]`** | Reference data; a dropdown must not explode a page |
| `useRolePresets`, `useEmissionsReference` | `staleTime: Infinity` | Session-stable catalogues |
| `usePublicLanding` | 5 min | Not per-visitor |
| `useCustomerActivity` | 60 s; a refusal returns `{ quotes: 0 }` | Cannot distinguish empty from restricted, so it claims neither |
| `usePricingQueue` | `refetchInterval: 60_000`, refetch on focus | A work queue others are also claiming from |
| `useStaff`, `useStaffPresets` | `staleTime: 0`, `gcTime: 0` | Role changes must be visible immediately |
| `useOrganisations`, `useCo2Estimate` | `placeholderData: keepPreviousData` | The table must not blank between pages, the bars must not blank between estimates |
| `usePublicTracking` | custom `retry`: never on `PublicApiError` < 500 | A 404 is an answer |

### Error mapping

`src/lib/errors.ts`:

```ts
errorKey(error: unknown): string   // an i18n key in the `staff` namespace
```

`StaffError` → its `kind`; `AccessError` → `'denied'`; anything else →
`'unavailable'`. It lives in `lib/` because it had been duplicated byte for byte
across seven screens.

### Known inconsistency

`features/customer-admin/api/team.ts` is the only api module that does **not**
set `retry: false`, does **not** apply an `AbortSignal.timeout`, and surfaces
`error.message` rather than the `StaffError` / `LookupWriteError` convention.

---

## 6. Generated types

`src/api/generated/` is produced by `scripts/generate-api.mjs` and is
**git-ignored**. See `02-build-and-tooling.md` §3.

- `schema.d.ts` — `openapi-typescript` output: `paths`, `components`,
  `operations`. ~89 path entries.
- `staff-role-form.ts` — a zod schema generated from `StaffRoleUpdateDto` by
  `scripts/generate-staff-form.mjs`, which **throws** unless every property is
  required. That guard exists so a DTO growing an optional field cannot silently
  drop it from the form.

Both come from one document in one run, so types and form schema can never
describe different API versions.

**Never hand-write a type that mirrors an API shape.** ESLint blocks importing
from the API app; the public contracts are the one sanctioned exception, and they
carry a PROVISIONAL header saying so.

---

## 7. Shared data hooks

| Hook | File | Notes |
|---|---|---|
| `useFeature(key)` / `hasFeature(user, key)` | `shared/features/useFeature.ts` | Reads the cached `['current-user']`. Returns **false until loaded**, so a control never flashes on |
| `useSetting(key, fallback)` / `getSetting(user, key, fallback)` | `shared/features/useSetting.ts` | Type-checks against the fallback, so an older SPA keeps working against a newer API (ADR-010) |
| `useReference(category, options?)` | `shared/reference/useReference.ts` | 15 categories in `REFERENCE`. Plus `useReferenceLabels` and `useReferenceOptions` |
| `useEmissionsReference()`, `useCo2Estimate(request)` | `shared/api/emissions.ts` | Public transport, no auth |

CO₂ arithmetic is deliberately **server-side**. A figure the customer sees must
have one implementation; a copy in the browser is how the number on screen ends
up disagreeing with the number on the quotation.

### Small utilities

| File | Export |
|---|---|
| `lib/use-debounced.ts` | `useDebounced<T>(value, delay = 250)` — keeps a query key still while somebody types |
| `lib/use-now.ts` | `useNow(intervalMs = 60_000)` — a ticking clock, so an age advances without an unrelated re-render |
| `lib/relative-time.ts` | `timeAgo(iso, locale, now = Date.now())` — `now` is injectable so tests can pin it |
| `lib/errors.ts` | `errorKey(error)` |

---

## 8. Adding an endpoint

1. Ship it on the API, regenerate: `pnpm api:generate:offline`.
2. Add a hook in `src/features/<feature>/api/<name>.ts`.
3. Use `authenticatedClient(audience)`; pick `'customer'` or `'staff'` by which
   shell the screen lives in.
4. Set `retry: false` and an explicit timeout.
5. Choose a query key that shares a prefix with anything that should be
   invalidated alongside it.
6. Map failures through `errorKey()` so the screen shows a translated message.
7. Provide loading, empty and error states — required for every data view.
