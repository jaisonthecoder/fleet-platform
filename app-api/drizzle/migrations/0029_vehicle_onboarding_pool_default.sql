-- V1 onboarding: new records remain non-bookable until compliance is verified.
ALTER TABLE "fleet"."vehicle"
  ALTER COLUMN "booking_pool_flag" SET DEFAULT false;