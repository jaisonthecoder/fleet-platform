# Phase 10 — Testing, A11y, Security, i18n & Rollout (+ Backend/DB Change Register)

> The quality bar, delivery sequence, and the **single consolidated list** of backend/DB changes the admin
> UI needs — so the backend lane can pick them up without reading every phase file.

---

## 1. Testing strategy (the pyramid)

| Level | Tooling | What we test |
|---|---|---|
| **Unit** | Vitest | contracts (Zod parse), `roles`/`landing`/`sod` maps, `flattenHierarchy`, `toCsv`, decision-table helpers |
| **Component** | Vitest + Testing Library | shared kit (ResourceTable, ResourceFormDialog, pickers, TreeTable, DecisionTableEditor…) states + keyboard |
| **Hook** | RTL `renderHook` + MSW | query/mutation hooks: parse, invalidation, optimistic + rollback |
| **Integration (screen)** | RTL + MSW | each page: load → interact → mutate → toast; 403/SoD; empty/error/loading |
| **Contract** | MSW handlers mirror backend contracts; a **drift check** (below) | UI mirror == backend contract |
| **A11y** | `@testing-library` + roles/labels; optional `axe` | dialogs, tables, forms, focus, live regions |
| **E2E (later)** | Playwright | admin happy paths against a seeded backend (dev-login) |

**Golden rules**
- MSW is **tests-only** (`onUnhandledRequest:'error'`) — **every** endpoint a screen touches needs a
  handler. Add handlers per phase in `mocks/handlers/{platform,admin,governance}.ts`.
- **Contract-first + kill-MSW:** once a screen is verified against the live backend (dev-login), **remove
  its MSW handler** (guardrail). Keep only handlers for endpoints that don't exist yet (capability-gated).
- Coverage floor stays at the repo threshold (lines 70 / branches 60 in `vite.config.ts`); admin modules
  should meet or exceed it.

### 1.1 Contract-drift guard (UI ↔ backend)
Add a lightweight check (script or test) that asserts the UI's mirrored shapes match
`app-api/src/contracts/*` (names + field sets). The backend already snapshots `contracts.manifest.json`;
the UI check imports/compares field lists so a backend contract change fails CI on the UI side too.

---

## 2. Accessibility (WCAG 2.1 AA — non-negotiable)

- Semantic `<table>` for data; `<form>` + `<label>`-associated controls; dialogs are focus-trapped and
  restore focus; drawers are labelled; toasts announce via live region.
- Full keyboard path for every action (row actions, pickers, matrix toggles, tree expand/collapse).
- `:focus-visible` ring intact (global); status never colour-alone (icon+label everywhere).
- RTL parity verified on `/ar` for every screen (logical properties only; mirrored tables/drawers).
- Colour contrast from tokens in **both** themes; charts carry the sr-only data-table fallback (existing).

---

## 3. Security (UI is affordance; backend is the boundary)

- **RBAC never UI-only.** Every admin call still 401/403s server-side; `RequireRole` + nav gating are UX.
- **SoD is server-authoritative** — surfaced with reasons, never pre-judged or hidden.
- **No secrets in the client** — integrations show status/last-sync only; env holds only public `VITE_*`.
- **Open-redirect safe** (login already guards `redirect`); dev-login (`x-dev-person-id`) is structurally
  off in uat/prod (backend `devLoginEnabled`), and the UI's `isDevLoginEnabled` mirrors it.
- **Auditability:** admin writes are audited server-side; the UI shows who/when and confirms destructive
  actions. **Append-only** audit + **immutable** policy versions are respected (no edit/delete affordances).
- **Input validation** at the boundary (Zod on submit + on parse); server `reasons[]` mapped back to fields.

---

## 4. i18n & RTL

- All copy via `react-i18next`; **no hardcoded strings** in shared components (consumers pass `t()` output).
- EN + AR authored **together** per phase; role names, SoD reasons, rule-type names, statuses all localised.
- Numbers/dates locale-aware (`lib/format`); AR inputs `dir="rtl"`; bilingual data edited in both languages.
- Verify each screen on `/ar` before its exit checklist is ticked.

---

## 5. Rollout sequence (ship order)

Ship **backend-ready** slices first (immediate value, zero backend dependency), enhancement-dependent
slices behind capability flags.

1. **Phase 01 — Foundations** (role-nav, RequireRole, landing, scope switcher, kit v1). *Unblocks all.*
2. **Phase 02 — Reference Data** ✅ (flagship; unblocks feature dropdowns).
3. **Phase 03 — User & Access** ✅ (unblocks test users/roles → exercises role-nav across the app).
4. **Phase 07 — Data Quality & Migration** ✅ (Data Steward; backed today).
5. **Phase 06 — Audit + Exceptions** ✅ read (Decision-log route gated until endpoint).
6. **Phase 05 — Policy Studio** — test-panel + read ship on the live PDP; authoring/activation when PAP endpoints land.
7. **Phase 04 — Org config** — read-only explorer + terminology ship; editing when hierarchy-write lands.
8. **Phase 08 — Integrations/Notifications/Home** — home ships; the rest when config endpoints land.

