-- Administrative view of, and control over, a customer user's sign-in.
--
-- portal_app still holds no privilege on any local_* table, so staff screens cannot
-- read a password hash or a second-factor secret even by accident. What they get is
-- the state an administrator actually needs: does this person have a password, is it
-- disabled, do they have a second factor, how many recovery codes are left.

/** Re-enables a credential an administrator had disabled. Deliberately separate from disable. */
CREATE OR REPLACE FUNCTION app.local_credential_enable(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  UPDATE local_credential
     SET disabled_at = NULL, updated_at = now()
   WHERE user_id = p_user_id
     AND disabled_at IS NOT NULL;

  RETURN FOUND;
END;
$$;

/** Cancels unspent links of one kind - used when an invitation is revoked. */
CREATE OR REPLACE FUNCTION app.local_challenge_revoke(
  p_user_id UUID,
  p_purpose local_challenge_purpose
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE local_security_challenge
     SET consumed_at = now()
   WHERE user_id = p_user_id
     AND purpose = p_purpose
     AND consumed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

/**
 * Security state for a page of users, in one round trip.
 *
 * Returns a row per requested user whether or not a credential exists, so a list can
 * show "no password yet" without a second query.
 */
CREATE OR REPLACE FUNCTION app.local_account_security(p_user_ids UUID[])
RETURNS TABLE (
  user_id                 UUID,
  has_password            BOOLEAN,
  credential_disabled     BOOLEAN,
  password_set_at         TIMESTAMPTZ,
  mfa_enrolled            BOOLEAN,
  recovery_codes_left     INTEGER,
  active_sessions         INTEGER,
  pending_activation_link BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT u.id,
         c.user_id IS NOT NULL,
         c.disabled_at IS NOT NULL,
         c.password_set_at,
         EXISTS (SELECT 1 FROM local_mfa_factor f WHERE f.user_id = u.id AND f.confirmed_at IS NOT NULL),
         (SELECT COUNT(*)::INTEGER FROM local_recovery_code r WHERE r.user_id = u.id AND r.used_at IS NULL),
         (SELECT COUNT(*)::INTEGER FROM local_session s
           WHERE s.user_id = u.id AND s.revoked_at IS NULL
             AND s.idle_expires_at > now() AND s.absolute_expires_at > now()),
         EXISTS (SELECT 1 FROM local_security_challenge ch
                  WHERE ch.user_id = u.id AND ch.purpose = 'activation'
                    AND ch.consumed_at IS NULL AND ch.expires_at > now())
    FROM unnest(p_user_ids) AS requested(id)
    JOIN "user" u ON u.id = requested.id
    LEFT JOIN local_credential c ON c.user_id = u.id;
$$;

GRANT EXECUTE ON FUNCTION
  app.local_credential_enable(UUID),
  app.local_challenge_revoke(UUID, local_challenge_purpose),
  app.local_account_security(UUID[])
TO portal_app;
