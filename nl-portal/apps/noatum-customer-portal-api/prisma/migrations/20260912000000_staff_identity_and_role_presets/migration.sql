-- ---------------------------------------------------------------------------
-- Staff identity and role presets.
--
-- Three things happen here:
--
--  1. The identity anchor. A person is recognised by (idp_issuer, idp_subject)
--     from their Microsoft token, never by email alone, so changing an email
--     does not relink an account and two subjects sharing an email cannot
--     inherit each other's access.
--
--  2. A narrow identity-resolution path. Every identity table is behind RLS
--     that keys off a tenant context, but that context can only be built AFTER
--     the caller is known - a deadlock at sign-in. Rather than granting the
--     runtime role BYPASSRLS (which would disable tenant isolation platform
--     wide), one transaction-local flag, app.identity_lookup, opens exactly the
--     four tables the lookup needs, and only the app.* functions below set it.
--
--  3. The permission catalogue and the role presets, seeded from the same
--     definitions held in src/contracts/permissions.ts. A drift test fails the
--     build if the two disagree.
-- ---------------------------------------------------------------------------

-- The access-pending state: signed in and recognised, holding no roles yet.
ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'registered' BEFORE 'invited';

-- --- identity anchor -------------------------------------------------------
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "idp_issuer" VARCHAR(256);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "idp_subject" VARCHAR(128);

-- Multiple NULLs never collide in a Postgres unique index, so rows that have
-- not yet signed in stay insertable.
CREATE UNIQUE INDEX IF NOT EXISTS "user_idp_issuer_idp_subject_key"
  ON "user" ("idp_issuer", "idp_subject");

-- Who granted a role, and when. Null where a grant predates this migration.
ALTER TABLE "user_role" ADD COLUMN IF NOT EXISTS "assigned_by_id" UUID;
ALTER TABLE "user_role" ADD COLUMN IF NOT EXISTS "assigned_at"
  TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- --- identity resolution policies ------------------------------------------
-- Permissive policies are OR'd, so these widen nothing for ordinary requests:
-- outside the functions below the flag is unset and every one evaluates false.
DROP POLICY IF EXISTS user_identity_resolution ON "user";
CREATE POLICY user_identity_resolution ON "user"
  USING (current_setting('app.identity_lookup', true) = 'on')
  WITH CHECK (current_setting('app.identity_lookup', true) = 'on');

DROP POLICY IF EXISTS user_role_identity_resolution ON user_role;
CREATE POLICY user_role_identity_resolution ON user_role
  FOR SELECT
  USING (current_setting('app.identity_lookup', true) = 'on');

DROP POLICY IF EXISTS role_permission_identity_resolution ON role_permission;
CREATE POLICY role_permission_identity_resolution ON role_permission
  FOR SELECT
  USING (current_setting('app.identity_lookup', true) = 'on');

DROP POLICY IF EXISTS user_account_access_identity_resolution ON user_account_access;
CREATE POLICY user_account_access_identity_resolution ON user_account_access
  FOR SELECT
  USING (current_setting('app.identity_lookup', true) = 'on');

-- --- identity resolution functions -----------------------------------------
-- Both are SECURITY DEFINER with a pinned search_path, so they keep working if
-- the runtime role's table grants are tightened later, and cannot be captured
-- by a user-supplied schema on the search path.

