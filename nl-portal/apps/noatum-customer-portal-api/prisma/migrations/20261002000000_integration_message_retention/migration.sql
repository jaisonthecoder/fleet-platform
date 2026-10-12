-- ---------------------------------------------------------------------------
-- Retention for the integration message store.
--
-- The store keeps another system's payloads, which contain customer data. The
-- table's migration said retention was "a scheduled job"; there was no such job,
-- so payloads accumulated indefinitely.
--
-- This REDACTS rather than deletes. Knowing that an exchange happened, when, and
-- what came of it is the operational record; the payload is only needed while a
-- replay is still plausible. Deleting the row would throw away the evidence along
-- with the data.
--
-- SECURITY INVOKER, deliberately. `portal_app` already holds UPDATE on this table,
-- so running as the definer would be a privilege escalation that buys nothing —
-- and it would turn a blank-every-customer's-data primitive into something any
-- session could call. As the invoker, row-level security applies: the policy's
-- USING clause is internal-only, so a customer session matches no rows at all.
-- The explicit check below states that rather than leaving it to be inferred.
-- ---------------------------------------------------------------------------

CREATE FUNCTION app.redact_integration_messages(p_retain_days integer)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT app.is_internal() THEN
    RAISE EXCEPTION 'retention is internal-only'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_retain_days IS NULL OR p_retain_days < 1 THEN
    RAISE EXCEPTION 'retention must be at least one day';
  END IF;

  -- Settled and done with. Three exclusions, each for its own reason:
  --   pending / sending - still has work to do, whatever its age, and without its
  --     payload that work becomes impossible;
  --   failed - the enum says "kept for replay", and a replay needs the payload;
  --   inbound - no inbound message reaches a settled status until the inbound door
  --     in C7 exists to process one, so today they are all legitimately pending.
  UPDATE integration_message
     SET payload = '{}'::jsonb,
         updated_at = now()
   WHERE direction = 'outbound'
     AND status IN ('sent', 'acknowledged', 'skipped')
     AND created_at < now() - make_interval(days => p_retain_days)
     AND payload <> '{}'::jsonb;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.redact_integration_messages(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.redact_integration_messages(integer) TO portal_app;
