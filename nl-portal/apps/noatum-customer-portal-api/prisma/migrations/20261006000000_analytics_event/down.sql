-- Reverses 20261006000000_analytics_event.
--
-- Discards every recorded product-usage event. Nothing of evidential value is
-- lost - that lives in `audit_event`, which this migration never touched - but
-- any usage trend built on this table starts again from zero.

DROP FUNCTION IF EXISTS app.purge_analytics_events(integer);
DROP TABLE IF EXISTS analytics_event;
