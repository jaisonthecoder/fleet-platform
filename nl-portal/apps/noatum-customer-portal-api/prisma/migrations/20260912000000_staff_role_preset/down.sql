BEGIN;
SET LOCAL app.is_internal = 'true';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_role WHERE role_id = '9ba0d274-646f-4bd3-a67a-cb3164790b74') THEN
    RAISE EXCEPTION 'Remove Portal Admin assignments through the approved recovery procedure before rollback';
  END IF;
  IF EXISTS (SELECT 1 FROM role_permission WHERE permission_key IN ('admin.staff.read', 'admin.staff.roles.manage') AND role_id <> '9ba0d274-646f-4bd3-a67a-cb3164790b74') THEN
    RAISE EXCEPTION 'Other roles use staff permissions; refusing cascading permission removal';
  END IF;
END $$;
DELETE FROM role_permission WHERE role_id = '9ba0d274-646f-4bd3-a67a-cb3164790b74';
DELETE FROM role WHERE id = '9ba0d274-646f-4bd3-a67a-cb3164790b74' AND key = 'portal_admin';
DELETE FROM permission WHERE key IN ('admin.staff.read', 'admin.staff.roles.manage');
COMMIT;
