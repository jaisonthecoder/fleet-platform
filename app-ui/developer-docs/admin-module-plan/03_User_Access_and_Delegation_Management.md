# Phase 03 — User, Access & Delegation Management

> **Backend readiness: ✅ ready** for users/roles/access-review/delegations. One gap (revoke needs an
> assignment id in the list) is specified in §9 with a clean interim.
>
> **Owner:** `SystemAdmin`. **Route:** `/{lang}/admin/access`. Related read: `GET /admin/access-review`
> (recertification), reused by Internal Audit (file 06).

---

## 1. Business context

Access management is the platform's identity-governance surface: **who holds what role, on which scope**,
who granted it, and the ability to grant/revoke and suspend/reactivate accounts — all **SoD-checked** and
**audited**. Roles attach to a **person per scope** (a Fleet Manager can also be a driver, but can never
approve their own booking). This screen is where recertification ("who has what, where", FR-IAM-05) happens.

**Guardrails:**
- **SoD is server-authoritative.** A grant that violates SoD returns `403 { reasons:['SoD-04'|'SoD-05'|…] }`.
  The UI never pre-approves SoD; it surfaces the reason and blocks the submit with guidance.
- Roles are **scoped** (`scopeNodeId`), so assignment always needs person + role + scope.
- Revoke is **effective-date expiry** (soft), not a hard delete. Suspend/reactivate toggles account status.
- The acting admin is recorded (`assignedByPersonId`) — the UI sends the current principal implicitly
  (backend derives from the token); no manual entry.

---

## 2. Backend surface (exact)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/users` | SystemAdmin | List user accounts |
| GET | `/api/v1/admin/access-review` | SystemAdmin | "Who has what, where" export |
| POST | `/api/v1/admin/roles` | SystemAdmin | Assign role at scope (SoD-checked) → `{ id }` |
| DELETE | `/api/v1/admin/roles/:assignmentId` | SystemAdmin | Revoke (expire) an assignment |
| POST | `/api/v1/admin/users/:userId/suspend` | SystemAdmin | Suspend account |
| POST | `/api/v1/admin/users/:userId/reactivate` | SystemAdmin | Reactivate account |
| GET | `/api/v1/dev/users` | public (dev) | Seeded persons for pickers (dev only) |
| GET | `/api/v1/hierarchy` | authed | Scope options (from Phase 01) |

**Contracts (mirror in `features/admin/access/access.contract.ts`):**
```ts
export interface UserAccount {
  id: string; entraObjectId: string; personId: string | null
  email: string | null; displayName: string | null; status: string   // Active | Suspended
}
export interface AccessReviewRow {
  personId: string; role: string; scopeNodeId: string
  source: string; assignedByPersonId: string | null                    // source: manual|hcm|entra-group
}
export const assignRoleSchema = z.object({
  personId: z.string().uuid(),
  role: z.enum(PLATFORM_ROLES),
  scopeNodeId: z.string().uuid(),
  source: z.enum(['manual','hcm','entra-group']).optional(),
})
```
**Fns:** `fetchUsers()`, `fetchAccessReview()`, `assignRole(body)→{id}`, `revokeRole(assignmentId)`,
`setUserStatus(userId, 'suspend'|'reactivate')`.

---

## 3. Data hooks (`hooks/use-access.ts`)

```ts
useUsers()                 // ['admin','users']
useAccessReview()          // ['admin','access-review']
useAssignRole()            // POST /admin/roles; invalidate access-review; toast; 403 SoD → form alert
useRevokeRole()            // DELETE; confirm; invalidate; toast
useSetUserStatus()         // suspend/reactivate; confirm; optimistic status; invalidate users
```

---

## 4. Screen design (`pages/access-page.tsx`) — tabbed

`AdminPageLayout` + `Tabs`: **Access review** (default) · **Users** · (Delegations optional §7).

