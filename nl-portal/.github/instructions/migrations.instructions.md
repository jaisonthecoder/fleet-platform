---
applyTo: "apps/noatum-customer-portal-api/prisma/**"
description: Migrations — RLS, forward-only, reversible
---

# Migration rules (apps/noatum-customer-portal-api/prisma)

## Never migrate at application startup

The pipeline runs `prisma migrate deploy` as a step **before** the app deploy, using
`DATABASE_MIGRATION_URL` (owner role). The running app uses `DATABASE_URL` (the limited
`app_api` role) and cannot alter the schema.

## Every table, without exception

CLAUDE.md rule 1 and DoD item 1: **no table ships without a policy.** In the same
migration that creates the table:

- **Pattern A** (single owner — quotes, bookings, users, templates, addresses, invoices):
  `customer_group_id uuid NOT NULL` + an index on it + `ENABLE` and `FORCE ROW LEVEL
  SECURITY` + a policy of the shape
  `app.is_internal() OR app.is_system() OR customer_group_id = ANY (app.group_ids())`
  with the same `WITH CHECK`.
- **Pattern B** (the shipment family): no `customer_group_id`. The policy is an `EXISTS`
  on `shipment_visibility`; child tables join through `shipment_id`.
- **Reference or internal-only tables**: still need a policy — an internal-only one — and

`FORCE` matters as much as `ENABLE`: without it the table owner bypasses the policy.

## Forward-only and reversible

- ADR-001: every migration has a **`down.sql`**.
- Once a migration has been applied it is **frozen**. Fix a problem with a *new*
  migration. Editing an applied file leaves every database that already ran it out of
  step with the repo, silently.

## Prisma cannot express these — write them as SQL

Enums with constraints, partial and expression indexes, triggers, RLS policies,
`SECURITY DEFINER` functions, database roles and grants. Generate the migration with
`migrate:create`, then hand-edit it to add them.

## Roles

`app_api` (API and in-process jobs, request context) and `app_worker` (system context,
DELETE revoked on tenant tables). `app_api` must be pinned with
`ALTER ROLE app_api SET app.is_system = 'false'` so a request can never claim system
context. Migrations run as the owner.

## Verify before you commit

```bash
pnpm lint && pnpm typecheck && pnpm test
```

The per-table invariants above are checked in review, not mechanically. Read the
migration against the Pattern A / Pattern B checklist before you open the PR.
