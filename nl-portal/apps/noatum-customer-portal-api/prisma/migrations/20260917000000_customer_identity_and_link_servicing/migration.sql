-- ---------------------------------------------------------------------------
-- Customer identity, customer hierarchy, and per-link servicing office.
--
-- Driven by the supplied Create-customer and Customer-detail mockups, and by
-- docs/design/Customer-Onboarding-and-User-Management.md §4.1, which has carried
-- parent_id and email_domains since v3 while the schema never gained them.
--
-- THE MODEL THE MOCKUPS DESCRIBE, and it is not the one a reader might assume:
--
--   * A customer is PORTAL-OWNED and created independently. It may be typed in
--     the portal or imported from somewhere that is not CargoWise. It is never
--     created by an organisation import.
--   * Linking happens the other way round: while creating the customer, staff
--     search the already-imported CargoWise directory and attach the
--     organisations that belong to that customer. Step 1 of the wizard.
--   * One customer holds MANY organisations - the mockup shows IBERIARETVLC,
--     IBERIARETBCN and IBERIARETMAD all linked to Iberia Retail Group SL. One
--     organisation belongs to ONE customer, which is what ORG-01 enforces and
--     what the mockup's "Linked to Iberia Retail Group SL" badge displays.
--   * Customers themselves nest: the mockup shows "IRG North America Inc. ·
--     child". That is a CUSTOMER hierarchy, portal-owned. CargoWise has no
--     organisation hierarchy, so the two must never be conflated.
--   * Each link carries its own servicing office ("per-office assignment on
--     each link"), falling back to the customer's default servicing branch.
--
-- Deliberately NOT enforced here: "inactive organisations cannot be onboarded".
-- That is an eligibility rule at link time, not a database invariant - an
-- organisation going inactive in CargoWise afterwards must not break the row.
-- The database enforces the rule that is a security boundary (source-confirmed,
-- one code one customer); the service enforces eligibility.
-- ---------------------------------------------------------------------------

CREATE TYPE "customer_status" AS ENUM ('onboarding', 'active', 'suspended', 'closed');

ALTER TABLE "customer_group"
  ADD COLUMN "parent_id"     UUID,
  ADD COLUMN "legal_name"    VARCHAR(240),
  ADD COLUMN "country_code"  CHAR(2),
  -- Email domains that may be invited without a Noatum override. Design doc §4.1.
  ADD COLUMN "email_domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "status"        "customer_status" NOT NULL DEFAULT 'onboarding',
  -- Used when a link does not name its own servicing office.
  ADD COLUMN "default_servicing_branch_id" UUID;

-- RESTRICT, not CASCADE: deleting a parent must never silently remove the
-- children's tenancy along with it.
ALTER TABLE "customer_group" ADD CONSTRAINT "customer_group_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "customer_group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_group" ADD CONSTRAINT "customer_group_parent_not_self"
  CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "customer_group" ADD CONSTRAINT "customer_group_default_servicing_branch_id_fkey"
  FOREIGN KEY ("default_servicing_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "customer_group_parent_id_idx" ON "customer_group"("parent_id");
CREATE INDEX "customer_group_status_idx" ON "customer_group"("status");

-- Existing rows pre-date the status column and were already live.
UPDATE "customer_group" SET "status" = 'active' WHERE "is_active";

COMMENT ON COLUMN "customer_group"."parent_id" IS
  'Customer hierarchy, portal-owned. NOT a CargoWise organisation hierarchy - CargoWise has none.';
COMMENT ON COLUMN "customer_group"."email_domains" IS
  'Domains a Customer Admin may invite without a Noatum override.';

-- Per-link servicing office. The mockup calls this "explicit routing,
-- per-office assignment on each link".
ALTER TABLE "customer_account" ADD COLUMN "servicing_branch_id" UUID;

ALTER TABLE "customer_account" ADD CONSTRAINT "customer_account_servicing_branch_id_fkey"
  FOREIGN KEY ("servicing_branch_id") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "customer_account_servicing_branch_id_idx" ON "customer_account"("servicing_branch_id");

COMMENT ON COLUMN "customer_account"."servicing_branch_id" IS
  'Noatum office servicing this link. Falls back to customer_group.default_servicing_branch_id.';
COMMENT ON TABLE "customer_account" IS
  'The link between one portal customer and one CargoWise organisation. A customer may hold many; an organisation belongs to one.';
