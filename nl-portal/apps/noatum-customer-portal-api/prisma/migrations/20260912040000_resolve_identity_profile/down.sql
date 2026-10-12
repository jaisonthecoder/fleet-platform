-- Reverses 20260912040000_resolve_identity_profile by dropping the two profile
-- columns from the projection.

DROP FUNCTION IF EXISTS app.resolve_identity(text, text);

CREATE FUNCTION app.resolve_identity(p_issuer text, p_subject text)
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
