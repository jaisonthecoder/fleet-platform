-- ---------------------------------------------------------------------------
-- Legacy: the first staff role preset.
--
-- This migration and 20260912000000_staff_identity_and_role_presets share a
-- timestamp. On the database where both were authored this one ran first; on a
-- fresh database they sort the other way round, the sibling has already seeded
-- these two permissions, and the original unconditional INSERT aborted the
-- transaction. No new environment could be created.
--
-- It is therefore made idempotent rather than deleted: the file has already run
-- where it ran, and removing it would leave that history unexplained. On a fresh
-- database every statement below is now a no-op, and the `portal_admin` role it
-- creates is retired a moment later by
-- 20260912010000_identity_function_fix_and_role_merge, which is already written
-- to tolerate the role being absent.
-- ---------------------------------------------------------------------------

BEGIN;
SET LOCAL app.is_internal = 'true';

INSERT INTO permission (key, description) VALUES
  ('admin.staff.read', 'Read the registered internal staff directory and allowed role presets'),
  ('admin.staff.roles.manage', 'Assign and remove approved portal-owned internal staff role presets')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role (id, key, name, description, is_internal) VALUES
  ('9ba0d274-646f-4bd3-a67a-cb3164790b74', 'portal_admin', 'Portal Admin',
   'Staff directory and role assignment only. No customer, pricing, cost or impersonation access.', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, p.permission_key
FROM role r
CROSS JOIN (VALUES ('admin.staff.read'), ('admin.staff.roles.manage')) AS p(permission_key)
WHERE r.key = 'portal_admin'
ON CONFLICT DO NOTHING;

COMMIT;
