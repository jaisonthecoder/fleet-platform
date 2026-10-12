-- Reverting loses the record of every exchange with CargoWise, including any
-- outbound message still waiting for a transport. Export the table first if the
-- relay has not delivered them.

DROP FUNCTION IF EXISTS app.record_outbound_message(
  text, text, text, jsonb, uuid, uuid, text, text, integration_message_status
);
DROP POLICY IF EXISTS integration_message_access ON integration_message;
DROP TABLE IF EXISTS integration_message;
DROP TYPE IF EXISTS integration_message_status;
DROP TYPE IF EXISTS integration_direction;
