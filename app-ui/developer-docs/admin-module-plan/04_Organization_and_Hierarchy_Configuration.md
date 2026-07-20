# Phase 04 — Organisation & Hierarchy Configuration

> **Backend readiness: 🟡 read ready · writes need backend.** `GET /hierarchy` is live and powers the
> tree viewer + Scope Switcher today. **Node create/rename/move/retire** and **terminology/branding**
> writes are backend enhancements (§8) — the UI ships a **read-only, history-safe tree explorer** first,
> then unlocks editing as the endpoints land.
>
> **Owner:** `SystemAdmin`. **Route:** `/{lang}/admin/organization`. **Architecture anchor:** ADR-009 —
> hierarchy nodes are a **first-class entity** (`hierarchy_node`, ltree), never flattened into lookups;
> only the **level taxonomy** (Cluster/Pool/Location…) is a lookup type.

---

## 1. Business context (FR-ARC-02, FR-REU-04)

The generic N-level hierarchy engine is what makes the platform **reusable by configuration**: AD Ports
deploys it as **Group → Cluster → Pool → Location**; another org configures **Company → Region → Branch**.
Admins must be able to:
- **Visualise** the tree (levels, names, paths) and use it as the Scope Switcher source.
- **Edit** it *history-safely*: add/rename/move/retire nodes without breaking effective-dated
  assignments (a vehicle's past pool membership must remain provable).
- **Relabel level words** ("Cluster" → "Region") — the **terminology overrides** (these are a lookup type
  `hierarchy-level`, so they're managed via the reference-data engine, cross-linked here).
- **Brand** within the token system (logo + accent) — Phase 2 scope, respects Wayfinder tokens.

---

## 2. Backend surface

| Method | Path | Status | Purpose |
|---|---|---|---|
| GET | `/api/v1/hierarchy` | ✅ live | Nested tree (from Phase 01 contract) |
| GET | `/api/v1/lookups/hierarchy-level` | ✅ live | Level taxonomy (terminology) via reference-data |
| POST/PATCH | `/api/v1/admin/hierarchy/nodes` | 🟠 **enhancement** | Create / rename / move / retire node |
| — | branding/terminology store | 🟠 **enhancement** | Persist org branding + level relabels |

**Contract reuse:** `HierarchyNode` + `flattenHierarchy`/`descendantsOf` from `features/platform`
(Phase 01). No new read contract.

---

## 3. Screen design (`pages/organization-page.tsx`)

`AdminPageLayout` + `Tabs`: **Structure** · **Terminology** · **Branding**.

### Tab A — Structure (tree)
- **`TreeTable`/`TreeView`** (shared kit) rendering the hierarchy: expand/collapse, columns
  Level | Name | Path | (Nodes count) | ⋯. Uses the same `TreeTable` as reference-data cascading types.
- **Node detail** → `DetailDrawer`: level, parent, ltree `path`, children, and (when available)
  effective-dated assignment counts. Shows `AuditMetaFooter`.
- **Editing (capability-gated):** when write endpoints exist —
  - `+ Add node` (parent preselected from the selected node; level from taxonomy),
  - **Rename** (label only; code/path stable),
  - **Move** (re-parent) via a guarded dialog that **warns about history** and requires confirm — the
    backend keeps effective-dated history; the UI explains the effect,
  - **Retire** (soft) with confirm.
  - All writes optimistic-off (pessimistic) with pending state; invalidate `['hierarchy']` and the
    Scope Switcher refreshes.
- **Read-only mode (today):** the tree + detail render; edit actions show a "Editing arrives with the
  hierarchy write API" note behind a `capabilities.hierarchyWrite` flag.

### Tab B — Terminology (level relabels)
- A thin wrapper over **reference-data** for the `hierarchy-level` lookup type: edit `labelEn/labelAr`
  per level (e.g. relabel "Cluster" → "Region"). Reuses the Phase-02 `BilingualField` + value-edit flow.
  Cross-links to `/admin/reference-data?type=hierarchy-level`. **Backed today** (reference-data is live).

### Tab C — Branding (Phase 2)
- Logo upload (uses `CameraCapture`/file pattern), accent selection **constrained to token-safe values**
  (never raw hex that breaks contrast), live preview in both themes. Persisted via the branding store
  (enhancement). Deferred; documented for completeness.

---

## 4. Reusable components used / created

| Component | Source | Notes |
|---|---|---|
| `TreeTable`/`TreeView` | shared (from Phase 02) | same tree used for cascading lookups |
| `DetailDrawer`, `AdminPageLayout`, `ResourceFormDialog`, `Tabs`, `AuditMetaFooter` | shared kit | reused |
| `BilingualField` | shared (Phase 02) | level relabels |
| `LevelBadge` | **new shared** | localised level chip (reused by Scope Switcher + access scope column) |
| `MoveNodeDialog` | module-specific | history-warning re-parent flow |

---

## 5. RBAC & governance

- Route `RequireRole roles={['SystemAdmin']}`.
- **Move/Retire are high-impact** — always confirm with an explicit history-safety note; audited server-side.
- Terminology edits flow through the governed reference-data engine (already audited).

---

## 6. i18n keys (`admin.organization.*`)

```
title, subtitle, tab.structure, tab.terminology, tab.branding,
col.level|name|path|children|actions, action.addNode, action.rename, action.move, action.retire,
move.title, move.historyWarning, retire.confirm*, node.detail*, terminology.intro, branding.intro,
capability.readOnlyNote
```

---

## 7. Tests

- `organization-page.test.tsx` — renders tree from MSW `/hierarchy`; expand/collapse; detail drawer;
  edit actions hidden when `capabilities.hierarchyWrite=false`, shown + callable when true (mocked).
- `terminology` tab reuses reference-data tests (level type edit).
- `tree-table.test.tsx` (shared) covers expand/keyboard.

**MSW:** `/hierarchy`, `/lookups/hierarchy-level`; (mock write endpoints behind the capability flag for
the editing tests).

---

## 8. Backend / DB change register (proposed)

1. **Hierarchy write API** — `POST /admin/hierarchy/nodes` (create), `PATCH /admin/hierarchy/nodes/:id`
   (rename/move/retire). Must keep **ltree `path`** consistent on move (update subtree paths in a tx) and
   preserve **effective-dated assignment history**. Return the updated subtree. **Medium–high** (careful
   ltree + history handling). *This is the main unlock for this phase.*
2. **Node metadata on read** — include `childCount`, `activeVehicleCount`, audit metadata to power the
   detail drawer without N+1 calls. **Low–medium.**
3. **Branding + org settings store** — `GET/PUT /admin/org-settings` (logo ref, accent token, level
   relabels if not modelled purely as lookups). **Medium.**
4. **Terminology** is already covered by the `hierarchy-level` lookup type — no new endpoint (reuse Phase 02).

Until (1) lands, ship the **read-only explorer + terminology editing** (both backed today) — already a
useful, production-quality screen.

---

## 9. Exit checklist

- [ ] Read-only tree explorer + detail drawer from `/hierarchy`; Scope Switcher shares the data.
- [ ] Terminology tab edits `hierarchy-level` via reference-data (bilingual), live-backed.
- [ ] Editing actions implemented behind `capabilities.hierarchyWrite`; wired when API lands.
- [ ] `TreeTable`, `LevelBadge` in shared kit + tested; history-warning move flow specified.
- [ ] RBAC guard (SystemAdmin); i18n EN/AR; RTL verified.
- [ ] Backend items filed in register (file 10).
- [ ] Gate green.
