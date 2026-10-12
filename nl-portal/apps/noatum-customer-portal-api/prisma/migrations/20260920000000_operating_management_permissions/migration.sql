-- ---------------------------------------------------------------------------
-- admin.operating.read / admin.operating.manage
--
-- Regions and branches are Noatum-owned operating structure. Until now the
-- catalogue was read-only (the Branches screen borrowed admin.staff.read) and
-- maintained only by the dev seed. This adds the two permissions the management
-- screen needs, split the same way admin.organisations.link and
-- admin.organisations.import are: viewing the catalogue is separate from
-- changing it, so a viewer role can be granted without the ability to rename or
-- deactivate an office.
--
-- The region and branch tables already exist (20260912050000) with internal-only
-- RLS and portal_app grants, so no schema change is needed here — only the
-- permission catalogue and the platform_admin grant, kept in step with
-- src/contracts/permissions.ts so the drift test stays green.
-- ---------------------------------------------------------------------------

INSERT INTO permission (key, description) VALUES
  ('admin.operating.read',   'View the operating structure of regions and branches'),
  ('admin.operating.manage', 'Create and maintain regions and branches')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, p.key
FROM role r
CROSS JOIN (VALUES ('admin.operating.read'), ('admin.operating.manage')) AS p(key)
WHERE r.key = 'platform_admin'
ON CONFLICT DO NOTHING;
