-- Reverses 20260913000000_lookup_sort_and_metadata.
-- Both columns are additive and nothing keys off them, so dropping them loses
-- only the notes an administrator typed.

DROP INDEX IF EXISTS "lookup_category_sort_order_name_idx";
ALTER TABLE "lookup_item" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "lookup_category" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "lookup_category" DROP COLUMN IF EXISTS "sort_order";
