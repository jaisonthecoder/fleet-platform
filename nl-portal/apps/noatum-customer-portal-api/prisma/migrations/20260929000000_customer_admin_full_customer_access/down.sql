-- Reverses 20260929000000_customer_admin_full_customer_access.
--
-- Returns customer_admin to people-administration only. The five permissions
-- kept here are the ones the preset held before the widening; everything else
-- granted by that migration is withdrawn.

DELETE FROM role_permission
WHERE role_id IN (SELECT id FROM role WHERE key = 'customer_admin')
  AND permission_key NOT IN (
    'dashboard.read', 'shipments.read', 'documents.read', 'documents.download',
    'notifications.manage',
    'users.read', 'users.manage', 'reports.assign',
    'address_book.read', 'address_book.manage', 'admin.audit.read'
  );
