-- Reverses 20260927000000_local_auth_self_service. Function only; no data is lost.

DROP FUNCTION IF EXISTS app.local_mfa_restart(UUID);
