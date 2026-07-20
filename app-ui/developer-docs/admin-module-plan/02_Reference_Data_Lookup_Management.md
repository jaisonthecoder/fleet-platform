# Phase 02 — Reference Data (Lookup) Management

> **Backend readiness: ✅ fully ready.** This is the flagship first feature screen — the *only* admin
> area whose backend CRUD is finished and stable (sub-phase 1A₂, ADR-009). It also feeds every future
> dropdown (vehicle body-type/fuel-type/use-category/make→model, etc.), so it unblocks the rest of the app.
>
> **Owners:** `DataSteward`, `SystemAdmin`. **Route:** `/{lang}/admin/reference-data`.

---

## 1. Business context (ADR-009)

Reference data ("lookups") are the platform's **configurable pick-lists** — bilingual, effective-dated,
code-keyed, and Redis-cached. Business logic keys on the **stable `code`**, never the label; labels are
localised at the edge. Some types are **hierarchical/cascading** (Make → Model). Reference data is the
reuse story: one governed engine drives every dropdown, per organisation, without code changes.

**Guardrails to honour in the UI:**
- `code` is **immutable** after creation (PATCH cannot change it).
- Never delete — **deactivate** (soft-state). Deactivated values stay in history and stop appearing in pickers.
- Always edit **both** EN and AR labels; never blank the inactive language.
- Cascading values carry a `parentCode` within the same type.

---

## 2. Backend surface (exact)

| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/api/v1/lookups` | authed | List the **type catalogue** |
| GET | `/api/v1/lookups/:typeCode` | authed | Active values (flat) |
| GET | `/api/v1/lookups/:typeCode?tree=true` | authed | Active values (nested tree) |
| GET | `/api/v1/lookups/:typeCode/:parentCode` | authed | Cascading children of a parent |
| POST | `/api/v1/admin/lookups/:typeCode/values` | DataSteward\|SystemAdmin | Create value |
| PATCH | `/api/v1/admin/lookups/values/:id` | DataSteward\|SystemAdmin | Update labels/desc/order/active |
| POST | `/api/v1/admin/lookups/values/:id/deactivate` | DataSteward\|SystemAdmin | Soft-deactivate |

**Contracts (mirror in `features/admin/reference-data/reference-data.contract.ts`):**
```ts
export interface LookupType {
  id: string; code: string; labelEn: string; labelAr: string; isHierarchical: boolean
}
export interface LookupValue {
  id: string; code: string; labelEn: string; labelAr: string
  descriptionEn: string | null; descriptionAr: string | null
  parentId: string | null; sortOrder: number; children?: LookupValue[]
}
export const createLookupValueSchema = z.object({
  code: z.string().min(1),
  labelEn: z.string().min(1), labelAr: z.string().min(1),
  descriptionEn: z.string().optional(), descriptionAr: z.string().optional(),
  parentCode: z.string().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export const updateLookupValueSchema = z.object({
  labelEn: z.string().min(1).optional(), labelAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional(), descriptionAr: z.string().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
})
```
**Fetch/mutate fns:** `fetchLookupTypes()`, `fetchLookupValues(typeCode, tree?)`,
`fetchLookupChildren(typeCode, parentCode)`, `createLookupValue(typeCode, body)`,
`updateLookupValue(id, body)`, `deactivateLookupValue(id)` — all via `apiClient`, Zod-parsed.

> ⚠️ **Response note:** `GET /:typeCode` currently returns **active** values only. Showing/toggling
> **inactive** values needs a backend flag (`?includeInactive=true`) — see §9 (Backend register). Until
> then, "Deactivate" removes the row from view (correct) and re-activation is done via a dedicated
> enhancement; the UI hides the "show inactive" control behind a capability flag.

---

## 3. Data hooks (`features/admin/reference-data/hooks/use-lookups.ts`)

```ts
useLookupTypes()                        // ['admin','lookups','types']
useLookupValues(typeCode, { tree })     // ['admin','lookups', typeCode, { tree }]
useLookupChildren(typeCode, parentCode) // ['admin','lookups', typeCode, parentCode]
useCreateLookupValue(typeCode)          // invalidates [typeCode]; toast; server-error→form
useUpdateLookupValue(typeCode)          // optimistic for sortOrder/isActive; invalidate on settle
useDeactivateLookupValue(typeCode)      // confirm → mutate → invalidate; toast
```
- Mutations invalidate the affected `typeCode` key and `types` when counts matter.
- Cache-awareness: the backend also caches in Redis and invalidates on write, so a refetch after mutate
  reflects the change; no client cache hacks needed.

---

## 4. Screen design (`pages/reference-data-page.tsx`)

**Layout:** `AdminPageLayout` with a **master–detail** split.

```
┌ PageHeader: "Reference data"  · eyebrow ADMINISTRATION · [ + Add value ] ┐
├───────────────┬──────────────────────────────────────────────────────────┤
│ Type list     │  Values of <selected type>                                 │
│ (left rail)   │  FilterBar: [search] [Active|All*] [Flat|Tree(if hier.)]   │
│  • Body type  │  ResourceTable / TreeTable:                                 │
│  • Fuel type  │    Code | Label (EN) | Label (AR) | Sort | Status | ⋯      │
│  • Use categ. │    row ⋯ → Edit · Deactivate                                │
│  • Make ▸     │                                                            │
│    Model      │  (hierarchical types render a Tree with expand/collapse)   │
└───────────────┴──────────────────────────────────────────────────────────┘
```

- **Type list (left):** from `useLookupTypes()`. Each shows localised `label{En|Ar}` + a badge for
  `isHierarchical`. Selecting a type loads its values. Searchable when many. On mobile it collapses to a
  `Select` above the table.
- **Values table (right):** `ResourceTable<LookupValue>`. Columns: `code` (mono/`.font-data`), Label EN,
  Label AR, Sort order, Status chip (Active), row-actions. Localised column headers. Search filters by
  code/label. Sort by `sortOrder` then code.
- **Hierarchical types:** toggle **Tree** view — an indented, expand/collapse tree (fetch with
  `?tree=true`) so Make → Model cascades are visible and editable in place; **Flat** view lists all.
- **Bilingual display:** table shows both languages; the active-locale label is emphasised, the other muted.

**Add / Edit value** → `ResourceFormDialog` with fields:
- `code` (text, **create-only**, disabled in edit, hint "immutable"), Label EN, Label AR,
  Description EN (optional), Description AR (optional), Sort order (number),
  Parent (only for hierarchical types — a `Select`/`Combobox` of existing values in the type),
  Active (switch, edit-only).
- Zod = `createLookupValueSchema` / `updateLookupValueSchema`. Submit → mutation; server `reasons[]`
  (e.g. duplicate code → 409) map onto the `code` field / form-level alert.

**Deactivate** → `useConfirm({ tone:'danger', title, description })` → mutation → toast + refetch.

**States:** skeleton table while loading; guided empty-state ("No values yet — add the first") with a
CTA; error state with reason + Retry; success toasts on every mutation.

---

## 5. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `AdminPageLayout`, `ResourceTable`, `ResourceFormDialog`, `FilterBar` | shared kit (file 09) | reused as-is |
| `BilingualField` | **new shared** (file 09) | paired EN/AR inputs with RTL AR input; used across all reference data + org terminology |
| `CodeField` | **new shared** | mono input, uppercase-normalise, immutable-in-edit affordance |
| `TreeTable` | **new shared** | indented expand/collapse table for hierarchical lookups (reused by Org hierarchy, phase 04) |
| `StatusChip` | existing | Active/Inactive |
| `useConfirm`, `notify` | existing | destructive confirm + toasts |

`BilingualField`, `CodeField` and `TreeTable` are **generic** and reused by Org configuration (04) and
anywhere bilingual/coded/hierarchical data appears.

---

## 6. RBAC & governance

- Route wrapped in `RequireRole roles={['DataSteward','SystemAdmin']}`.
- Reads are visible to those roles; **write actions** (Add/Edit/Deactivate) render only for the same
  roles (they are the same here) — and any 403 is surfaced via toast with the reason.
- **Audit:** every write is audited server-side. Show `AuditMetaFooter` in the edit dialog / a detail
  drawer when the backend returns audit metadata (enhancement — see §9); until then omit gracefully.

---

## 7. i18n keys (`admin.referenceData.*`)

```
title, subtitle, typeList, hierarchical, addValue, editValue, deactivateValue,
col.code, col.labelEn, col.labelAr, col.sort, col.status, col.actions,
field.code, field.codeHint, field.labelEn, field.labelAr, field.descEn, field.descAr,
field.sort, field.parent, field.active, view.flat, view.tree, filter.active, filter.all,
empty.title, empty.body, confirm.deactivateTitle, confirm.deactivateBody,
toast.created, toast.updated, toast.deactivated, error.duplicateCode
```
EN + AR authored together. AR labels use proper terms; the AR input is `dir="rtl"`.

---

## 8. Tests

- `use-lookups.test.ts` — types/values/children queries parse MSW payloads; create invalidates + refetches.
- `reference-data-page.test.tsx` — renders types, selects one → table populated; opens Add dialog,
  submits valid value → POST called (MSW) + success toast; duplicate-code 409 → field error shown;
  deactivate → confirm → DELETE/POST called; empty + error states render.
- `bilingual-field.test.tsx`, `code-field.test.tsx`, `tree-table.test.tsx` — shared-component behaviour.

**MSW (`mocks/handlers/admin.ts`):** GET `/lookups`, GET `/lookups/:type` (+ `?tree`), GET
`/lookups/:type/:parent`, POST `/admin/lookups/:type/values`, PATCH `/admin/lookups/values/:id`,
POST `/admin/lookups/values/:id/deactivate`. Include a hierarchical fixture (Make→Model) + a duplicate-code
409 branch. **Delete these handlers once verified against the live backend** (per screen).

---

## 9. Backend / DB change register (proposed — additive, non-breaking)

Logged in file 10; summarised here:

1. **`?includeInactive=true` on `GET /lookups/:typeCode`** + a **re-activate** path (either
   `PATCH values/:id { isActive:true }` — already supported by `updateLookupValueSchema.isActive`, just
   not reachable because inactive rows aren't listed). *Enables "show inactive" + re-activation.* **Low effort.**
2. **Return audit metadata** (`createdBy/at`, `updatedBy/at`) on lookup value reads → powers `AuditMetaFooter`. **Low.**
3. **Lookup *type* management** (create/rename type, mark hierarchical) — currently types are seeded only.
   Add `POST /admin/lookups/types` + `PATCH` for a fully self-service catalogue. **Medium.** (UI ships
   value-management first; type-management is a follow-up sub-phase.)
4. **Bulk import/export of reference data** (CSV/JSON) for onboarding a new org — reuses the migration
   pattern. **Medium**, Phase-later.

Until (1)/(2) land, the UI ships the **full value CRUD** (create/edit/deactivate/cascade) which is 100%
backed today, and hides inactive-view/audit-footer behind capability flags.

---

## 10. Exit checklist

- [ ] `reference-data.contract.ts` mirrors backend types + Zod; parsed on fetch.
- [ ] Hooks with correct keys + invalidation; optimistic sort/active; pessimistic create.
- [ ] Master–detail page: type list + values table + tree view for hierarchical types.
- [ ] Add/Edit dialog (code immutable-in-edit, bilingual, parent for cascading); Deactivate with confirm.
- [ ] All four states + toasts; duplicate-code + 403 handled.
- [ ] `BilingualField`, `CodeField`, `TreeTable` added to shared kit + tested.
- [ ] RBAC guard + nav item (DataSteward/SystemAdmin); i18n EN/AR; RTL verified.
- [ ] MSW handlers + tests; **live-verified** against backend, handlers removed.
- [ ] Backend enhancements filed in register (file 10).
- [ ] Gate green.
