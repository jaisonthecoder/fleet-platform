CREATE OR REPLACE FUNCTION "fleet"."reject_changed_consent_content"() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
    OR NEW."domain" IS DISTINCT FROM OLD."domain"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."content_en" IS DISTINCT FROM OLD."content_en"
    OR NEW."content_ar" IS DISTINCT FROM OLD."content_ar"
    OR NEW."content_sha256" IS DISTINCT FROM OLD."content_sha256"
    OR NEW."effective_at_utc" IS DISTINCT FROM OLD."effective_at_utc"
    OR NEW."created_by_person_id" IS DISTINCT FROM OLD."created_by_person_id"
    OR NEW."created_at_utc" IS DISTINCT FROM OLD."created_at_utc" THEN
    RAISE EXCEPTION 'immutable consent content cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "consent_template_content_immutable_trg" ON "fleet"."consent_template";
--> statement-breakpoint
CREATE TRIGGER "consent_template_content_immutable_trg"
  BEFORE UPDATE ON "fleet"."consent_template"
  FOR EACH ROW EXECUTE FUNCTION "fleet"."reject_changed_consent_content"();
