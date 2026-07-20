# Phase 01 — Foundations: RBAC, Role-Driven Nav, Scope Switcher & Admin Shell

> **Backend readiness: ✅ ready.** Uses `GET /me` and `GET /hierarchy` (both live). No backend change.
>
> **Why first.** Every admin screen is RBAC-gated and scope-aware. This phase turns the *already-built*
> auth foundation (`useAuth().me`, dev-login/MSAL, 401 handling) into a **role-driven shell** and lays
> down the **reusable admin-page kit** that phases 02–08 compose. Nothing else can be production-ready
> until routes are guarded, nav reflects roles, and scope is selectable.

---

## 1. Scope

1. **Role model helper** — typed union of the 18 roles + predicates.
2. **Role-driven sidebar** — nav items filtered by `me.roles`; grouped sections (Operations / Governance / Administration); **real profile** from `me` (retire `DEMO_USER`).
3. **`RequireRole` route guard** — 403 screen when the user lacks the role (defence-in-depth with backend).
4. **Role-based landing** — index route redirects each actor to their landing (`/admin`, `/data-quality`, `/audit`, or Home).
5. **Scope Switcher** — `ScopeProvider` (persisted) + header control reading `GET /hierarchy`; flatten/tree helpers reused by role-assignment + data scoping.
6. **Admin shell + reusable admin-page kit** — `AdminPageLayout`, `ResourcePage`, `ResourceTable`, `ResourceFormDialog`, `FilterBar`, `DetailDrawer`, `AuditMetaFooter`, `AccessDenied`. (Full specs in file 09; this phase builds the first cut.)

---

## 2. Files (create / modify)

```
src/features/auth/
  roles.ts                     # NEW: PlatformRole union, ROLE_GROUPS, hasAnyRole(me, roles), isAdminFamily(me)
  require-role.tsx             # NEW: <RequireRole roles={[...]}> guard → <AccessDenied/> or children
  access-denied.tsx           # NEW: 403 screen (reason + back to landing)
  landing.ts                  # NEW: resolveLanding(me) → best route segment for the actor

src/app/providers/
  scope-provider.tsx          # NEW: ScopeProvider + useScope() (selectedScopeId, setScope, persisted)

src/features/platform/         # NEW module (identity/hierarchy read surface, shared)
  platform.contract.ts        # HierarchyNodeDto mirror + fetchHierarchy(); flattenHierarchy(); descendantsOf()
  hooks/use-hierarchy.ts       # useHierarchy() query
  components/scope-switcher.tsx# header dropdown/combobox over hierarchy
  components/scope-picker.tsx  # form control (reused by role assignment)

src/app/shell/
  nav.ts                       # MODIFY: NavItem += { roles?, group }, add admin/governance items, navFor(me)
  app-sidebar.tsx              # MODIFY: filter by navFor(me); grouped sections; real profile from me
  app-header.tsx               # MODIFY: breadcrumb for nested admin routes; mount <ScopeSwitcher/>
  app-shell.tsx                # (unchanged unless layout slot needed)

src/app/routing/router.tsx     # MODIFY: index → role landing; add admin/* + governance routes (lazy, guarded)

src/components/patterns/        # first cut of the reusable admin kit (finalised in file 09)
  admin-page-layout.tsx        # NEW
  resource-table.tsx           # NEW (wraps ui/data-table with row actions + toolbar slots)
  resource-form-dialog.tsx     # NEW (Dialog + RHF form scaffold)
  filter-bar.tsx               # NEW
  detail-drawer.tsx            # NEW (Sheet-based)
  audit-meta-footer.tsx        # NEW (who/when strip)

src/app/providers/app-providers.tsx  # MODIFY: mount ScopeProvider (inside SidebarProvider)
src/i18n/locales/{en,ar}.json        # MODIFY: nav groups, admin nav labels, scope, accessDenied keys
```

---

## 3. Role model (`features/auth/roles.ts`)

```ts
export const PLATFORM_ROLES = [
  'Employee','Approver','Delegate','FleetManager','ClusterFleetLead','GroupFleetLead',
  'ClusterCEO','Procurement','Finance','HR','InsuranceLead','HSE','InternalAudit',
  'Executive','DataSteward','SystemAdmin','SubstituteDriver','ProfessionalDriver',
] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const ADMIN_ROLES: PlatformRole[] = ['SystemAdmin','DataSteward']
export const AUDIT_ROLES: PlatformRole[] = ['InternalAudit','SystemAdmin']

export function heldRoles(me: Me | null): Set<string> {
  return new Set((me?.roles ?? []).map((r) => r.role))
}
export function hasAnyRole(me: Me | null, roles: readonly PlatformRole[]): boolean {
  const held = heldRoles(me); return roles.some((r) => held.has(r))
}
export function isAdminFamily(me: Me | null): boolean {
  return hasAnyRole(me, ['SystemAdmin','DataSteward','InternalAudit'])
}
```

