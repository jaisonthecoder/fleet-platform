CREATE TABLE "fleet"."booking_policy_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"booking_id" uuid NOT NULL,
	"decision_key" text NOT NULL,
	"correlation_id" text NOT NULL,
	"provenance" jsonb NOT NULL,
	"recorded_at_utc" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fleet"."booking_policy_decision" ADD CONSTRAINT "booking_policy_decision_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "fleet"."booking"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_org_id_uq" ON "fleet"."booking" USING btree ("organization_id","id");
--> statement-breakpoint
ALTER TABLE "fleet"."booking_policy_decision" ADD CONSTRAINT "booking_policy_decision_booking_same_org_fk" FOREIGN KEY ("organization_id","booking_id") REFERENCES "fleet"."booking"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_policy_decision_request_uq" ON "fleet"."booking_policy_decision" USING btree ("booking_id","decision_key","correlation_id");
--> statement-breakpoint
CREATE INDEX "booking_policy_decision_booking_idx" ON "fleet"."booking_policy_decision" USING btree ("booking_id","recorded_at_utc");