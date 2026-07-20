CREATE TABLE "fleet"."telemetry" (
	"time" timestamp with time zone NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"device_id" text,
	"lat" double precision,
	"lon" double precision,
	"speed" double precision,
	"ignition" boolean,
	"odometer" double precision,
	"fuel_level" double precision,
	"dtc_codes" text[],
	"device_health" jsonb
);
--> statement-breakpoint
CREATE INDEX "telemetry_vehicle_time_idx" ON "fleet"."telemetry" USING btree ("vehicle_id","time");--> statement-breakpoint
SELECT create_hypertable('fleet.telemetry', 'time', if_not_exists => TRUE, migrate_data => TRUE);