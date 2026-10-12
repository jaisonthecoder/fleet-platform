-- ---------------------------------------------------------------------------
-- Platform feature switches.
--
-- The catalogue of switches is code (contracts/feature-switches.ts); this table
-- holds only the state of one an administrator has changed. Absence means "use
-- the code default", so a fresh environment behaves predictably and a key that
-- is later retired stops having any effect the moment it leaves the catalogue.
--
-- Read is open to any authenticated context because a switch decides whether a
-- capability exists at all, and a customer-facing route may need to ask. Nothing
-- here is customer data. Writing is internal-only.
--
-- No DELETE grant: a switch is set, never removed. Removing a row would silently
-- revert a deliberate decision to a code default.
-- ---------------------------------------------------------------------------

CREATE TABLE "feature_switch" (
  "key"                VARCHAR(80) NOT NULL,
  "is_enabled"         BOOLEAN NOT NULL,
  "approval_reference" VARCHAR(200),
  "reason"             VARCHAR(400) NOT NULL,
  "updated_by_id"      UUID,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "feature_switch_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "feature_switch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_switch" FORCE ROW LEVEL SECURITY;

CREATE POLICY "feature_switch_read" ON "feature_switch" FOR SELECT USING (true);

CREATE POLICY "feature_switch_write" ON "feature_switch"
  FOR ALL
  USING (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean);

GRANT SELECT, INSERT, UPDATE ON "feature_switch" TO portal_app;
