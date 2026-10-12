-- ---------------------------------------------------------------------------
-- An invitation carries the roles it grants
--
-- Until now every invitation meant one thing - Customer Admin - because the only
-- route that created one was Noatum appointing a customer's first administrator.
-- A Customer Admin inviting colleagues has to say what each of them will be, so
-- the invitation has to carry it: the roles are decided when the invitation is
-- sent, not when the link is opened, and the person opening the link must not be
-- able to influence them.
--
-- display_name is captured at invitation time for the same reason the design asks
-- for it: an administrator inviting six colleagues should see names in the list,
-- not six email addresses waiting to accept.
--
-- resend_count enforces the cap in the onboarding design (maximum three), and
-- office_account_id carries the optional "restrict this person to one office"
-- that user_account_access applies once the user exists.
-- ---------------------------------------------------------------------------

ALTER TABLE invitation
  ADD COLUMN role_keys        text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN display_name     varchar(200),
  ADD COLUMN resend_count     integer     NOT NULL DEFAULT 0,
  ADD COLUMN office_account_id uuid;

ALTER TABLE invitation
  ADD CONSTRAINT invitation_office_account_id_fkey
  FOREIGN KEY (office_account_id) REFERENCES customer_account(id) ON DELETE SET NULL;

CREATE INDEX invitation_office_account_id_idx ON invitation (office_account_id);

-- Every invitation that already exists was an administrator appointment, so it
-- keeps meaning that rather than becoming an invitation to nothing.
UPDATE invitation SET role_keys = ARRAY['customer_admin'] WHERE role_keys = '{}';
