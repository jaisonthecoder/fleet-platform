# Routing, shells and navigation

How a URL becomes a rendered page, which shell owns it, and how navigation is
filtered.

---

## 1. Two dispatches before a route matches

This is the part that surprises people. The app chooses what to render **twice**,
both times by reading `window.location.pathname` directly, before React Router
does any matching.

### 1.1 `src/main.tsx` — bundle selection

Runs before React Router mounts. Picks one of four bundles:

| Path pattern | Renders | Notes |
|---|---|---|
| `/forgot-password`, `/invitation/:token`, `/portal-admin-setup/:token`, `/reset-password/:token` | `LocalAuthPage` (lazy) | **No router, no providers** |
| `/`, `/login`, `/login/customer`, `/login/staff` | `LoginPage` (lazy) | `restorePortalSession(false)` first |
| `/portal/*`, `/app/*`, **or any path when `import.meta.env.DEV`** | `App` (lazy) | `restorePortalSession(true)` first |
| anything else, in production | `PendingPortal` | inline "portal pending" placeholder |

`restorePortalSession` clears the stored CSRF token outright when
`VITE_LOCAL_AUTH_ENABLED !== 'true'`.

**Consequence:** the login and password-reset screens are standalone React trees.
They have no `QueryClientProvider` and no router, so nothing inside them may use
TanStack Query or `useNavigate`.

### 1.2 `src/app/App.tsx` — route-tree selection

Picks one of three `<Routes>` trees, again by pathname, **read once at mount and
not reactively**. A client-side navigation that crosses from `/portal/*` to
`/app/*` therefore needs a full document load — which is why the shells use
`window.location.replace` rather than `navigate` when they redirect across the
boundary.

---

## 2. The three shells

| Shell | Layout component | Routes | Token ramp | Chrome |
|---|---|---|---|---|
| **Staff** | `StaffPortalLayout` → `AppShell` | `/portal/*` | `--noa-*` | Collapsible sidebar rail, header, global track search |
| **Customer** | `CustomerPortalLayout` → `CustomerShell` | `/app/*` | `--space-*` | Website: red strip, horizontal nav, 1320px |
| **Workspace** (dev only) | `PortalLayout` | `/controls`, `/foundation`, `/overlays`, `/data`, `/listings` | `--noa-*` | UI-kit preview |

`WorkspaceRoutes` returns `null` unless `import.meta.env.DEV`, so the UI kit
never ships.

Files:

```
src/app/layouts/StaffPortalLayout.tsx     guard + shell wiring
src/app/layouts/CustomerPortalLayout.tsx  guard + shell wiring
src/app/layouts/PortalLayout.tsx          dev workspace
src/shared/layouts/app-shell/             AppShell, AppHeader, AppSidebar, GlobalTrackSearch
src/shared/layouts/customer-shell/        CustomerShell, CustomerMeasure
```

### 2.1 The shell boundary rule

A customer *visits*; a staff user *lives here*. That is why the two shells use
different spacing ramps and different chrome — see `03-design-tokens.md` §2. The
rule is documented at the top of `CustomerShell.module.css`.

**Do not mix ramps inside one component.** Picking the shell tells you the ramp.

---

## 3. Route table

### 3.1 Staff — `/portal/*`

Layout guard requires all three: `user.isInternal`, no `onBehalfOfUserId`, and
permission `admin.staff.read`. Otherwise it renders a `StatePanel` in one of four
states: `loading`, `unavailable`, `denied`, `pending`. A **non-internal** user is
sent to `/app/dashboard` via `window.location.replace`.

| Path | Component |
|---|---|
| `/portal` | → `Navigate to="staff"` |
| `/portal/organisations` | `OrganisationsPage` |
| `/portal/organisations/:id` | `OrganisationDetailPage` |
| `/portal/customers` | `CustomersPage` |
| `/portal/customers/:id` | `CustomerDetailPage` |
| `/portal/unassigned` | `UnassignedPage` |
| `/portal/lookups` | `LookupsPage` |
| `/portal/features` | `FeatureManagementPage` |
| `/portal/settings` | `SettingsPage` |
| `/portal/pricing` | `PricingQueuePage` |
| `/portal/pricing/:id` | `PricingDetailPage` |
| `/portal/branches` | `OperatingPage` |
| `/portal/staff` | `StaffPage` |
| `/portal/account` | `AccountSecurityPage` |
| `*` | → `Navigate to="/portal/staff"` |

Outlet context: `CurrentUserDto`.

### 3.2 Customer — `/app/*`

The shell renders for anonymous visitors too. An **internal** user is sent to
`/portal/staff` from an effect. Outlet context is the session or `undefined`.

