-- Reverses 20261004000000_quote_pricing.
--
-- Dropping these discards every priced option and charge line. A quote that was
-- `priced` or `published` keeps its headline total on the quote row but loses the
-- breakdown behind it, so it can no longer be explained to the customer who
-- received it. Read that sentence again before running this anywhere real.
--
-- Cost goes first, then charge lines, then options: the foreign keys cascade, but
-- being explicit means the order is not an accident of DDL.

DROP TABLE IF EXISTS quote_charge_line_cost;
DROP TABLE IF EXISTS quote_charge_line;
DROP TABLE IF EXISTS quote_option;
