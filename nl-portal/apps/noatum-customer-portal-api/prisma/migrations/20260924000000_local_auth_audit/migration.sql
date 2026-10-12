-- Audit for events that happen before anyone is signed in.
--
-- Sign-in, activation, password reset and bootstrap provisioning all need an audit
-- trail, but none of them has a tenant context to write under: audit_event is behind
-- RLS and the request carries no customer group yet. Rather than widen that policy,
-- one definer function writes the row.
--
-- Deliberately narrow: the caller chooses the action and the metadata, never the table.

CREATE OR REPLACE FUNCTION app.local_auth_audit(
  p_action     TEXT,
  p_actor_id   UUID,
  p_group_id   UUID,
  p_entity_id  TEXT,
  p_metadata   JSONB,
  p_ip         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  IF p_action NOT LIKE 'auth.%' THEN
    RAISE EXCEPTION 'local_auth_audit only writes auth.* actions, not %', p_action
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO audit_event (customer_group_id, actor_user_id, action, entity_type, entity_id, metadata, ip_address)
  VALUES (
    p_group_id,
    p_actor_id,
    p_action,
    'local_auth',
    p_entity_id,
    COALESCE(p_metadata, '{}'::JSONB),
    -- A malformed forwarded address must not lose the audit row.
    CASE WHEN p_ip IS NULL THEN NULL ELSE
      (SELECT CASE WHEN p_ip ~ '^[0-9a-fA-F:.]+$' THEN p_ip::INET ELSE NULL END)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION app.local_auth_audit(TEXT, UUID, UUID, TEXT, JSONB, TEXT) TO portal_app;