| Path | Component | Access |
|---|---|---|
| `/app` | → `Navigate to="dashboard"` | |
| `/app/dashboard` | `CustomerDashboardPage` | **Public.** The only path readable signed out (`PUBLIC_PATH`). Renders `PublicLanding` when anonymous |
| `/app/quotations` | `QuotesListPage` | signed in |
| `/app/quotations/new` | `QuoteRequestPage` | declared **before** `:id`, so `new` is not read as an id |
| `/app/quotations/:id` | `QuoteDetailPage` | signed in |
| `/app/team` | `TeamPage` | nav gated on `users.manage` |
| `/app/account` | `CustomerAccountSecurityPage` | deliberately out of the nav — profile menu only |
| `/app/*` | `CustomerSectionFallback` | signed in → `/app/dashboard`; visitor → `window.location.assign('/login')` |
| `*` | → `Navigate to="/app/dashboard"` | |

### 3.3 Standalone (no router)

| Path | Component |
|---|---|
| `/`, `/login`, `/login/customer`, `/login/staff` | `LoginPage` |
| `/forgot-password` | `LocalAuthPage` → `ForgotPasswordPage` |
| `/invitation/:token` | `LocalAuthPage` → `SetPasswordPage` (`purpose: activation`) |
| `/portal-admin-setup/:token` | `LocalAuthPage` → `SetPasswordPage` (bootstrap) |
| `/reset-password/:token` | `LocalAuthPage` → `SetPasswordPage` (reset) |

`matchLocalAuthRoute()` in `LocalAuthPage.tsx` is the path parser.

---

## 4. Navigation

`src/app/navigation/navigation.ts` holds four `as const` arrays.

### 4.1 `staffNavigation`

Nine entries, all `available: true`, each gated on its own permission and sorted
into one of two groups.

| id | href | permission | group |
|---|---|---|---|
| `organisations` | `/portal/organisations` | `admin.organisations.link` | administration |
| `customers` | `/portal/customers` | `admin.customers.read` | administration |
| `unassigned` | `/portal/unassigned` | `admin.customers.manage` | administration |
| `lookups` | `/portal/lookups` | `admin.lookups.manage` | administration |
| `features` | `/portal/features` | `admin.flags.manage` | administration |
| `settings` | `/portal/settings` | `admin.settings.read` | administration |
| `branches` | `/portal/branches` | `admin.operating.read` | operating |
| `pricing` | `/portal/pricing` | `pricing.queue.read` | operating |
| `staff` | `/portal/staff` | `admin.staff.read` | operating |

Labels resolve as `staff:nav_<id>`, group headings as `staff:navGroup_<group>`.

### 4.2 `customerNavigation`

Six entries, no icons, no groups — the customer shell is a horizontal website
nav, not a grouped rail.

| id | href | permission | available |
|---|---|---|---|
| `dashboard` | `/app/dashboard` | `dashboard.read` | ✅ |
| `shipments` | `/app/shipments` | `shipments.read` | ❌ |
| `quotations` | `/app/quotations` | `quotes.read` | ✅ |
| `bookings` | `/app/bookings` | `bookings.read` | ❌ |
| `invoices` | `/app/invoices` | `invoices.read` | ❌ |
| `team` | `/app/team` | `users.manage` | ✅ |

Three behaviours to know:

- `available: false` entries are **declared but have no route**. They render
  disabled with the `customerNavUnavailable` label, so the navigation shows the
  whole product from the first release and each item lights up as its slice
  lands.
- Signed out, every entry except `/app/dashboard` is rewritten to `/login` and
  labelled `customerNavSignInRequired`.
- Entries are filtered by permission, so a colleague without `users.manage`
  never learns the Team page exists.

### 4.3 `workspaceNavigation` / `workspaceMobileNavigation`

Dev workspace only. `href` is derived as `/${id}`. The mobile bar is
`['controls', 'data', 'listings', 'foundation']` — `overlays` is excluded.

### 4.4 Staff mobile bar

**Not** in `navigation.ts`. `StaffPortalLayout` hardcodes
`['customers', 'organisations', 'branches', 'staff']` and intersects it with the
permitted navigation.

---

## 5. Adding a page — checklist

1. Create the page under `src/features/<feature>/pages/`.
2. Add the route to the correct tree in `src/app/router.tsx`. Static segments go
   **before** dynamic ones (`quotations/new` before `quotations/:id`).
3. If it should appear in navigation, add an entry to the right array with its
   permission. Do not add a permission check inside the page as well — the layout
   filters.
4. Add `nav_<id>` (staff) or `customerNav_<id>` labels to **both** locale files.
5. Pick the token ramp from the shell, not from taste.
6. Provide loading, empty and error states. `StatePanel` / `.noa-state` exists
   for the staff surface; the customer surface uses its own card treatment.

---

## 6. Known oddities

- **`AdminSectionPage`** (`src/features/admin/pages/AdminSectionPage.tsx`) is
  exported and imported by nothing. No route references it.
- Navigation id `branches` → route `/portal/branches` → component
  `OperatingPage`, which lives in `admin/pages/`. Three different names for one
  destination.
- `src/components/` and `src/hooks/` exist but contain only `.gitkeep`. The
  design system lives in `src/design-system/`, shared hooks in `src/lib/` and
  `src/shared/`. `components.json` nevertheless aliases `hooks` → `@/hooks`.
- Route-tree selection is non-reactive (§1.2), so crossing `/portal` ↔ `/app`
  requires a document load.
