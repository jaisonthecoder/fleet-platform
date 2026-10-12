-- ---------------------------------------------------------------------------
-- ORG-01: one organisation code belongs to one customer.
--
-- The schema carried only UNIQUE (customer_group_id, cw1_org_code), which
-- prevents the harmless duplicate (the same code twice on one customer) and
-- permits the dangerous one (the same code on two customers). Because
-- TenantResolverService turns a customer's linked codes into the CargoWise
-- query, two owners of one code means two customers receiving the same
-- shipments and invoices, with no second line of defence behind it.
--
-- FR-ORG-003, LLD invariant I1, the CW1 multi-tenant note ("Impossible - unique
-- index") and the simplification register all assume this constraint exists.
-- It did not.
--
-- Case matters too: `ACME001` and `acme001` are the same organisation in
-- CargoWise but two rows here, so a global unique on the raw column would still
-- be bypassable. The index is therefore on the normalised expression.
--
-- A functional unique index is used rather than a stored `code_norm` column so
-- that nothing drifts from schema.prisma. If ORG-02 needs `code_norm` as a
-- foreign key target for the link gate, it can be materialised then.
--
-- Verified before writing this migration: the table holds zero rows, so there is
-- nothing to reconcile. Against a populated database run the collision report in
-- the comment below first - a failure here is a live data leak, not a retry.
--
--   SELECT lower(btrim(cw1_org_code)) AS code_norm,
--          count(*) AS rows,
--          count(DISTINCT customer_group_id) AS groups,
--          string_agg(DISTINCT cw1_org_code, ' | ') AS variants
--   FROM customer_account
--   GROUP BY 1
--   HAVING count(DISTINCT customer_group_id) > 1 OR count(*) > 1;
-- ---------------------------------------------------------------------------

-- Refuse to create the index while a collision exists, rather than failing with
-- a bare duplicate-key error that says nothing about why it matters.
DO $$
DECLARE
  collisions integer;
BEGIN
  SELECT count(*) INTO collisions FROM (
    SELECT 1 FROM customer_account
    GROUP BY lower(btrim(cw1_org_code))
    HAVING count(*) > 1
  ) duplicated;

  IF collisions > 0 THEN
    RAISE EXCEPTION
      'ORG-01 blocked: % organisation code(s) are linked more than once. Two customers may be sharing one code. Resolve the ownership before applying this migration.',
      collisions;
  END IF;
END
$$;

-- Codes arrive from a source system; stored with surrounding whitespace they
-- would normalise to the same key while reading as different values.
ALTER TABLE "customer_account"
  ADD CONSTRAINT "customer_account_cw1_org_code_trimmed"
  CHECK ("cw1_org_code" = btrim("cw1_org_code") AND length("cw1_org_code") > 0);

-- The invariant: one organisation, one customer, whatever the casing.
CREATE UNIQUE INDEX "customer_account_cw1_org_code_norm_key"
  ON "customer_account" (lower(btrim("cw1_org_code")));

COMMENT ON INDEX "customer_account_cw1_org_code_norm_key" IS
  'FR-ORG-003: an organisation code belongs to exactly one CustomerGroup. Case and whitespace insensitive.';
