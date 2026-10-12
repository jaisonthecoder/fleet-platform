-- Reverses 20260912020000_register_staff_identity_timestamps by restoring the
-- previous function body. Note that doing so reinstates the NOT NULL violation on
-- user.updated_at for every first sign-in, so this is for completeness only.

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

  INSERT INTO "user" (idp_issuer, idp_subject, email, display_name, status, is_internal, last_login_at)
  VALUES (p_issuer, p_subject, p_email, p_display_name, 'registered', true, now())
  ON CONFLICT (idp_issuer, idp_subject) DO UPDATE
    SET last_login_at = now(),
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), "user".display_name)
  RETURNING id INTO v_id;

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
