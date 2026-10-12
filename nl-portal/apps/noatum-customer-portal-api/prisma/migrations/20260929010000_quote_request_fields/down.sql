-- Reverses 20260929010000_quote_request_fields.
--
-- Dropping the six columns discards whatever customers submitted in them. That is
-- correct for a rollback of this migration - the data had nowhere to live before
-- it - but it is not recoverable, so take a backup first on anything but a local
-- database.

DROP FUNCTION IF EXISTS app.next_quote_reference(uuid);

DROP POLICY IF EXISTS quote_reference_counter_tenant_isolation ON quote_reference_counter;
DROP TABLE IF EXISTS quote_reference_counter;

ALTER TABLE quote
  DROP COLUMN IF EXISTS incoterm,
  DROP COLUMN IF EXISTS ready_date,
  DROP COLUMN IF EXISTS customer_reference,
  DROP COLUMN IF EXISTS service_level,
  DROP COLUMN IF EXISTS volume_m3,
  DROP COLUMN IF EXISTS notes;
