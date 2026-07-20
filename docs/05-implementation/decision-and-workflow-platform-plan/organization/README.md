# Reusable Organization Management - Phase Index

This workstream completes organization and reusable N-level hierarchy management before hierarchy-scoped policy activation.

## Current source truth

- One seeded organization and a first-class effective-dated `hierarchy_node` tree exist.
- Roles and vehicle assignments reference hierarchy nodes; vehicle assignments prevent overlapping effective periods.
- `GET /hierarchy` returns the whole active tree, with a minimal DTO and no organization/scope filtering.
- No organization settings or hierarchy write API exists.
- `/admin/organization` is a placeholder.
- `RolesGuard` is role-only, and `ScopeProvider` is not consumed by domain feature queries.
- Policy reads/cache keys are not organization/scope aware.
- Live local data requires remediation: four active roots, three leaked test pools, null seeded Arabic/level metadata, and six people without home pools.

## Phase order

| Phase | File | Outcome |
| --- | --- | --- |
| O0 | [00-domain-boundaries-and-decisions.md](00-domain-boundaries-and-decisions.md) | Reusable organization/hierarchy rules approved |
| O1 | [01-data-quality-and-master-data-remediation.md](01-data-quality-and-master-data-remediation.md) | Current data cleaned and approved hierarchy reconciled |
| O2 | [02-database-hardening-and-history.md](02-database-hardening-and-history.md) | Stable codes, invariants, history and safe restructure storage |
| O3 | [03-organization-administration-backend.md](03-organization-administration-backend.md) | Rich read and history-safe write APIs |
| O4 | [04-scope-authorization-and-query-propagation.md](04-scope-authorization-and-query-propagation.md) | Organization/scope-aware authorization and feature queries |
| O5 | [05-organization-management-ui.md](05-organization-management-ui.md) | Real Wayfinder Organization Management UI |
| O6 | [06-policy-hierarchy-integration-gate.md](06-policy-hierarchy-integration-gate.md) | Policy binding/inheritance/invalidation gate passed |

## Boundary rule

Organization-default policy drafts may remain available during O0-O5. Deployment to cluster, pool, location, or another organization is disabled until O6 passes.

## Implementation progress - 2026-07-19

- O1 partial: canonical seed metadata is repaired idempotently; quality API exposes remaining root/home-scope defects. Business-approved hierarchy import and orphan remediation remain open.
- O2 foundation: stable codes/revisions and baseline uniqueness/check constraints are implemented in migration `0016`. Parent/level/org triggers, change events and write procedures remain open.
- O3 read slice: SystemAdmin workspace/quality endpoints are live; write/history/impact endpoints remain open.
- O5 read slice: real bilingual Organization Management page and accessible hierarchy tree are live; writes remain capability-blocked.
- O4 and O6 remain blocking prerequisites for authorized scope propagation and scoped policy activation.

## Adversarial critique round 1 and next-phase progress

Closed before enabling writes:

- Principal and `GET /me` now carry authoritative `organizationId`; Organization Administration uses Principal organization rather than a global default.
- Normal `GET /hierarchy` now returns role-authorized subtrees plus required ancestors, filtered by organization. Role-less users receive an empty tree.
- Scope Switcher offers only assigned subtrees, removes stale selections, and shows `All scopes` only for a root-scoped role.
- Migration `0017_hierarchy_invariants_history` makes `level_code`/`name_ar` mandatory, validates non-root parent organization/level/path/cycle rules, increments revisions automatically, and adds append-only `hierarchy_change_event`.
- Guarded create, impact preview, bilingual rename, and dependency-free retirement APIs/UI are live. Each write commits hierarchy state, change event, hash-chain audit, and outbox atomically.
- Live browser lifecycle verified `CREATED -> RENAMED -> RETIRED`, revision `1 -> 2 -> 3`, no overflow, and complete audit/outbox evidence.

Critique claims rejected/corrected:

- Migration `0016` did not cause data loss; its fallback code generation is transitional technical debt for pre-existing noncanonical nodes.
- Multiple nodes at the same `level_index` are valid siblings and must not be globally unique.
- ltree cycles do not create recursive SQL loops, but they corrupt ancestry semantics; trigger protection is still required and implemented for new/updated non-root nodes.

