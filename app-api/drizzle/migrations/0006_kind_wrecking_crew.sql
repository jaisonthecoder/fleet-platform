CREATE TYPE "public"."fleet_import_batch_status" AS ENUM('Staged', 'Validated', 'SignedOff', 'Committed', 'Rejected');--> statement-breakpoint
CREATE TYPE "public"."fleet_import_row_status" AS ENUM('Pending', 'Valid', 'Invalid', 'Duplicate', 'NeedsResolution', 'Committed');--> statement-breakpoint
CREATE TABLE "fleet"."dedup_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_id" uuid NOT NULL,
	"match_type" text NOT NULL,
	"match_value" text NOT NULL,
	"existing_vehicle_id" uuid,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"source" text NOT NULL,
	"uploaded_by_ref" text,
	"status" "fleet_import_batch_status" DEFAULT 'Staged' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"completeness_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"signed_off_by_ref" text,
	"signed_off_at" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."import_row" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"status" "fleet_import_row_status" DEFAULT 'Pending' NOT NULL,
	"reason" text,
	"committed_vehicle_id" uuid,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."dedup_candidate" ADD CONSTRAINT "dedup_candidate_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "fleet"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."dedup_candidate" ADD CONSTRAINT "dedup_candidate_row_id_import_row_id_fk" FOREIGN KEY ("row_id") REFERENCES "fleet"."import_row"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."import_row" ADD CONSTRAINT "import_row_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "fleet"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dedup_candidate_batch_idx" ON "fleet"."dedup_candidate" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "import_row_batch_idx" ON "fleet"."import_row" USING btree ("batch_id","status");