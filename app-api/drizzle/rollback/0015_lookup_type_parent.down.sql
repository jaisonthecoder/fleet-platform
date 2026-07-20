-- Compensating (down) migration for 0015_lookup_type_parent.
-- Drizzle migrations are forward-only (journal-tracked); this rollback lives
-- outside drizzle/migrations so the programmatic migrator never applies it.
-- Apply manually to revert: psql "$DATABASE_URL" -f drizzle/rollback/0015_lookup_type_parent.down.sql
DROP INDEX IF EXISTS "fleet"."lookup_type_parent_type_idx";
ALTER TABLE "fleet"."lookup_type" DROP CONSTRAINT IF EXISTS "lookup_type_parent_type_id_lookup_type_id_fk";
ALTER TABLE "fleet"."lookup_type" DROP COLUMN IF EXISTS "parent_type_id";
