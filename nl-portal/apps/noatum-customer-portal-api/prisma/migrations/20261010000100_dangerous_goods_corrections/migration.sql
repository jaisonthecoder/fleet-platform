-- ---------------------------------------------------------------------------
-- Two corrections to the dangerous goods slice
--
-- 1. `dg_packing_group` becomes system-owned.
--
--    `PACKING_GROUPS` in quote.schema.ts is a zod enum of I, II, III and NONE.
--    A portal-owned lookup can be extended on the Lookups screen, so an
--    administrator could add a fourth group, watch it appear in the dropdown and
--    then have the server reject it with an opaque enum error - two sources of
--    truth for the same four values.
--
--    The constant is the right side to keep. The UN has defined exactly three
--    packing groups for as long as the Model Regulations have existed; this is
--    not a list Noatum maintains. System ownership says so, and the lookups
--    service already refuses label, parent and active edits on a non-portal
--    category.
--
--    The other three DG lists stay portal-owned on purpose: packagings,
--    regimes and units are conveniences the business may reasonably extend, and
--    the columns behind them are free text.
--
-- 2. The table comment is corrected.
--
--    The applied migration's comment says only UN number and class are required.
--    That was true when it was written and is no longer: the required set was
--    settled from 49 CFR 172.202/172.203 and is recorded in docs/gaps.md G3.
--    The original migration file is left untouched - editing an applied
--    migration changes its checksum and Prisma then reports drift - so the
--    correction is made here, where it is also a record of the change.
-- ---------------------------------------------------------------------------

UPDATE lookup_category
SET ownership = 'system',
    description = 'The three UN packing groups plus "not assigned". Defined by the UN Model Regulations, not maintained by Noatum.'
WHERE code = 'dg_packing_group';

COMMENT ON TABLE quote_dangerous_goods IS
  'Dangerous goods data captured with a quote request, one row per UN number and packaging variant. NOT a dangerous goods declaration: 49 CFR 172.204(d)(1) requires that to be signed by the shipper or their agent, and CargoWise owns it. Required on submission: UN number, proper shipping name, class, packing group as an answer, packaging type, package count, net quantity and unit; flashpoint when class 3 is primary or subsidiary; technical name for an n.o.s. entry. See docs/gaps.md section G.';
