-- Rollback for 0060_scheduled_work_deduplication.
DROP INDEX IF EXISTS "fleet"."scheduled_work_pending_subject_uq";