-- Self-service second-factor replacement.
--
-- `local_mfa_reset` is the administrative tool: it clears the factor AND ends every
-- session, which is right when an administrator is helping someone locked out. It is
-- wrong when the person is signed in and simply changing phones, because it would sign
-- them out of the screen they are standing on, mid-enrolment, with no factor left.
--
-- This clears the factor and its recovery codes and leaves sessions alone. The caller
-- has already re-entered their password, and the session is raised back to full
-- assurance only once a new code is confirmed.

CREATE OR REPLACE FUNCTION app.local_mfa_restart(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_removed BOOLEAN := FALSE;
BEGIN
  DELETE FROM local_recovery_code WHERE user_id = p_user_id;

  DELETE FROM local_mfa_factor WHERE user_id = p_user_id;
  v_removed := FOUND;

  RETURN v_removed;
END;
$$;

GRANT EXECUTE ON FUNCTION app.local_mfa_restart(UUID) TO portal_app;
