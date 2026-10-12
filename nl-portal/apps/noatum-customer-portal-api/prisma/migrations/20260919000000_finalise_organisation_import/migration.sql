-- ---------------------------------------------------------------------------
-- app.finalise_organisation_import — deactivation by absence, with a brake.
--
-- The batch writer (app.apply_organisation_batch) deliberately does NOT handle
-- absence: it sees one page at a time and cannot know whether a code is gone or
-- simply in another page. Only the importer knows the whole snapshot, so the
-- decision belongs here (see the note in 20260916010000).
--
-- THE BRAKE. "Absent from the export" and "the export was truncated" look
-- identical from the database's side, and the second one would silently revoke a
-- live customer's access to every shipment under those codes. So a run that
-- carries less than half of what is currently active is REFUSED rather than
-- applied, and says so. The operator re-runs with a complete file or, if the
-- shrinkage is real, deactivates by hand with a reason.
--
-- Small directories are exempt: going from 4 organisations to 1 is plausible in
-- a new environment, and a brake that fires constantly gets disabled.
--
-- Deactivation NEVER deletes and never touches customer_account: an organisation
-- going inactive in CargoWise must not strip a live link, it must raise an alert
-- (doc 13 section 9). The link survives; only is_active changes.
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

  -- Only an authoritative snapshot may deactivate. A delta says nothing about
  -- what it does not mention.
  IF NOT v_run.is_authoritative OR v_run.mode <> 'snapshot' THEN
    RETURN jsonb_build_object('deactivated', 0, 'skipped', 'not-an-authoritative-snapshot');
  END IF;

  SELECT array_agg(DISTINCT lower(btrim(code))) INTO v_seen
  FROM unnest(coalesce(p_seen_codes, ARRAY[]::text[])) AS code
  WHERE btrim(code) <> '';

  v_seen := coalesce(v_seen, ARRAY[]::text[]);
  v_seen_count := array_length(v_seen, 1);
  v_seen_count := coalesce(v_seen_count, 0);

  SELECT count(*) INTO v_active_now
  FROM master_org
  WHERE source_system = v_run.source_system
    AND source_instance = v_run.source_instance
    AND is_active;

  IF v_active_now > 10 AND v_seen_count * 2 < v_active_now THEN
    RETURN jsonb_build_object(
      'deactivated', 0,
      'refused', 'snapshot-too-small',
      'seen', v_seen_count,
      'activeBefore', v_active_now
    );
  END IF;

  PERFORM set_config('app.org_batch', 'on', true);

  FOR v_row IN
    SELECT id, source_code, name, is_active
    FROM master_org
    WHERE source_system = v_run.source_system
      AND source_instance = v_run.source_instance
      AND is_active
      AND NOT (code_norm = ANY (v_seen))
    FOR UPDATE
  LOOP
    UPDATE master_org
       SET is_active = false,
           last_seen_at = last_seen_at,
           updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO org_change_log (org_id, run_id, change_type, before, after)
    VALUES (
      v_row.id,
      p_run_id,
      'deactivated',
      jsonb_build_object('isActive', true),
      jsonb_build_object('isActive', false, 'reason', 'absent-from-authoritative-snapshot')
    );

    v_deactivated := v_deactivated + 1;
  END LOOP;

  PERFORM set_config('app.org_batch', 'off', true);

  UPDATE org_import_run
     SET rows_deactivated = v_deactivated
   WHERE id = p_run_id;

  RETURN jsonb_build_object('deactivated', v_deactivated, 'seen', v_seen_count, 'activeBefore', v_active_now);
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.org_batch', 'off', true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION app.finalise_organisation_import(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.finalise_organisation_import(uuid, text[]) TO portal_app;

COMMENT ON FUNCTION app.finalise_organisation_import(uuid, text[]) IS
  'Deactivates organisations absent from an authoritative full snapshot. Refuses when the snapshot carries less than half the currently active rows, because a truncated export and a genuine removal are indistinguishable here.';
