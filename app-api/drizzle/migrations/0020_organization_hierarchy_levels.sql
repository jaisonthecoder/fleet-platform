CREATE TABLE "fleet"."organization_hierarchy_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"code" text NOT NULL,
	"position" integer NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."organization_hierarchy_level" ADD CONSTRAINT "organization_hierarchy_level_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_hierarchy_level_org_code_uq" ON "fleet"."organization_hierarchy_level" USING btree ("organization_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_hierarchy_level_org_position_uq" ON "fleet"."organization_hierarchy_level" USING btree ("organization_id","position");
--> statement-breakpoint
ALTER TABLE "fleet"."organization_hierarchy_level" ADD CONSTRAINT "organization_hierarchy_level_position_range" CHECK ("position" >= 0 AND "position" < 5);
--> statement-breakpoint
ALTER TABLE "fleet"."organization_hierarchy_level" ADD CONSTRAINT "organization_hierarchy_level_revision_positive" CHECK ("revision" > 0);
--> statement-breakpoint
INSERT INTO "fleet"."organization_hierarchy_level" ("organization_id","code","position","label_en","label_ar","mandatory")
SELECT o.id, v.code, v.position, v.label_en, v.label_ar, v.mandatory
FROM fleet.organization o
CROSS JOIN (VALUES
  ('GROUP',0,'Group','مجموعة',true),
  ('CLUSTER',1,'Cluster','مجموعة فرعية',true),
  ('POOL',2,'Pool','مجمع',true),
  ('LOCATION',3,'Location','موقع',false)
) AS v(code,position,label_en,label_ar,mandatory)
ON CONFLICT (organization_id,code) DO NOTHING;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD CONSTRAINT "hierarchy_node_level_definition_fk" FOREIGN KEY ("organization_id","level_code") REFERENCES "fleet"."organization_hierarchy_level"("organization_id","code") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."organization_hierarchy_level_bump_revision"() RETURNS trigger AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  NEW.updated_at_utc := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "organization_hierarchy_level_bump_revision_trg"
BEFORE UPDATE ON "fleet"."organization_hierarchy_level"
FOR EACH ROW EXECUTE FUNCTION "fleet"."organization_hierarchy_level_bump_revision"();