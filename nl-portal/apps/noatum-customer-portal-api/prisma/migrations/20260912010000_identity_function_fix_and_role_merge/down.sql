-- Reverses 20260912010000_identity_function_fix_and_role_merge.
--
-- Restores the retired portal_admin preset with its original id, so grants that
-- referenced it can be reinstated. The text[] cast is left in place: reverting it
-- would reintroduce the result-type mismatch that broke every sign-in.

SELECT set_config('app.is_internal', 'true', true);

INSERT INTO role (id, key, name, description, is_internal) VALUES
  ('9ba0d274-646f-4bd3-a67a-cb3164790b74', 'portal_admin', 'Portal Admin',
   'Staff directory and role assignment only. No customer, pricing, cost or impersonation access.', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, k.key
FROM role r
CROSS JOIN (VALUES ('admin.staff.read'), ('admin.staff.roles.manage')) AS k(key)
WHERE r.key = 'portal_admin'
ON CONFLICT (role_id, permission_key) DO NOTHING;
