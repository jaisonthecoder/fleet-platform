-- ---------------------------------------------------------------------------
-- Align the organisation directory with the real CargoWise schema.
--
-- Evidence and reasoning: docs/Orignal Docs/12-CW1-Organisation-Schema-and-
-- Portal-Directory-Design.md, read from the published NativeOrganization.xsd and
-- Native.xsd. Four findings drive this migration.
--
-- F-B  CargoWise has NO "is customer" flag. Customer-ness is OrgCompanyData
--      .IsDebtor (per CargoWise company), the AR debtor group, or the 3-char
--      OrgHeader.Category whose code list is not published. So is_customer and
--      is_supplier are PORTAL-DERIVED, and the columns now say so. What the
--      source actually gives us is stored beside them: `category` and
--      `source_roles`, the Is* booleans that were true.
--
-- F-C  OrgHeader.Code is 12 characters. We keep varchar(40) deliberately: the
--      supplied document-type catalogue already contains 4-character codes where
--      the historical schema said 3, and truncating a source key is
--      unrecoverable. Over-provisioning a key column costs nothing.
--
-- 2.6  There is no parent/child hierarchy in CargoWise. What exists is
--      ControllingCustomer -> another organisation's Code. `source_parent_code`
--      was therefore a misleading name and is renamed. It remains evidence only:
--      linking a controlling customer grants nothing over the controlled one.
--
-- 2.2  Address purpose lives in OrgAddressCapability (AddressType, 3 chars, plus
--      IsMainAddress) and repeats, which our purposes[] + is_primary already
--      matches. The address itself carries a UN/LOCODE port, a trading-name
--      override and its own contact details, which we were dropping.
-- ---------------------------------------------------------------------------

-- OrgHeader.Category. Three characters; the code list is NOT in the schema and
-- must come from Noatum's CargoWise, so nothing keys off this value yet.
ALTER TABLE "master_org" ADD COLUMN "category" VARCHAR(3);

-- The Is* role booleans that were true, e.g. {IsConsignee,IsTransportClient}.
-- Stored as the source spells them so the mapping stays auditable; a mapping_*
-- table translates them when a rule ever needs to.
ALTER TABLE "master_org" ADD COLUMN "source_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "master_org" RENAME COLUMN "source_parent_code" TO "source_controlling_customer_code";

COMMENT ON COLUMN "master_org"."is_customer" IS
  'Portal-derived. CargoWise has no IsCustomer field; see category and source_roles for what the source actually said.';
COMMENT ON COLUMN "master_org"."is_supplier" IS
  'Portal-derived. See category and source_roles.';
COMMENT ON COLUMN "master_org"."source_controlling_customer_code" IS
  'CargoWise ControllingCustomer.Code. Evidence only - never an access grant (FR-ORG-005).';
COMMENT ON COLUMN "master_org"."source_branch_code" IS
  'CargoWise ControllingBranch.Code. NOT the Noatum servicing branch, which is the portal-owned branch table.';

CREATE INDEX "master_org_category_idx" ON "master_org"("category");

-- Address detail the schema carries and we were discarding.
ALTER TABLE "org_address"
  ADD COLUMN "related_port_code"     VARCHAR(5),
  ADD COLUMN "company_name_override" VARCHAR(100),
  ADD COLUMN "email"                 VARCHAR(254),
  ADD COLUMN "phone"                 VARCHAR(20);

COMMENT ON COLUMN "org_address"."purposes" IS
  'OrgAddressCapability.AddressType codes, repeating. Display and routing only; never a basis for access.';
COMMENT ON COLUMN "org_address"."related_port_code" IS 'UN/LOCODE from OrgAddress.RelatedPortCode.';

-- OrgCusCode.CustomsRegNo is 254; the transaction-level RegistrationNumber.Value
-- is 35. Size for the larger, and keep the scheme's own description.
ALTER TABLE "org_registration_id" ALTER COLUMN "value" TYPE VARCHAR(254);
ALTER TABLE "org_registration_id" ADD COLUMN "scheme_description" VARCHAR(35);
ALTER TABLE "org_registration_id" ADD COLUMN "is_country_default" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "org_registration_id"."scheme" IS 'OrgCusCode.CodeType. Code list not published; comes from Noatum CargoWise.';

-- Action DELETE exists in the CargoWise envelope. The mirror never deletes.
COMMENT ON TABLE "master_org" IS
  'Read-only mirror of CargoWise organisations. A source DELETE deactivates; rows are never removed. Written only through app.apply_organisation_batch.';
