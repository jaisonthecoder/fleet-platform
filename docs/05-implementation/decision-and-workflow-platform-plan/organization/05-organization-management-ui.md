# O5 - Organization Management UI

## Objective

Replace `/admin/organization` placeholder with a complete, contract-backed Wayfinder experience for organization settings, N-level hierarchy visualization, history-safe changes, impact review and terminology.

## Owners and dependencies

- Primary: Frontend React Engineer and UX Designer
- Contributors: Backend, Product/Data Steward, Security, QA
- Depends on: O3 APIs and O4 authorization contracts
- Human gate: UX/accessibility and organization-admin approval

## Feature structure

Create `features/organization/` with contracts, TanStack hooks, OrganizationPage, StructureView, NodeDetailDrawer, create/rename/move/retire/reactivate dialogs, impact view and history timeline. Replace generated ComingSoon route with explicit SystemAdmin route.

## Screens and behavior

### Hierarchy level customization

Organization-specific level cards (maximum five) show stable code, bilingual label, mandatory/optional status and active node count. Admins may edit labels, add optional levels and drag/reorder cards with keyboard arrow alternatives. Backend validates populated parent-child level edges before commit; an order that would restructure active nodes is blocked and must use governed subtree moves instead.

### Overview/settings

Organization name/code/status, default timezone/currency, hierarchy health/generation and quality warnings. Stable code changes are restricted by contract.

### Structure

Accessible dense N-level tree/table showing code, bilingual name, level, status, roll-up vehicle/user counts and hierarchy context. Expand/collapse, search/filter, current/historical date mode, selection and details. Mobile uses nested list/drill-down rather than a compressed table.

### Node operations

Add child; rename bilingual labels; move via target scope picker and mandatory impact preview; retire/reactivate with reason, effective time and dependency handling. No optimistic visual tree mutation before server commit; show pending state and invalidate hierarchy/scope/domain queries after success.

### Terminology

Cross-link or embedded governed editing of `hierarchy-level` lookup labels. Node `level_code` remains stable; labels are localized presentation.

### History

Timeline of create/rename/move/retire/reactivate with actor, reason, old/new parent/path and effective time.

### Selected node operational panel

Shows parent/supervisor context, direct and roll-up vehicles/users, utilisation, scoped role assignments, recent vehicle transfers and restructure history. Role mutation remains owned by Access Management; this panel is evidence/read-only for assignments.

## Shared components to create

- `TreeTable`/`HierarchyTree` with equivalent accessible list mode.
- `LevelBadge`.
- `BilingualField`.
- `NodePath`/hierarchy breadcrumb.
- `MoveNodeDialog`.
- `ImpactSummary`.
- `HierarchyHistoryTimeline`.

Do not claim these exist before implementation.

## Query keys

`['organization']`, `['hierarchy','authorized',generation]`, `['hierarchy','admin',asOf]`, `['hierarchy-node',id]`, `['hierarchy-impact',id,operation,target,generation]`, `['hierarchy-history',id]`. Mutations invalidate scope switcher, access scopes, dashboards and policy scope metadata as declared by backend generation/events.

## ScopeProvider integration

Validate stored selection against authorized response; seed authorized home scope; remove unauthorized/retired selections; include selected scope in feature query keys; prevent organization-wide option without permission.

## States

Loading skeleton, empty first-node state, API error/retry, access denied, stale revision/impact conflict with reload/diff, degraded/history unavailable, no authorized scopes and partial metadata warnings.

## i18n/RTL/accessibility

All labels/reasons/levels in EN/AR; Arabic field direction; logical indentation; keyboard tree navigation; semantic treegrid or list; visible focus; focus restoration after add/remove/move; announcements for validation and saved hierarchy generation; status never color alone; light/dark and 320px-to-wide verification.

## Tests

Contracts/hooks/MSW; tree expansion/search/selection; keyboard/ARIA; create/rename/move/retire/reactivate; stale impact/revision; query invalidation; unauthorized scope; EN/AR/RTL; axe; Playwright real backend including hierarchy move and reload.

## Migration and rollback

UI route can first ship read-only behind capability metadata. Enable writes only after O3/O4 gates. Application rollback keeps backend/API additive; hide write capability without losing history.

## Exit gate

O5 passes when SystemAdmin can manage the hierarchy without SQL, normal users see only authorized scopes, all dynamic states are accessible/bilingual, and browser evidence covers desktop/mobile/light/dark/RTL.
