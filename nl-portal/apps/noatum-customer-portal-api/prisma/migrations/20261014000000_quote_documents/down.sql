-- Reverses 20261014000000_quote_documents.
--
-- Drops the links and the file records. The objects themselves stay in the
-- container: this migration cannot reach them, and deleting customer documents
-- because a schema was rolled back would be the wrong default. Clean the
-- container by hand if the rollback is permanent.

DROP FUNCTION IF EXISTS app.record_stored_file(text, text, text, text, integer, text, uuid);

DROP TABLE IF EXISTS quote_document;
DROP TABLE IF EXISTS stored_file;

DROP TYPE IF EXISTS quote_document_direction;
DROP TYPE IF EXISTS stored_file_scan_status;
