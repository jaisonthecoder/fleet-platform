-- ---------------------------------------------------------------------------
-- Two fields the lookup administration screen needs.
--
-- `sort_order` on a category lets an administrator put the lists people use
-- most at the top of the rail, instead of relying on alphabetical order.
--
-- `metadata` is an inert notes field: governance or integration context that
-- travels with the record. Nothing reads it and nothing may key behaviour off
-- it - the moment a rule is derived from this column it has become the
-- unlimited custom attribute the lookup plan rules out.
-- ---------------------------------------------------------------------------

ALTER TABLE "lookup_category" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "lookup_category" ADD COLUMN "metadata" JSONB;
ALTER TABLE "lookup_item" ADD COLUMN "metadata" JSONB;

CREATE INDEX "lookup_category_sort_order_name_idx" ON "lookup_category"("sort_order", "name");
