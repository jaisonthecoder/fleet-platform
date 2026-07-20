# O4 - Scope Authorization and Query Propagation

## Objective

Make organization and hierarchy scope enforceable server-side and propagate authorized scope through the UI and every scoped domain query.

## Owners and dependencies

- Primary: Backend and Security Engineers
- Contributors: Frontend, Domain owners, QA, SRE
- Depends on: O2 and O3

## Principal and authentication

Add `organizationId` and role-assignment generation/freshness metadata to Principal. AuthGuard builds Principal from linked person/account and active role assignments. Role changes invalidate/reload authorization promptly; session-long stale roles are not accepted.

## Authorized scope service

Implement reusable operations:

- Validate node belongs to Principal organization and is active/effective.
- Compute authorized closure from role assignments and hierarchy ancestry/descendants.
- Check role at exact scope, ancestor scope or organization-wide according to operation policy.
- Resolve resource scope for booking, vehicle, entitlement, fine, workflow and dashboard.
- Return manageable scopes for SystemAdmin/policy publisher according to role model.

Use DB ltree queries or bounded cached closure with organization/generation-aware keys.

## Authorization pattern

`RolesGuard` remains coarse route admission. Services or a scope guard/decorator enforce resource scope after loading the resource; never trust a client `scopeId`. Define explicit policies such as `read-subtree`, `manage-exact-scope`, `approve-resource-scope`, and `organization-admin`.

## Read contracts

- Normal `GET /hierarchy`: only authorized nodes and required ancestors for tree context.
- SystemAdmin admin hierarchy: full organization tree.
- `GET /me`: organization, roles/scopes, authorized default/home scope and authorization generation.
- Scope-selection endpoint/metadata distinguishes selectable, inherited/context-only and organization-wide scopes.

## Query propagation

Connect selected scope to TanStack query keys and API `scopeId` for dashboards and future fleet/fines/operations pages. Backend revalidates every scope. Clear/replace persisted UI scope after role revocation, node retirement, organization change or missing authorization. `All scopes` appears only with organization-wide permission.

## Repository hardening

Filter hierarchy, audit, access review, people, role, vehicle, lookup, dashboard, policy and workflow reads/writes by organization. Add cross-organization consistency validation where FK alone cannot enforce it. Scope policy/lookup/decision cache keys by organization and generation.

## Domain enforcement priority

1. Hierarchy and admin reads.
2. Dashboard arbitrary `scopeId` reads.
3. Role assignment/revocation.
4. Vehicle writes/transfers.
5. Booking/entitlement approvals.
6. Fines/compliance/handover.
7. Workflow task authorization.
8. Policy draft/deployment scope management.

## Tests

Two-organization fixtures; authorized closure/property tests; cross-org and cross-scope 403/404 behavior; dashboard scope bypass; role revoke freshness; unauthorized persisted UI scope; cache-key collision; concurrent role assignment/SoD; audit organization partition; every domain resource-scope matrix.

## Migration and rollback

Additive Principal/API changes require backward-compatible response evolution. Feature flags can enforce scope per module incrementally, with deny/audit shadow mode before hard enforcement. Never roll back organization filtering after multi-org data exists.

## Exit gate

O4 passes when arbitrary hierarchy/scope IDs cannot expose or mutate unauthorized data, role changes propagate within the approved window, and all scoped query contracts are server-validated.
