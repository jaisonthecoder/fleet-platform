-- Reverses 20261003000200_scoped_settings.
--
-- Dropping the table discards every override, returning the platform to the
-- catalogue defaults. That is a real behaviour change, not a no-op: a branch
-- that had been publishing directly would start waiting for CargoWise again.
-- Read the settings change log before running this in an environment anybody
-- relies on.

DROP TABLE IF EXISTS setting_value;
DROP TYPE IF EXISTS setting_scope;
