-- Reverses 20260921000000_customer_success_operating_read.

DELETE FROM role_permission
WHERE permission_key = 'admin.operating.read'
  AND role_id IN (SELECT id FROM role WHERE key = 'customer_success');
