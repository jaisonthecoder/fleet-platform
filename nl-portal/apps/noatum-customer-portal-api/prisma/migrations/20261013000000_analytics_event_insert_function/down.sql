-- Reverses 20261013000000_analytics_event_insert_function.
--
-- Dropping this restores the silent loss of customer analytics events, so it is
-- only correct as part of rolling the whole migration back.

DROP FUNCTION IF EXISTS app.record_analytics_event(text, text, text, jsonb, uuid, uuid, text);
