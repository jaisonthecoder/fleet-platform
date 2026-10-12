-- Reverses 20260926000000_local_auth_admin. Functions only; no data is lost.

DROP FUNCTION IF EXISTS app.local_account_security(UUID[]);
DROP FUNCTION IF EXISTS app.local_challenge_revoke(UUID, local_challenge_purpose);
DROP FUNCTION IF EXISTS app.local_credential_enable(UUID);
