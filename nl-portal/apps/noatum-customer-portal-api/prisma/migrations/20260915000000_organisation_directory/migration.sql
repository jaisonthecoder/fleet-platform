-- ---------------------------------------------------------------------------
-- ORG-02: the source organisation model.
--
-- Closes defect F4. `master_org` carried six columns - code, name, country,
-- city, is_customer, synced_at - where the LLD defines thirteen. Without
-- source_hash there is no change detection, without is_active there is no
-- deactivation-by-absence, and without provenance there is no way to tell a row
-- that CargoWise confirmed from a row somebody typed. Every one of those is load
-- bearing for the import pipeline in ORG-03.
--
-- THE LINK GATE is the reason this migration exists in this shape. The guard
-- belongs on the link, not on the import: any path may populate the directory,
-- but only a source-confirmed organisation may ever be linked to a customer.
-- That is enforced here by the database, not by a service check:
--
--   master_org       UNIQUE (id, is_source_confirmed)
--   customer_account org_confirmed BOOLEAN GENERATED ALWAYS AS (true) STORED
--                    FOREIGN KEY (org_id, org_confirmed)
--                      REFERENCES master_org (id, is_source_confirmed)
--
-- Because the referencing column is a generated constant `true`, the only rows
-- that satisfy the foreign key are those whose `is_source_confirmed` is true.
-- An unconfirmed organisation is unlinkable by construction, and unconfirming a
-- linked one is refused by the same constraint. The LLD already uses this
-- technique for ux_account_group_id; this applies it to a different invariant.
--
-- TWO DECISION GATES ARE STILL OPEN, and this migration is deliberately written
-- so that neither answer forces a rewrite:
--
--  * ORG-D02 (source namespace) - is an organisation code unique globally, or
--    only within a CargoWise instance? The natural key is
--    (source_system, source_instance, code_norm), which is correct under the
--    per-instance answer and merely never violated under the global one. If the
--    answer is "global", add a unique on code_norm alone; nothing here is lost.
--    `source_instance` is NOT NULL with a placeholder default because a nullable
--    column cannot participate in a unique key that actually excludes anything.
--  * ORG-D07 - reinstating org_import_run and org_change_log as a recorded
--    exception to simplification register C6. The mockups require last-run
--    counts, error totals, snapshot-versus-delta and next scheduled run, which
--    is more than one audit blob should carry. Proceeding on the plan's
--    proposal; the acceptance itself is still owed.
--
-- Verified before writing: master_org and customer_account both hold zero rows
-- locally. The migration is nonetheless written to carry existing data, because
-- it must apply to any environment.
-- ---------------------------------------------------------------------------

CREATE TYPE "org_source_kind" AS ENUM ('feed', 'file', 'manual');
CREATE TYPE "org_link_status" AS ENUM ('pending', 'confirmed');
CREATE TYPE "org_import_mode" AS ENUM ('snapshot', 'delta');
CREATE TYPE "org_import_outcome" AS ENUM ('running', 'succeeded', 'failed', 'aborted');

-- ---------------------------------------------------------------------------
-- 1. Import runs. Created before master_org because confirmed_by_run_id
--    references it.
-- ---------------------------------------------------------------------------

