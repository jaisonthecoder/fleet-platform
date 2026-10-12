-- Reverts to the 20260919000000 definition, which did not guard an empty snapshot
-- below eleven active rows. Kept only so the migration is reversible.
DROP FUNCTION IF EXISTS app.finalise_organisation_import(uuid, text[]);
