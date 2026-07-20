CREATE TYPE "public"."fleet_booking_status" AS ENUM('Draft', 'PendingApproval', 'Approved', 'Active', 'Completed', 'Declined', 'Cancelled', 'Expired', 'NoShow');--> statement-breakpoint
CREATE TYPE "public"."fleet_consent_event" AS ENUM('Signed', 'Voided', 'ReConsented');--> statement-breakpoint
CREATE TABLE "fleet"."booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"booking_number" text,
	"vehicle_id" uuid NOT NULL,
	"driver_person_id" uuid NOT NULL,
	"requested_by_person_id" uuid NOT NULL,
	"status" "fleet_booking_status" DEFAULT 'Draft' NOT NULL,
	"pickup_at_utc" timestamp with time zone NOT NULL,
	"return_at_utc" timestamp with time zone NOT NULL,
	"reservation_start" timestamp with time zone NOT NULL,
	"reservation_end" timestamp with time zone NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"destination" text,
	"purpose" text,
	"passenger_count" integer,
	"consent_record_id" uuid,
	"workflow_instance_id" uuid,
	"policy_version" text,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."booking_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"detail" jsonb,
	"actor_ref" text,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."consent_lifecycle_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"consent_record_id" uuid,
	"event_type" "fleet_consent_event" NOT NULL,
	"reason" text,
	"at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."consent_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"booking_id" uuid NOT NULL,
	"driver_person_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"vehicle_category_code" text,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"policy_version" text,
	"consent_document_version" text NOT NULL,
	"signature_ref" text,
	"employee_id" text,
	"ip" text,
	"device" text,
	"signed_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fleet"."waitlist_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"driver_person_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"pickup_at_utc" timestamp with time zone NOT NULL,
	"return_at_utc" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'Waiting' NOT NULL,
	"created_at_utc" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."booking" ADD CONSTRAINT "booking_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."booking" ADD CONSTRAINT "booking_driver_person_id_person_id_fk" FOREIGN KEY ("driver_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."booking" ADD CONSTRAINT "booking_requested_by_person_id_person_id_fk" FOREIGN KEY ("requested_by_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."booking_event" ADD CONSTRAINT "booking_event_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."consent_lifecycle_event" ADD CONSTRAINT "consent_lifecycle_event_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."consent_lifecycle_event" ADD CONSTRAINT "consent_lifecycle_event_consent_record_id_consent_record_id_fk" FOREIGN KEY ("consent_record_id") REFERENCES "fleet"."consent_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."consent_record" ADD CONSTRAINT "consent_record_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."consent_record" ADD CONSTRAINT "consent_record_driver_person_id_person_id_fk" FOREIGN KEY ("driver_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."consent_record" ADD CONSTRAINT "consent_record_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."waitlist_entry" ADD CONSTRAINT "waitlist_entry_driver_person_id_person_id_fk" FOREIGN KEY ("driver_person_id") REFERENCES "fleet"."person"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fleet"."waitlist_entry" ADD CONSTRAINT "waitlist_entry_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "fleet"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_number_uq" ON "fleet"."booking" USING btree ("booking_number") WHERE "fleet"."booking"."booking_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "booking_vehicle_status_idx" ON "fleet"."booking" USING btree ("vehicle_id","status");--> statement-breakpoint
CREATE INDEX "booking_driver_idx" ON "fleet"."booking" USING btree ("driver_person_id");--> statement-breakpoint
CREATE INDEX "booking_requested_by_idx" ON "fleet"."booking" USING btree ("requested_by_person_id");--> statement-breakpoint
CREATE INDEX "booking_event_booking_idx" ON "fleet"."booking_event" USING btree ("booking_id","at_utc");--> statement-breakpoint
CREATE INDEX "consent_lifecycle_booking_idx" ON "fleet"."consent_lifecycle_event" USING btree ("booking_id","at_utc");--> statement-breakpoint
CREATE INDEX "consent_record_booking_idx" ON "fleet"."consent_record" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "waitlist_driver_idx" ON "fleet"."waitlist_entry" USING btree ("driver_person_id");--> statement-breakpoint
-- Hand-authored (drizzle-kit cannot emit exclusion constraints):
-- A vehicle cannot have two overlapping bookings while either is in an ACTIVE
-- (reserved) status. Availability and commit share this one reservation range,
-- so double-booking is structurally impossible; a concurrent overlap raises
-- exclusion_violation (23P01) → mapped to HTTP 409 (P1B-R2-1). Draft/Declined/
-- Cancelled/Completed/Expired/NoShow bookings are excluded, so they hold nothing.
ALTER TABLE "fleet"."booking"
  ADD CONSTRAINT "booking_no_double_book"
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(reservation_start, reservation_end) WITH &&
  ) WHERE (status IN ('PendingApproval', 'Approved', 'Active'));