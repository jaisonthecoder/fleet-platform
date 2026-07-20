CREATE TYPE "public"."fleet_compliance_item_status" AS ENUM('Valid', 'ExpiringSoon', 'Expired');--> statement-breakpoint
CREATE TABLE "fleet"."access_block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"person_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"blocked_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at_utc" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fleet"."compliance_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"subject_type" text NOT NULL,
	"subject_ref" uuid NOT NULL,
	"item_type" text NOT NULL,
	"status" "fleet_compliance_item_status" DEFAULT 'Valid' NOT NULL,
	"expiry_date" date,
	"next_alert_at" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."eligibility_evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"driver_person_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"reasons" text[],
	"policy_version" text,
	"data_as_of" timestamp with time zone,
	"evaluated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."access_block" ADD CONSTRAINT "access_block_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_block_person_idx" ON "fleet"."access_block" USING btree ("person_id","active");--> statement-breakpoint
CREATE INDEX "compliance_item_subject_idx" ON "fleet"."compliance_item" USING btree ("subject_type","subject_ref");--> statement-breakpoint
CREATE INDEX "compliance_item_expiry_idx" ON "fleet"."compliance_item" USING btree ("expiry_date") WHERE "fleet"."compliance_item"."status" <> 'Expired';--> statement-breakpoint
CREATE INDEX "compliance_item_next_alert_idx" ON "fleet"."compliance_item" USING btree ("next_alert_at");--> statement-breakpoint
CREATE INDEX "eligibility_evaluation_driver_idx" ON "fleet"."eligibility_evaluation" USING btree ("driver_person_id","evaluated_at_utc");