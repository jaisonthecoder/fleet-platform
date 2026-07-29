CREATE UNIQUE INDEX "vendor_document_pending_uq" ON "fleet"."vendor_document" USING btree ("organization_id", "vendor_id", "document_type_code") WHERE "fleet"."vendor_document"."status" IN ('Uploaded', 'PendingConfirmation');--> statement-breakpoint
CREATE OR REPLACE FUNCTION fleet.vendor_document_validate_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  replacement fleet.vendor_document%ROWTYPE;
BEGIN
  IF NEW.superseded_by_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO replacement
  FROM fleet.vendor_document
  WHERE id = NEW.superseded_by_id;

  IF replacement.id IS NULL
     OR replacement.organization_id <> NEW.organization_id
     OR replacement.vendor_id <> NEW.vendor_id
     OR replacement.document_type_code <> NEW.document_type_code
     OR replacement.version <= NEW.version THEN
    RAISE EXCEPTION 'invalid vendor document lineage'
      USING ERRCODE = '23514',
            CONSTRAINT = 'vendor_document_lineage_valid';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER vendor_document_lineage_trg
BEFORE INSERT OR UPDATE OF superseded_by_id
ON fleet.vendor_document
FOR EACH ROW
EXECUTE FUNCTION fleet.vendor_document_validate_lineage();