Per screen: mirror contract → build from kit → MSW test → **live-verify (dev-login) → delete MSW handler**
→ tick exit checklist. Keep `docs/04-planning/ui-page-roadmap` statuses updated as screens flip ⬜→✅.

---

## 6. Backend / DB Change Register (consolidated)

Additive, contract-stable proposals. Each: *why*, *shape*, *effort*, *UI interim*. The UI can ship every
phase's backed portion **without** these; they unlock the enhancement-gated portions.

| # | Change | Phase | Effort | UI interim until it lands |
|---|---|---|---|---|
| R1 | `?includeInactive=true` on `GET /lookups/:type` + reachable re-activate (`PATCH isActive`) | 02 | Low | Deactivate hides row; no inactive view |
| R2 | Audit metadata (created/updated by/at) on lookup + governed reads | 02,03,04 | Low | Hide `AuditMetaFooter` |
| R3 | Lookup **type** CRUD (`POST/PATCH /admin/lookups/types`) | 02 | Med | Value CRUD only (types seeded) |
| R4 | Reference-data bulk import/export (CSV/JSON) | 02 | Med | Manual entry |
| R5 | **Assignment id** in `GET /admin/access-review` (or `GET /admin/roles?…`) for revoke | 03 | Small | Revoke only on in-session grants |
| R6 | `GET /admin/persons?q=` (prod person directory) | 03 | Sm–Med | `PersonPicker` uses `/dev/users` (dev) |
| R7 | `GET /delegations` (+ revoke) | 03 | Small | Create-only delegations panel (flagged) |
| R8 | Pagination + filter params on `/admin/users`, `/admin/access-review`, `/audit` | 03,06 | Med | Client-side page filtering |
| R9 | Hierarchy **write** API (`POST/PATCH /admin/hierarchy/nodes`, ltree- + history-safe) | 04 | Med–High | Read-only explorer + terminology edits |
| R10 | Node metadata on hierarchy read (childCount, vehicleCount, audit) | 04 | Low–Med | Basic detail drawer |
| R11 | Org branding/settings store (`GET/PUT /admin/org-settings`) | 04,08 | Med | Branding tab deferred |
| R12 | **PAP** read (`GET /admin/policy/rules[/:type]`) | 05 | Low | Seed 12 rule types locally |
| R13 | **PAP** save draft (`POST …/versions`) | 05 | Low–Med | Read + dry-run only |
| R14 | **PAP** activate (`POST …/activate`, wraps existing `PolicyAdminService.activate`, 2nd-approver) | 05 | Low | Read + dry-run only |
| R15 | `POST /admin/policy/rules/:type/validate` (server table validation) | 05 | Low | Client Zod validation only |
| R16 | `GET /audit/verify` (expose `verifyChain`) | 06 | Low | Show count + append-only note |
| R17 | `GET /decisions/log` (read `decision_log`) | 06 | Low–Med | Decision-log route gated |
| R18 | Server CSV export (audit/exceptions/access-review) | 03,06 | Med | Client CSV |
| R19 | Import **batch list** endpoint (`GET /imports?status=&page=`) | 07 | Small | Track batches by id locally |
| R20 | Server-side file upload (multipart CSV/XLSX; raise 5000 cap) | 07 | Med | Client CSV parse ≤5000 |
| R21 | `GET /admin/integrations` (+ `POST …/hcm/sync` exposing existing `HcmSyncService`) | 08 | Sm–Med | Home health only; integrations flagged |
| R22 | Notification config store (`GET/PUT /admin/notifications/config`, unmutable compliance enforced) | 08 | Med | Screen flagged |
| R23 | System settings / feature flags (`GET/PUT /admin/settings`) | 08 | Med | `useCapabilities` from env |
| R24 | `GET /admin/overview` aggregate (health + integration summary + activity) | 08 | Low–Med | Multiple calls / partial home |

**Principles for the backend lane:** additive over breaking; keep PAP/PDP/PEP + append-only audit +
effective-dated soft-state invariants; respect the dormant `organization_id` seam; every new list endpoint
ships with pagination/filter/sort from day one.

---

## 7. Master exit checklist (admin & governance surface complete)

- [ ] Foundations shipped: role-driven nav, `RequireRole`, role landing, scope switcher, kit v1.
- [ ] Backed-today screens live-verified + MSW removed: Reference Data, User & Access, Data Quality, Audit+Exceptions.
- [ ] Enhancement-gated screens present + flagged: Policy authoring, Org editing, Decision log, Integrations, Notifications.
- [ ] Shared kit complete (file 09 matrix) + in the design showcase (both themes + RTL) + tested.
- [ ] Every screen: 4 states, confirms, toasts, RBAC, SoD guidance, i18n EN/AR, a11y, RTL.
- [ ] Contract-drift guard green; coverage ≥ repo floor.
- [ ] Backend register (this file §6) filed for the backend lane; roadmap statuses updated.
- [ ] Full gate green: `tsc -b --noEmit`, `oxlint`, `vitest run`, `vite build`.
