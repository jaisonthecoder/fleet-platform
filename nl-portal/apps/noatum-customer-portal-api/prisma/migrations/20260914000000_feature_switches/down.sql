-- Reverses 20260914000000_feature_switches.
-- Every capability returns to the code default in contracts/feature-switches.ts,
-- which is the safe direction for the current catalogue. Confirm that remains
-- true before relying on this.

DROP TABLE IF EXISTS "feature_switch";