- **Rule:** the UI keys on the **role string** (stable), never a label. Role display names come from i18n
  (`roles.<Role>`), never hardcoded.

---

## 4. Role-driven nav (`app/shell/nav.ts`)

Extend `NavItem` and add groups. Items without `roles` are visible to any authenticated user; items with
`roles` render only when `hasAnyRole(me, roles)`.

```ts
export type NavGroup = 'operations' | 'governance' | 'administration'
export interface NavItem {
  segment: string            // may be nested, e.g. 'admin/reference-data'
  icon: LucideIcon
  labelKey: string
  group: NavGroup
  roles?: PlatformRole[]     // undefined = all authenticated
  end?: boolean
  disabled?: boolean
}

export function navFor(me: Me | null): NavItem[] {
  return navItems.filter((i) => !i.roles || hasAnyRole(me, i.roles))
}
```

**Admin/governance items to add** (icons: `Database`, `Users`, `Building2`, `SlidersHorizontal`,
`Plug`, `BellRing`, `ClipboardCheck`, `ScrollText`, `Scale`):

| segment | group | roles | label |
|---|---|---|---|
| `admin` | administration | `SystemAdmin` | Admin home |
| `admin/reference-data` | administration | `DataSteward,SystemAdmin` | Reference data |
| `admin/access` | administration | `SystemAdmin` | Access management |
| `admin/organization` | administration | `SystemAdmin` | Organisation |
| `admin/policy` | administration | `SystemAdmin` | Policy studio |
| `admin/integrations` | administration | `SystemAdmin` | Integrations |
| `admin/notifications` | administration | `SystemAdmin` | Notifications |
| `data-quality` | governance | `DataSteward,SystemAdmin` | Data quality |
| `audit` | governance | `InternalAudit,SystemAdmin` | Audit log |

- Existing operational items (booking/handover/approvals/…) keep `group:'operations'`, `roles`
  omitted for now (refined when those modules land). The sidebar renders **section headers** per group,
  hiding a section entirely when it has no visible items.

**Sidebar changes (`app-sidebar.tsx`):**
- Replace `navItems.map(...)` with `navFor(me)` grouped by `group` (labelled dividers).
- Replace `DEMO_USER` in `SidebarProfile` with `me` (initials from `fullName`, `grade`/`email` subline);
  keep the collapsed avatar behaviour. Pull `me` from `useAuth()`.

**Breadcrumb (`app-header.tsx`):** `useBreadcrumb` currently splits on the first segment. Update to match
the **full nested segment** against `navItems` (so `admin/reference-data` resolves to its label +
register `nav.registers.administration`). Add register keys for the new groups.

---

## 5. `RequireRole` guard + AccessDenied + landing

```tsx
// require-role.tsx
export function RequireRole({ roles, children }: { roles: PlatformRole[]; children: ReactNode }) {
  const { me, status } = useAuth()
  if (status === 'loading') return <RouteFallback />
  if (!hasAnyRole(me, roles)) return <AccessDenied requiredRoles={roles} />
  return <>{children}</>
}
```

- **`AccessDenied`** — 403 screen: shield icon, "You don't have access", the required role(s) as chips,
  a "Back to {landing}" button, and a "Request access" mailto/hook stub. Wayfinder danger-tint header.
- **`resolveLanding(me)`** — `SystemAdmin → 'admin'`, `DataSteward → 'data-quality'`,
  `InternalAudit → 'audit'`, else `''` (Home). The index route renders `<Navigate to={landing} replace>`
  wrapped so it only redirects **once** post-auth (avoid loops). Non-admins keep the current Home.

---

## 6. Scope Switcher (`GET /hierarchy`)

**Contract mirror (`features/platform/platform.contract.ts`):**
```ts
export interface HierarchyNode {
  id: string; parentId: string | null; levelIndex: number
  levelLabel: string; name: string; path: string; children: HierarchyNode[]
}
export const hierarchyNodeSchema: z.ZodType<HierarchyNode> = z.lazy(() => z.object({
  id: z.string(), parentId: z.string().nullable(), levelIndex: z.number(),
  levelLabel: z.string(), name: z.string(), path: z.string(),
  children: z.array(hierarchyNodeSchema),
}))
export async function fetchHierarchy(): Promise<HierarchyNode[]> {
  return z.array(hierarchyNodeSchema).parse(await apiClient.get('/v1/hierarchy'))
}
export function flattenHierarchy(nodes: HierarchyNode[], depth = 0): FlatNode[] { /* pre-order, carries depth for indent */ }
export function descendantsOf(nodes: HierarchyNode[], id: string): string[] { /* for roll-up scope */ }
```

