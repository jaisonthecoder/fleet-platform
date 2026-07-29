-- N-level hierarchy: remove the hard five-level ceiling on the level taxonomy.
-- Positions stay zero-based and unique per organization; depth is now unbounded.
ALTER TABLE "fleet"."organization_hierarchy_level" DROP CONSTRAINT IF EXISTS "organization_hierarchy_level_position_range";
--> statement-breakpoint
ALTER TABLE "fleet"."organization_hierarchy_level" ADD CONSTRAINT "organization_hierarchy_level_position_range" CHECK ("position" >= 0);
