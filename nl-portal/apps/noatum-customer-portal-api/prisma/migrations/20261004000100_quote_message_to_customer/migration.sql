-- ---------------------------------------------------------------------------
-- C4 follow-up - the staff message needs its own column
--
-- `price()` first wrote the pricer's message into `quote.notes`. That column is
-- the CUSTOMER's remarks to the pricing team, captured at request time - the
-- very text the pricer is reading in order to answer. Pricing a quote therefore
-- destroyed the request it was answering, and the second pricer to open it would
-- have found the remarks gone with no way to recover them.
--
-- Separate column, because these are two different people's words about the same
-- shipment and neither is a draft of the other.
-- ---------------------------------------------------------------------------

ALTER TABLE quote
  ADD COLUMN IF NOT EXISTS message_to_customer text;

COMMENT ON COLUMN quote.message_to_customer IS
  'The pricer''s covering message. Drafted while pricing, sent only on publish - never by the act of saving. Distinct from `notes`, which is the customer''s own remarks.';
COMMENT ON COLUMN quote.notes IS
  'The CUSTOMER''s remarks, captured with the request. Never written by staff.';
