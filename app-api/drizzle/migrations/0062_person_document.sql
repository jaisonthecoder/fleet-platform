-- 0062 — Centralized employee document store (licence, Emirates ID, medical,
-- training, other). Metadata only; binaries live in the private object store.
CREATE TABLE IF NOT EXISTS "fleet"."person_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid NOT NULL,
  "person_id" uuid NOT NULL,
  "doc_type_code" text NOT NULL,
  "document_reference" text,
  "blob_ref" text,
  "issue_date" date,
  "expiry_date" date,
  "version" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'Uploaded' NOT NULL,
  "uploaded_by" uuid,
  "created_at_utc" timestamptz DEFAULT now() NOT NULL,
  "updated_at_utc" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "person_document_status_valid" CHECK ("status" IN ('Uploaded', 'Confirmed', 'Superseded')),
  CONSTRAINT "person_document_org_fk" FOREIGN KEY ("organization_id") REFERENCES "fleet"."organization"("id"),
  CONSTRAINT "person_document_person_fk" FOREIGN KEY ("person_id") REFERENCES "fleet"."person"("id"),
  CONSTRAINT "person_document_uploaded_by_fk" FOREIGN KEY ("uploaded_by") REFERENCES "fleet"."person"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_document_person_type_idx"
  ON "fleet"."person_document" ("person_id", "doc_type_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_document_expiry_idx"
  ON "fleet"."person_document" ("expiry_date");
