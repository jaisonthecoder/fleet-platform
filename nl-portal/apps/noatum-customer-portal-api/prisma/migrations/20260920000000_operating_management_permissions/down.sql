-- Reverses 20260920000000_operating_management_permissions.
DELETE FROM role_permission WHERE permission_key IN ('admin.operating.read', 'admin.operating.manage');
DELETE FROM permission WHERE key IN ('admin.operating.read', 'admin.operating.manage');
