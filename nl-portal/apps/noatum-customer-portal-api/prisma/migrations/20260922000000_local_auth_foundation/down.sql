-- Reverse of 20260922000000_local_auth_foundation.
--
-- Refuses while anyone still signs in with a password. Dropping these tables
-- would not "roll back" local authentication, it would delete the only
-- credential the pilot's customers and bootstrap administrator have (ADR-006).
-- Withdraw local sign-in by setting LOCAL_AUTH_ENABLED=false, move the affected
-- people to their replacement method, then run this.

DO $$
DECLARE
  v_credentials integer;
BEGIN
  SELECT count(*) INTO v_credentials FROM local_credential WHERE disabled_at IS NULL;
  IF v_credentials > 0 THEN
    RAISE EXCEPTION
      'refusing rollback: % active local credential(s) still depend on these tables', v_credentials
      USING ERRCODE = 'dependent_objects_still_exist';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS app.local_auth_cleanup(integer);
DROP FUNCTION IF EXISTS app.local_challenge_consume(text, text);
DROP FUNCTION IF EXISTS app.local_challenge_peek(text, text);
DROP FUNCTION IF EXISTS app.local_challenge_issue(uuid, text, text, timestamptz, uuid, boolean);
DROP FUNCTION IF EXISTS app.local_session_revoke_user(uuid, text);
DROP FUNCTION IF EXISTS app.local_session_destroy(text);
DROP FUNCTION IF EXISTS app.local_session_touch(text, timestamptz);
DROP FUNCTION IF EXISTS app.local_session_save(text, uuid, text, integer, jsonb, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS app.local_session_load(text);
DROP FUNCTION IF EXISTS app.local_credential_set(uuid, text, boolean);
DROP FUNCTION IF EXISTS app.local_credential_for_login(text);
DROP FUNCTION IF EXISTS app.resolve_identity_by_id(uuid);

DROP TABLE IF EXISTS "local_recovery_code";
DROP TABLE IF EXISTS "local_mfa_factor";
DROP TABLE IF EXISTS "local_security_challenge";
DROP TABLE IF EXISTS "local_session";
DROP TABLE IF EXISTS "local_credential";

DROP TYPE IF EXISTS "local_challenge_purpose";
