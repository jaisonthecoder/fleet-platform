-- Reverse of 20260101000000_tenancy_roles_rls (ADR-001: every migration is reversible).
--
-- Order matters: drop policies before the functions they call, and leave the roles in
-- place — dropping a role that owns objects elsewhere fails, and a role with no grants
-- is harmless.

-- --- policies --------------------------------------------------------------
DROP POLICY IF EXISTS customer_group_tenant_isolation ON customer_group;
DROP POLICY IF EXISTS customer_account_tenant_isolation ON customer_account;
DROP POLICY IF EXISTS invitation_tenant_isolation ON invitation;
DROP POLICY IF EXISTS quote_tenant_isolation ON quote;
DROP POLICY IF EXISTS quote_template_tenant_isolation ON quote_template;
DROP POLICY IF EXISTS address_book_entry_tenant_isolation ON address_book_entry;
DROP POLICY IF EXISTS user_tenant_isolation ON "user";
DROP POLICY IF EXISTS news_item_read ON news_item;
DROP POLICY IF EXISTS news_item_write ON news_item;
DROP POLICY IF EXISTS audit_event_read ON audit_event;
DROP POLICY IF EXISTS audit_event_insert ON audit_event;

-- --- row level security ----------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customer_group',
    'customer_account',
    'invitation',
    'quote',
    'quote_template',
    'address_book_entry',
    'user',
    'news_item',
    'audit_event'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- --- grants ----------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM portal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM portal_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM portal_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM portal_app;
REVOKE USAGE ON SCHEMA public FROM portal_app;

-- --- helper functions and schema -------------------------------------------
REVOKE EXECUTE ON FUNCTION app.current_group(), app.is_internal(), app.require_group() FROM portal_app;
REVOKE USAGE ON SCHEMA app FROM portal_app;

DROP FUNCTION IF EXISTS app.require_group();
DROP FUNCTION IF EXISTS app.is_internal();
DROP FUNCTION IF EXISTS app.current_group();

-- Only drops if empty, which is what we want — a later migration may have added to it.
DROP SCHEMA IF EXISTS app RESTRICT;

-- pgboss owns its own state. Dropping it would discard queued and failed jobs, so it is
-- left in place deliberately; remove it by hand if the database is being torn down.

-- Roles are intentionally NOT dropped. See the header.
