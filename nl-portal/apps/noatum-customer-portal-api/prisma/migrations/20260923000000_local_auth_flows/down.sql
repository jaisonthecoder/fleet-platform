-- Reverses 20260923000000_local_auth_flows.
--
-- Functions only: no table created here, so nothing to lose. The storage and its
-- accessors belong to 20260922000000 and are dropped by that migration's down.sql.

DROP FUNCTION IF EXISTS app.local_record_login(UUID);
DROP FUNCTION IF EXISTS app.local_session_promote(TEXT);
DROP FUNCTION IF EXISTS app.local_mfa_reset(UUID);
DROP FUNCTION IF EXISTS app.local_recovery_codes_remaining(UUID);
DROP FUNCTION IF EXISTS app.local_recovery_code_use(UUID, TEXT);
DROP FUNCTION IF EXISTS app.local_recovery_codes_replace(UUID, TEXT[]);
DROP FUNCTION IF EXISTS app.local_mfa_use_step(UUID, BIGINT, BOOLEAN);
DROP FUNCTION IF EXISTS app.local_mfa_factor_get(UUID);
DROP FUNCTION IF EXISTS app.local_mfa_begin(UUID, TEXT);
DROP FUNCTION IF EXISTS app.local_bootstrap_admin(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS app.local_password_set_from_challenge(local_challenge_purpose, TEXT, TEXT);
