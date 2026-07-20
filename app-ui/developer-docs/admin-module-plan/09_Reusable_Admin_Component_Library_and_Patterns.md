# Phase 09 — Reusable Admin Component Library & Patterns

> **The reuse contract.** The user's rule: *each actor has a dedicated module, but pages and components
> are reusable across modules*. This file is the **single catalogue** of the shared kit that every admin/
> governance module (and later every operational module) composes. Build these **once**, in
> `src/components/*` / `src/hooks/*` / `src/lib/*` (domain-agnostic), and reuse them everywhere. It extends
> the existing `../component-library-plan/` with **admin-console patterns**.

---

## 1. Where the shared kit lives (never inside a feature module)

```
src/components/
  ui/         # shadcn primitives (exist): button, input, select, dialog, sheet, table, tabs,
              #   dropdown-menu, popover, combobox, checkbox, radio, switch, slider, tooltip,
              #   alert, alert-dialog, badge, avatar, accordion, scroll-area, separator, progress,
              #   data-table, calendar, date-picker, command, skeleton, status-chip, signal-card, page-header
  patterns/   # composed, domain-agnostic (exist + NEW below): admin-page-layout, resource-table,
              #   resource-form-dialog, filter-bar, detail-drawer, audit-meta-footer, tree-table,
              #   bilingual-field, code-field, compare-merge-panel, file-dropzone, completeness-meter,
              #   integrity-banner, hash-badge, toggle-matrix, health-tile, freshness-badge,
              #   launcher-grid, export-button, empty-state, banner, stat-card, skeletons,
              #   camera-capture, signature-pad, damage-marker, availability-strip
  charts/     # chart-frame, kpi-sparkline, bar/area/pie (exist)
  form/       # form (RHF+Zod) (exist)
src/hooks/    # use-confirm, use-toast, use-capabilities (NEW), use-pagination (NEW)
src/lib/      # api-client, auth-headers, env, utils(cn), csv (NEW), parse-csv (NEW), format (NEW)
src/features/auth/   # roles, require-role, access-denied, landing  (RBAC shared across modules)
src/features/platform/  # hierarchy contract + scope helpers (shared read surface)
```

**Boundary rule (enforced by dependency-cruiser):** `components/*`, `hooks/*`, `lib/*` **must not import
from `features/*`**. Feature modules depend on the kit, never the reverse. Cross-module needs are promoted
into the kit, not imported sideways.

---

## 2. The admin-console pattern set (build here, reuse everywhere)

| Component | Props (essence) | Built on | Reused by |
|---|---|---|---|
| **`AdminPageLayout`** | `title, eyebrow, description, actions?, filterBar?, children, drawer?` | `page-header`, tokens | **all** admin/governance pages |
| **`ResourceTable<T>`** | `columns, data, toolbar?, rowActions?, state(loading/empty/error), selection?, pagination('client'|'server'), onQueryChange?` | `ui/data-table` | reference-data, access, audit, data-quality, integrations |
| **`ResourceFormDialog`** | `open, mode('create'|'edit'), schema(Zod), defaultValues, fields, onSubmit, serverError` | `dialog`, `form` | reference-data, access, org, policy |
| **`FilterBar`** | `filters[] (search/select/toggle/dateRange/scope), value, onChange, onClear` | `input/select/segmented` | every list screen |
| **`DetailDrawer`** | `open, title, children, actions?` | `sheet`, `scroll-area` | audit, org, integrations, policy |
| **`AuditMetaFooter`** | `createdBy/at, updatedBy/at` | tokens | any governed record view |
| **`TreeTable` / `TreeView`** | `nodes, columns, expandable, onSelect` | `ui/table` | reference-data (cascading), org hierarchy |
| **`BilingualField`** | `nameEn, nameAr, labels, dir` | `form`, `input` | reference-data, org terminology, any EN/AR field |
| **`CodeField`** | `immutable?, uppercase?` | `input` (`.font-data`) | reference-data, policy rule ids |
| **`PersonPicker`** | `value, onChange, source(fn)` | `combobox`, `command` | access, delegations, entitlements, substitution |
| **`RolePicker`** | `value, onChange, grouped?` | `select` | access, delegations |
| **`ScopePicker` / `ScopeSwitcher`** | `value, onChange` (from `/hierarchy`) | `combobox` | access, org, any scope-bound screen + header |
| **`DecisionTableEditor`** | `inputSchema, table, onChange, readOnly?` | `ui/table`, `form` | policy studio |
| **`DecisionTrace`** | `{decision, reasons[], policyVersion, matchedRow}` | tokens, `status-chip` | policy test panel, audit decision log, approval evidence |
| **`JsonDiffViewer`** | `left, right` | tokens | policy versions, any immutable-version compare |
| **`IntegrityBanner`** | `verified, brokenAtSeq?` | `banner` | audit, any tamper-evident view |
| **`HashBadge`** | `hash, copy?` | `badge` | audit evidence |
| **`FileDropzone` + `useCsvParse`** | `accept, maxRows, onRows` | input, `lib/parse-csv` | data-quality, bulk reference-data, fines import |
| **`CompletenessMeter`** | `score, target` | `progress`, `status-chip` | data-quality, any quality gate |
| **`CompareMergePanel`** | `left, right, onMerge` | `sheet`/`dialog` | data-quality dedup, any merge |
| **`ToggleMatrix`** | `rows, cols, value, lockedCells, onChange` | `switch`, `ui/table` | notifications, any permission/capability matrix |
| **`HealthTile`** | `label, status, detail` | `stat-card`, `status-chip` | admin home, ops surfaces |
| **`FreshnessBadge`** | `lastSyncAt, slaMinutes` | `badge` | integrations, compliance/eligibility |
| **`LauncherGrid`** | `items(role-filtered)` | `card`, nav | admin home, other role homes |
| **`ExportButton` + `toCsv`** | `rows, columns, filename` | `button`, `lib/csv` | access review, audit, data-quality, dashboards |
| **`AccessDenied`** | `requiredRoles` | tokens | `RequireRole` fallback everywhere |

