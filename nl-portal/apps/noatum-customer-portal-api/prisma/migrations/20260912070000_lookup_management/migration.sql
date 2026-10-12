-- ---------------------------------------------------------------------------
-- Lookup management: the reference-data store behind every option list.
--
-- Global data, not tenant data. A country or an Incoterm belongs to the
-- platform, so these tables carry no customer_group_id and no tenant policy
-- would be truthful. They use a split policy instead:
--
--   * read  - any authenticated context may read an item that is active and
--             flagged customer visible; internal contexts read everything.
--   * write - internal contexts only.
--
-- `is_customer_visible` defaults to false, which is what makes the document
-- allow-list real: an imported row reaches no customer surface until someone
-- approves it. Translations inherit the decision through their item.
--
-- Structural fields (ownership, parent category, source system) are
-- deployment-controlled. Staff maintain content; changing what a category
-- permits is a migration, per LM-D04.
-- ---------------------------------------------------------------------------

CREATE TYPE "LookupOwnership" AS ENUM ('portal', 'source', 'system');

CREATE TABLE "lookup_category" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"               VARCHAR(60) NOT NULL,
  "name"               VARCHAR(120) NOT NULL,
  "description"        VARCHAR(400),
  "ownership"          "LookupOwnership" NOT NULL,
  "source_system"      VARCHAR(40),
  "source_ref"         VARCHAR(240),
  "default_locale"     VARCHAR(10) NOT NULL DEFAULT 'en-US',
  "parent_category_id" UUID,
  "is_active"          BOOLEAN NOT NULL DEFAULT true,
  "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "lookup_category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lookup_category_code_key" ON "lookup_category"("code");

-- Restrict, not cascade: a category that still defines another one's parent
-- rule cannot be dropped out from under it.
ALTER TABLE "lookup_category" ADD CONSTRAINT "lookup_category_parent_category_id_fkey"
  FOREIGN KEY ("parent_category_id") REFERENCES "lookup_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "lookup_item" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "category_id"         UUID NOT NULL,
  "code"                VARCHAR(80) NOT NULL,
  "parent_id"           UUID,
  "sort_order"          INTEGER NOT NULL DEFAULT 0,
  "is_active"           BOOLEAN NOT NULL DEFAULT true,
  "is_customer_visible" BOOLEAN NOT NULL DEFAULT false,
  "source_ref"          VARCHAR(120),
  "version"             INTEGER NOT NULL DEFAULT 1,
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "lookup_item_pkey" PRIMARY KEY ("id"),
  -- An item cannot be its own parent. Deeper cycles are a service-level check;
  -- this catches the case a constraint can express.
  CONSTRAINT "lookup_item_parent_not_self" CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);
CREATE UNIQUE INDEX "lookup_item_category_id_code_key" ON "lookup_item"("category_id", "code");
CREATE INDEX "lookup_item_category_id_is_active_sort_order_idx"
  ON "lookup_item"("category_id", "is_active", "sort_order");
CREATE INDEX "lookup_item_parent_id_idx" ON "lookup_item"("parent_id");

ALTER TABLE "lookup_item" ADD CONSTRAINT "lookup_item_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "lookup_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Restrict: retirement is deactivation, never a delete that orphans children.
ALTER TABLE "lookup_item" ADD CONSTRAINT "lookup_item_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "lookup_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "lookup_item_translation" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "item_id"     UUID NOT NULL,
  "locale"      VARCHAR(10) NOT NULL,
  "label"       VARCHAR(240) NOT NULL,
  "description" VARCHAR(600),
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "lookup_item_translation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lookup_item_translation_item_id_locale_key"
  ON "lookup_item_translation"("item_id", "locale");

ALTER TABLE "lookup_item_translation" ADD CONSTRAINT "lookup_item_translation_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "lookup_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE "lookup_category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lookup_category" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lookup_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lookup_item" FORCE ROW LEVEL SECURITY;
ALTER TABLE "lookup_item_translation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lookup_item_translation" FORCE ROW LEVEL SECURITY;

-- A category carries no customer content, so any authenticated context may read
-- an active one to resolve a list it is otherwise entitled to.
CREATE POLICY "lookup_category_read" ON "lookup_category"
  FOR SELECT USING (
    COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean
    OR "is_active"
  );

CREATE POLICY "lookup_category_write" ON "lookup_category"
  FOR ALL
  USING (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean);

-- The allow-list, enforced in the data layer rather than in a service that
-- might forget: a customer context sees only active, approved rows.
CREATE POLICY "lookup_item_read" ON "lookup_item"
  FOR SELECT USING (
    COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean
    OR ("is_active" AND "is_customer_visible")
  );

CREATE POLICY "lookup_item_write" ON "lookup_item"
  FOR ALL
  USING (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean);

-- Translations inherit their item's decision; there is no second rulebook.
CREATE POLICY "lookup_item_translation_read" ON "lookup_item_translation"
  FOR SELECT USING (
    COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean
    OR EXISTS (
      SELECT 1 FROM "lookup_item" i
      WHERE i."id" = "lookup_item_translation"."item_id"
        AND i."is_active" AND i."is_customer_visible"
    )
  );

CREATE POLICY "lookup_item_translation_write" ON "lookup_item_translation"
  FOR ALL
  USING (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.is_internal', true), ''), 'false')::boolean);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "lookup_category", "lookup_item", "lookup_item_translation"
  TO portal_app;
