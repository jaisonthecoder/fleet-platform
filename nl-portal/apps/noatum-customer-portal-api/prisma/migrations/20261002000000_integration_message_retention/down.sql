-- Reverting stops retention running, so integration message payloads accumulate
-- indefinitely again. Already-redacted payloads are not recoverable.

DROP FUNCTION IF EXISTS app.redact_integration_messages(integer);
