-- ---------------------------------------------------------------------------
-- C5 - publishing needs a permission of its own
--
-- Pricing a quote and releasing it to the customer are different acts. A branch
-- may well want a junior to build the answer and somebody else to send it, and
-- with one permission covering both there is no way to express that.
--
-- Granted to both pricing roles, which is not a hole in four-eyes: the service
-- refuses to publish above the approval threshold until a DIFFERENT person has
-- approved. The permission says "may release"; the threshold says "not alone".
-- ---------------------------------------------------------------------------

INSERT INTO permission (key, description) VALUES
  ('pricing.publish', 'Release a priced quote to the customer')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permission (role_id, permission_key)
SELECT r.id, 'pricing.publish'
FROM role r
WHERE r.key IN ('pricing', 'pricing_approver')
ON CONFLICT DO NOTHING;
