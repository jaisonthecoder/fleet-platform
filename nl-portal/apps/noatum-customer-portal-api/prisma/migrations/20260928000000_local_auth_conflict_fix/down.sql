-- Reverses 20260928000000_local_auth_conflict_fix.
--
-- Nothing to drop: this migration only replaced two function bodies. Restoring the
-- earlier bodies would reintroduce a runtime failure, so the fix stands.
SELECT 1;
