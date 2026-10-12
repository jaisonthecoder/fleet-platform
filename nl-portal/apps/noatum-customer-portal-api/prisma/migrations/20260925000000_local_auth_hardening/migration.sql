-- Hardening for the local authentication flows.
--
-- One hole, found in review: `local_password_set_from_challenge` cleared `disabled_at`.
-- An administrator who disables a compromised credential would have it silently
-- re-enabled by any password-reset link issued before the disablement - and a reset
-- link is exactly what an attacker who still holds the mailbox would already have.
--
-- A disabled credential now stays disabled, and a suspended or closed account cannot
-- gain a password at all. Re-enabling is an administrative act, not a side effect.

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
  ON CONFLICT (user_id) DO UPDATE
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

-- Disabling a credential must also kill anything that could undo it: live sessions and
-- any unspent reset or activation link.
CREATE OR REPLACE FUNCTION app.local_credential_disable(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_disabled BOOLEAN := FALSE;
BEGIN
  UPDATE local_credential
     SET disabled_at = now(), updated_at = now()
   WHERE user_id = p_user_id
     AND disabled_at IS NULL;
  v_disabled := FOUND;

  UPDATE local_session
     SET revoked_at = now()
   WHERE user_id = p_user_id AND revoked_at IS NULL;

  UPDATE local_security_challenge
     SET consumed_at = now()
   WHERE user_id = p_user_id AND consumed_at IS NULL;

  RETURN v_disabled;
END;
$$;

GRANT EXECUTE ON FUNCTION
  app.local_password_set_from_challenge(local_challenge_purpose, TEXT, TEXT),
  app.local_credential_disable(UUID)
TO portal_app;
