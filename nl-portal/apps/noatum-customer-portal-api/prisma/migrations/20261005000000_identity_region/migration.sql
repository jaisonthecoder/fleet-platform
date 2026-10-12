-- ---------------------------------------------------------------------------
-- The region layer of ADR-010 was unreachable.
--
-- `SettingContext` accepts a region code and the resolver honours it, but
-- nothing in the running system ever supplied one: `TenantContext` carried a
-- branch and no region. So the four-layer hierarchy was really two layers,
-- global and branch, and the mockup's own worked example - the Iberia region
-- threshold of EUR 15,000 sitting above a global EUR 10,000 - could not happen.
--
-- The region comes from the user's branch, which already has `region_id`. It is
-- resolved here rather than looked up per request because settings are read on
-- every claim, price and publish, and a second round trip on each of those to
-- learn something that cannot change mid-session is waste.
--
-- Both identity functions gain `region_code` and `region_name`. A user with no
-- branch, or a branch with no region, gets NULL and the resolver simply skips
-- that layer - which is the correct behaviour, not a failure.
-- ---------------------------------------------------------------------------

-- The projection joins `region` during a pre-auth lookup, so it needs the same
-- narrow, transaction-local exemption `branch` and `customer_group` already
-- have. Gated on the flag the functions set and clear, never a blanket read.
DROP POLICY IF EXISTS region_identity_resolution ON region;
CREATE POLICY region_identity_resolution ON region
  FOR SELECT
  USING (current_setting('app.identity_lookup', true) = 'on');

DROP FUNCTION IF EXISTS app.resolve_identity(text, text);

CREATE FUNCTION app.resolve_identity(p_issuer text, p_subject text)
RETURNS TABLE (
  user_id uuid,
  customer_group_id uuid,
  customer_group_status text,
  is_internal boolean,
  status text,
  display_name text,
  email text,
  branch_code text,
  branch_name text,
  region_code text,
  region_name text,
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
    g.status::text,
    u.is_internal,
    u.status::text,
    u.display_name::text,
    u.email::text,
    b.code::text,
    b.name::text,
    rg.code::text,
    rg.name::text,
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
  LEFT JOIN region rg ON rg.id = b.region_id
  LEFT JOIN customer_group g ON g.id = u.customer_group_id
  WHERE u.idp_issuer = p_issuer
    AND u.idp_subject = p_subject;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app.resolve_identity(text, text) TO portal_app;

DROP FUNCTION IF EXISTS app.resolve_identity_by_id(uuid);

CREATE FUNCTION app.resolve_identity_by_id(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  customer_group_id uuid,
  customer_group_status text,
  is_internal boolean,
  status text,
  display_name text,
  email text,
  branch_code text,
  branch_name text,
  region_code text,
  region_name text,
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
    g.status::text,
    u.is_internal,
    u.status::text,
    u.display_name::text,
    u.email::text,
    b.code::text,
    b.name::text,
    rg.code::text,
    rg.name::text,
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
  LEFT JOIN region rg ON rg.id = b.region_id
  LEFT JOIN customer_group g ON g.id = u.customer_group_id
  WHERE u.id = p_user_id;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app.resolve_identity_by_id(uuid) TO portal_app;