### Tab A — Access review ("who has what, where")
- `ResourceTable<AccessReviewRow>`: Person | Role | Scope | Source | Granted by | ⋯
  - Person: resolve `personId` → name via a **person map** (from `/dev/users` in dev, or the future
    `/admin/persons` endpoint §9); fall back to short id with copy.
  - Role: localised `roles.<Role>` chip. Scope: resolve `scopeNodeId` → `levelLabel · name` from hierarchy.
  - Source: chip (manual / HCM / Entra-group).
- **FilterBar:** search (person/role/scope), filter by role, filter by scope (ScopePicker), filter by source.
- **Primary action:** `+ Assign role` → dialog (below).
- **Export:** `ExportButton` → CSV of the current (filtered) view (recertification evidence). Client-side
  CSV now; server export when available (§9).
- **Row action Revoke:** enabled when an `assignmentId` is known (see §9 interim); confirm → revoke.

### Tab B — Users
- `ResourceTable<UserAccount>`: User | Email | Linked person | Status | ⋯
  - Status chip (Active/Suspended). Row actions: **Suspend** / **Reactivate** (confirm), **View access**
    (filters Tab A to that person).
  - Empty-state note: in **dev-login**, accounts are created via Entra JIT provisioning, so this list may
    be empty locally — show a helpful empty-state explaining that (accurate to the backend).

### Assign Role dialog (`ResourceFormDialog`)
- Fields: **Person** (`PersonPicker` — searchable; dev: from `/dev/users`; prod: `/admin/persons` §9),
  **Role** (`RolePicker` — `Select` of the 18 roles, localised, grouped by family), **Scope**
  (`ScopePicker` from hierarchy), **Source** (default `manual`, usually hidden).
- Zod = `assignRoleSchema`. Submit → `useAssignRole`.
- **SoD handling:** on `403 { reasons }`, render a **danger `Alert`** inside the dialog: "This grant is
  blocked by segregation-of-duties" + the mapped reason (`sod.SoD-04` → "Finance and Fleet Manager cannot
  be held together on the same scope") + keep the form open so the admin can adjust. No optimistic close.
- On success: toast, close, invalidate access-review, and **retain the returned `{id}`** so an immediate
  Revoke is possible on the just-added row.

---

## 5. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `AdminPageLayout`, `ResourceTable`, `ResourceFormDialog`, `FilterBar`, `Tabs` | shared kit | reused |
| `PersonPicker` | **new shared** | searchable person combobox; data-source-agnostic (dev-users now, `/admin/persons` later); reused by delegations, entitlements, substitution |
| `RolePicker` | **new shared** | localised role select (18 roles, grouped); reused wherever a role is chosen |
| `ScopePicker` | from Phase 01 | hierarchy scope combobox |
| `ExportButton` + `toCsv()` | **new shared** (`lib/csv.ts`) | recertification/report exports across audit/finance/data-quality |
| `RoleChip`, `SourceChip`, `StatusChip` | shared/existing | localised, colour+label |
| `sod` reason map | **new** (`features/admin/access/sod-reasons.ts`) | maps `SoD-01..08` codes → i18n keys |

`PersonPicker`, `RolePicker`, `ExportButton` are broadly reused — they belong in the shared kit (file 09).

---

## 6. RBAC & governance

- Route wrapped `RequireRole roles={['SystemAdmin']}`.
- Every write confirms (assign shows a review summary; revoke/suspend are `tone:'danger'`).
- SoD/403 always surfaced with human guidance; the UI never hides an SoD failure as a generic error.
- **Self-action guard (UX):** warn (not block) when an admin suspends their **own** account or revokes
  their **own** last admin role — the backend is the authority, but the UI adds a confirm with a clear note.

---

## 7. Delegations (optional sub-section, backend ready)

