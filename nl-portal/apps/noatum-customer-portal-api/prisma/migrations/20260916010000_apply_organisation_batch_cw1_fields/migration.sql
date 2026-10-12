-- ---------------------------------------------------------------------------
-- app.apply_organisation_batch, aligned with the CargoWise field set.
--
-- Replaces the 20260915010000 version. Three changes, all driven by
-- docs/Orignal Docs/12-CW1-Organisation-Schema-and-Portal-Directory-Design.md:
--
--  * accepts `category` (OrgHeader.Category) and `roles` (the Is* booleans that
--    were true), so the source's own classification is stored rather than only
--    our derived is_customer flag;
--  * `controllingCustomerCode` replaces `sourceParentCode`, matching the field
--    that actually exists in CargoWise;
--  * the change hash covers the new source-owned fields, so a role or category
--    change is detected as a real change rather than silently ignored.
--
-- Unchanged and deliberate: no deactivation-by-absence here (the truncated
-- snapshot brake belongs with the importer, ORG-03), confirmation only ever
-- moves forward, and the narrow app.org_batch flag is lowered on both the
-- success and the error path.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.apply_organisation_batch(p_run_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run       record;
  v_row       jsonb;
  v_code      text;
  v_instance  text;
  v_system    text;
  v_roles     text[];
  v_hash      char(64);
  v_confirmed boolean;
  v_existing  record;
  v_org_id    uuid;
  v_created   integer := 0;
  v_updated   integer := 0;
  v_unchanged integer := 0;
  v_rejected  integer := 0;
  v_errors    jsonb := '[]'::jsonb;
  v_index     integer := 0;
BEGIN
  SELECT * INTO v_run FROM org_import_run WHERE id = p_run_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown import run %', p_run_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_run.outcome <> 'running' THEN
    RAISE EXCEPTION 'Import run % is already %', p_run_id, v_run.outcome USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Batch payload must be a JSON array' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- A manual entry is provisional by definition: nothing has confirmed it, so it
  -- stays unlinkable until a source run says otherwise.
  v_confirmed := v_run.source_kind <> 'manual';

  PERFORM set_config('app.org_batch', 'on', true);

  FOR v_row IN SELECT jsonb_array_elements(p_rows) LOOP
    v_index := v_index + 1;
    v_code := btrim(COALESCE(v_row->>'sourceCode', ''));
    v_system := COALESCE(NULLIF(btrim(COALESCE(v_row->>'sourceSystem', '')), ''), v_run.source_system);
    v_instance := COALESCE(NULLIF(btrim(COALESCE(v_row->>'sourceInstance', '')), ''), v_run.source_instance);

    IF v_code = '' OR btrim(COALESCE(v_row->>'name', '')) = '' THEN
      v_rejected := v_rejected + 1;
      v_errors := v_errors || jsonb_build_object(
        'index', v_index,
        'sourceCode', v_row->>'sourceCode',
        'reason', CASE WHEN v_code = '' THEN 'missing source code' ELSE 'missing name' END
      );
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(value ORDER BY value), ARRAY[]::text[]) INTO v_roles
    FROM jsonb_array_elements_text(COALESCE(v_row->'roles', '[]'::jsonb));

    -- Source-owned fields only. Portal state such as is_source_confirmed must
    -- never make a row look changed.
    v_hash := encode(sha256(convert_to(concat_ws(
      E'\u001F',
      v_code,
      COALESCE(v_row->>'name', ''),
      COALESCE(v_row->>'legalName', ''),
      COALESCE(v_row->>'category', ''),
      COALESCE(v_row->>'countryCode', ''),
      COALESCE(v_row->>'city', ''),
      COALESCE(v_row->>'state', ''),
      COALESCE(v_row->>'postcode', ''),
      COALESCE(v_row->>'sourceBranchCode', ''),
      COALESCE(v_row->>'controllingCustomerCode', ''),
      array_to_string(v_roles, ','),
      COALESCE(v_row->>'isCustomer', 'false'),
      COALESCE(v_row->>'isSupplier', 'false')
    ), 'UTF8')), 'hex');

    SELECT id, source_hash INTO v_existing
    FROM master_org
    WHERE source_system = v_system
      AND source_instance = v_instance
      AND code_norm = lower(v_code);

    IF NOT FOUND THEN
      INSERT INTO master_org (
        source_code, source_system, source_instance, source_kind,
        name, legal_name, category, source_roles,
        country_code, city, state, postcode,
        source_branch_code, source_controlling_customer_code,
        is_customer, is_supplier,
        is_active, is_source_confirmed, confirmed_by_run_id,
        source_version, source_hash, last_seen_at
      ) VALUES (
        v_code, v_system, v_instance, v_run.source_kind,
        v_row->>'name', v_row->>'legalName', NULLIF(v_row->>'category', ''), v_roles,
        NULLIF(v_row->>'countryCode', ''), v_row->>'city', v_row->>'state', v_row->>'postcode',
        v_row->>'sourceBranchCode', v_row->>'controllingCustomerCode',
        COALESCE((v_row->>'isCustomer')::boolean, false),
        COALESCE((v_row->>'isSupplier')::boolean, false),
        COALESCE((v_row->>'isActive')::boolean, true),
        v_confirmed, CASE WHEN v_confirmed THEN p_run_id END,
        v_row->>'sourceVersion', v_hash, now()
      )
      RETURNING id INTO v_org_id;

      v_created := v_created + 1;
      INSERT INTO org_change_log (org_id, run_id, change_type, before, after)
      VALUES (v_org_id, p_run_id, 'created', NULL, v_row);

    ELSIF v_existing.source_hash IS DISTINCT FROM v_hash THEN
      UPDATE master_org SET
        source_code = v_code,
        name = v_row->>'name',
        legal_name = v_row->>'legalName',
        category = COALESCE(NULLIF(v_row->>'category', ''), category),
        source_roles = v_roles,
        country_code = NULLIF(v_row->>'countryCode', ''),
        city = v_row->>'city',
        state = v_row->>'state',
        postcode = v_row->>'postcode',
        source_branch_code = v_row->>'sourceBranchCode',
        source_controlling_customer_code = v_row->>'controllingCustomerCode',
        is_customer = COALESCE((v_row->>'isCustomer')::boolean, is_customer),
        is_supplier = COALESCE((v_row->>'isSupplier')::boolean, is_supplier),
        is_active = COALESCE((v_row->>'isActive')::boolean, true),
        -- Confirmation only ever moves forward: a manual re-touch of a
        -- source-confirmed row must not demote it back to provisional.
        is_source_confirmed = is_source_confirmed OR v_confirmed,
        confirmed_by_run_id = CASE
          WHEN is_source_confirmed THEN confirmed_by_run_id
          WHEN v_confirmed THEN p_run_id
          ELSE confirmed_by_run_id
        END,
        source_version = COALESCE(v_row->>'sourceVersion', source_version),
        source_hash = v_hash,
        last_seen_at = now(),
        updated_at = now()
      WHERE id = v_existing.id;

      v_updated := v_updated + 1;
      INSERT INTO org_change_log (org_id, run_id, change_type, before, after)
      VALUES (v_existing.id, p_run_id, 'updated',
              jsonb_build_object('sourceHash', v_existing.source_hash), v_row);

    ELSE
      -- Identical content. Record that it was seen; write no history row, or the
      -- history tab fills with "seen again, unchanged" and becomes unreadable.
      UPDATE master_org SET
        last_seen_at = now(),
        is_source_confirmed = is_source_confirmed OR v_confirmed,
        confirmed_by_run_id = CASE
          WHEN is_source_confirmed THEN confirmed_by_run_id
          WHEN v_confirmed THEN p_run_id
          ELSE confirmed_by_run_id
        END
      WHERE id = v_existing.id;
      v_unchanged := v_unchanged + 1;
    END IF;
  END LOOP;

  UPDATE org_import_run SET
    rows_read = rows_read + v_index,
    rows_created = rows_created + v_created,
    rows_updated = rows_updated + v_updated,
    rows_unchanged = rows_unchanged + v_unchanged,
    rows_rejected = rows_rejected + v_rejected,
    errors = errors || v_errors
  WHERE id = p_run_id;

  PERFORM set_config('app.org_batch', 'off', true);

  RETURN jsonb_build_object(
    'read', v_index,
    'created', v_created,
    'updated', v_updated,
    'unchanged', v_unchanged,
    'rejected', v_rejected,
    'errors', v_errors
  );
EXCEPTION WHEN OTHERS THEN
  -- Never leave the write flag raised for the rest of the caller's transaction.
  PERFORM set_config('app.org_batch', 'off', true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION app.apply_organisation_batch(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.apply_organisation_batch(uuid, jsonb) TO portal_app;
