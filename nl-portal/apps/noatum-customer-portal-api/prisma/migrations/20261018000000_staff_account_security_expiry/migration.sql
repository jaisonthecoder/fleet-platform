-- A staff screen can now say when a pending sign-in link runs out, not just that one
-- exists, and it counts a password-reset link as well as an invitation. Both are the
-- same thing to whoever is waiting for it.
--
-- The return type changes, so the function is dropped rather than replaced.

DROP FUNCTION IF EXISTS app.local_account_security(UUID[]);

CREATE FUNCTION app.local_account_security(p_user_ids UUID[])
RETURNS TABLE (
  user_id                 UUID,
  has_password            BOOLEAN,
  credential_disabled     BOOLEAN,
  password_set_at         TIMESTAMPTZ,
  mfa_enrolled            BOOLEAN,
  recovery_codes_left     INTEGER,
  active_sessions         INTEGER,
  pending_activation_link BOOLEAN,
  pending_link_expires_at TIMESTAMPTZ
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
                  WHERE ch.user_id = u.id AND ch.purpose IN ('activation', 'password_reset')
                    AND ch.consumed_at IS NULL AND ch.expires_at > now()),
         (SELECT MAX(ch.expires_at) FROM local_security_challenge ch
           WHERE ch.user_id = u.id AND ch.purpose IN ('activation', 'password_reset')
             AND ch.consumed_at IS NULL AND ch.expires_at > now())
    FROM unnest(p_user_ids) AS requested(id)
    JOIN "user" u ON u.id = requested.id
    LEFT JOIN local_credential c ON c.user_id = u.id;
$$;

REVOKE ALL ON FUNCTION app.local_account_security(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.local_account_security(UUID[]) TO portal_app;
