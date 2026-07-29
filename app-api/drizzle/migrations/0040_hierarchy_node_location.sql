-- Location for hierarchy nodes: optional geo-coordinates and postal address so a
-- node (pool/location/etc.) can be pinned on a map or entered manually.
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "latitude" double precision;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "longitude" double precision;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "address" text;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "city" text;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "country" text;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90));
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180));
