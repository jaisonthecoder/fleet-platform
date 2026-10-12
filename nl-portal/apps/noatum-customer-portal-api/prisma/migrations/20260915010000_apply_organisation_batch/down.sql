-- Reverses 20260915010000_apply_organisation_batch.

REVOKE EXECUTE ON FUNCTION app.apply_organisation_batch(uuid, jsonb) FROM portal_app;
DROP FUNCTION IF EXISTS app.apply_organisation_batch(uuid, jsonb);
DROP POLICY IF EXISTS org_batch_write ON "master_org";
