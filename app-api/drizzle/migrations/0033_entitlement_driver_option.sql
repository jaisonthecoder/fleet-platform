-- Dedicated-vehicle requests carry two orthogonal axes: duration (request_type)
-- and driver staffing (driver_option). Previously both were conflated into a
-- single request_type value; driver_option is added so the UI's duration ×
-- driver matrix maps 1:1 onto storage. Nullable for backward compatibility.
ALTER TABLE "fleet"."entitlement_request" ADD COLUMN "driver_option" text;
