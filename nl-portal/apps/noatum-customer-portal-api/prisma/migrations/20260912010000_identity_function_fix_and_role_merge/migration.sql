-- ---------------------------------------------------------------------------
-- Two corrections to the staff identity work.
--
--  1. permission.key is varchar(80), so array_agg produced character varying[]
--     where app.resolve_identity declares text[], and every sign-in failed with
--     "structure of query does not match function result type". Cast explicitly.
--
--  2. 20260912000000_staff_role_preset seeded a `portal_admin` role carrying the
--     two staff-administration permissions. The approved presets replace it with
--     `platform_admin`, so anyone holding it is moved across and it is retired.
--     Done here rather than by editing that migration, which has already run.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.resolve_identity(p_issuer text, p_subject text)
RETURNS TABLE (
  user_id uuid,
  customer_group_id uuid,
  is_internal boolean,
  status text,
  permissions text[],
  account_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.identity_lookup', 'on', true);

  RETURN QUERY
  SELECT
    u.id,
    u.customer_group_id,
    u.is_internal,
    u.status::text,
    COALESCE((
      SELECT array_agg(DISTINCT rp.permission_key::text)
      FROM user_role ur
      JOIN role_permission rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = u.id
    ), ARRAY[]::text[]),
    COALESCE((
      SELECT array_agg(a.account_id)
      FROM user_account_access a
      WHERE a.user_id = u.id
    ), ARRAY[]::uuid[])
  FROM "user" u
  WHERE u.idp_issuer = p_issuer
    AND u.idp_subject = p_subject;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app.resolve_identity(text, text) TO portal_app;

SELECT set_config('app.is_internal', 'true', true);

-- Carry existing holders over, skipping anyone who already has the new preset.
INSERT INTO user_role (user_id, role_id)
SELECT ur.user_id, target.id
FROM user_role ur
JOIN role source ON source.id = ur.role_id AND source.key = 'portal_admin'
JOIN role target ON target.key = 'platform_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

DELETE FROM user_role
WHERE role_id IN (SELECT id FROM role WHERE key = 'portal_admin');

DELETE FROM role_permission
WHERE role_id IN (SELECT id FROM role WHERE key = 'portal_admin');

DELETE FROM role WHERE key = 'portal_admin';
