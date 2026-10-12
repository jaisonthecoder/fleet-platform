-- ---------------------------------------------------------------------------
-- admin.organisations.import
--
-- Split out of admin.organisations.link because the two acts carry different
-- blast radii. Linking touches one customer. Running an authoritative import
-- rewrites the directory and can deactivate organisations wholesale, so it stays
-- with platform administrators and away from customer-success roles.
-- ---------------------------------------------------------------------------

INSERT INTO permission (key, description)
VALUES ('admin.organisations.import', 'Run the CargoWise organisation import and view its history')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, 'admin.organisations.import'
FROM role r
WHERE r.key = 'platform_admin'
ON CONFLICT DO NOTHING;
