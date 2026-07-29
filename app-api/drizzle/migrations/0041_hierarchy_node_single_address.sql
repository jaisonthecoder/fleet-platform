-- Simplify hierarchy node location to a single free-text address (drop the
-- separate city/country columns added in 0040).
ALTER TABLE "fleet"."hierarchy_node" DROP COLUMN IF EXISTS "city";
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" DROP COLUMN IF EXISTS "country";
