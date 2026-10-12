# ADR-001 — PostgreSQL access and migrations: Prisma

| | |
|---|---|
| **Status** | Accepted · 04.09.2026 |
| **Context** | The Implementation Plan left "Prisma or TypeORM — pick one, stay with it" open. The LLD relies on per-transaction `set_config` for row-level security and on raw SQL for RLS policies, triggers and `SECURITY DEFINER` functions. |
| **Decision** | Use **Prisma** for schema modelling, generated types and application queries. Use **plain SQL migration files** (Prisma `migrate` with hand-edited SQL) for anything Prisma's schema language cannot express: enums with constraints, partial and expression indexes, triggers, RLS policies, functions, DB roles and grants. Every migration has a `down.sql`. |
| **Consequences** | End-to-end TypeScript types from DB to `shared-types`. RLS works because Prisma interactive transactions pin one connection. A pooler must run in transaction mode (see LLD §4.2). Raw SQL in migrations is reviewed like code. The team accepts that some DDL lives outside `schema.prisma`. |
| **Alternatives** | TypeORM (weaker type inference, decorators drift from DB); Knex/Kysely (no schema model). |
