# Architecture

The shape of the SPA: layers, boundaries, and what happens between page load and
a rendered screen.

---

## 1. Source layout

```
src/
├── main.tsx              bootstrap + path-based bundle selection
├── app/
│   ├── App.tsx           picks one of three route trees
│   ├── providers.tsx     BrowserRouter + QueryClientProvider
│   ├── router.tsx        PortalRoutes | CustomerRoutes | WorkspaceRoutes
│   ├── layouts/          StaffPortalLayout, CustomerPortalLayout, PortalLayout
│   └── navigation/       navigation.ts — the four nav arrays
├── api/
│   ├── generated/        openapi-typescript output — GIT-IGNORED
│   └── public/           the anonymous client + its zod contracts + stand-in
├── auth/                 sign-in.ts (MSAL), dev-session.ts, recent-staff.ts
├── design-system/        tokens, components, primitives, styles
├── features/<name>/      api/ components/ pages/ i18n/
├── shared/
│   ├── api/              cross-feature query hooks
│   ├── components/       Breadcrumb, ListingGrid, Co2Calculator
│   ├── features/         useFeature, useSetting
│   ├── reference/        useReference
│   └── layouts/          app-shell/, customer-shell/
├── lib/                  errors, relative-time, use-debounced, use-now
└── i18n/                 i18next init + the default namespace
```

`src/components/` and `src/hooks/` exist but hold only `.gitkeep`. The design
system lives in `src/design-system/`; shared hooks in `src/lib/` and
`src/shared/`. `components.json` nevertheless aliases `hooks` → `@/hooks`.

---

## 2. Layers and the rules between them

```
      pages  ─────────────► feature api hooks ─────► clients ────► HTTP
        │                          │
        ├──► design-system         └──► generated types / zod contracts
        └──► shared components
```

| Layer | May import | Must not |
|---|---|---|
| `design-system/` | tokens, `lib/`, Radix | feature code, router, API clients, i18n |
| `shared/` | design-system, `lib/`, api clients | feature code |
| `features/<a>/` | design-system, shared, `lib/`, own `api/` | **another feature's internals** |
| `app/` | everything | — |

Two import bans are enforced by ESLint rather than convention:

- `apps/noatum-customer-portal-api/**` — the two apps deploy separately and
  share no code. Generate the client instead.
- `cw1-simulator` — never imported by the SPA.

**The design system never calls `useTranslation`.** Every string arrives as a
prop. That is what makes it reusable across the two shells and testable without
an i18n context.

---

## 3. Bootstrap order

```
main.tsx
 ├─ import './i18n'                    i18next initialised before any render
 ├─ import foundation.css              tokens → base → Mulish → globals
 ├─ getElementById('root')             throws 'Root element missing'
 ├─ restorePortalSession(…)            optional CSRF probe over the network
 ├─ path match → dynamic import        one of four bundles
 └─ <StrictMode>
      └─ AppProviders                  (app bundle only)
           ├─ BrowserRouter
           └─ QueryClientProvider      new QueryClient(), no defaultOptions
                └─ layout              adds its i18n bundle, issues ['current-user']
```

`restorePortalSession` clears the stored CSRF token outright when
`VITE_LOCAL_AUTH_ENABLED !== 'true'` — a leftover token would otherwise divert
staff requests onto cookie auth.

---

## 4. Two dispatches before routing

The app chooses what to render **twice**, both times by reading
`window.location.pathname` directly:

1. **`main.tsx`** picks one of four bundles: local-auth pages, login, the app, or
   a production placeholder.
2. **`App.tsx`** picks one of three route trees, **once at mount, not
   reactively**.

Consequences:

- The login and password-reset screens are standalone React trees with **no
  router and no `QueryClientProvider`**. Nothing inside them may use TanStack
  Query or `useNavigate`.
- Crossing `/portal` ↔ `/app` requires a document load, which is why the shells
  use `window.location.replace` rather than `navigate` when they redirect across
  the boundary.

Full detail in `05-routing-and-shells.md`.

---

## 5. The three shells

| Shell | Routes | Token ramp | Audience |
|---|---|---|---|
| Staff | `/portal/*` | `--noa-*` | Noatum internal |
| Customer | `/app/*` | `--space-*` | Customers, and anonymous visitors on `/app/dashboard` |
| Workspace | `/controls`, `/data`, … | `--noa-*` | **Dev only** — returns `null` unless `import.meta.env.DEV` |

The shell determines the token ramp. A customer *visits*; a staff user *lives
here*. See `03-design-tokens.md` §2.

---

## 6. Identity — four paths

| Path | Mechanism | Where |
|---|---|---|
| Portal session | HttpOnly cookie + CSRF token in `localStorage` | `features/local-auth/api/local-auth.ts` |
| Entra ID (staff) | MSAL redirect, bearer token | `auth/sign-in.ts` |
| Entra ID (customer) | Same, separate registration — **currently unconfigured** | `auth/sign-in.ts` |
| Dev identity | Three request headers | `auth/dev-session.ts` |

`authenticatedClient` picks between them in a fixed order. See
`06-data-layer.md` §2.

MSAL is used **imperatively** — there is no `<MsalProvider>` in the tree.

---

## 7. Where state lives

| Kind | Mechanism |
|---|---|
| Server data | TanStack Query. One `QueryClient`, no global defaults |
| URL state | `useSearchParams` — e.g. the public tracking lookup lives in `?ref=&kind=` so a result can be refreshed, shared and reached with Back |
| Form state | `react-hook-form` + zod via `@hookform/resolvers` |
| Ephemeral UI | `useState` in the component |
| Per-viewer preferences | `localStorage`, always inside `try/catch` |
| Session identity | `sessionStorage` (dev identity), `localStorage` (CSRF, recent staff profile) |

There is **no Redux, Zustand or Context-based store**. Permissions and feature
flags are read from the cached `['current-user']` query rather than copied into
a store.

---

## 8. Cross-repository couplings

This app is a git submodule. Three things reach outside it:

1. **`scripts/generate-api.mjs --offline`** reads
   `../../noatum-customer-portal-api/openapi.json`. The app cannot generate its
   API client from its own repository alone.
2. **`Workspace.test.tsx`** reads `../../docs/noatum-designsystem.md` and pins
   `tokens.css` against it. Running the unit suite needs the parent checkout.
3. `src/api/generated/` is git-ignored, so a fresh clone does not typecheck
   until (1) has run.

---

## 9. Deliberate omissions

Recorded so they read as decisions, not gaps:

- **No SSR.** ADR-002 chose Vite for the logged-in portal; public pages may move
  to a small Next.js app later for SEO. Do not introduce SSR without an ADR.
- **No dark mode.** Actively asserted against in `Workspace.test.tsx`.
- **No global error boundary** in `AppProviders`.
- **No toast system.** Feedback is rendered inline by each screen.
- **No state-management library.**
- **No `<title>` management** — `index.html` has one static title.