Remaining blockers before subtree move or scoped policy activation:

- Governed remediation of the three active orphan test roots and six missing home scopes, followed by a single-active-root constraint.
- Composite organization consistency constraints/triggers for person home scope, role scope, vehicle scope, entitlement location, and policy bindings.
- Lock-and-impact-token subtree move with descendant path rewrite and concurrency tests.
- Full resource-scope authorization across dashboards, approvals, vehicles, bookings, compliance, fines, handover, workflows, and policy deployment.
- History/read UI, reactivation, effective-dated scheduled restructure, and large-tree virtualization/complete keyboard tree navigation.

## Blocker closure and O6 handoff

The prior blocker list is now closed for the organization foundation:

- Local leaked roots are dependency-checked and retired; booking-referenced test people are preserved and assigned the canonical home scope. Live readiness is one active root and zero missing home scopes.
- Migration `0018_organization_scope_consistency` enforces one active root, parent/person/role/vehicle/entitlement/policy organization consistency, and effective-window checks.
- Safe subtree move uses organization advisory lock, expected revision, target-specific impact token, cycle/level checks, ordered descendant path rewrite, history/audit/outbox, and stale replay rejection.
- History, retired-node listing, reactivation, move UI, and roving keyboard tree navigation are implemented.
- Dashboard scope reads, role grants, and vehicle list/create/update/transition/document/transfer paths now use authenticated organization/scope authorization.
- Migration `0019_policy_scope_binding` adds organization/scope-aware draft bindings and uniqueness, creating the storage handoff into O6.

Verification baseline: backend 245 unit, 83 integration, 5 E2E; frontend 52 tests; migrations 0016-0019 forward/idempotent; static/build/guard gates green. Remaining work belongs to O6 policy ancestry/cache/runtime and broader domain-by-domain scope migration, not organization-management blockers.

## Mockup-driven O5 extension before O6 runtime

- Organization UI redesign uses a configurable hierarchy-level strip, dense tree table with vehicle/user rollups, and selected-node operational detail.
- Migration `0020_organization_hierarchy_levels` adds organization-specific level definitions (maximum five), bilingual labels, mandatory/optional metadata, stable order and node-level FK consistency.
- Level cards support drag/drop plus keyboard arrow controls. Reordering is blocked when populated parent-child edges would become invalid; structural changes continue through audited subtree move.
- Backend workspace exposes level definitions and per-node roll-up vehicle/user/utilisation metrics; node detail exposes scoped roles, recent vehicle transfers and restructures.
- This O5 extension lands before O6 ancestry runtime so level semantics and scope labels are stable for policy inheritance.

### Completed and critique-verified

- Migrations `0020_organization_hierarchy_levels` and `0021_organization_metrics_indexes` add organization-specific level definitions (maximum five), stable order, bilingual labels, mandatory/optional metadata, node-level definition consistency and metric query indexes.
- Level strip supports pointer drag plus explicit labeled arrow-button keyboard controls; populated-edge reorder is rejected with exact incompatible edges.
- Dense structure tree shows roll-up vehicle/user counts; selected-node panel shows parent, utilization, direct scoped roles, recent transfers and restructures.
- Admin may add an optional fifth level and edit bilingual level labels; level codes remain immutable logic keys.
- Critique fixes: active-person metrics, direct node-detail query, UUID route pipes, reactivation parent/level validation, duplicate level-code prevention, RTL dialogs, mobile horizontal-scroll affordance and semantic drag layout.
- Browser verified five level cards and safe `409` rejection for invalid populated-level reorder; EN/AR/no-overflow remain green.
- Verification baseline after redesign: backend 246 unit, 86 integration, 5 E2E; frontend 56 tests; migrations through `0021`; static/build/contract/guard gates green.

O5 is complete for the approved mockup scope. O6 ancestry resolution/cache/provenance resumes next.

## Reference-material rule

`docs/Organization_Management_and_Policy_Engine.md` supplies candidate business hierarchy, shared-location semantics, and D24 cross-cluster context only. Its SQL, fixed levels, table names, rule counts, and current-state claims are not implementation authority.
