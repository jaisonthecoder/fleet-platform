-- Reverses 20261008000000_quote_decision.
--
-- Any accepted quote loses the record of WHICH option was accepted. The status
-- survives, so the quote still reads as accepted while the commercially
-- meaningful half of that fact is gone. There is no way to reconstruct it from
-- the remaining columns.

ALTER TABLE quote
  DROP CONSTRAINT IF EXISTS quote_accepted_names_an_option,
  DROP CONSTRAINT IF EXISTS quote_accepted_option_fk,
  DROP CONSTRAINT IF EXISTS quote_decided_by_fk;

ALTER TABLE quote
  DROP COLUMN IF EXISTS accepted_option_id,
  DROP COLUMN IF EXISTS decline_reason,
  DROP COLUMN IF EXISTS decided_at,
  DROP COLUMN IF EXISTS decided_by_id;
