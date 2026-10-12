# Migrations

SQL migrations for the API. They are the only way the schema changes.

## Rules

- **Never migrate at application startup.** The pipeline runs `prisma migrate deploy` as a
  dedicated step before the app deploy, using `DATABASE_MIGRATION_URL` (owner role). The running
  app uses `DATABASE_URL` (limited role) and cannot alter the schema.
- **Enums, RLS policies, functions and grants are explicit SQL.** Prisma does not model them.
  Hand-write them in a migration rather than relying on the generated diff.
- **Every new table holding customer data needs, in the same migration:** a `customer_group_id`
  column, `ENABLE`/`FORCE ROW LEVEL SECURITY`, a `_tenant_isolation` policy, and grants for
  `portal_app`. Add a matching case to `apps/noatum-customer-portal-api/test/isolation`.
- Migrations are forward-only. Fix a bad migration with a new one; never edit an applied file.

## Workflow

```bash
# 1. change prisma/schema.prisma
# 2. generate the SQL without applying it, so you can review and extend it
pnpm --filter noatum-customer-portal-api migrate:create --name add_shipment_tables
# 3. hand-edit the generated migration.sql to add RLS, policies and grants
# 4. apply locally
pnpm --filter noatum-customer-portal-api migrate
```

## Files

| Migration | What it does |
| --- | --- |
| `20260101000000_tenancy_roles_rls` | Roles (`portal_owner`, `portal_app`), `app.current_group()` / `app.is_internal()` / `app.require_group()`, RLS policies for every tenant-scoped table, grants, `pgboss` schema. |