CREATE TABLE "org_import_run" (
  "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_kind"      "org_source_kind" NOT NULL,
  "source_system"    VARCHAR(20) NOT NULL DEFAULT 'cw1',
  "source_instance"  VARCHAR(40) NOT NULL,
  "mode"             "org_import_mode" NOT NULL,
  -- An authoritative run may deactivate organisations absent from it. A run that
  -- is not authoritative may only add and update. ORG-D03 defines what makes a
  -- file authoritative; until then the importer must pass this explicitly.
  "is_authoritative" BOOLEAN NOT NULL DEFAULT false,
  "started_by_id"    UUID,
  "file_name"        VARCHAR(260),
  "file_hash"        CHAR(64),
  "rows_read"        INTEGER NOT NULL DEFAULT 0,
  "rows_created"     INTEGER NOT NULL DEFAULT 0,
  "rows_updated"     INTEGER NOT NULL DEFAULT 0,
  "rows_unchanged"   INTEGER NOT NULL DEFAULT 0,
  "rows_deactivated" INTEGER NOT NULL DEFAULT 0,
  "rows_rejected"    INTEGER NOT NULL DEFAULT 0,
  "errors"           JSONB NOT NULL DEFAULT '[]'::jsonb,
  "outcome"          "org_import_outcome" NOT NULL DEFAULT 'running',
  "started_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "finished_at"      TIMESTAMPTZ(6),
  CONSTRAINT "org_import_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_import_run_started_at_idx" ON "org_import_run"("started_at" DESC);
CREATE INDEX "org_import_run_source_idx" ON "org_import_run"("source_system", "source_instance", "started_at" DESC);

ALTER TABLE "org_import_run" ADD CONSTRAINT "org_import_run_started_by_id_fkey"
  FOREIGN KEY ("started_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. master_org: from a six-column stub to the mirror the LLD defines.
--    Existing rows are carried over, not dropped.
-- ---------------------------------------------------------------------------

ALTER TABLE "master_org" RENAME COLUMN "code" TO "source_code";

ALTER TABLE "master_org"
  ADD COLUMN "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN "source_system"       VARCHAR(20) NOT NULL DEFAULT 'cw1',
  -- Placeholder until ORG-D02 names the real instances (CW1-EU, CW1-US, ...).
  -- Deliberately not 'CW1-EU': inventing a namespace would be worse than an
  -- obviously provisional one that an import run must overwrite.
  ADD COLUMN "source_instance"     VARCHAR(40) NOT NULL DEFAULT 'unassigned',
  ADD COLUMN "source_kind"         "org_source_kind" NOT NULL DEFAULT 'feed',
  ADD COLUMN "legal_name"          VARCHAR(240),
  ADD COLUMN "state"               VARCHAR(120),
  ADD COLUMN "postcode"            VARCHAR(40),
  -- A CargoWise attribute of the organisation. NOT the Noatum servicing branch:
  -- that is `branch`, portal-owned, and the two must never be conflated.
  ADD COLUMN "source_branch_code"  VARCHAR(40),
  -- Evidence only. A parent organisation never grants access to a child's data;
  -- FR-ORG-005 keeps linking at organisation level and nowhere else.
  ADD COLUMN "source_parent_code"  VARCHAR(40),
  ADD COLUMN "is_supplier"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "is_active"           BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "is_source_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "confirmed_by_run_id" UUID,
  ADD COLUMN "source_version"      VARCHAR(80),
  ADD COLUMN "source_hash"         CHAR(64),
  ADD COLUMN "first_seen_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  ADD COLUMN "last_seen_at"        TIMESTAMPTZ(6),
  ADD COLUMN "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  ADD COLUMN "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now();

-- Generated, so the normalised key cannot drift from the value it normalises.
ALTER TABLE "master_org"
  ADD COLUMN "code_norm" VARCHAR(40)
  GENERATED ALWAYS AS (lower(btrim("source_code"))) STORED;

ALTER TABLE "master_org"
  ADD CONSTRAINT "master_org_source_code_trimmed"
  CHECK ("source_code" = btrim("source_code") AND length("source_code") > 0);

ALTER TABLE "master_org" DROP CONSTRAINT "master_org_pkey";
ALTER TABLE "master_org" ADD CONSTRAINT "master_org_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "master_org_source_identity_key"
  ON "master_org"("source_system", "source_instance", "code_norm");

-- The link gate's referenced key.
ALTER TABLE "master_org"
  ADD CONSTRAINT "master_org_id_is_source_confirmed_key" UNIQUE ("id", "is_source_confirmed");

CREATE INDEX "master_org_code_norm_idx" ON "master_org"("code_norm");
CREATE INDEX "master_org_is_active_idx" ON "master_org"("is_active");
CREATE INDEX "master_org_country_code_idx" ON "master_org"("country_code");

ALTER TABLE "master_org" ADD CONSTRAINT "master_org_confirmed_by_run_id_fkey"
  FOREIGN KEY ("confirmed_by_run_id") REFERENCES "org_import_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Any rows that predate this migration came from the placeholder sync handler.
-- They stay unconfirmed on purpose: nothing has proved their provenance, so
-- nothing may link them until a real run confirms them.
UPDATE "master_org" SET "last_seen_at" = "synced_at" WHERE "last_seen_at" IS NULL;

-- synced_at is superseded by first_seen_at/last_seen_at. Two freshness columns
-- with different meanings is how a stale-import alert ends up reading the wrong
-- one, so the old single column goes.
ALTER TABLE "master_org" DROP COLUMN "synced_at";

-- ---------------------------------------------------------------------------
-- 3. Addresses, identifiers, contacts.
-- ---------------------------------------------------------------------------

-- No customer column and no link table, deliberately. FR-ORG-005 forbids
-- address-level linking, so the schema gives it nowhere to live.
CREATE TABLE "org_address" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id"              UUID NOT NULL,
  "source_address_code" VARCHAR(60) NOT NULL,
  "purposes"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_primary"          BOOLEAN NOT NULL DEFAULT false,
  "address_line_1"      VARCHAR(200),
  "address_line_2"      VARCHAR(200),
  "city"                VARCHAR(120),
  "state"               VARCHAR(120),
  "postcode"            VARCHAR(40),
  "country_code"        CHAR(2),
  -- The source's own formatting, kept verbatim so the detail view can show what
  -- CargoWise shows rather than our reassembly of it.
  "formatted"           TEXT,
  "is_active"           BOOLEAN NOT NULL DEFAULT true,
  "source_hash"         CHAR(64),
  "first_seen_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_seen_at"        TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "org_address_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_address_org_id_source_address_code_key"
  ON "org_address"("org_id", "source_address_code");
CREATE INDEX "org_address_org_id_idx" ON "org_address"("org_id");

ALTER TABLE "org_address" ADD CONSTRAINT "org_address_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "master_org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Repeatable and jurisdiction-qualified. Never one universal VAT field: an
-- organisation can hold several registrations of the same scheme in different
-- jurisdictions.
CREATE TABLE "org_registration_id" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id"       UUID NOT NULL,
  "scheme"       VARCHAR(40) NOT NULL,
  "value"        VARCHAR(120) NOT NULL,
  "jurisdiction" CHAR(2),
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "org_registration_id_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_registration_id_identity_key"
  ON "org_registration_id"("org_id", "scheme", "value", (COALESCE("jurisdiction", '')));
CREATE INDEX "org_registration_id_org_id_idx" ON "org_registration_id"("org_id");

ALTER TABLE "org_registration_id" ADD CONSTRAINT "org_registration_id_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "master_org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Created empty and left unpopulated until ORG-D05 clears. A contact is never an
-- identity, never an invitation and never a recipient authorisation; the portal
-- user table remains the only source of who may sign in.
CREATE TABLE "org_contact" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id"     UUID NOT NULL,
  "address_id" UUID,
  "full_name"  VARCHAR(200) NOT NULL,
  "job_title"  VARCHAR(160),
  "email"      VARCHAR(320),
  "phone"      VARCHAR(60),
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "org_contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_contact_org_id_idx" ON "org_contact"("org_id");

ALTER TABLE "org_contact" ADD CONSTRAINT "org_contact_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "master_org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_contact" ADD CONSTRAINT "org_contact_address_id_fkey"
  FOREIGN KEY ("address_id") REFERENCES "org_address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Change log. Written only when a row's hash actually changes, so the
--    history tab does not become 2,318 rows a day of "seen again, identical".
-- ---------------------------------------------------------------------------

CREATE TABLE "org_change_log" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "org_id"      UUID NOT NULL,
  "run_id"      UUID,
  "change_type" VARCHAR(20) NOT NULL,
  "before"      JSONB,
  "after"       JSONB,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "org_change_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_change_log_org_id_created_at_idx" ON "org_change_log"("org_id", "created_at" DESC);
CREATE INDEX "org_change_log_run_id_idx" ON "org_change_log"("run_id");

ALTER TABLE "org_change_log" ADD CONSTRAINT "org_change_log_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "master_org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_change_log" ADD CONSTRAINT "org_change_log_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "org_import_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. The link, on customer_account.
-- ---------------------------------------------------------------------------

ALTER TABLE "customer_account"
  ADD COLUMN "org_id"              UUID,
  ADD COLUMN "link_status"         "org_link_status" NOT NULL DEFAULT 'confirmed',
  ADD COLUMN "justification"       TEXT,
  ADD COLUMN "linked_by_user_id"   UUID,
  ADD COLUMN "linked_at"           TIMESTAMPTZ(6),
  ADD COLUMN "approved_by_user_id" UUID,
  ADD COLUMN "approved_at"         TIMESTAMPTZ(6);

-- Links that predate this migration were already granting access. Defaulting
-- them to 'confirmed' preserves that; silently flipping live customers to
-- 'pending' would revoke access without anyone deciding to. New rows get
-- 'pending' instead, so the linking service has to say confirmed explicitly.
ALTER TABLE "customer_account" ALTER COLUMN "link_status" SET DEFAULT 'pending';

-- The link gate. A constant generated column is the whole trick: the foreign key
-- can only be satisfied by a master_org row whose is_source_confirmed is true.
ALTER TABLE "customer_account"
  ADD COLUMN "org_confirmed" BOOLEAN GENERATED ALWAYS AS (true) STORED;

-- ON UPDATE stays NO ACTION: PostgreSQL refuses a cascading action on a foreign
-- key that contains a generated column, because the cascade would have to write
-- to a column the database owns. Nothing updates a master_org id in any case.
ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_org_confirmed_fkey"
  FOREIGN KEY ("org_id", "org_confirmed")
  REFERENCES "master_org"("id", "is_source_confirmed")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "customer_account_org_id_idx" ON "customer_account"("org_id");
CREATE INDEX "customer_account_link_status_idx" ON "customer_account"("link_status");

ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_linked_by_user_id_fkey"
  FOREIGN KEY ("linked_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. Row level security. Internal reference data with no tenant column, so the
--    same internal_only policy as role, permission, region and branch. This is
--    what stops a customer context enumerating which organisations - or which
--    customers - exist.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'org_address', 'org_registration_id', 'org_contact', 'org_import_run', 'org_change_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS internal_only ON %I', t);
    EXECUTE format(
      'CREATE POLICY internal_only ON %I USING (COALESCE(NULLIF(current_setting(''app.is_internal'', true), ''''), ''false'')::boolean) WITH CHECK (COALESCE(NULLIF(current_setting(''app.is_internal'', true), ''''), ''false'')::boolean)',
      t
    );
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "org_address", "org_registration_id", "org_contact", "org_import_run", "org_change_log"
  TO portal_app;

-- master_org itself stays REVOKEd from the runtime role; see the write path in
-- 20260915010000_apply_organisation_batch.
