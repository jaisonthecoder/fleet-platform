ALTER TABLE "fleet"."bsd_return_window"
  ADD COLUMN IF NOT EXISTS "organization_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
  ADD COLUMN IF NOT EXISTS "confirmed_by_person_id" uuid,
  ADD COLUMN IF NOT EXISTS "confirmed_at_utc" timestamptz,
  ADD COLUMN IF NOT EXISTS "activated_at_utc" timestamptz,
  ADD COLUMN IF NOT EXISTS "completed_at_utc" timestamptz;
--> statement-breakpoint
ALTER TABLE "fleet"."bsd_return_window"
  ADD CONSTRAINT "bsd_window_status_valid" CHECK ("status" IN ('Proposed', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'Conflict')),
  ADD CONSTRAINT "bsd_window_range_valid" CHECK ("window_end" > "window_start"),
  ADD CONSTRAINT "bsd_window_confirmer_org_fk" FOREIGN KEY ("organization_id", "confirmed_by_person_id") REFERENCES "fleet"."person"("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "fleet"."bsd_return_window"
  ADD CONSTRAINT "bsd_window_no_overlap"
  EXCLUDE USING gist (
    "entitlement_request_id" WITH =,
    tstzrange("window_start", "window_end", '[)') WITH &&
  ) WHERE ("status" IN ('Proposed', 'Confirmed', 'Active'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fleet.validate_bsd_allocation_window()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM fleet.entitlement_allocation allocation
    WHERE allocation.entitlement_request_id = NEW.entitlement_request_id
      AND allocation.vehicle_id = NEW.vehicle_id
      AND allocation.status = 'Active'
      AND NEW.window_start >= allocation.effective_start::timestamptz
      AND NEW.window_end <= (allocation.effective_end + 1)::timestamptz
  ) THEN
    RAISE EXCEPTION 'BSD window must be contained by active allocation' USING ERRCODE = '23514', CONSTRAINT = 'bsd_window_inside_allocation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER bsd_window_allocation_guard_trg
BEFORE INSERT OR UPDATE OF window_start, window_end, vehicle_id, entitlement_request_id, status
ON fleet.bsd_return_window FOR EACH ROW EXECUTE FUNCTION fleet.validate_bsd_allocation_window();