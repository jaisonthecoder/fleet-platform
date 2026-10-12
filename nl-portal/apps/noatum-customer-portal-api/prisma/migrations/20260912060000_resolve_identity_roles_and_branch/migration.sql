-- ---------------------------------------------------------------------------
-- The shell shows which role the signed-in person holds and which branch they
-- work from, so identity resolution returns both. Roles are read from the same
-- assignment join that already produces the permissions; the branch is a join
-- onto the catalogue added in 20260912050000.
--
-- Nothing here changes authorization: the badge is a label, and every route
-- still checks permissions.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS branch_identity_resolution ON branch;
CREATE POLICY branch_identity_resolution ON branch
  FOR SELECT
  USING (current_setting('app.identity_lookup', true) = 'on');

DROP FUNCTION IF EXISTS app.resolve_identity(text, text);

CREATE FUNCTION app.resolve_identity(p_issuer text, p_subject text)
RETURNS TABLE (
  user_id uuid,
  customer_group_id uuid,
  is_internal boolean,
  status text,
  display_name text,
  email text,
  branch_code text,
  branch_name text,
  role_keys text[],
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
    u.display_name::text,
    u.email::text,
    b.code::text,
    b.name::text,
    COALESCE((
      SELECT array_agg(r.key::text ORDER BY r.key)
      FROM user_role ur
      JOIN role r ON r.id = ur.role_id
      WHERE ur.user_id = u.id
    ), ARRAY[]::text[]),
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
  LEFT JOIN branch b ON b.id = u.branch_id
  WHERE u.idp_issuer = p_issuer
    AND u.idp_subject = p_subject;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app.resolve_identity(text, text) TO portal_app;
