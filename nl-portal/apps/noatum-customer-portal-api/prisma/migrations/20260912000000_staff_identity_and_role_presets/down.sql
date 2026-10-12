-- Reverses 20260912000000_staff_identity_and_role_presets.
--
-- The 'registered' enum value is deliberately left in place: Postgres cannot drop
-- an enum label, and any row still carrying it would become unreadable. Move those
-- rows to 'invited' before relying on this script.

UPDATE "user" SET status = 'invited' WHERE status = 'registered';

DROP FUNCTION IF EXISTS app.register_staff_identity(text, text, text, text);
DROP FUNCTION IF EXISTS app.resolve_identity(text, text);

DROP POLICY IF EXISTS user_account_access_identity_resolution ON user_account_access;
DROP POLICY IF EXISTS role_permission_identity_resolution ON role_permission;
DROP POLICY IF EXISTS user_role_identity_resolution ON user_role;
DROP POLICY IF EXISTS user_identity_resolution ON "user";

ALTER TABLE "user_role" DROP COLUMN IF EXISTS "assigned_at";
ALTER TABLE "user_role" DROP COLUMN IF EXISTS "assigned_by_id";

DROP INDEX IF EXISTS "user_idp_issuer_idp_subject_key";
ALTER TABLE "user" DROP COLUMN IF EXISTS "idp_subject";
ALTER TABLE "user" DROP COLUMN IF EXISTS "idp_issuer";

SELECT set_config('app.is_internal', 'true', true);

DELETE FROM role_permission
WHERE role_id IN (
  SELECT id FROM role WHERE key IN (
    'platform_admin', 'customer_success', 'pricing', 'pricing_approver', 'ops',
    'customer_standard', 'customer_quoting_booking', 'customer_finance',
    'customer_analyst', 'customer_claims', 'customer_admin'
  )
);

DELETE FROM role WHERE key IN (
  'platform_admin', 'customer_success', 'pricing', 'pricing_approver', 'ops',
  'customer_standard', 'customer_quoting_booking', 'customer_finance',
  'customer_analyst', 'customer_claims', 'customer_admin'
);
