CREATE TYPE "public"."fleet_vendor_source_mode" AS ENUM('Manual', 'Integrated');--> statement-breakpoint
CREATE TYPE "public"."fleet_vendor_status" AS ENUM('Draft', 'PendingApproval', 'Active', 'Suspended', 'Retired');--> statement-breakpoint
CREATE TYPE "public"."fleet_lease_contract_status" AS ENUM('Active', 'ExpiringSoon', 'Expired', 'Renewed', 'Terminated');--> statement-breakpoint
CREATE TABLE "fleet"."vendor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"trade_licence_number" text,
	"trade_licence_emirate" text,
	"tax_registration_number" text,
	"category_code" text NOT NULL,
	"primary_contact_name" text,
	"primary_contact_role" text,
	"primary_contact_email" text,
	"primary_contact_phone" text,
	"payment_terms" text,
	"currency" text DEFAULT 'AED' NOT NULL,
	"bank_iban_masked" text,
	"source_mode" "fleet_vendor_source_mode" DEFAULT 'Manual' NOT NULL,
	"source_system" text,
	"external_ref" text,
	"data_quality_flag" boolean DEFAULT false NOT NULL,
	"vendor_portal_enabled" boolean DEFAULT false NOT NULL,
	"status" "fleet_vendor_status" DEFAULT 'Draft' NOT NULL,
	"notes" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."lease_contract" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"vendor_id" uuid NOT NULL,
	"contract_ref" text NOT NULL,
	"scope_node_id" uuid,
	"monthly_amount" numeric(14, 2),
	"currency" text DEFAULT 'AED' NOT NULL,
	"start_date" date,
	"end_date" date,
	"off_hire_notice_days" numeric(5, 0),
	"early_termination_penalty" text,
	"renewal_options" text,
	"escalation_clause" text,
	"replacement_clause" text,
	"alert_ladder" text DEFAULT '90/60/30' NOT NULL,
	"status" "fleet_lease_contract_status" DEFAULT 'Active' NOT NULL,
	"renewed_into_contract_ref" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."lease_contract" ADD CONSTRAINT "lease_contract_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "fleet"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."lease_contract" ADD CONSTRAINT "lease_contract_scope_node_id_hierarchy_node_id_fk" FOREIGN KEY ("scope_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_trade_licence_uq" ON "fleet"."vendor" USING btree ("organization_id","trade_licence_number") WHERE "fleet"."vendor"."trade_licence_number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_external_ref_uq" ON "fleet"."vendor" USING btree ("organization_id","source_system","external_ref") WHERE "fleet"."vendor"."external_ref" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "vendor_category_idx" ON "fleet"."vendor" USING btree ("category_code");--> statement-breakpoint
CREATE INDEX "vendor_status_idx" ON "fleet"."vendor" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendor_source_mode_idx" ON "fleet"."vendor" USING btree ("source_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "lease_contract_ref_uq" ON "fleet"."lease_contract" USING btree ("organization_id","contract_ref");--> statement-breakpoint
CREATE INDEX "lease_contract_vendor_idx" ON "fleet"."lease_contract" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "lease_contract_end_date_idx" ON "fleet"."lease_contract" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "lease_contract_status_idx" ON "fleet"."lease_contract" USING btree ("status");--> statement-breakpoint
INSERT INTO fleet.lookup_type
  (code, label_en, label_ar, is_hierarchical, is_system)
VALUES
  ('vendor-category', 'Vendor Category', 'فئة المورد', false, true)
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
INSERT INTO fleet.lookup_value
  (lookup_type_id, code, label_en, label_ar, sort_order)
SELECT t.id, v.code, v.en, v.ar, v.ord
FROM fleet.lookup_type t
JOIN (VALUES
  ('vendor-category', 'LESSOR', 'Lessor', 'مؤجر', 0),
  ('vendor-category', 'REPAIR_MAINTENANCE', 'Repair & Maintenance', 'إصلاح وصيانة', 1),
  ('vendor-category', 'TELEMATICS', 'Telematics', 'أنظمة التتبع', 2),
  ('vendor-category', 'FUEL_SUPPLIER', 'Fuel Supplier', 'مورد وقود', 3),
  ('vendor-category', 'OTHER', 'Other', 'أخرى', 4)
) AS v(type_code, code, en, ar, ord)
  ON v.type_code = t.code
ON CONFLICT (lookup_type_id, code) DO NOTHING;
