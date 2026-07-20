# Admin & Governance Modules — Build Plan (Overview & Architecture)

> **Goal.** Deliver the **production-ready Administration & Governance surface** of `app-ui` —
> the screens the **System Admin**, **Data Steward** and **Internal Audit** actors use to configure
> and govern the platform — built **contract-first against the real backend**, skinned to the
> **Wayfinder** design pattern (`../design-system.md`), and assembled from a **shared, reusable
> component/pattern kit** so every other actor module (Booking, Handover, Approvals, Entitlements,
> Fleet, Fines, Dashboards…) reuses the same building blocks.
>
> This folder holds the **phase-by-phase plan** — one phase per file, build in order, each phase has
> an **exit checklist**. It is the admin-domain sibling of `../component-library-plan/`.

---

## 0. How to read this folder

| # | File | Scope | Backend readiness |
|---|---|---|---|
| 00 | `00_Overview_and_Architecture.md` | This file — vision, module architecture, RBAC, routes, data layer, DoD | — |
| 01 | `01_Foundations_RBAC_Nav_and_Admin_Shell.md` | Role model, role-driven nav, `RequireRole`, role landing, **Scope Switcher**, Admin shell, reusable admin-page kit | ✅ ready |
| 02 | `02_Reference_Data_Lookup_Management.md` | Lookup/reference-data console (bilingual, cascading, cache-aware) | ✅ ready |
| 03 | `03_User_Access_and_Delegation_Management.md` | Users, role assignment (SoD-aware), access review, delegations | ✅ ready |
| 04 | `04_Organization_and_Hierarchy_Configuration.md` | Hierarchy tree editor, level taxonomy, terminology overrides, branding | 🟡 read ready · writes need backend |
| 05 | `05_Policy_Engine_Studio_PAP.md` | Decision-Table Studio (author/test/version/activate) | 🟡 engine ready · PAP HTTP needs backend |
| 06 | `06_Audit_Exceptions_and_Decision_Console.md` | Audit log, SoD-exception report, PDP decision log, chain verification | 🟡 read ready · filters/export need backend |
| 07 | `07_Data_Quality_and_Migration_Console.md` | Import batches, validation, dedup, completeness, steward sign-off | ✅ ready |
| 08 | `08_Integrations_Notifications_and_System_Config.md` | Integration health, HCM sync, notification config, feature flags, admin home | 🟠 needs backend |
| 09 | `09_Reusable_Admin_Component_Library_and_Patterns.md` | The shared kit every module reuses + module→component reuse matrix | — |
| 10 | `10_Testing_A11y_Security_i18n_and_Rollout.md` | Test strategy, a11y, security, MSW, rollout, **backend/DB change register** | — |

**Sequencing rationale.** Phases 1–3 and 7 are backed by a **finished, stable backend** (sub-phases
1A₂ + 1B/M3) and ship first with zero backend dependency. Phases 4–6 and 8 need **backend
enhancements** — each is specified here *and* logged in the Backend/DB Change Register (file 10 §)
so the backend lane can pick them up. We keep the UI moving on ready surfaces and never block on the
backend.

---

## 1. Actors, modules & the "dedicated module, reusable parts" rule

The platform is **modular by actor/domain**. Each actor's operations live in a **dedicated feature
module** (own folder, routes, data hooks, screens), but the **pages and components are composed from a
shared kit** — so a table, a form dialog, a detail drawer, a scope picker or an audit footer is
written **once** and reused everywhere. This is the core architectural rule the user asked for.

| Actor | Dedicated module (`src/features/…`) | Landing | This plan covers |
|---|---|---|---|
| **System Admin** | `admin/` | `/{lang}/admin` | Home, Reference data, Access, Org, Policy studio, Integrations, Notifications |
| **Data Steward** | `governance/data-quality/` (+ shares `admin/reference-data`) | `/{lang}/data-quality` | Reference data, Data-quality & migration console |
| **Internal Audit** | `governance/audit/` | `/{lang}/audit` | Audit log, Exceptions, Decision log (read-only) |

> Other actor modules (Booking, Handover, Approvals, Entitlements, Fleet, Fines, Dashboards) follow
> the **exact same module shape** defined here and reuse the **same shared kit** (file 09). This plan
> establishes the template.

### 1.1 Module folder shape (every feature module follows this)

```
src/features/<module>/
  routes.tsx                 # lazy route objects contributed to the router (owns its subtree)
  <module>.contract.ts       # Zod schemas + fetch/mutate fns mirroring backend contracts
  hooks/                     # TanStack Query hooks (queries + mutations, keys, invalidation)
    use-<resource>.ts
  pages/                     # route-level screens (compose shared kit + module components)
    <resource>-page.tsx
  components/                # module-specific composed components (thin; prefer shared kit)
  <module>.i18n.ts           # (optional) namespace helper; strings live in locales/*.json
  __tests__/                 # component + integration tests (MSW-backed)
```