`POST /api/v1/delegations` exists (`createDelegationSchema { delegatorPersonId, delegatePersonId,
requestType, validFrom, validTo }`). Add a small **Delegations** panel/tab:
- Form: Delegator (PersonPicker, default = self), Delegate (PersonPicker), Request type (Select),
  Valid from/to (date range). Submit → toast.
- **List** of active delegations needs a `GET /delegations` endpoint (§9) — until then the panel is
  create-only with a note, or deferred to the profile page. Keep it behind a capability flag.

---

## 8. i18n keys (`admin.access.*`, `roles.*`, `sod.*`)

```
title, subtitle, tab.review, tab.users, tab.delegations,
review.col.person|role|scope|source|grantedBy|actions,
users.col.user|email|person|status|actions,
assign.title, assign.person, assign.role, assign.scope, assign.source, assign.submit,
action.revoke, action.suspend, action.reactivate, action.viewAccess, action.export,
confirm.revoke*, confirm.suspend*, empty.usersDev, empty.review,
sod.blockedTitle, sod.SoD-01 … sod.SoD-08,   roles.<EachRole>
toast.assigned, toast.revoked, toast.suspended, toast.reactivated
```

---

## 9. Backend / DB change register (proposed)

1. **Assignment id in listings (revoke enabler).** `GET /admin/access-review` (and/or a new
   `GET /admin/roles?personId=&scopeNodeId=`) should return `assignmentId` per row so **revoke works on
   existing grants**, not only freshly-created ones. *Small, additive.* **Interim:** UI enables Revoke only
   on rows assigned in-session (id retained from the POST response).
2. **`GET /admin/persons` (searchable).** A production person directory for the PersonPicker (dev uses
   `/dev/users`, which 404s in prod). Params: `q`, `limit`. **Small–medium.**
3. **`GET /delegations` list** (+ revoke) to make the Delegations panel two-way. **Small.**
4. **Server-side access-review export** (`GET /admin/access-review?format=csv`) for large orgs +
   tamper-evident recertification evidence. **Medium.** UI ships client CSV now.
5. **Pagination + filter params** on `/admin/users` and `/admin/access-review` (`q, role, scopeNodeId,
   page, pageSize`) for scale. **Medium.**

---

## 10. Tests

- `use-access.test.ts` — users/access-review parse; assign invalidates review; suspend optimistic.
- `access-page.test.tsx` — review tab renders rows with resolved person/scope; Assign dialog submits →
  POST (MSW) + toast; **SoD 403 → in-dialog alert with mapped reason, dialog stays open**; users tab
  suspend → confirm → POST; empty/error states.
- `person-picker.test.tsx`, `role-picker.test.tsx`, `export-button.test.tsx`, `sod-reasons.test.ts`.

**MSW (`mocks/handlers/admin.ts`):** GET `/admin/users`, GET `/admin/access-review`, POST `/admin/roles`
(success + a `403 SoD-04` branch), DELETE `/admin/roles/:id`, POST `/admin/users/:id/{suspend,reactivate}`,
GET `/dev/users` (persons), plus `/hierarchy` (from Phase 01).

---

## 11. Exit checklist

- [ ] `access.contract.ts` mirrors users/access-review/assign + Zod; parsed on fetch.
- [ ] Hooks with invalidation; optimistic status; pessimistic assign.
- [ ] Tabbed page: Access review (filter/export/assign/revoke) + Users (suspend/reactivate/view-access).
- [ ] Assign dialog with Person/Role/Scope pickers; **SoD 403 surfaced with guidance**, dialog stays open.
- [ ] `PersonPicker`, `RolePicker`, `ExportButton`, `sod` map added to shared kit + tested.
- [ ] RBAC guard (SystemAdmin); self-action UX guard; i18n EN/AR incl. role + SoD copy; RTL verified.
- [ ] Delegations panel behind capability flag (create-only) with register item for `GET /delegations`.
- [ ] MSW handlers + tests; live-verified; handlers removed per screen.
- [ ] Backend items filed in register (file 10).
- [ ] Gate green.
