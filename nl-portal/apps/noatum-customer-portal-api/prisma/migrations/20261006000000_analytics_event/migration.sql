-- ---------------------------------------------------------------------------
-- AnalyticsEvent had nowhere to go.
--
-- The Definition of Done asks for an analytics event on every user action, and
-- seven services dutifully emit one - into `logger.log`. Nothing persisted it,
-- so every question the events exist to answer ("is anyone using the quote
-- wizard", "where do people abandon onboarding") could only be answered by
-- grepping application logs, which are retained for days and are not queryable.
--
-- Separate from `audit_event` on purpose, and the distinction is not pedantry:
--   - audit answers "who changed this record, and may I prove it later".
--     It is evidence, it is retained for years, and it is never sampled or
--     trimmed.
--   - analytics answers "how is the product being used". It is disposable, it
--     is aggregated, and it gets a retention sweep.
-- Putting them in one table means either keeping click data for seven years or
-- deleting evidence, and both are wrong.
-- ---------------------------------------------------------------------------

CREATE TABLE analytics_event (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable: a staff action has no customer group, and forcing one would mean
  -- inventing an attribution that is not true.
  customer_group_id uuid REFERENCES customer_group (id) ON DELETE SET NULL,
  actor_user_id     uuid REFERENCES "user" (id) ON DELETE SET NULL,
  action            varchar(120) NOT NULL,
  entity_type       varchar(80),
  entity_id         varchar(80),
  -- No personal data. This is counts and shapes, not a second copy of the
  -- record - which is why it can be deleted on a schedule without losing
  -- anything the business needs.
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id    varchar(80),
  created_at        timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX analytics_event_action_idx ON analytics_event (action, created_at);
CREATE INDEX analytics_event_created_idx ON analytics_event (created_at);
CREATE INDEX analytics_event_group_idx
  ON analytics_event (customer_group_id, created_at)
  WHERE customer_group_id IS NOT NULL;

ALTER TABLE analytics_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_event FORCE ROW LEVEL SECURITY;

-- Reading is internal only. A customer has no business seeing usage data, not
-- even their own: it would expose how Noatum staff work a request.
CREATE POLICY analytics_event_read ON analytics_event
  FOR SELECT
  USING (app.is_internal());

-- Writing is open to any authenticated session, because a customer action is
-- exactly the thing worth counting. The WITH CHECK stops a customer attributing
-- an event to another group.
CREATE POLICY analytics_event_write ON analytics_event
  FOR INSERT
  WITH CHECK (
    app.is_internal()
    OR customer_group_id IS NULL
    OR customer_group_id = app.current_group()
  );

-- No UPDATE and no DELETE policy, so neither is possible through portal_app.
-- Analytics is append-only; the retention sweep runs as the owner.
GRANT SELECT, INSERT ON analytics_event TO portal_app;

-- ---------------------------------------------------------------------------
-- Retention
--
-- SECURITY INVOKER with an explicit internal check, not SECURITY DEFINER. The
-- retention job runs internally and already has the rights it needs; a definer
-- function here would be a delete-everything primitive callable from any
-- session, which is a much larger thing to own than the convenience is worth.
-- ---------------------------------------------------------------------------
CREATE FUNCTION app.purge_analytics_events(p_retain_days integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  IF NOT app.is_internal() THEN
    RAISE EXCEPTION 'purge_analytics_events requires an internal context'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_retain_days IS NULL OR p_retain_days < 1 THEN
    RAISE EXCEPTION 'retention must be at least one day';
  END IF;

  DELETE FROM analytics_event
  WHERE created_at < now() - make_interval(days => p_retain_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.purge_analytics_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.purge_analytics_events(integer) TO portal_owner;

COMMENT ON TABLE analytics_event IS
  'Product usage. Append-only, internally readable, swept on a retention schedule. Distinct from audit_event, which is evidence and is never trimmed.';