**Boundary rules (dependency-cruiser-friendly):**
- `features/*` may import from `components/*`, `hooks/*`, `lib/*`, `app/providers/*`, and its **own**
  subtree. A feature module **must not** import another feature module's internals — cross-module
  reuse goes through the **shared kit** (`components/`, `hooks/`, `lib/`) or a small `features/shared/`.
- `components/*` (shared kit) is **domain-agnostic**: no imports from `features/*`.
- Server access is **only** through `lib/api-client` + a module's `*.contract.ts` (never raw `fetch`).

---

## 2. RBAC model (UI mirrors the backend; never *replaces* it)

The backend enforces authorization at two guards — `AuthGuard` (identity) then `RolesGuard`
(`@Roles(...)`). **The UI RBAC is for navigation and affordance only; it is never the security
boundary.** Every admin call still 401/403s server-side.

- **Identity source:** `GET /api/v1/me` → `{ personId, fullName, email, grade, employmentStatus,
  homePoolNodeId, roles: [{ role, scopeNodeId, scopeName }] }` (already wired via `useAuth().me`).
- **18 roles** (closed set, mirrors DB `fleet_role`): `Employee, Approver, Delegate, FleetManager,
  ClusterFleetLead, GroupFleetLead, ClusterCEO, Procurement, Finance, HR, InsuranceLead, HSE,
  InternalAudit, Executive, DataSteward, SystemAdmin, SubstituteDriver, ProfessionalDriver`.
- **Admin route → required roles:**

| Route | Required role(s) | Backend guard |
|---|---|---|
| `admin` (home) | any admin-family role | authed |
| `admin/reference-data` (lookups) | `DataSteward` \| `SystemAdmin` | `@Roles(DataSteward, SystemAdmin)` |
| `admin/access` | `SystemAdmin` | `@Roles(SystemAdmin)` |
| `admin/organization` | `SystemAdmin` | (writes: enhancement) |
| `admin/policy` | `SystemAdmin` | (PAP: enhancement) |
| `admin/integrations` | `SystemAdmin` | (enhancement) |
| `admin/notifications` | `SystemAdmin` | (enhancement) |
| `data-quality` | `DataSteward` \| `SystemAdmin` | authed (imports) |
| `audit`, `audit/exceptions`, `audit/decisions` | `InternalAudit` \| `SystemAdmin` | authed (read) |

- **UI enforcement:** a `RequireRole` guard (file 01) gates each route; the **role-driven sidebar**
  only renders items the user can reach; RBAC-gated actions inside a page are hidden/disabled when the
  user lacks the role **and** the server response is handled (403 → friendly "insufficient role").
- **SoD is server-authoritative.** Role assignment can be rejected with `403 { reasons: ['SoD-04'] }`.
  The UI surfaces the reason codes as human-readable guidance (file 03) — it does **not** pre-judge SoD.

---

## 3. Data layer (contract-first, TanStack Query)

- **Contracts.** The backend owns Zod contracts in `app-api/src/contracts/**`, but some import the
  Drizzle `roleEnum`, so the UI **mirrors** the exact shapes in each module's `*.contract.ts`
  (typed, Zod-validated on parse). A CI drift check (file 10) keeps them honest.
- **Client.** All calls go through `lib/api-client` (already sends dev-login `x-dev-person-id` or
  Entra `Bearer`, normalises RFC-7807 errors to `ApiRequestError { status, title, reasons[] }`, and
  drops the session on 401). Base path `env.apiBaseUrl` = `/api` → dev-proxied to the backend.
- **Server state = TanStack Query.** Query keys are **module-namespaced arrays**
  (`['admin','lookups', typeCode]`). Mutations invalidate precisely and use **optimistic updates**
  where safe (toggle active, sort order), with rollback on error and a toast on failure.
- **Client state = local/context.** Scope selection lives in a `ScopeProvider` (persisted). No Redux.
- **Forms = React Hook Form + Zod** (`@hookform/resolvers`), schemas re-exported from the contract so
  client validation == server validation. Server field errors (`reasons[]`) map back onto the form.

### 3.1 Standard query-key namespaces

```
['me']                                  ['admin','lookups','types']
['hierarchy']                           ['admin','lookups', typeCode, { tree }]
['admin','users']                       ['admin','lookups', typeCode, parentCode]
['admin','access-review']               ['admin','policy','rules']
['governance','audit', filters]         ['governance','imports', batchId]
```

---

## 4. Route map (adopted from the roadmap target)

Routes are **locale-prefixed** (`/{lang}/…`) and **role-guarded**. We adopt the roadmap's target
names (`docs/04-planning/ui-page-roadmap`) — this reconciles the current flat rail toward the
role-driven target.

