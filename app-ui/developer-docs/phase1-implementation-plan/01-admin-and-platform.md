# U1 — Admin & Platform

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the System Admin / Data Steward area — the first feature slice, because its backend (lookups, users/roles, hierarchy, audit) is **done and stable** and it establishes the reusable CRUD/table/form/RBAC patterns. It also seeds the bilingual **lookups** that later feature dropdowns (vehicle body-type, fuel-type, use-category) depend on.

**Entry:** U0 done (session, role-nav, scope, api layer).
**Exit:** admins manage lookups, users & roles, view the org tree, and review audit/exceptions — all against the real backend, RBAC-gated.

---

## 0. Current UI state — verified 2026-07-18 (deep inspection)

> A prior UI session scaffolded the **admin navigation + routing + RBAC gating + scope primitives**, but the **lookup-management and user/access screens themselves are NOT built** — they render coming-soon placeholders. Build U1 into these existing routes; do not re-create the shell.

**Already exists (reuse — do not rebuild):**
- **Role-driven sidebar** — `app/shell/nav.ts` + `navFor(me)`: groups `operations | governance | administration`, each item role-gated; `RequireRole` guards; role-based landing redirect (`router.tsx` `IndexRedirect` → `features/auth/landing.resolveLanding`). Declared admin/governance items:
  - `admin` (home, `SystemAdmin`), **`admin/reference-data`** (lookups, `DataSteward`+`SystemAdmin`), **`admin/access`** (user & access, `SystemAdmin`), `admin/organization` (`SystemAdmin`), `admin/policy`, `admin/integrations`, `admin/notifications`; governance: `data-quality` (`DataSteward`+`SystemAdmin`), `audit` (`InternalAudit`+`SystemAdmin`).
- **Platform primitives** — `features/platform/`: `hooks/use-hierarchy.ts` (`GET /hierarchy`), `components/scope-picker.tsx` (Combobox over the tree — its comment already says *“reused by role assignment”*), `components/scope-switcher.tsx`, `platform.contract.ts` (`Me`, hierarchy DTO, `flattenHierarchy`).
- **Auth/session** — MSAL + dev-login, `require-auth`/`require-role`, `roles.ts` (`PlatformRole`, `hasAnyRole`).

**NOT yet implemented (this is the actual U1 work):**
- `admin/organization`, `audit`, `data-quality` still render **`ComingSoonPage`** (role-guarded) per `app/routing/router.tsx`.

**BUILT 2026-07-18 — Reference data (lookups):** `admin/reference-data` is now a real screen (replaces its ComingSoon):
- `features/config/config.contract.ts` (mirrors backend `lookup.contract.ts`), `features/config/hooks/use-lookups.ts` (TanStack Query), `features/config/reference-data-page.tsx` (type filter → values `DataTable` → add-value dialog + confirm-deactivate), `mocks/handlers/config.ts`, route wired with `RequireRole ADMIN_ROLES`, `reference-data-page.test.tsx` (3 tests). Full app-ui gate green (tsc · oxlint · vitest · vite build).
- **Phase-exit critique — round 1 done 2026-07-19 (fixed):** ✅ **edit value** (`PATCH`) + edit dialog; ✅ add-value **mutation test**; ✅ form errors announced (`role="alert"`). Deferred: **parent-cascade** picker for hierarchical types (low priority — only make→model); values **skeletons**; **EN/AR localisation** (U8 sweep).

**BUILT 2026-07-19 — Users & access:** `admin/access` is now a real screen:
- `features/identity/user-admin.contract.ts` (mirrors backend `user-admin.contract.ts` — `UserAccount`, `AssignRole` [role from shared `PLATFORM_ROLES`], `AccessReviewRow`), `features/identity/hooks/use-user-admin.ts`, `features/identity/access-management-page.tsx` (users `DataTable` + suspend/reactivate; assign-role dialog reusing `ScopePicker` + role `Combobox`; access-review table + **CSV export**), `mocks/handlers/identity.ts`, route wired `RequireRole ['SystemAdmin']`, `access-management-page.test.tsx` (3 tests). Gate green (vitest 46).
- **Backend gap found:** role **revoke** needs an `assignmentId`, but no read endpoint exposes it (`AccessReviewRow` / `UserAccount` lack it) → revoke UI deferred; **action: backend should add the assignment id to the access-review rows** (or a per-user assignments read). Logged here + in memory.
- **Phase-exit critique — round 1 done 2026-07-19 (fixed):** ✅ **confirm-on-suspend**; ✅ status → **`status-chip`** (colour-never-alone); ✅ **suspend-confirm test**; ✅ mirrored `roleSource` enum registered in the **contract-drift guard**. Deferred: **revoke** (backend must expose assignment ids first); **EN/AR localisation** (U8 sweep); show each user's current roles inline (needs a per-user roles read).

