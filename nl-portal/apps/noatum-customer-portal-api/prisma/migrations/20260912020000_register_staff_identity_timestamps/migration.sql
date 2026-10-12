-- ---------------------------------------------------------------------------
-- app.register_staff_identity never set user.updated_at.
--
-- Prisma's @updatedAt is maintained by the client, not by a database default, so
-- the column is NOT NULL with nothing to fall back on and every first sign-in
-- failed with 23502.
--
-- The sign-in branch deliberately leaves updated_at alone: the staff screen uses
-- it for optimistic concurrency, so bumping it whenever somebody signs in would
-- invalidate an administrator's open edit for no business reason.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.register_staff_identity(
  p_issuer text,
  p_subject text,
  p_email text,
  p_display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM set_config('app.identity_lookup', 'on', true);

  INSERT INTO "user" (
    idp_issuer, idp_subject, email, display_name, status, is_internal,
    last_login_at, created_at, updated_at
  )
  VALUES (
    p_issuer, p_subject, p_email, p_display_name, 'registered', true,
    now(), now(), now()
  )
  ON CONFLICT (idp_issuer, idp_subject) DO UPDATE
    SET last_login_at = now(),
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), "user".display_name)
  RETURNING id INTO v_id;

  -- An existing row keyed on email alone adopts this subject the first time the
  -- person signs in, and only while that row is still unclaimed.
  IF v_id IS NULL THEN
    UPDATE "user"
       SET idp_issuer = p_issuer,
           idp_subject = p_subject,
           last_login_at = now()
     WHERE email = p_email
       AND idp_subject IS NULL
       AND is_internal = true
    RETURNING id INTO v_id;
  END IF;

  PERFORM set_config('app.identity_lookup', 'off', true);
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION app.register_staff_identity(text, text, text, text) TO portal_app;
