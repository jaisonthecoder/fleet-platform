-- Adds the `draft` lifecycle state from
-- docs/Orignal Docs/13-Customer-Onboarding-Flow-Design.md §4.
--
-- A customer starts named and nothing more: no confirmed link, no users, no data
-- visible, and deletable. Without this state, "created" and "onboarding" collapse
-- into one and there is no honest answer to what a half-finished customer is.
--
-- Split across two migrations on purpose: PostgreSQL refuses to USE a new enum
-- value in the same transaction that adds it, and Prisma runs each migration in
-- its own transaction. The column default moves in 20260917020000.

ALTER TYPE "customer_status" ADD VALUE IF NOT EXISTS 'draft' BEFORE 'onboarding';