**Route reconciliation:** the built app uses **`admin/reference-data`** for lookups (not `admin/lookups` as first drafted); `audit` lives at `/{lang}/audit` (governance group). The §2 table below is aligned to the **built segments** — use those.

---

## 1. Backend dependencies
- **Lookups:** `GET /lookups`, `GET /lookups/:typeCode`, `GET /lookups/:typeCode/:parentCode`; `POST /admin/lookups/:typeCode/values`, `PATCH /admin/lookups/values/:id`, `POST /admin/lookups/values/:id/deactivate` (roles: DataSteward, SystemAdmin).
- **Users & access:** `GET /admin/users`, `POST /admin/roles`, `DELETE /admin/roles/:assignmentId`, `POST /admin/users/:userId/{suspend,reactivate}`, `GET /admin/access-review` (role: SystemAdmin).
- **Org tree:** `GET /hierarchy`. **Delegations:** `POST /delegations`. **Audit:** `GET /audit`, `GET /reports/exceptions`.
- Contracts: `lookup.contract.ts`, `user-admin.contract.ts`, `platform.contract.ts`.

## 2. Screens & routes (all under `/{lang}/admin`, role-gated)
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| Admin home | `/{lang}/admin` | I2 | `GET /me`, integration status (static P1) |
| Lookup management | `/{lang}/admin/reference-data` | — | lookups read + admin write |
| User & access management | `/{lang}/admin/access` | FR-IAM-05 | `admin/users`, `admin/roles`, `admin/access-review` |
| Org & hierarchy | `/{lang}/admin/organization` | I2 | `GET /hierarchy` (tree view; edit deferred) |
| Audit & exceptions | `/{lang}/audit` | — | `GET /audit`, `GET /reports/exceptions` |
| Delegations | `/{lang}/profile#delegation` | FR-DEL | `POST /delegations` |

## 3. Components
- **Lookup management**: `DataTable` of types → drill to values; `Dialog` + RHF/Zod form to add a value (code, EN label, AR label, parent); deactivate via `useConfirm`. Bilingual inputs; **branch on `code`, display labels**.
- **User & access**: `DataTable` of users (name, HCM id, status, roles); role-assign `Dialog` (person + role + scope node from `/hierarchy`); revoke via `useConfirm`; suspend/reactivate actions; "Export access review" button (downloads `admin/access-review`). SoD violations surface the backend 4xx reason as a banner.
- **Org & hierarchy**: read-only tree (reuse the hierarchy tree component); terminology labels shown; structural edit is a later phase.
- **Audit**: paginated `DataTable` (actor, action, entity, time); exceptions tab (SoD overrides).
- **Delegations**: form (delegate person, request type, from/to dates); active-delegations list.

## 4. Data & state
- Query keys: `['lookups']`, `['lookups', typeCode]`, `['admin','users']`, `['hierarchy']`, `['audit', {limit,offset}]`, `['reports','exceptions']`.
- Mutations invalidate their list (`lookups` value add → invalidate `['lookups', typeCode]`; role assign/revoke → invalidate `['admin','users']` + `['admin','access-review']`).

## 5. States
- Loading skeletons on tables; empty-state for no lookups/users; **403** (non-admin) → access-denied; role-assign SoD rejection → banner with reason (`sod-04`/`sod-05`).

## 6. RBAC & scope
- `admin/*` gated to `SystemAdmin` (+ `DataSteward` for lookups). Not scope-filtered (org-wide config) except access-review which can filter by node.

## 7. i18n / RTL
- Lookup values are **bilingual** — the editor captures EN + AR; display uses the active locale. All chrome via i18n; RTL-safe tables.

## 8. MSW → real API
- Add handlers for lookups/users to build, then **delete** them once live; keep for component tests. Retire any placeholder admin mock.

## 9. Tests
- Lookup add/deactivate happy path (MSW) + code-not-label assertion.
- Role assign rejected by SoD → reason surfaced.
- Access-review export triggers the request.
- Non-admin → access-denied.

## 10. Exit gate
- Lookup CRUD, user role assign/revoke/suspend, access-review export, org tree, audit + exceptions, delegations — all on the real backend, RBAC-correct, bilingual, four-states complete. Gate green.

## 11. Traceability
- FRs: FR-IAM-02/04/05, FR-DEL, FR-AUD, FR-REU-02 (config-not-code lookups). Backend: `config`, `identity` (user-admin), `platform` (audit/hierarchy/delegation).
