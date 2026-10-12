-- ---------------------------------------------------------------------------
-- Tenancy: database roles, tenant-context functions, RLS policies, grants.
--
-- Run order matters: this migration must come AFTER the Prisma-generated
-- migration that creates the tables, and it must be re-applied (as a new
-- migration) whenever a table holding customer data is added.
--
-- Roles
--   portal_owner : owns the schema, used ONLY by the pipeline migration step.
--   portal_app   : the runtime role the API connects as. No BYPASSRLS, no DDL.
--
-- Tenant context
--   The API sets app.customer_group_id (and app.is_internal) per transaction
--   via TenantRepository. RLS policies read them through app.current_group().
--   A missing setting yields NULL, which every policy treats as "deny".
-- ---------------------------------------------------------------------------

-- --- roles -----------------------------------------------------------------
-- Passwords are set out of band (Key Vault); CREATE ROLE here is idempotent so
-- the same migration is safe on a freshly provisioned database.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_app') THEN
    CREATE ROLE portal_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_owner') THEN
    CREATE ROLE portal_owner NOLOGIN;
  END IF;
END
$$;

-- --- tenant context helpers ------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;

-- The tenant currently in scope, or NULL when unset.
CREATE OR REPLACE FUNCTION app.current_group()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.customer_group_id', true), '')::uuid;
$$;

-- True only for Noatum staff sessions that have been explicitly elevated.
CREATE OR REPLACE FUNCTION app.is_internal()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean;
$$;

-- Guard: refuse to run with no tenant context in a customer-scoped path.
CREATE OR REPLACE FUNCTION app.require_group()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  g uuid;
BEGIN
  g := app.current_group();
  IF g IS NULL THEN
    RAISE EXCEPTION 'tenant context missing: app.customer_group_id is not set'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN g;
END
$$;

GRANT USAGE ON SCHEMA app TO portal_app;
GRANT EXECUTE ON FUNCTION app.current_group(), app.is_internal(), app.require_group() TO portal_app;

-- --- row level security ----------------------------------------------------
-- Pattern per tenant-scoped table:
--   ENABLE + FORCE row level security (FORCE so the owner is not exempt),
--   one policy keyed on customer_group_id, internal staff read-through.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'customer_group',
    'customer_account',
    'invitation',
    'quote',
    'quote_template',
    'address_book_entry'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_isolation', t);
  END LOOP;
END
$$;

-- customer_group is keyed on its own id.
CREATE POLICY customer_group_tenant_isolation ON customer_group
  USING (id = app.current_group() OR app.is_internal())
  WITH CHECK (id = app.current_group() OR app.is_internal());

CREATE POLICY customer_account_tenant_isolation ON customer_account
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

CREATE POLICY invitation_tenant_isolation ON invitation
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

CREATE POLICY quote_tenant_isolation ON quote
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

CREATE POLICY quote_template_tenant_isolation ON quote_template
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

CREATE POLICY address_book_entry_tenant_isolation ON address_book_entry
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

-- Users: a customer admin sees users in their own group; internal staff see all.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_tenant_isolation ON "user";
CREATE POLICY user_tenant_isolation ON "user"
  USING (customer_group_id = app.current_group() OR app.is_internal())
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

-- News: global rows (NULL group) are readable by everyone, writable by staff only.
ALTER TABLE news_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_item FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS news_item_read ON news_item;
CREATE POLICY news_item_read ON news_item
  FOR SELECT
  USING (customer_group_id IS NULL OR customer_group_id = app.current_group() OR app.is_internal());
DROP POLICY IF EXISTS news_item_write ON news_item;
CREATE POLICY news_item_write ON news_item
  FOR ALL
  USING (app.is_internal())
  WITH CHECK (app.is_internal());

-- Audit: append-only from the application, readable within the tenant.
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_event_read ON audit_event;
CREATE POLICY audit_event_read ON audit_event
  FOR SELECT
  USING (customer_group_id = app.current_group() OR app.is_internal());
DROP POLICY IF EXISTS audit_event_insert ON audit_event;
CREATE POLICY audit_event_insert ON audit_event
  FOR INSERT
  WITH CHECK (customer_group_id = app.current_group() OR app.is_internal());

-- --- grants ----------------------------------------------------------------
-- portal_app gets DML on data tables and nothing else. No DDL, no TRUNCATE.
GRANT USAGE ON SCHEMA public TO portal_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portal_app;

-- Reference tables are read-only for the app; staff tooling writes them.
REVOKE INSERT, UPDATE, DELETE ON master_org, permission FROM portal_app;

-- Audit is append-only for the app.
REVOKE UPDATE, DELETE ON audit_event FROM portal_app;

-- Anything created by a later migration inherits the same shape.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO portal_app;

-- pg-boss owns its own schema and needs DDL there for its internal upkeep.
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION portal_app;
