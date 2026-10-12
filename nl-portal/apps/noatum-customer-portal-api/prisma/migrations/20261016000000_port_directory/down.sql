-- Reverses 20261016000000_port_directory.
--
-- Lossy, and worth saying so: the directory is reference data loaded by
-- infra/scripts/seed-ports.mjs, so dropping the table discards whichever edition
-- was imported along with any is_active decisions Noatum made on top of it. Run
-- the seed again after re-applying.
--
-- Quotes are unaffected. They keep the port code and name as their own text,
-- which is why nothing here has a foreign key pointing at this table.

DROP INDEX IF EXISTS port_country_idx;
DROP INDEX IF EXISTS port_code_prefix_idx;
DROP INDEX IF EXISTS port_name_prefix_idx;

DROP POLICY IF EXISTS port_write ON port;
DROP POLICY IF EXISTS port_read ON port;

DROP TABLE IF EXISTS port;
