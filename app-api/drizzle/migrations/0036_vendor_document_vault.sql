CREATE TYPE "public"."fleet_vendor_document_status" AS ENUM('Uploaded', 'PendingConfirmation', 'Confirmed', 'Superseded', 'Rejected');--> statement-breakpoint
CREATE TABLE "fleet"."vendor_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vendor_id" uuid NOT NULL,
	"document_type_code" text NOT NULL,
	"version" integer NOT NULL,
	"document_reference" text,
	"blob_ref" text NOT NULL,
	"issue_date" date,
	"expiry_date" date,
	"status" "fleet_vendor_document_status" DEFAULT 'PendingConfirmation' NOT NULL,
	"extracted_metadata" jsonb,
	"confirmed_metadata" jsonb,
	"confirmed_by_actor_ref" text,
	"confirmed_at_utc" timestamp with time zone,
	"superseded_by_id" uuid,
	"created_by_actor_ref" text NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_document_issue_expiry_valid" CHECK ("issue_date" IS NULL OR "expiry_date" IS NULL OR "expiry_date" >= "issue_date"),
	CONSTRAINT "vendor_document_confirmation_complete" CHECK ("status" <> 'Confirmed' OR ("confirmed_by_actor_ref" IS NOT NULL AND "confirmed_at_utc" IS NOT NULL))
);--> statement-breakpoint
ALTER TABLE "fleet"."vendor_document" ADD CONSTRAINT "vendor_document_vendor_org_fk" FOREIGN KEY ("organization_id", "vendor_id") REFERENCES "fleet"."vendor"("organization_id", "id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."vendor_document" ADD CONSTRAINT "vendor_document_superseded_by_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "fleet"."vendor_document"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_document_version_uq" ON "fleet"."vendor_document" USING btree ("organization_id", "vendor_id", "document_type_code", "version");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_document_current_confirmed_uq" ON "fleet"."vendor_document" USING btree ("organization_id", "vendor_id", "document_type_code") WHERE "fleet"."vendor_document"."status" = 'Confirmed';--> statement-breakpoint
CREATE INDEX "vendor_document_vendor_idx" ON "fleet"."vendor_document" USING btree ("organization_id", "vendor_id", "document_type_code", "version");--> statement-breakpoint
CREATE INDEX "vendor_document_expiry_idx" ON "fleet"."vendor_document" USING btree ("expiry_date") WHERE "fleet"."vendor_document"."status" = 'Confirmed';--> statement-breakpoint
INSERT INTO fleet.lookup_type
  (code, label_en, label_ar, is_hierarchical, is_system)
VALUES
  ('vendor-document-type', 'Vendor Document Type', 'نوع مستند المورد', false, true)
ON CONFLICT (code) DO NOTHING;--> statement-breakpoint
INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, description_en, description_ar, sort_order, metadata)
SELECT t.id, v.code, v.en, v.ar, v.description_en, v.description_ar, v.ord, v.metadata::jsonb
FROM fleet.lookup_type t
JOIN (VALUES
  ('vendor-document-type', 'TRADE_LICENCE', 'Trade licence', 'الرخصة التجارية', 'Expiry tracked; required before Vendor activation.', 'يتم تتبع الانتهاء؛ مطلوب قبل تنشيط المورد.', 0, '{"required":true,"tracksExpiry":true}'),
  ('vendor-document-type', 'LIABILITY_INSURANCE', 'Liability insurance certificate', 'شهادة تأمين المسؤولية', 'Coverage and expiry require human confirmation.', 'تتطلب التغطية والانتهاء تأكيداً بشرياً.', 1, '{"required":true,"tracksExpiry":true}'),
  ('vendor-document-type', 'MASTER_SERVICE_AGREEMENT', 'Master service agreement', 'اتفاقية الخدمات الرئيسية', 'Signed agreement referenced by contracts.', 'اتفاقية موقعة تشير إليها العقود.', 2, '{"required":true,"tracksExpiry":false}'),
  ('vendor-document-type', 'SIGNATORY_AUTHORIZATION', 'Signatory authorization', 'تفويض الموقّع', 'Optional signing-authority evidence.', 'دليل اختياري لصلاحية التوقيع.', 3, '{"required":false,"tracksExpiry":false}')
) AS v(type_code, code, en, ar, description_en, description_ar, ord, metadata)
  ON v.type_code = t.code
ON CONFLICT (lookup_type_id, code) DO NOTHING;