```
/{lang}/admin                         Admin home (overview + integration status)
/{lang}/admin/reference-data          Reference Data (Lookup) Management     [DataSteward|SystemAdmin]
/{lang}/admin/access                  User & Access Management               [SystemAdmin]
/{lang}/admin/organization            Org & Hierarchy Configuration          [SystemAdmin]
/{lang}/admin/policy                  Policy Engine Studio (PAP)             [SystemAdmin]
/{lang}/admin/integrations            Integrations status & config           [SystemAdmin]
/{lang}/admin/notifications           Notification configuration             [SystemAdmin]
/{lang}/data-quality                  Data Quality & Migration Console       [DataSteward|SystemAdmin]
/{lang}/audit                         Audit Log                              [InternalAudit|SystemAdmin]
/{lang}/audit/exceptions              SoD Exception report                   [InternalAudit|SystemAdmin]
/{lang}/audit/decisions               PDP Decision log                       [InternalAudit|SystemAdmin]
```

> **Compatibility:** the current build ships `/{lang}/policy` (coming-soon). `admin/policy` supersedes
> it; keep a redirect `policy → admin/policy` for one release (file 05).

---

## 5. Non-negotiable principles (every admin screen)

These extend the component-library principles (`../component-library-plan/00 §1`) with admin specifics.

1. **Tokens only / one font / 3px radius / warm border / both themes / RTL parity** — inherit verbatim.
2. **Contract-first.** No screen ships against a shape the backend doesn't return. Mirror the contract,
   validate on parse, and **delete the corresponding MSW handler as the screen is verified live**.
3. **RBAC is affordance, not security.** Hide/disable by role *and* handle 401/403 gracefully.
4. **Every mutation is governed.** Admin writes are audited server-side; the UI shows **who/when**
   (audit metadata) and always **confirms destructive/irreversible actions** (`useConfirm`).
5. **Bilingual data is first-class.** Reference data carries EN + AR; edit both, display by locale,
   never lose the non-active language. Business logic keys on **stable `code`**, never the label.
6. **Explain every block.** A denied action (SoD, hard-block, stale data) names the **cause and the
   next step** — mirrors PRD non-negotiable "blocks explain themselves".
7. **Every list has all four states:** loading (skeleton) · empty (guided empty-state) · error
   (retry + reason) · populated. No spinners-only.
8. **Optimistic where safe, pessimistic where risky.** Toggles/reorder optimistic; create/assign/
   sign-off pessimistic with a pending state.
9. **Accessibility WCAG 2.1 AA.** Semantic tables/forms/dialogs, full keyboard, `:focus-visible`,
   labelled controls, live-region toasts, focus trap + restore in dialogs.
10. **i18n everywhere.** No hardcoded copy; all strings via `react-i18next`; numbers/dates locale-aware.

---

## 6. Definition of Done (applies to every phase)

- [ ] Screen(s) built from the **shared kit** (file 09); module-specific code is thin.
- [ ] **Contract-first**: Zod-mirrored types, parsed on fetch; server errors mapped to UI.
- [ ] **RBAC**: route guarded (`RequireRole`), nav gated, actions gated, 401/403 handled.
- [ ] All **four list states** + destructive **confirm** + success/failure **toasts**.
- [ ] **Bilingual + RTL** verified on `/ar`; logical properties only.
- [ ] **a11y**: keyboard path, roles/labels, focus management, contrast — checked.
- [ ] **MSW** contract handlers added for tests; **live-verify** then remove per screen.
- [ ] **Tests**: hook(s) + page interaction + one integration (MSW) per screen.
- [ ] **Gate green** via `./node_modules/.bin/`: `tsc -b --noEmit`, `oxlint`, `vitest run`, `vite build`.
- [ ] Backend gaps (if any) filed in the **Backend/DB Change Register** (file 10) with rationale.
- [ ] `design-system.md` / this plan updated **before** a genuinely new pattern ships.

---

## 7. Backend flexibility note (we may change backend + DB)

The user has authorised backend/DB changes where they raise the product to global standard. Each phase
that needs a change **specifies it precisely** (endpoint, method, contract, migration sketch) and logs
it in file 10's register with: *why*, *shape*, *effort*, *whether the UI can ship a read-only or
mock-first slice meanwhile*. Guiding rules for proposals:
- Prefer **additive, contract-stable** changes (new endpoints/fields) over breaking ones.
- Keep the **PAP/PDP/PEP** separation and the **append-only audit** invariants intact.
- Respect the **dormant `organization_id`** multi-tenant seam and **effective-dated** soft-state model.
- Any new list endpoint ships with **pagination + filter + sort** params from day one (avoid re-work).
