-- ---------------------------------------------------------------------------
-- The customer's answer, recorded
--
-- A quote reaching `accepted` said nothing about WHICH option was accepted. With
-- several priced options that is the only part that matters commercially: the
-- booking that follows, the invoice, and any argument six months later all turn
-- on which of them the customer chose.
--
-- `decline_reason` is optional by design. Making it mandatory would produce a
-- column full of "no" - a customer owes us no explanation, and a required field
-- they resent typing is worth less than an empty one they chose to skip.
-- ---------------------------------------------------------------------------

ALTER TABLE quote
  ADD COLUMN IF NOT EXISTS accepted_option_id uuid,
  ADD COLUMN IF NOT EXISTS decline_reason     varchar(400),
  ADD COLUMN IF NOT EXISTS decided_at         timestamptz(6),
  ADD COLUMN IF NOT EXISTS decided_by_id      uuid;

ALTER TABLE quote
  ADD CONSTRAINT quote_accepted_option_fk
    FOREIGN KEY (accepted_option_id) REFERENCES quote_option (id) ON DELETE SET NULL,
  ADD CONSTRAINT quote_decided_by_fk
    FOREIGN KEY (decided_by_id) REFERENCES "user" (id) ON DELETE SET NULL;

-- An accepted quote names an option. Enforced here rather than trusted to the
-- service, because "accepted, but we do not know what" is unrecoverable once the
-- options have been replaced by a later re-price.
ALTER TABLE quote
  ADD CONSTRAINT quote_accepted_names_an_option
    CHECK (status <> 'accepted' OR accepted_option_id IS NOT NULL);

COMMENT ON COLUMN quote.accepted_option_id IS
  'Which priced option the customer chose. The booking and the invoice both hang off this.';
COMMENT ON COLUMN quote.decline_reason IS
  'Optional. A customer owes no explanation; a mandatory field would fill with "no".';
