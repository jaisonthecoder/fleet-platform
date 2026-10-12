-- Fixes "column reference \"user_id\" is ambiguous" in two definer functions.
--
-- A RETURNS TABLE column becomes a PL/pgSQL variable, so inside the body `user_id`
-- means both the output variable and the table column. Postgres tolerates that until
-- it hits a bare `ON CONFLICT (user_id)`, where it cannot choose, and raises 42702 at
-- RUN time - not at CREATE time. Both functions therefore shipped broken:
-- activation failed with a 500, and bootstrap provisioning would have done the same.
--
-- Naming the constraint removes the ambiguity without renaming the outputs, which the
-- repository selects by name.

CREATE OR REPLACE FUNCTION app.local_password_set_from_challenge(
  p_purpose       local_challenge_purpose,
  p_token_hash    TEXT,
  p_password_hash TEXT
)
RETURNS TABLE (
  user_id          UUID,
  security_version INTEGER,
  email            TEXT,
  mfa_enrolled     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_challenge local_security_challenge%ROWTYPE;
  v_version   INTEGER;
  v_status    user_status;
BEGIN
  UPDATE local_security_challenge AS c
     SET consumed_at = now()
   WHERE c.token_hash = p_token_hash
     AND c.purpose = p_purpose
     AND c.consumed_at IS NULL
     AND c.expires_at > now()
  RETURNING c.* INTO v_challenge;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- The link is spent either way, so a refused attempt cannot be retried.
  IF EXISTS (
    SELECT 1 FROM local_credential lc
     WHERE lc.user_id = v_challenge.user_id AND lc.disabled_at IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  SELECT u.status INTO v_status FROM "user" u WHERE u.id = v_challenge.user_id;
  IF v_status IS NULL OR v_status IN ('suspended', 'disabled') THEN
    RETURN;
  END IF;

  IF v_challenge.invitation_id IS NOT NULL THEN
    UPDATE invitation
       SET status = 'accepted', accepted_at = now()
     WHERE id = v_challenge.invitation_id
       AND status = 'pending';
  END IF;

  INSERT INTO local_credential AS lc (user_id, password_hash, security_version)
  VALUES (v_challenge.user_id, p_password_hash, 1)
  ON CONFLICT ON CONSTRAINT local_credential_pkey DO UPDATE
     SET password_hash    = EXCLUDED.password_hash,
         password_set_at  = now(),
         updated_at       = now(),
         security_version = lc.security_version + 1
  RETURNING lc.security_version INTO v_version;

  UPDATE "user"
     SET status = 'active', updated_at = now()
   WHERE id = v_challenge.user_id
     AND status IN ('invited', 'registered');

  UPDATE local_session
     SET revoked_at = now()
   WHERE local_session.user_id = v_challenge.user_id
     AND revoked_at IS NULL;

  RETURN QUERY
  SELECT u.id,
         v_version,
         u.email::TEXT,
         EXISTS (
           SELECT 1 FROM local_mfa_factor f
            WHERE f.user_id = u.id AND f.confirmed_at IS NOT NULL
         )
    FROM "user" u
   WHERE u.id = v_challenge.user_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.local_bootstrap_admin(
  p_email        TEXT,
  p_display_name TEXT,
  p_role_key     TEXT,
  p_token_hash   TEXT,
  p_expires_at   TIMESTAMPTZ
)
RETURNS TABLE (
  user_id      UUID,
  created      BOOLEAN,
  role_granted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_created BOOLEAN := FALSE;
  v_granted BOOLEAN := FALSE;
BEGIN
  SELECT id INTO v_role_id FROM role WHERE key = p_role_key;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role % does not exist. Seed roles before provisioning an administrator.', p_role_key
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT u.id INTO v_user_id FROM "user" u WHERE u.email = p_email::CITEXT;

  IF v_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM local_credential c
       WHERE c.user_id = v_user_id AND c.disabled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'A working password already exists for %. Use password recovery instead.', p_email
        USING ERRCODE = 'unique_violation';
    END IF;

    IF EXISTS (
      SELECT 1 FROM "user" u
       WHERE u.id = v_user_id AND (u.is_internal = FALSE OR u.customer_group_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION '% already exists as a customer user and cannot be made a Portal Admin.', p_email
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    INSERT INTO "user" (customer_group_id, email, display_name, status, is_internal)
    VALUES (NULL, p_email::CITEXT, p_display_name, 'registered', TRUE)
    RETURNING id INTO v_user_id;
    v_created := TRUE;
  END IF;

  INSERT INTO user_role (user_id, role_id, assigned_by_id)
  VALUES (v_user_id, v_role_id, NULL)
  ON CONFLICT ON CONSTRAINT user_role_pkey DO NOTHING;
  v_granted := FOUND;

  UPDATE local_security_challenge
     SET consumed_at = now()
   WHERE local_security_challenge.user_id = v_user_id
     AND purpose = 'bootstrap'
     AND consumed_at IS NULL;

  INSERT INTO local_security_challenge (purpose, token_hash, user_id, expires_at)
  VALUES ('bootstrap', p_token_hash, v_user_id, p_expires_at);

  RETURN QUERY SELECT v_user_id, v_created, v_granted;
END;
$$;

GRANT EXECUTE ON FUNCTION
  app.local_password_set_from_challenge(local_challenge_purpose, TEXT, TEXT),
  app.local_bootstrap_admin(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
TO portal_app;
