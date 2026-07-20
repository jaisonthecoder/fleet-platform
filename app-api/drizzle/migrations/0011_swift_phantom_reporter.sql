CREATE TYPE "public"."fleet_entitlement_status" AS ENUM('Draft', 'PendingApproval', 'Approved', 'Allocated', 'Declined', 'Cancelled', 'Expired');--> statement-breakpoint
CREATE TABLE "fleet"."bsd_return_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"entitlement_request_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"reason" text,
	"status" text DEFAULT 'Proposed' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."entitlement_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"request_type" text NOT NULL,
	"requester_person_id" uuid NOT NULL,
	"justification_category" text NOT NULL,
	"justification_text" text NOT NULL,
	"vehicle_category_code" text,
	"vehicle_id" uuid,
	"duration_start" date,
	"duration_end" date,
	"location_node_id" uuid,
	"business_unit" text,
	"cost_centre" text,
	"status" "fleet_entitlement_status" DEFAULT 'Draft' NOT NULL,
	"workflow_instance_id" uuid,
	"policy_version" text,
	"eligibility_result" jsonb,
	"consent_signed_at_utc" timestamp with time zone,
	"consent_document_version" text,
	"consent_signature_ref" text,
	"allocated_at_utc" timestamp with time zone,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."bsd_return_window" ADD CONSTRAINT "bsd_return_window_entitlement_request_id_entitlement_request_id_fk" FOREIGN KEY ("entitlement_request_id") REFERENCES "fleet"."entitlement_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."bsd_return_window" ADD CONSTRAINT "bsd_return_window_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request" ADD CONSTRAINT "entitlement_request_requester_person_id_person_id_fk" FOREIGN KEY ("requester_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request" ADD CONSTRAINT "entitlement_request_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."entitlement_request" ADD CONSTRAINT "entitlement_request_location_node_id_hierarchy_node_id_fk" FOREIGN KEY ("location_node_id") REFERENCES "fleet"."hierarchy_node"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bsd_window_entitlement_idx" ON "fleet"."bsd_return_window" USING btree ("entitlement_request_id");--> statement-breakpoint
CREATE INDEX "entitlement_requester_idx" ON "fleet"."entitlement_request" USING btree ("requester_person_id");--> statement-breakpoint
CREATE INDEX "entitlement_status_idx" ON "fleet"."entitlement_request" USING btree ("status");