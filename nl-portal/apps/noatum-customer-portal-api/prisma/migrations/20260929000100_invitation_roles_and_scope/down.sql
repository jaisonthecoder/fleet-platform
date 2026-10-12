-- Reverses 20260929000100_invitation_roles_and_scope.

DROP INDEX IF EXISTS invitation_office_account_id_idx;

ALTER TABLE invitation
  DROP CONSTRAINT IF EXISTS invitation_office_account_id_fkey;

ALTER TABLE invitation
  DROP COLUMN IF EXISTS role_keys,
  DROP COLUMN IF EXISTS display_name,
  DROP COLUMN IF EXISTS resend_count,
  DROP COLUMN IF EXISTS office_account_id;
