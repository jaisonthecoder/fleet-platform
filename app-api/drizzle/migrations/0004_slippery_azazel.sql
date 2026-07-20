CREATE TABLE "fleet"."lookup_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"code" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"is_hierarchical" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."lookup_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"lookup_type_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"metadata" jsonb,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."user_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"entra_object_id" text NOT NULL,
	"person_id" uuid,
	"email" text,
	"display_name" text,
	"status" text DEFAULT 'Active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"is_service_account" boolean DEFAULT false NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "level_code" text;--> statement-breakpoint
ALTER TABLE "fleet"."hierarchy_node" ADD COLUMN "name_ar" text;--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD COLUMN "assigned_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "fleet"."lookup_value" ADD CONSTRAINT "lookup_value_lookup_type_id_lookup_type_id_fk" FOREIGN KEY ("lookup_type_id") REFERENCES "fleet"."lookup_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."lookup_value" ADD CONSTRAINT "lookup_value_parent_id_lookup_value_id_fk" FOREIGN KEY ("parent_id") REFERENCES "fleet"."lookup_value"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."user_account" ADD CONSTRAINT "user_account_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lookup_type_code_uq" ON "fleet"."lookup_type" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "lookup_value_type_code_uq" ON "fleet"."lookup_value" USING btree ("lookup_type_id","code");--> statement-breakpoint
CREATE INDEX "lookup_value_type_parent_idx" ON "fleet"."lookup_value" USING btree ("lookup_type_id","parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "user_account_entra_object_id_uq" ON "fleet"."user_account" USING btree ("entra_object_id");--> statement-breakpoint
ALTER TABLE "fleet"."role_assignment" ADD CONSTRAINT "role_assignment_assigned_by_person_id_person_id_fk" FOREIGN KEY ("assigned_by_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;