-- ---------------------------------------------------------------------------
-- Close two holes in the deactivation brake.
--
-- 1. AN EMPTY SNAPSHOT WAS NOT GUARDED BELOW ELEVEN ACTIVE ROWS. The brake only
--    armed when more than ten organisations were active, so a small directory
--    receiving an empty or unparseable export had every row deactivated — the
--    exact outcome the brake exists to prevent. Zero seen is now always refused,
--    at any size: nothing legitimate ever removes the entire directory at once.
--
-- 2. `last_seen_at = last_seen_at` was a no-op left in the UPDATE.
--
-- The half-of-active threshold is unchanged and remains deliberate: below it the
-- run declines rather than guesses, and the operator re-runs with a complete file.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.finalise_organisation_import(p_run_id uuid, p_seen_codes text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run          record;
  v_seen         text[];
  v_active_now   integer;
  v_seen_count   integer;
  v_deactivated  integer := 0;
  v_row          record;
BEGIN
  SELECT * INTO v_run FROM org_import_run WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown import run %', p_run_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_run.outcome <> 'running' THEN
    RAISE EXCEPTION 'Import run % is already %', p_run_id, v_run.outcome USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT v_run.is_authoritative OR v_run.mode <> 'snapshot' THEN
    RETURN jsonb_build_object('deactivated', 0, 'skipped', 'not-an-authoritative-snapshot');
  END IF;

  SELECT array_agg(DISTINCT lower(btrim(code))) INTO v_seen
  FROM unnest(coalesce(p_seen_codes, ARRAY[]::text[])) AS code
  WHERE btrim(code) <> '';

  v_seen := coalesce(v_seen, ARRAY[]::text[]);
  v_seen_count := coalesce(array_length(v_seen, 1), 0);

  SELECT count(*) INTO v_active_now
  FROM master_org
  WHERE source_system = v_run.source_system
    AND source_instance = v_run.source_instance
    AND is_active;

  -- An empty snapshot is never a legitimate instruction to empty the directory.
  IF v_seen_count = 0 AND v_active_now > 0 THEN
    RETURN jsonb_build_object(
      'deactivated', 0, 'refused', 'snapshot-empty', 'seen', 0, 'activeBefore', v_active_now
    );
  END IF;

  IF v_active_now > 10 AND v_seen_count * 2 < v_active_now THEN
    RETURN jsonb_build_object(
      'deactivated', 0, 'refused', 'snapshot-too-small', 'seen', v_seen_count, 'activeBefore', v_active_now
    );
  END IF;

  PERFORM set_config('app.org_batch', 'on', true);

  FOR v_row IN
    SELECT id, source_code
    FROM master_org
    WHERE source_system = v_run.source_system
      AND source_instance = v_run.source_instance
      AND is_active
      AND NOT (code_norm = ANY (v_seen))
    FOR UPDATE
  LOOP
    UPDATE master_org SET is_active = false, updated_at = now() WHERE id = v_row.id;

    INSERT INTO org_change_log (org_id, run_id, change_type, before, after)
    VALUES (
      v_row.id, p_run_id, 'deactivated',
      jsonb_build_object('isActive', true),
      jsonb_build_object('isActive', false, 'reason', 'absent-from-authoritative-snapshot')
    );

    v_deactivated := v_deactivated + 1;
  END LOOP;

  PERFORM set_config('app.org_batch', 'off', true);

  UPDATE org_import_run SET rows_deactivated = v_deactivated WHERE id = p_run_id;

  RETURN jsonb_build_object('deactivated', v_deactivated, 'seen', v_seen_count, 'activeBefore', v_active_now);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.org_batch', 'off', true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION app.finalise_organisation_import(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.finalise_organisation_import(uuid, text[]) TO portal_app;
