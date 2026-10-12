-- Reverses 20260916010000_apply_organisation_batch_cw1_fields.
--
-- The function is dropped rather than restored to its 20260915010000 body: the
-- columns it referenced (source_parent_code) only exist once
-- 20260916000000_organisation_cw1_alignment is also reversed, and that migration
-- recreates them. Re-apply 20260915010000 after rolling both back.

DROP FUNCTION IF EXISTS app.apply_organisation_batch(uuid, jsonb);
