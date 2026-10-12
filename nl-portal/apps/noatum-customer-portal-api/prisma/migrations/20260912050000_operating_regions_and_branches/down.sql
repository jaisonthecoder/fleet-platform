-- Reverses 20260912050000_operating_regions_and_branches.
-- Staff branch assignments are lost with the column; export them first if the
-- catalogue is to be rebuilt.

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_branch_id_fkey";
DROP INDEX IF EXISTS "user_branch_id_idx";
ALTER TABLE "user" DROP COLUMN IF EXISTS "branch_id";

DROP TABLE IF EXISTS "branch";
DROP TABLE IF EXISTS "region";
