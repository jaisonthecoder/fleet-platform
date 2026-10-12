-- Local authentication flows: activation, bootstrap, MFA.
--
-- Migration 20260922000000 created the storage and the single-purpose accessors.
-- This one adds the operations that must be ATOMIC, and therefore cannot be composed
-- from two repository calls:
--
--   * consuming a challenge and setting a password is one act. Split in two, a crash
--     between them burns the customer's only activation link and leaves no password;
--   * provisioning the bootstrap administrator creates a user, grants a role and issues
--     a challenge. Half of that is a locked-out platform.
--
-- Same rules as the previous migration: portal_app holds no privilege on any local_*
-- table, so every one of these runs SECURITY DEFINER with a pinned search_path.

-- ---------------------------------------------------------------------------
-- Activation, bootstrap and password reset all end the same way: a live challenge
-- is spent and a password comes into force. The purpose decides what else happens.
-- ---------------------------------------------------------------------------
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
  v_challenge  local_security_challenge%ROWTYPE;
  v_version    INTEGER;
BEGIN
  -- Atomic spend. Two browsers opening the same link cannot both win.
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

  -- The invitation is the customer-visible record of the same event, so it closes here
  -- rather than in a follow-up write that could fail on its own.
  IF v_challenge.invitation_id IS NOT NULL THEN
    UPDATE invitation
       SET status = 'accepted', accepted_at = now()
     WHERE id = v_challenge.invitation_id
       AND status = 'pending';
  END IF;

  INSERT INTO local_credential AS lc (user_id, password_hash, security_version)
  VALUES (v_challenge.user_id, p_password_hash, 1)
  ON CONFLICT (user_id) DO UPDATE
     SET password_hash    = EXCLUDED.password_hash,
         password_set_at  = now(),
         updated_at       = now(),
         -- Re-enables a credential an administrator had disabled only because a live
         -- challenge was issued for it, which is itself an administrative act.
         disabled_at      = NULL,
         security_version = lc.security_version + 1
  RETURNING lc.security_version INTO v_version;

  -- An invited person becomes a real user at the moment they set a password.
  UPDATE "user"
     SET status = 'active', updated_at = now()
   WHERE id = v_challenge.user_id
     AND status IN ('invited', 'registered');

  -- Anything issued under the old password dies with it.
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

-- ---------------------------------------------------------------------------
-- The first Portal Admin, who cannot be invited because nobody exists to invite them.
--
-- Issues a one-time link; it never sets a password, so there is no default credential
-- to forget about. Repeat-safe, and refuses outright once a working credential exists
-- so it cannot be used to take over the live administrator account.
-- ---------------------------------------------------------------------------
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
  ON CONFLICT (user_id, role_id) DO NOTHING;
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

-- ---------------------------------------------------------------------------
-- Second factor.
-- ---------------------------------------------------------------------------

/** Stores an unconfirmed secret. Refuses to overwrite a confirmed one. */
CREATE OR REPLACE FUNCTION app.local_mfa_begin(p_user_id UUID, p_secret TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  INSERT INTO local_mfa_factor AS f (user_id, secret_encrypted)
  VALUES (p_user_id, p_secret)
  ON CONFLICT (user_id) DO UPDATE
     SET secret_encrypted = EXCLUDED.secret_encrypted,
         last_used_step   = NULL,
         updated_at       = now()
   WHERE f.confirmed_at IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.local_mfa_factor_get(p_user_id UUID)
RETURNS TABLE (secret_encrypted TEXT, confirmed BOOLEAN, last_used_step BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT f.secret_encrypted, f.confirmed_at IS NOT NULL, f.last_used_step
    FROM local_mfa_factor f
   WHERE f.user_id = p_user_id;
$$;

/**
 * Records the time step a code came from, and refuses one already spent.
 * Without this, a code stays valid for its whole 30-second window to anyone who
 * reads it over the user's shoulder.
 */
CREATE OR REPLACE FUNCTION app.local_mfa_use_step(
  p_user_id UUID,
  p_step    BIGINT,
  p_confirm BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  UPDATE local_mfa_factor
     SET last_used_step = p_step,
         confirmed_at   = CASE WHEN p_confirm THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
         updated_at     = now()
   WHERE user_id = p_user_id
     AND (last_used_step IS NULL OR last_used_step < p_step);

  RETURN FOUND;
END;
$$;

/** Replaces the whole set: recovery codes are shown once, as a set, or not at all. */
CREATE OR REPLACE FUNCTION app.local_recovery_codes_replace(p_user_id UUID, p_hashes TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM local_recovery_code WHERE user_id = p_user_id;

  INSERT INTO local_recovery_code (user_id, code_hash)
  SELECT p_user_id, h FROM unnest(p_hashes) AS h;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION app.local_recovery_code_use(p_user_id UUID, p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  UPDATE local_recovery_code
     SET used_at = now()
   WHERE user_id = p_user_id
     AND code_hash = p_hash
     AND used_at IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.local_recovery_codes_remaining(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER FROM local_recovery_code
   WHERE user_id = p_user_id AND used_at IS NULL;
$$;

/** Administrative removal of a lost factor. Sessions go with it. */
CREATE OR REPLACE FUNCTION app.local_mfa_reset(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  DELETE FROM local_recovery_code WHERE user_id = p_user_id;
  DELETE FROM local_mfa_factor WHERE user_id = p_user_id;

  UPDATE local_session
     SET revoked_at = now()
   WHERE user_id = p_user_id AND revoked_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ---------------------------------------------------------------------------
-- Session assurance and sign-in bookkeeping.
-- ---------------------------------------------------------------------------

/** Raises a half-authenticated session to a full one once the second factor is in. */
CREATE OR REPLACE FUNCTION app.local_session_promote(p_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  UPDATE local_session
     SET assurance = 'authenticated', last_used_at = now()
   WHERE token_hash = p_token_hash
     AND revoked_at IS NULL
     AND absolute_expires_at > now();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION app.local_record_login(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  UPDATE "user" SET last_login_at = now() WHERE id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION
  app.local_password_set_from_challenge(local_challenge_purpose, TEXT, TEXT),
  app.local_bootstrap_admin(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ),
  app.local_mfa_begin(UUID, TEXT),
  app.local_mfa_factor_get(UUID),
  app.local_mfa_use_step(UUID, BIGINT, BOOLEAN),
  app.local_recovery_codes_replace(UUID, TEXT[]),
  app.local_recovery_code_use(UUID, TEXT),
  app.local_recovery_codes_remaining(UUID),
  app.local_mfa_reset(UUID),
  app.local_session_promote(TEXT),
  app.local_record_login(UUID)
TO portal_app;
