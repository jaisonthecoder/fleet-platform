# U0 — Foundation & API Integration Layer

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** turn the existing auth + API-client scaffolding into a complete, role- and scope-aware integration layer that every feature phase builds on. Most of this phase is **finalisation**, not greenfield — auth, `apiClient`, env and the shell already exist.

**Entry:** backend Phase-1 running locally (`api` on its port; DB `0012`, Redis up).
**Exit:** an authenticated user lands on a role-correct shell, the sidebar + scope switcher are driven by `/me` + `/hierarchy`, all data flows through TanStack Query + `apiClient`, and the contract-sync + MSW-retirement conventions are in place.

---

## 1. Backend dependencies
- `GET /api/v1/me` — identity + `roles[] {role, scopeNodeId, scopeName}` (dev-login: `x-dev-person-id`; SSO: Bearer).
- `GET /api/v1/hierarchy` — the nested node tree (Scope Switcher + roll-up source).
- `GET /api/v1/dev/users` — dev-login user picker (lower envs only; may be empty → "Skip login").
- Contracts: `app-api/src/contracts/platform.contract.ts` (`MeResponse`, `HierarchyNodeDto`), `policy-evaluation.contract.ts` (shared enums).

## 2. Work items

### 2.1 Session & identity (`features/auth` + a `session` store)
- ✅ MSAL + dev-login credential handling (`auth-headers.ts`) — keep.
- ⬜ On authenticated boot, fetch `GET /me` once → a **session store** (`useSession()` — React context or TanStack Query singleton) exposing `{ personId, fullName, email, roles, scopes }`.
- ⬜ Derive `activeScope` (default = the user's home/first scope) persisted to `sessionStorage`; expose `setActiveScope()`.
- ⬜ 401 handler already drops the session → redirect to `/{lang}/login` with a toast.

### 2.2 Role-driven navigation (replace the fixed rail)
- ⬜ One **role→nav table** (`app/shell/nav.ts`): each item declares `{ segment, icon, labelKey, roles[], end? }`. The sidebar renders only items the user's `/me` roles permit.
- ⬜ Landing redirect: `/{lang}` → the role's default screen (Employee→`book`; FleetManager→`operations`; ClusterCEO→`entitlements`; Executive→`dashboards`; SystemAdmin→`admin`; DataSteward→`data-quality`). Reuse `features/auth/landing.ts`.
- ⬜ `require-role` guards on every domain route (already exists — wire per route).

### 2.3 Scope switcher
- ⬜ `ScopeSwitcher` in the header: renders the `/hierarchy` tree; selecting a node sets `activeScope`; scoped screens read `activeScope.id` and pass `?scopeId=` to their queries. Group/cluster/pool roll-up is server-side.

### 2.4 Data layer conventions
- ⬜ Adopt **TanStack Query** app-wide (provider already in `AppProviders`). Standard: `queryKey = [resource, scopeId, …params]`; mutations call `apiClient.post/patch/delete` then `queryClient.invalidateQueries`.
- ⬜ A shared `useApiError()` maps `ApiRequestError` → `notify.danger(title, reasons)` (reasons localised).
- ⬜ A tiny `usePaged()` helper for `?limit/&offset` list endpoints.

### 2.5 Contract sync
- ⬜ Establish the rule: each feature keeps a `*.contract.ts` mirroring the backend Zod contract (types + enums + reason codes). Add a **drift check** script (finalised in U8) comparing the UI contract manifest to `app-api/src/contracts/contracts.manifest.json`.

### 2.6 MSW strategy
- ⬜ MSW is **dev/test only**. Add `VITE_USE_MOCKS` flag (default off when `VITE_API_URL` is set). Each later phase deletes its handlers from `mocks/handlers/` as it goes live; MSW handlers remain for component/unit tests.

## 3. States
- **Loading** boot: full-page skeleton until `/me` resolves.
- **No credential**: login page (built).
- **Dev-login, no seeded users**: "Skip login (development only)" continues with an unauthenticated dev principal (matches the attached screen) — dev only.
- **401 mid-session**: drop session → login + toast.

## 4. Tests
- `useSession` resolves `/me` (MSW) → roles/scopes populated.
- Role→nav renders only permitted items (table-driven test per role).
- Scope switcher sets `?scopeId` on a scoped query (MSW asserts the param).
- 401 from `apiClient` triggers the unauthorized handler.

## 5. Exit gate
- Authenticated boot → `/me` → role-correct sidebar + landing redirect + working scope switcher.
- All reads/writes go through `apiClient` + TanStack Query (no raw `fetch` in components).
- Contract-sync rule documented; MSW toggle in place.
- `tsc`/`oxlint`/`vitest`/`vite build` green; verified in-browser against the running backend.

## 6. Traceability
- FRs: FR-IAM-01/02 (SSO + hierarchy-scoped RBAC), FR-ARC-02 (hierarchy), P2 (identity/access).
- Roadmap: `ui-page-roadmap` §"role→landing", App Shell.
- Backend: `platform` (identity/hierarchy), `auth` guard.
