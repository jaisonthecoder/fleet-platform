-- ---------------------------------------------------------------------------
-- customer_admin holds every customer-facing permission
--
-- The preset was people-administration only: invite colleagues, set roles, keep
-- the address book, read the audit. That was a deliberate separation of duties -
-- whoever grants access should not also approve an invoice.
--
-- Product direction of 17.09.2026 widens it. The Customer Admin is the customer's
-- own owner of the portal and, in a pilot, usually its only user; a role that
-- cannot quote, book or open an invoice leaves the account unable to do anything
-- on the day it is created. Customers who want the separation back move people
-- onto the five narrower customer presets, each of which carries one job.
--
-- This grants exactly the complement of INTERNAL_ONLY_PERMISSIONS in
-- src/contracts/permissions.ts: no pricing, no Noatum administration, no
-- impersonation. admin.audit.read is included because a customer administrator
-- reads their own group's audit, which is not an internal permission.
-- ---------------------------------------------------------------------------

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, p.key
FROM role r
CROSS JOIN permission p
WHERE r.key = 'customer_admin'
  AND p.key IN (
    'dashboard.read',
    'quotes.read', 'quotes.create', 'quotes.submit', 'quotes.accept', 'quotes.cancel',
    'templates.read', 'templates.manage',
    'address_book.read', 'address_book.manage',
    'shipments.read', 'shipments.export',
    'documents.read', 'documents.download', 'documents.upload',
    'invoices.read', 'invoices.download',
    'bookings.read', 'bookings.create', 'bookings.cancel',
    'claims.read', 'claims.create', 'claims.comment',
    'reports.read', 'reports.export', 'reports.assign',
    'notifications.manage',
    'users.read', 'users.manage',
    'api_keys.manage',
    'admin.audit.read'
  )
ON CONFLICT DO NOTHING;
