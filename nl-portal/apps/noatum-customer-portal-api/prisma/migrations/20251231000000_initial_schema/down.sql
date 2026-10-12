BEGIN;
DROP TABLE audit_event, job_run, mapping_entry, news_item, address_book_entry,
  quote_template, quote, invitation, user_account_access, user_role,
  role_permission, permission, role, "user", master_org, customer_account, customer_group;
DROP TYPE job_status, transport_mode, quote_status, invitation_status, user_status, customer_tier;
COMMIT;
