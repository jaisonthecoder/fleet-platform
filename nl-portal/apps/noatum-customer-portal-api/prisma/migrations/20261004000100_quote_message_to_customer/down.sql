-- Reverses 20261004000100_quote_message_to_customer.
--
-- Drops every drafted covering message. It does NOT put them back into `notes`,
-- because that column holds the customer's own words and merging the two would
-- corrupt both.

ALTER TABLE quote DROP COLUMN IF EXISTS message_to_customer;
