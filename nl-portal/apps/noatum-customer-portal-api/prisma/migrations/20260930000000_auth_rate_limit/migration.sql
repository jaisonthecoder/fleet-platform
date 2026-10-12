-- ---------------------------------------------------------------------------
-- Sign-in rate limiting moves from process memory into PostgreSQL.
--
-- `RateLimiterMemory` counts inside one Node process. With two instances behind
-- a load balancer an attacker gets one budget per instance, so the protection
-- weakens exactly when we scale for availability. Nothing warns you: the app
-- looks healthy and the limits silently double.
--
-- Deliberately NOT `RateLimiterPostgres` from the same library: it wants its own
-- `pg` client (not installed) and creates its own table at runtime, which would
-- sit outside our migration history and outside RLS. This is the same shape,
-- owned by us.
--
-- Pre-auth by definition, so there is no tenant context and TenantRepository
-- cannot be used. Access is via SECURITY DEFINER functions only, following the
-- pattern the local-auth tables already use.
-- ---------------------------------------------------------------------------

CREATE TABLE auth_rate_limit (
  key          text        PRIMARY KEY,
  points       integer     NOT NULL DEFAULT 0,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_rate_limit_expires_at_idx ON auth_rate_limit (expires_at);

ALTER TABLE auth_rate_limit ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_rate_limit FORCE ROW LEVEL SECURITY;

-- No policy grants anything: every read and write goes through the functions
-- below. The isolation invariant "every table has RLS and a policy" still holds.
CREATE POLICY auth_rate_limit_no_direct_access ON auth_rate_limit
  USING (false)
  WITH CHECK (false);

-- The default privileges granted in 20260101000000 apply to every new table, so
-- revoke explicitly rather than assume. Verified below.
REVOKE ALL ON TABLE auth_rate_limit FROM portal_app;

-- --- consume ---------------------------------------------------------------
-- Atomic increment inside one statement, so two instances cannot both read a
-- stale count and both allow the attempt. Returns the running total.
--
-- `p_block_seconds` mirrors the library's blockDuration: once the budget is
-- spent, extend the window so the caller stays locked out rather than being
-- released when the original window happens to lapse.
-- NOTE ON THE OUT NAMES: a RETURNS TABLE column becomes a PL/pgSQL variable, so an
-- OUT column called `expires_at` makes every bare `expires_at` in the body ambiguous
-- (SQLSTATE 42702) - the same defect fixed for local auth in 20260928000000. The OUT
-- names are therefore deliberately distinct from the table's columns.
CREATE FUNCTION app.rate_limit_consume(
  p_key           text,
  p_points        integer,
  p_window_seconds integer,
  p_block_seconds  integer DEFAULT 0
)
RETURNS TABLE (consumed_points integer, window_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_consumed integer;
  v_expires  timestamptz;
BEGIN
  -- Opportunistic cleanup; cheap because of the expires_at index and it keeps
  -- the table from growing without a scheduled job.
  DELETE FROM auth_rate_limit WHERE auth_rate_limit.expires_at < now() - interval '1 hour';

  INSERT INTO auth_rate_limit AS l (key, points, expires_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT ON CONSTRAINT auth_rate_limit_pkey DO UPDATE
    SET points = CASE WHEN l.expires_at < now() THEN 1 ELSE l.points + 1 END,
        expires_at = CASE
          WHEN l.expires_at < now() THEN now() + make_interval(secs => p_window_seconds)
          ELSE l.expires_at
        END
  RETURNING l.points, l.expires_at INTO v_consumed, v_expires;

  IF p_block_seconds > 0 AND v_consumed > p_points THEN
    UPDATE auth_rate_limit AS l
       SET expires_at = GREATEST(l.expires_at, now() + make_interval(secs => p_block_seconds))
     WHERE l.key = p_key
     RETURNING l.points, l.expires_at INTO v_consumed, v_expires;
  END IF;

  consumed_points := v_consumed;
  window_expires_at := v_expires;
  RETURN NEXT;
END;
$$;

-- --- read ------------------------------------------------------------------
CREATE FUNCTION app.rate_limit_get(p_key text)
RETURNS TABLE (consumed_points integer, window_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT l.points, l.expires_at
    FROM auth_rate_limit l
   WHERE l.key = p_key
     AND l.expires_at >= now();
END;
$$;

-- --- reset -----------------------------------------------------------------
-- Called after a successful sign-in, so one good attempt clears the budget.
CREATE FUNCTION app.rate_limit_delete(p_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  DELETE FROM auth_rate_limit WHERE key = p_key;
END;
$$;

GRANT EXECUTE ON FUNCTION app.rate_limit_consume(text, integer, integer, integer) TO portal_app;
GRANT EXECUTE ON FUNCTION app.rate_limit_get(text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.rate_limit_delete(text) TO portal_app;

-- PostgreSQL grants EXECUTE to PUBLIC by default, which on a SECURITY DEFINER
-- function means any role could clear anyone's attempt budget. Revoke first, then
-- grant only what the runtime needs.
REVOKE EXECUTE ON FUNCTION app.rate_limit_consume(text, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.rate_limit_get(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION app.rate_limit_delete(text) FROM PUBLIC;

-- The runtime role must reach this table only through the functions above.
-- Default privileges have granted new tables to portal_app before, silently.
DO $$
BEGIN
  IF has_table_privilege('portal_app', 'auth_rate_limit', 'SELECT')
     OR has_table_privilege('portal_app', 'auth_rate_limit', 'INSERT')
     OR has_table_privilege('portal_app', 'auth_rate_limit', 'UPDATE')
     OR has_table_privilege('portal_app', 'auth_rate_limit', 'DELETE') THEN
    RAISE EXCEPTION 'portal_app must not hold direct privileges on auth_rate_limit';
  END IF;
END;
$$;
