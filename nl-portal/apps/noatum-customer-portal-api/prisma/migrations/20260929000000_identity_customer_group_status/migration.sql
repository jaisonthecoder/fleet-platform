-- ---------------------------------------------------------------------------
-- Suspending a customer must actually lock its people out.
--
-- `changeStatus('suspended')` set the customer_group row and nothing else, so
-- every user of a suspended customer kept full access. The resolver already
-- filters organisation codes on `group.status = 'active'`, which hides shipments
-- and invoices, but Pattern A data (quotes, templates, the address book) is
-- scoped by customer_group_id alone and stayed readable.
--
-- The fix belongs here rather than in a bulk UPDATE of every user row.
-- Suspension is a property of the CUSTOMER, so it is read from the customer on
-- each sign-in. Mutating user rows would mean guessing, on restore, which of
-- them we had disabled ourselves and which an administrator had disabled
-- earlier - and getting that wrong silently restores access to someone who was
-- individually blocked.
--
-- Both identity functions gain `customer_group_status`. Internal staff have no
-- customer group, so they get NULL and are unaffected. The guard refuses any
-- non-internal user whose group is not active.
-- ---------------------------------------------------------------------------

-- The projection reads customer_group during a pre-auth lookup, so that table
-- needs the same narrow, transaction-local exemption branch already has. This
-- is not a blanket read: it is gated on the flag the functions set and clear.
DROP POLICY IF EXISTS customer_group_identity_resolution ON customer_group;
CREATE POLICY customer_group_identity_resolution ON customer_group
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
  LEFT JOIN customer_group g ON g.id = u.customer_group_id
  WHERE u.id = p_user_id;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app.resolve_identity_by_id(uuid) TO portal_app;
