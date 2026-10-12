-- ---------------------------------------------------------------------------
-- Noatum operating structure: regions, branches, and the staff branch link.
--
-- FR-IAM-003 requires an administrator to assign an internal branch to staff,
-- with the rule that a missing branch cannot grant pricing scope. This adds the
-- catalogue that rule needs.
--
-- Two deliberate constraints:
--  * `branch.code` is portal-owned. It is NOT a CargoWise branch code, and none
--    is invented here. `source_branch_code` stays NULL until the CW1 contract is
--    confirmed (D-03), and the portal never writes a code back to the source.
--  * `region` groups branches and nothing more. Region-based policy precedence
--    is still an open decision (D-16/D-18), so no behaviour keys off it yet.
--
-- Both tables are internal reference data and carry the same internal-only RLS
-- policy as role and permission.
-- ---------------------------------------------------------------------------

CREATE TABLE "region" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"       VARCHAR(20) NOT NULL,
  "name"       VARCHAR(120) NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "region_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "region_code_key" ON "region"("code");

CREATE TABLE "branch" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "region_id"          UUID,
  "code"               VARCHAR(40) NOT NULL,
  "name"               VARCHAR(160) NOT NULL,
  "city"               VARCHAR(120),
  "country_code"       CHAR(2),
  "source_branch_code" VARCHAR(40),
  "source"             VARCHAR(20) NOT NULL DEFAULT 'manual',
  "is_active"          BOOLEAN NOT NULL DEFAULT true,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "branch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branch_code_key" ON "branch"("code");
CREATE INDEX "branch_region_id_idx" ON "branch"("region_id");

ALTER TABLE "branch" ADD CONSTRAINT "branch_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "branch_id" UUID;
CREATE INDEX IF NOT EXISTS "user_branch_id_idx" ON "user"("branch_id");
ALTER TABLE "user" ADD CONSTRAINT "user_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Internal reference data: readable and writable only in an internal context.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['region', 'branch'] LOOP
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

GRANT SELECT, INSERT, UPDATE, DELETE ON "region", "branch" TO portal_app;
