-- Reverses 20260925000000_local_auth_hardening.
--
-- Drops the disable helper. The password-setting function is left as it is rather than
-- restored to its earlier form: rolling back to a version that silently re-enables a
-- disabled credential would be reintroducing the defect this migration removed.

DROP FUNCTION IF EXISTS app.local_credential_disable(UUID);