> **Design compliance (inherited):** tokens-only, one font, 3px radius, warm border, both themes, RTL via
> logical props, status-never-colour-alone, WCAG 2.1 AA, i18n via props. See `../component-library-plan/00 §1`
> and `../design-system.md`. **Never pass a function `className`/children into a Radix `asChild`/Slot**
> (repo memory) — compute state and pass a string className (as `SidebarItem` does).

---

## 3. Module → shared-component reuse matrix

Proves the "reusable across modules" rule concretely.

| Component ↓ / Module → | Ref-data (02) | Access (03) | Org (04) | Policy (05) | Audit (06) | Data-quality (07) | Integ/Notif (08) |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| AdminPageLayout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ResourceTable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ResourceFormDialog | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| FilterBar | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| DetailDrawer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TreeTable | ✅ | — | ✅ | — | — | — | — |
| BilingualField / CodeField | ✅ | — | ✅ | ✅ | — | — | — |
| PersonPicker / RolePicker / ScopePicker | — | ✅ | ✅ | — | — | — | — |
| DecisionTrace | — | — | — | ✅ | ✅ | — | — |
| JsonDiffViewer | — | — | — | ✅ | ✅ | — | — |
| IntegrityBanner / HashBadge | — | — | — | — | ✅ | — | — |
| FileDropzone / CompareMergePanel / CompletenessMeter | ✅(bulk) | — | — | — | — | ✅ | — |
| ToggleMatrix | — | — | — | — | — | — | ✅ |
| ExportButton | — | ✅ | — | — | ✅ | ✅ | — |
| HealthTile / FreshnessBadge / LauncherGrid | — | — | — | — | — | — | ✅ |
| AuditMetaFooter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Shared hooks & lib

- **`useCapabilities()`** — reads a small capability map (feature flags + "which backend endpoints exist
  yet") so screens gate optional surfaces (inactive-view, decision-log, hierarchy-write, integrations)
  cleanly instead of hardcoding. Backed by `env` + a future `/admin/settings`.
- **`usePagination()`** — page/pageSize/sort state helper for the **server-paginated** `ResourceTable`
  variant (audit, users at scale).
- **`lib/csv.ts` (`toCsv`)** + **`lib/parse-csv.ts` (`parseCsv`)** — RFC-4180-safe export/import.
- **`lib/format.ts`** — locale-aware date/number/relative-time formatters (used by every table).
- **`sod-reasons` map** + **`roles` i18n** — shared reason/role localisation.

---

## 5. Build order for the kit (dependency-first)

1. **Layout & tables:** `AdminPageLayout`, `ResourceTable` (client + server variants), `FilterBar`,
   `DetailDrawer`, `AuditMetaFooter` — unblock 02/03/06/07.
2. **Forms & pickers:** `ResourceFormDialog`, `BilingualField`, `CodeField`, `PersonPicker`, `RolePicker`,
   `ScopePicker` — unblock 02/03/04.
3. **Trees & quality:** `TreeTable`, `FileDropzone/useCsvParse`, `CompletenessMeter`, `CompareMergePanel`
   — unblock 04/07.
4. **Governance/visual:** `DecisionTrace`, `DecisionTableEditor`, `JsonDiffViewer`, `IntegrityBanner`,
   `HashBadge`, `ToggleMatrix`, `HealthTile`, `FreshnessBadge`, `LauncherGrid`, `ExportButton` — unblock 05/06/08.

Each kit component ships to the **design showcase** (`/:lang/design`) in both themes + RTL, with a unit/
interaction test, before a screen depends on it (mirrors the component-library DoD).

---

## 6. Definition of Done (every shared component)

- [ ] Domain-agnostic (no `features/*` import); token-styled; both themes; RTL (logical props).
- [ ] All states: default/hover/focus-visible/active/disabled/loading/empty/error.
- [ ] Keyboard + ARIA + focus management; status never colour-alone.
- [ ] i18n via props (no hardcoded copy); locale-aware numbers/dates.
- [ ] Rendered in the design showcase; unit/interaction test; a11y check where meaningful.
- [ ] Listed in this matrix with its consuming modules; gate green.
