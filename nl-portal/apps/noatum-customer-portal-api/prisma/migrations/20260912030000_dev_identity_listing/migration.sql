-- ---------------------------------------------------------------------------
-- Listing for the development identity picker.
--
-- Only ever returns identities whose issuer is `dev://...`, which the header
-- bypass mints and a real Entra token never can. The endpoint that calls this is
-- additionally disabled unless DEV_AUTH_ENABLED is on, and configuration refuses
-- to boot with that flag in production - so in a real environment this function
-- has nothing to return.
--
-- `role` gains the same identity-resolution policy as the other identity tables
-- so the preset names can be joined; it is reference data, not customer data.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS role_identity_resolution ON role;
CREATE POLICY role_identity_resolution ON role
  FOR SELECT
  USING (current_setting('app.identity_lookup', true) = 'on');

CREATE OR REPLACE FUNCTION app.list_dev_identities()
RETURNS TABLE (
  subject text,
  email text,
  display_name text,
  status text,
  role_keys text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.identity_lookup', 'on', true);

  RETURN QUERY
  SELECT
    u.idp_subject::text,
    u.email::text,
    u.display_name::text,
    u.status::text,
    COALESCE((
      SELECT array_agg(r.key::text ORDER BY r.key)
      FROM user_role ur
      JOIN role r ON r.id = ur.role_id
      WHERE ur.user_id = u.id
    ), ARRAY[]::text[])
  FROM "user" u
  WHERE u.idp_issuer LIKE 'dev://%'
  ORDER BY u.display_name;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app.list_dev_identities() TO portal_app;
