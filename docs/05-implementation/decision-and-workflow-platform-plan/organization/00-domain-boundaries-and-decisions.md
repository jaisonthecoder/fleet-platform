# O0 - Organization Domain Boundaries and Decisions

## Objective

Approve the reusable organization model and invariant boundaries before schema or UI changes.

## Owners and dependencies

- Primary: Solution Architect and Product Owner
- Contributors: Data Steward, Backend, Database, Security, UX, SRE
- Depends on: Program Phase 0
- Human gate: organization model and AD Ports hierarchy approval

## Domain model

- **Organization:** legal/operational tenant boundary, defaults, ownership and audit partition.
- **Hierarchy Node:** stable scope identity in a generic N-level tree.
- **Node Code:** immutable business identifier unique within organization; survives rename/move.
- **ltree Path:** mutable ancestry/query materialization; recalculated on move.
- **Hierarchy Level:** configurable taxonomy code and bilingual labels, not node identity.
- **Physical Site:** optional future entity for shared address/geofence; not hierarchy ownership.
- **Person Home Scope:** default operational scope, sourced/reconciled from HCM or administration.
- **Role Scope:** effective-dated authorization assignment.
- **Vehicle Scope Assignment:** effective-dated vehicle ownership/location scope.
- **Policy Scope Binding:** effective-dated policy override at an organization or hierarchy node.

## Required decisions

1. Exactly one active organization/group root per organization.
2. Generic depth is supported; AD Ports target is Group -> Cluster -> Pool -> Location.
3. Stable node codes are uppercase, organization-unique and immutable after use.
4. Active sibling display names are unique per parent/language policy; same location label under different pools is permitted.
5. Parent and child must belong to the same organization and child level follows allowed taxonomy progression.
6. Rename changes labels only; code/path identity rules remain explicit.
7. Move changes ancestry/path for current structure and creates immutable change evidence.
8. Retire is soft/effective-dated and blocked or impact-governed when active dependencies exist.
9. Historical transactions retain original node IDs and resolved hierarchy/policy provenance.
10. Structural invariants such as no double booking, FK integrity and authorization cannot be weakened by policy.
11. Shared buildings use separate hierarchy nodes; introduce Physical Site only when address/geofence deduplication is required.
12. D24 cross-cluster booking defaults to deny until cluster-pair, cost and approver rules are approved.

## Candidate AD Ports master data

Treat the reference document's clusters, pools and locations as a candidate import set. Data Steward must validate names, Arabic labels, stable codes, ownership, parentage and pilot scope before seeding.

## Backend/frontend contract implications

Every organization/hierarchy DTO exposes stable code, bilingual names, level code/index, status/validity, parent/path, organization, revision and audit metadata according to caller authorization. UI never branches on labels or ltree paths.

## Tests and evidence

- Domain examples for another organization with different level names/depth.
- Shared-site scenario.
- Rename/move/retire historical interpretation examples.
- Policy exact-scope/ancestor/default examples.
- Product/Data Steward sign-off on candidate AD Ports hierarchy.

## Migration and rollback

No production data changes in O0. Record ADRs and unresolved decisions with owner/date. Rollback is document revision before O1.

## Exit gate

O0 passes when domain, security, data and product owners approve the model and no required behavior remains an implicit assumption.