**`ScopeProvider` (`app/providers/scope-provider.tsx`):**
- Holds `selectedScopeId: string | null` (default `me.homePoolNodeId` when known), `setScope`, and the
  resolved node. Persist to `localStorage['wf-scope']`. Expose `useScope()`.
- Mount **inside** `SidebarProvider` in `app-providers.tsx` (needs no data itself; the switcher fetches).

**`ScopeSwitcher` (header):** a `Combobox`/`DropdownMenu` listing flattened hierarchy (indented by
`levelIndex`, shows `levelLabel · name`), searchable, sets scope in context. Renders only when the user
has ≥1 role/hierarchy (hidden for role-less users). Compact icon in collapsed layouts. Fully keyboard +
RTL. **In Phase 1 it drives display/selection only**; feature screens consume `useScope()` later.

**`ScopePicker`** — the same data as a **form control** (label + combobox), reused by Role Assignment
(file 03) and any scope-bound form.

---

## 7. Reusable admin-page kit (first cut — full spec in file 09)

Build the minimum needed by phases 02–03 now; harden in file 09.

- **`AdminPageLayout`** — `PageHeader` (eyebrow=register, title, description, primary action slot) +
  optional `FilterBar` slot + content + optional right `DetailDrawer`. Consistent paddings/tokens.
- **`ResourceTable<T>`** — wraps `ui/data-table` adding: a **toolbar** (search + filters + actions),
  a **row-actions** column (dropdown: view/edit/deactivate…), density, sticky header, empty/loading/error
  slots, optional selection. Column defs stay in the page.
- **`ResourceFormDialog`** — `Dialog` + RHF `Form` scaffold with footer (Cancel / Save-with-pending),
  server-error → field mapping, create/edit modes. Consumers pass fields + Zod schema + submit fn.
- **`FilterBar`** — labelled filter controls row (search, selects, toggles) with a "clear all".
- **`DetailDrawer`** — `Sheet` right-side detail/inspector with header, scroll area, action footer.
- **`AuditMetaFooter`** — muted "Created/Updated by · when" strip for governed records.
- **`AccessDenied`** — from §5 (also used as the RBAC fallback anywhere).

All are **domain-agnostic**, token-styled, RTL-safe, i18n via props. They are the backbone of every
module in the app.

---

## 8. i18n keys (add to `en.json` + `ar.json`)

```
nav.groups.operations|governance|administration
nav.registers.governance|administration
nav.adminHome, nav.referenceData, nav.access, nav.organization, nav.policyStudio,
nav.integrations, nav.notifications, nav.dataQuality, nav.audit
scope.label, scope.placeholder, scope.search, scope.allScopes, scope.change
accessDenied.title, accessDenied.body, accessDenied.requiredRole, accessDenied.back, accessDenied.request
roles.<EachRole>            # 18 human-readable role names (EN + AR)
common.retry, common.clearFilters, common.rowActions, common.view, common.edit, common.deactivate
```

- Arabic values authored in parallel (RTL). Role names get proper Arabic terms (e.g. `SystemAdmin → مسؤول النظام`).

---

## 9. Tests (Vitest + RTL + MSW)

- `roles.test.ts` — `hasAnyRole`, `isAdminFamily`, `resolveLanding` truth tables.
- `require-role.test.tsx` — renders children when role held; `AccessDenied` when not; fallback while loading.
- `nav.test.ts` — `navFor(me)` filters admin items by role; sections hide when empty.
- `scope-switcher.test.tsx` — flattens hierarchy (MSW `/v1/hierarchy`), selects a node → `useScope()` updates + persists.
- `app-sidebar.test.tsx` — SystemAdmin sees Administration group; Employee does not; profile shows `me.fullName`.

**MSW handlers needed:** `GET /api/v1/me`, `GET /api/v1/hierarchy` (add to `mocks/handlers/platform.ts`).

---

## 10. Exit checklist

- [ ] `roles.ts`, `require-role.tsx`, `access-denied.tsx`, `landing.ts` created + unit-tested.
- [ ] Sidebar is **role-driven + grouped**; real profile from `me`; `DEMO_USER` removed.
- [ ] Index route redirects each actor to their landing; non-admins unaffected.
- [ ] `ScopeProvider` + `ScopeSwitcher` live in the header, reading `/hierarchy`, persisted, RTL/keyboard OK.
- [ ] Admin routes registered (lazy) and wrapped in `RequireRole` (screens can be placeholders until phase 02+).
- [ ] Reusable kit first cut (`AdminPageLayout`, `ResourceTable`, `ResourceFormDialog`, `FilterBar`, `DetailDrawer`, `AuditMetaFooter`, `AccessDenied`) in place.
- [ ] i18n EN/AR added; verified on `/ar`.
- [ ] Gate green (`tsc`, `oxlint`, `vitest`, `vite build`).
