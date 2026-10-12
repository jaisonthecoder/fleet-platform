-- ---------------------------------------------------------------------------
-- Remove the second-approver flow from customer links.
--
-- Direction from the user: onboarding should be simple, with no extra approver
-- step. Everything else stays.
--
-- What goes: `link_status` (pending/confirmed), `approved_by_user_id`,
-- `approved_at`, and the org_link_status enum. Those three columns exist only to
-- support a four-eyes step that we are not building. A link is now effective the
-- moment an authorised person creates it.
--
-- What stays, because none of it is approval:
--   * `justification`, `linked_by_user_id`, `linked_at` - that is audit, and a
--     link without a recorded reason and author is worse than useless later;
--   * `master_org.is_source_confirmed` and the composite foreign key - that is
--     PROVENANCE, not approval. It answers "did a source confirm this
--     organisation exists", which is what stops a typed code granting access;
--   * `customer_account.is_active` - a link can still be switched off without
--     losing its history.
--
-- Where the gate went instead. "A pending link grants nothing" was doing real
-- work, and it still needs to be true. The condition simply moves somewhere more
-- honest: a link is effective when the CUSTOMER is active and the link is
-- active. A customer still being set up is `draft`, and a draft customer grants
-- nothing - which is the same protection with one concept instead of two.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "customer_account_link_status_idx";

ALTER TABLE "customer_account" DROP CONSTRAINT IF EXISTS "customer_account_approved_by_user_id_fkey";

ALTER TABLE "customer_account"
  DROP COLUMN IF EXISTS "link_status",
  DROP COLUMN IF EXISTS "approved_by_user_id",
  DROP COLUMN IF EXISTS "approved_at";

DROP TYPE IF EXISTS "org_link_status";

COMMENT ON COLUMN "customer_account"."justification" IS
  'Why this organisation was linked to this customer. Recorded, never approved by a second person.';
