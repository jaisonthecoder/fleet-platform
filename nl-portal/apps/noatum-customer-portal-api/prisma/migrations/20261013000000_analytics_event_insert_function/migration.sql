-- ---------------------------------------------------------------------------
-- Customer analytics events were never being written.
--
-- `analytics_event` has an INSERT policy that deliberately allows a customer to
-- record their own actions, and a SELECT policy restricted to internal sessions.
-- Prisma's `create()` emits `INSERT ... RETURNING`, and PostgreSQL applies the
-- SELECT policy to the RETURNING clause - so every customer insert was refused
-- with "new row violates row-level security policy".
--
-- `AnalyticsService` swallows its own failures by design, so nothing surfaced:
-- every `quote.requested`, `quote.accepted`, `quote.rejected` and
-- `quote.withdrawn` event a customer generated has been silently dropped since
-- the table was created. Staff events were unaffected, which is why the table
-- never looked empty.
--
-- Worse, the swallow does not work inside a transaction. Catching the error in
-- JavaScript does not un-abort the PostgreSQL transaction, so any statement
-- after the analytics write fails too. The failure was invisible only while
-- nothing followed it.
--
-- The fix is the one this schema already uses for `integration_message`, and for
-- the identical reason: a SECURITY DEFINER function that re-checks the tenancy
-- rule it bypasses, so the caller never needs SELECT on the table.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.record_analytics_event(
  p_action         text,
  p_entity_type    text,
  p_entity_id      text,
  p_metadata       jsonb,
  p_customer_group uuid,
  p_actor_user     uuid,
  p_correlation_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  -- The tenancy rule the INSERT policy states, enforced here because this
  -- function bypasses it. A customer may record for themselves or for nobody,
  -- never for another group.
  IF NOT app.is_internal() THEN
    IF p_customer_group IS NOT NULL AND p_customer_group IS DISTINCT FROM app.current_group() THEN
      RAISE EXCEPTION 'refusing to record an analytics event for another customer'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- No RETURNING: nothing needs the id, and asking for it is what broke this.
  INSERT INTO analytics_event (
    customer_group_id, actor_user_id, action, entity_type, entity_id,
    metadata, correlation_id
  )
  VALUES (
    p_customer_group, p_actor_user, p_action, p_entity_type, p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb), p_correlation_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION app.record_analytics_event(text, text, text, jsonb, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.record_analytics_event(text, text, text, jsonb, uuid, uuid, text) TO portal_app;

COMMENT ON FUNCTION app.record_analytics_event(text, text, text, jsonb, uuid, uuid, text) IS
  'Records an analytics event without RETURNING, so a customer session is not blocked by the internal-only SELECT policy. Re-checks the tenancy rule it bypasses.';
