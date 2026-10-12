-- Reverses 20261007000000_pricing_publish_permission.
--
-- The role links go first: `permission` is the parent, and dropping it while a
-- role still points at it would fail on the foreign key.
--
-- Anyone holding a custom role that was granted this permission by hand loses it
-- too, and silently. That is the honest behaviour - the permission no longer
-- exists - but it is worth knowing before running this on a live environment.

DELETE FROM role_permission WHERE permission_key = 'pricing.publish';
DELETE FROM permission WHERE key = 'pricing.publish';
