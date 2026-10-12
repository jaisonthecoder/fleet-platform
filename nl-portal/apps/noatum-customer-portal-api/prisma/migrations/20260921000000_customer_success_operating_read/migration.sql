-- ---------------------------------------------------------------------------
-- admin.operating.read for customer_success
--
-- Choosing a servicing office is part of onboarding a customer: it is set on the
-- customer as a default and on each organisation link. Customer Success does that
-- work, but held neither admin.staff.read (which the old Branches screen borrowed)
-- nor admin.operating.read, so every office picker on the customer screens came
-- back empty for exactly the role that uses them.
--
-- Read only. Creating, renaming and deactivating offices stays with
-- platform_admin, which is the point of the read/manage split.
-- ---------------------------------------------------------------------------

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, 'admin.operating.read'
FROM role r
WHERE r.key = 'customer_success'
ON CONFLICT DO NOTHING;
