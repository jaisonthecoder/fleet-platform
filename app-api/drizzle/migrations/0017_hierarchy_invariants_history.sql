UPDATE "fleet"."hierarchy_node"
SET
  "level_code" = coalesce(nullif(trim("level_code"), ''), upper("level_label")),
  "name_ar" = coalesce(nullif(trim("name_ar"), ''), "name"),
  "updated_at_utc" = now();
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ALTER COLUMN "level_code" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ALTER COLUMN "name_ar" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "fleet"."hierarchy_change_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"node_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_ref" text NOT NULL,
	"reason" text,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"correlation_id" text,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_change_event" ADD CONSTRAINT "hierarchy_change_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_change_event" ADD CONSTRAINT "hierarchy_change_event_node_id_hierarchy_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "hierarchy_change_event_node_idx" ON "fleet"."hierarchy_change_event" USING btree ("node_id","at_utc");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."hierarchy_node_validate"() RETURNS trigger AS $$
DECLARE
  v_parent fleet.hierarchy_node%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'hierarchy-self-parent' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_parent FROM fleet.hierarchy_node WHERE id = NEW.parent_id FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'hierarchy-parent-not-found' USING ERRCODE = '23503';
    END IF;
    IF v_parent.organization_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'hierarchy-parent-organization-mismatch' USING ERRCODE = '23514';
    END IF;
    IF NEW.level_index <> v_parent.level_index + 1 THEN
      RAISE EXCEPTION 'hierarchy-level-progression-invalid' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND v_parent.path <@ OLD.path THEN
      RAISE EXCEPTION 'hierarchy-cycle-detected' USING ERRCODE = '23514';
    END IF;
    IF nlevel(NEW.path) <> nlevel(v_parent.path) + 1 OR NOT (v_parent.path @> NEW.path) THEN
      RAISE EXCEPTION 'hierarchy-path-parent-mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "hierarchy_node_validate_trg"
BEFORE INSERT OR UPDATE OF parent_id, organization_id, level_index, path
ON "fleet"."hierarchy_node"
FOR EACH ROW EXECUTE FUNCTION "fleet"."hierarchy_node_validate"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "fleet"."bump_revision"() RETURNS trigger AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  NEW.updated_at_utc := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "organization_bump_revision_trg"
BEFORE UPDATE ON "fleet"."organization"
FOR EACH ROW EXECUTE FUNCTION "fleet"."bump_revision"();
--> statement-breakpoint
CREATE TRIGGER "hierarchy_node_bump_revision_trg"
BEFORE UPDATE ON "fleet"."hierarchy_node"
FOR EACH ROW EXECUTE FUNCTION "fleet"."bump_revision"();