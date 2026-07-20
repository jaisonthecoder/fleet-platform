-- Compensating (down) migration for 0013_lookup_value_retiring.
-- Drizzle migrations are forward-only (journal-tracked); this rollback lives
-- outside drizzle/migrations so the programmatic migrator never applies it.
-- Apply manually to revert: psql "$DATABASE_URL" -f drizzle/rollback/0013_lookup_value_retiring.down.sql
ALTER TABLE "fleet"."lookup_value" DROP COLUMN IF EXISTS "retiring";
