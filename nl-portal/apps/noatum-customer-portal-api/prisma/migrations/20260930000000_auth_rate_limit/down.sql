-- Reverting returns sign-in rate limiting to per-process memory, which does not
-- hold across more than one instance.

DROP FUNCTION IF EXISTS app.rate_limit_delete(text);
DROP FUNCTION IF EXISTS app.rate_limit_get(text);
DROP FUNCTION IF EXISTS app.rate_limit_consume(text, integer, integer, integer);

DROP POLICY IF EXISTS auth_rate_limit_no_direct_access ON auth_rate_limit;
DROP TABLE IF EXISTS auth_rate_limit;
