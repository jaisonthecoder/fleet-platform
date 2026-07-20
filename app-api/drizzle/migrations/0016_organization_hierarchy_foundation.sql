ALTER TABLE "fleet"."organization" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "code" text;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "fleet"."hierarchy_node"
SET
  "code" = CASE "id"
    WHEN 'a0000000-0000-4000-8000-000000000001'::uuid THEN 'ADPORTS'
    WHEN 'a0000000-0000-4000-8000-000000000002'::uuid THEN 'PORTS'
    WHEN 'a0000000-0000-4000-8000-000000000003'::uuid THEN 'PORTS-KHALIFA'
    WHEN 'a0000000-0000-4000-8000-000000000004'::uuid THEN 'LOC-KEZAD-280'
    ELSE upper(regexp_replace("path"::text, '[^a-zA-Z0-9]+', '-', 'g'))
  END,
  "level_code" = coalesce("level_code", upper("level_label")),
  "name_ar" = coalesce("name_ar", "name"),
  "updated_at_utc" = now()
WHERE "code" IS NULL OR "level_code" IS NULL OR "name_ar" IS NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ALTER COLUMN "code" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_code_uq" ON "fleet"."organization" USING btree ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX "hierarchy_node_org_code_uq" ON "fleet"."hierarchy_node" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "hierarchy_node_org_path_uq" ON "fleet"."hierarchy_node" USING btree ("organization_id","path");
--> statement-breakpoint
ALTER TABLE "fleet"."organization" ADD CONSTRAINT "organization_revision_positive" CHECK ("revision" > 0);
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_level_nonnegative" CHECK ("level_index" >= 0);
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_revision_positive" CHECK ("revision" > 0);
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_valid_window" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");