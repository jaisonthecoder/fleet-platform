# O3 - Organization Administration Backend

## Objective

Deliver authenticated, audited organization settings and hierarchy read/write APIs following existing NestJS module, Zod contract, repository and transaction conventions.

## Owners and dependencies

- Primary: Backend Engineer (NestJS)
- Contributors: Database, Architecture, Security, QA, SRE
- Depends on: O2
- Roles: SystemAdmin writes; scoped read contract for normal users; InternalAudit history read

## Module structure

Create `modules/organization-administration/` with controller, service, repository and pure validation/internal helpers. Import PlatformModule for audit/access and MessagingModule for outbox. Keep normal authorized hierarchy reads in PlatformModule or a shared hierarchy read service; do not duplicate tree logic.

## Contracts and endpoints

- `GET /api/v1/hierarchy`: authorized current tree only, enriched with code/nameAr/levelCode.
- `GET /api/v1/admin/organization`: settings and hierarchy generation/health.
- `PATCH /api/v1/admin/organization`: update approved settings with expected revision.
- `GET /api/v1/admin/hierarchy?asOf=`: full current/historical tree.
- `GET /api/v1/admin/hierarchy/nodes/:id`: node detail, audit metadata and dependency counts.
- `GET /api/v1/admin/hierarchy/nodes/:id/impact?operation=&targetParentId=`: create/move/retire preview.
- `POST /api/v1/admin/hierarchy/nodes`: create child/root as permitted.
- `PATCH /api/v1/admin/hierarchy/nodes/:id`: rename/metadata update with expected revision.
- `POST /api/v1/admin/hierarchy/nodes/:id/move`: guarded subtree move using impact token and expected generation.
- `POST /api/v1/admin/hierarchy/nodes/:id/retire`: effective retire with reason/impact token.
- `POST /api/v1/admin/hierarchy/nodes/:id/reactivate`: validated reactivation.
- `GET /api/v1/admin/hierarchy/nodes/:id/history`: change timeline.

All contracts include organization, stable code, bilingual names, level, path, status/validity, parent, revision/generation and stable reason codes.

## Transaction behavior

Every write performs validation, domain mutation/history event, central hash-chain audit, outbox event and generation increment in one Postgres transaction. Map unique/FK/check/exclusion/deadlock errors to RFC-7807 4xx responses.

## Impact preview

Counts and references for active child nodes, people/home scopes, roles, vehicles, entitlements, workflow instances/tasks, policy drafts/bindings/deployments, dashboards/exports and future-effective changes. Preview returns a short-lived checksum/token tied to hierarchy revision and requested action; write rejects stale previews.

## Events

`OrganizationSettingsChanged`, `HierarchyNodeCreated`, `HierarchyNodeRenamed`, `HierarchySubtreeMoved`, `HierarchyNodeRetired`, `HierarchyNodeReactivated`. Consumers invalidate hierarchy, scope, dashboard and decision-resolution caches idempotently.

## Security

SystemAdmin authorization, organization match, optimistic revisions, mandatory reason for move/retire/reactivate, request limits, no client-authored path, audit actor from Principal, and no direct DB administration path.

## Tests

Controller validation/RBAC; service create/rename/move/retire/reactivate; cycle/cross-org/level/duplicate/stale-impact rejection; transaction rollback; audit/outbox atomicity; historical read; concurrent writes; HTTP 401/403; error mapping.

## Migration and rollback

O3 depends only on additive O2 schema. Application rollback leaves additive storage intact. Write capability is feature-flagged until O4/O5 verification; read endpoints remain backward compatible.

## Exit gate

O3 passes when hierarchy can be managed without direct SQL, all writes are history-safe/audited/atomic, and API/contract/security evidence is approved.
