---
applyTo: "apps/noatum-customer-portal-api/src/**/*.ts"
description: NestJS API — tenancy, permissions, adapters, jobs
---

# API rules (apps/noatum-customer-portal-api)

`CLAUDE.md` holds the six foundation rules. These are the ones that bite here.

## Tenancy — the highest-risk rule in the platform

- All customer data goes through **`TenantRepository`**. Never inject `PrismaService` or
  import `PrismaClient` in a feature module; the `tenant-access` check fails the build,
  and its allowlist is deliberately tiny.
- `TenantRepository.withTenant(ctx, fn)` opens a transaction and sets `app.group_ids`,
  `app.user_id`, `app.is_internal`, `app.permissions` for its duration. RLS reads those.
  They are transaction-local, so nothing leaks between pooled requests.
- **Never read `customer_group_id` from a request** — body, query or header. It comes from
  the validated Entra token via `TenantContext` (invariant I9).
- Cross-tenant reads return **404, never 403**. A 403 confirms the row exists.

## Permissions

Every route carries `@RequirePermission(PERMISSIONS.X)` with a **constant** from
`@/contracts`, never a literal. `@Public()` and `@AuthenticatedOnly()` are the
only alternatives, both narrow and documented where they are defined. Roles are named
sets of permission codes — **never check a role in code**, only a permission.

## Module shape

One folder per module under `src/modules/<name>/`: `<name>.module.ts`, `.controller.ts`,
`.service.ts`, `.repository.ts`, `dto/`, `entities/`, `.spec.ts`.

Controllers are thin: validate with the zod schema from `@/contracts`, call the
service, return a DTO. Business rules in services, data access in repositories. Status
machines get their own `*.status.ts` with a test per transition.

## Talking to the outside world

- CW1 XML lives **only** in `src/integration/cw1/`. Feature modules depend on the
  abstract `Tms*Adapter` interfaces, never on XML or an HTTP client.
- Everything external runs as a **job** in the `integration` module, enqueued in the same
  transaction as the business write.
- **One exception**: `RateEngineAdapter` is called synchronously from `quotes.service`
  with a 25 s timeout, because an instant quote must answer inside 30 s. On timeout, fall
  through to the manual path — a rating failure is a quote state, not an HTTP error.
- Jobs are idempotent; dedupe on `source_message_id + portal_ref`.
- Never write a CW1 code in TypeScript. Codes live in `mapping_*` tables.

## Every write

Business-significant writes emit an `AuditEvent` (with `impersonator_user_id` when
someone is impersonating); user actions emit an `AnalyticsEvent`. Both tables are
insert-only for the application roles. Integration failures never reach the customer as
an error — the entity keeps its last consistent state and ops are alerted.

## Before adding a table

Check `docs/Simplification-Register.md`. Phase 1 went from 27 tables to 15 on purpose.
A nullable column, a view or a config constant usually does the job.