CREATE OR REPLACE FUNCTION app.resolve_identity(p_issuer text, p_subject text)
RETURNS TABLE (
  user_id uuid,
  customer_group_id uuid,
  is_internal boolean,
  status text,
  permissions text[],
  account_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.identity_lookup', 'on', true);

  RETURN QUERY
  SELECT
    u.id,
    u.customer_group_id,
    u.is_internal,
    u.status::text,
    COALESCE((
      SELECT array_agg(DISTINCT rp.permission_key)
      FROM user_role ur
      JOIN role_permission rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = u.id
    ), ARRAY[]::text[]),
    COALESCE((
      SELECT array_agg(a.account_id)
      FROM user_account_access a
      WHERE a.user_id = u.id
    ), ARRAY[]::uuid[])
  FROM "user" u
  WHERE u.idp_issuer = p_issuer
    AND u.idp_subject = p_subject;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

-- First sign-in for an eligible member of staff. Creates the identity with no
-- roles at all, so registration never confers business access (FR-IAM-002).
-- Concurrent first sign-ins collapse onto one row via the unique index.
CREATE OR REPLACE FUNCTION app.register_staff_identity(
  p_issuer text,
  p_subject text,
  p_email text,
  p_display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM set_config('app.identity_lookup', 'on', true);

  INSERT INTO "user" (idp_issuer, idp_subject, email, display_name, status, is_internal, last_login_at)
  VALUES (p_issuer, p_subject, p_email, p_display_name, 'registered', true, now())
  ON CONFLICT (idp_issuer, idp_subject) DO UPDATE
    SET last_login_at = now(),
        display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), "user".display_name)
  RETURNING id INTO v_id;

  -- An existing row keyed on email alone (seeded or pre-registered) adopts this
  -- subject the first time that person signs in, and only while unclaimed.
  IF v_id IS NULL THEN
    UPDATE "user"
       SET idp_issuer = p_issuer,
           idp_subject = p_subject,
           last_login_at = now()
     WHERE email = p_email
       AND idp_subject IS NULL
       AND is_internal = true
    RETURNING id INTO v_id;
  END IF;

  PERFORM set_config('app.identity_lookup', 'off', true);
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION app.resolve_identity(text, text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.register_staff_identity(text, text, text, text) TO portal_app;

-- --- catalogue seed --------------------------------------------------------
-- Reference tables sit behind the internal_only policy, so the seed runs with
-- an internal context. set_config(..., true) keeps it local to this migration.
SELECT set_config('app.is_internal', 'true', true);

INSERT INTO permission (key, description) VALUES
  ('dashboard.read',              'View the dashboard'),
  ('quotes.read',                 'View quotations'),
  ('quotes.create',               'Create and edit quotation drafts'),
  ('quotes.submit',               'Submit a quotation request'),
  ('quotes.accept',               'Accept or reject a published offer'),
  ('quotes.cancel',               'Cancel a quotation request'),
  ('templates.read',              'View quotation templates'),
  ('templates.manage',            'Create and delete quotation templates'),
  ('address_book.read',           'View the address book'),
  ('address_book.manage',         'Maintain the address book'),
  ('pricing.queue.read',          'View the branch pricing queue'),
  ('pricing.claim',               'Claim a request for pricing'),
  ('pricing.claim.release',       'Release another user''s pricing claim'),
  ('pricing.price',               'Enter prices and charge lines'),
  ('pricing.approve',             'Approve a priced offer'),
  ('pricing.cross_branch',        'Work outside the assigned branch'),
  ('pricing.cost.view',           'View internal cost and margin'),
  ('shipments.read',              'View shipments'),
  ('shipments.export',            'Export shipment lists'),
  ('documents.read',              'View documents'),
  ('documents.download',          'Download documents'),
  ('documents.upload',            'Upload documents'),
  ('invoices.read',               'View invoices and credit notes'),
  ('invoices.download',           'Download financial documents'),
  ('bookings.read',               'View bookings'),
  ('bookings.create',             'Create bookings'),
  ('bookings.cancel',             'Cancel bookings'),
  ('claims.read',                 'View claims'),
  ('claims.create',               'Raise a claim'),
  ('claims.comment',              'Comment on a claim'),
  ('reports.read',                'Run assigned reports'),
  ('reports.export',              'Export report output'),
  ('reports.assign',              'Assign report access to users'),
  ('notifications.manage',        'Manage notification preferences'),
  ('users.read',                  'View users of the own customer'),
  ('users.manage',                'Invite and manage users of the own customer'),
  ('api_keys.manage',             'Manage API keys'),
  ('admin.staff.read',            'View Noatum staff and their access'),
  ('admin.staff.roles.manage',    'Assign and remove staff roles'),
  ('admin.customers.read',        'View customers'),
  ('admin.customers.manage',      'Create and maintain customers'),
  ('admin.accounts.manage',       'Maintain customer accounts'),
  ('admin.organisations.link',    'Link source organisations to a customer'),
  ('admin.flags.manage',          'Manage customer feature entitlements'),
  ('admin.lookups.manage',        'Maintain lookup and mapping data'),
  ('admin.settings.read',         'View platform settings'),
  ('admin.settings.manage',       'Change platform settings'),
  ('admin.news.manage',           'Publish news'),
  ('admin.impersonate',           'Start a read-only support session'),
  ('admin.audit.read',            'Read the audit trail'),
  ('admin.integration.read',      'View integration health and messages')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role (key, name, description, is_internal) VALUES
  ('platform_admin',           'Platform Admin',        'Platform governance and portal role assignment. Does not confer customer commercial or cost access.', true),
  ('customer_success',         'Customer Success',      'Customer onboarding, organisation linking, invitations, support and news.', true),
  ('pricing',                  'Pricing',               'Prices requests in the assigned branch.', true),
  ('pricing_approver',         'Pricing Approver',      'Approves priced offers in the assigned branch.', true),
  ('ops',                      'Ops',                   'Authorised read access across customers.', true),
  ('customer_standard',        'Standard',              'Tracking, approved documents, own profile and notifications.', false),
  ('customer_quoting_booking', 'Quoting and Booking',   'Standard plus quotations, bookings, templates and address book.', false),
  ('customer_finance',         'Finance',               'Standard plus addressee-authorised invoices and spend reports.', false),
  ('customer_analyst',         'Analyst',               'Standard plus assigned reports.', false),
  ('customer_claims',          'Claims',                'Standard plus claim submission and comments.', false),
  ('customer_admin',           'Customer Admin',        'Standard plus own-customer user and role administration. Not a superuser.', false)
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_internal = EXCLUDED.is_internal;

-- Presets are declarative: the pairs below are the whole definition, so a
-- re-run removes a grant that was taken out of the catalogue.
WITH preset(role_key, permission_key) AS (
  VALUES
    ('platform_admin', 'dashboard.read'),
    ('platform_admin', 'admin.staff.read'),
    ('platform_admin', 'admin.staff.roles.manage'),
    ('platform_admin', 'admin.customers.read'),
    ('platform_admin', 'admin.customers.manage'),
    ('platform_admin', 'admin.accounts.manage'),
    ('platform_admin', 'admin.organisations.link'),
    ('platform_admin', 'admin.flags.manage'),
    ('platform_admin', 'admin.lookups.manage'),
    ('platform_admin', 'admin.settings.read'),
    ('platform_admin', 'admin.settings.manage'),
    ('platform_admin', 'admin.news.manage'),
    ('platform_admin', 'admin.audit.read'),
    ('platform_admin', 'admin.integration.read'),

    ('customer_success', 'dashboard.read'),
    ('customer_success', 'admin.customers.read'),
    ('customer_success', 'admin.customers.manage'),
    ('customer_success', 'admin.accounts.manage'),
    ('customer_success', 'admin.organisations.link'),
    ('customer_success', 'admin.news.manage'),
    ('customer_success', 'admin.impersonate'),
    ('customer_success', 'users.read'),
    ('customer_success', 'users.manage'),

    ('pricing', 'dashboard.read'),
    ('pricing', 'quotes.read'),
    ('pricing', 'pricing.queue.read'),
    ('pricing', 'pricing.claim'),
    ('pricing', 'pricing.price'),

    ('pricing_approver', 'dashboard.read'),
    ('pricing_approver', 'quotes.read'),
    ('pricing_approver', 'pricing.queue.read'),
    ('pricing_approver', 'pricing.approve'),
    ('pricing_approver', 'pricing.claim.release'),

    ('ops', 'dashboard.read'),
    ('ops', 'quotes.read'),
    ('ops', 'shipments.read'),
    ('ops', 'documents.read'),

    ('customer_standard', 'dashboard.read'),
    ('customer_standard', 'shipments.read'),
    ('customer_standard', 'documents.read'),
    ('customer_standard', 'documents.download'),
    ('customer_standard', 'notifications.manage'),

    ('customer_quoting_booking', 'dashboard.read'),
    ('customer_quoting_booking', 'shipments.read'),
    ('customer_quoting_booking', 'documents.read'),
    ('customer_quoting_booking', 'documents.download'),
    ('customer_quoting_booking', 'notifications.manage'),
    ('customer_quoting_booking', 'quotes.read'),
    ('customer_quoting_booking', 'quotes.create'),
    ('customer_quoting_booking', 'quotes.submit'),
    ('customer_quoting_booking', 'quotes.accept'),
    ('customer_quoting_booking', 'quotes.cancel'),
    ('customer_quoting_booking', 'templates.read'),
    ('customer_quoting_booking', 'templates.manage'),
    ('customer_quoting_booking', 'address_book.read'),
    ('customer_quoting_booking', 'address_book.manage'),
    ('customer_quoting_booking', 'bookings.read'),
    ('customer_quoting_booking', 'bookings.create'),
    ('customer_quoting_booking', 'bookings.cancel'),

    ('customer_finance', 'dashboard.read'),
    ('customer_finance', 'shipments.read'),
    ('customer_finance', 'documents.read'),
    ('customer_finance', 'documents.download'),
    ('customer_finance', 'notifications.manage'),
    ('customer_finance', 'invoices.read'),
    ('customer_finance', 'invoices.download'),
    ('customer_finance', 'reports.read'),

    ('customer_analyst', 'dashboard.read'),
    ('customer_analyst', 'shipments.read'),
    ('customer_analyst', 'documents.read'),
    ('customer_analyst', 'documents.download'),
    ('customer_analyst', 'notifications.manage'),
    ('customer_analyst', 'reports.read'),
    ('customer_analyst', 'reports.export'),

    ('customer_claims', 'dashboard.read'),
    ('customer_claims', 'shipments.read'),
    ('customer_claims', 'documents.read'),
    ('customer_claims', 'documents.download'),
    ('customer_claims', 'notifications.manage'),
    ('customer_claims', 'claims.read'),
    ('customer_claims', 'claims.create'),
    ('customer_claims', 'claims.comment'),

    ('customer_admin', 'dashboard.read'),
    ('customer_admin', 'shipments.read'),
    ('customer_admin', 'documents.read'),
    ('customer_admin', 'documents.download'),
    ('customer_admin', 'notifications.manage'),
    ('customer_admin', 'users.read'),
    ('customer_admin', 'users.manage'),
    ('customer_admin', 'reports.assign'),
    ('customer_admin', 'address_book.read'),
    ('customer_admin', 'address_book.manage'),
    ('customer_admin', 'admin.audit.read')
),
resolved AS (
  SELECT r.id AS role_id, p.permission_key
  FROM preset p
  JOIN role r ON r.key = p.role_key
),
inserted AS (
  INSERT INTO role_permission (role_id, permission_key)
  SELECT role_id, permission_key FROM resolved
  ON CONFLICT (role_id, permission_key) DO NOTHING
  RETURNING 1
)
DELETE FROM role_permission rp
WHERE rp.role_id IN (SELECT id FROM role WHERE key IN (SELECT role_key FROM preset))
  AND NOT EXISTS (
    SELECT 1 FROM resolved d
    WHERE d.role_id = rp.role_id AND d.permission_key = rp.permission_key
  );
