-- Reverses 20260924000000_local_auth_audit. Audit rows already written are kept.

DROP FUNCTION IF EXISTS app.local_auth_audit(TEXT, UUID, UUID, TEXT, JSONB, TEXT);
