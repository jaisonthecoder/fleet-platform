-- ---------------------------------------------------------------------------
-- The integration message store: every exchange with CargoWise, both directions.
--
-- Two problems it solves.
--
-- OUTBOUND, and the reason it exists now: the CargoWise transport is not agreed,
-- so we hold the last mile. "Hold" must not mean "drop". Every message we would
-- have sent is built and recorded here as `pending`, written in the SAME
-- transaction as the business change that caused it. A quote and its CargoWise
-- copy therefore either both exist or neither does - there is no window where we
-- have answered a customer but lost the instruction to tell CargoWise. When the
-- transport is agreed, the relay starts delivering these rows and no business
-- code changes.
--
-- INBOUND: the raw message is archived before anything interprets it, so a
-- mapping bug is recoverable by replay rather than by asking CargoWise to resend.
--
-- Internal-only: these rows carry another system's payloads and operational
-- detail. `customer_group_id` is set where the message belongs to one customer so
-- staff can filter, but it never widens what a customer can see - no customer
-- policy selects from this table.
-- ---------------------------------------------------------------------------

CREATE TYPE integration_direction AS ENUM ('inbound', 'outbound');

CREATE TYPE integration_message_status AS ENUM (
  'pending',      -- recorded, not yet handed to a transport
  'sending',      -- claimed by the relay
  'sent',         -- the transport accepted it
  'acknowledged', -- the far side confirmed it
  'failed',       -- gave up after retries; kept for replay
  'skipped'       -- deliberately not sent, e.g. the sync switch is off
);

CREATE TABLE integration_message (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction          integration_direction NOT NULL,
  status             integration_message_status NOT NULL DEFAULT 'pending',

  -- Which system, and which instance of it, for the day there is more than one.
  source_system      varchar(40) NOT NULL DEFAULT 'cw1',
  source_instance    varchar(40) NOT NULL DEFAULT 'unassigned',

  -- The port method that produced it, e.g. `quote.request.create`. Business
  -- vocabulary, never a transport verb.
  operation          varchar(80) NOT NULL,

  -- Our reference for the thing this is about, e.g. Q-000042.
  portal_ref         varchar(80),
  -- `<portal_ref>:v<n>` - stable across retries, new on a re-price.
  idempotency_key    varchar(160),
  -- The far side's id for an inbound message. Unique per system and instance.
  source_message_id  varchar(160),
  -- The far side's own reference, once it gives us one.
  external_reference varchar(160),

  -- Canonical shape, not a CargoWise shape: converting is the transport's job.
  payload            jsonb NOT NULL DEFAULT '{}',

  attempts           integer NOT NULL DEFAULT 0,
  last_error         text,
  next_attempt_at    timestamptz,
  sent_at            timestamptz,

  customer_group_id  uuid REFERENCES customer_group(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  correlation_id     varchar(80),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- A message delivered twice is processed once.
--
-- Not partial, though only inbound rows carry a source id: PostgreSQL treats NULLs
-- as distinct, so a plain unique already permits any number of rows without one.
-- A `WHERE ... IS NOT NULL` predicate would add nothing except drift that Prisma
-- cannot express, and the next `migrate dev` would offer to drop the index.
CREATE UNIQUE INDEX integration_message_source_unique
  ON integration_message (source_system, source_instance, source_message_id);

-- Retrying must reuse the key rather than send twice, so the same idempotency key
-- may not be queued twice in the same direction. Same reasoning on NULLs.
CREATE UNIQUE INDEX integration_message_idempotency_unique
  ON integration_message (direction, idempotency_key);

-- The relay's query: oldest pending first, respecting backoff.
CREATE INDEX integration_message_relay_idx
  ON integration_message (status, next_attempt_at);

CREATE INDEX integration_message_portal_ref_idx ON integration_message (portal_ref);
CREATE INDEX integration_message_customer_idx ON integration_message (customer_group_id, created_at);

ALTER TABLE integration_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_message FORCE ROW LEVEL SECURITY;

-- One policy, same shape as every other table here.
--
-- USING is internal-only, so a customer can never SELECT, UPDATE or DELETE a row:
-- these carry another system's payloads and operational detail.
--
-- WITH CHECK is wider on purpose. A customer submitting a quote runs with
-- is_internal = false, and the outbound copy MUST be written inside that same
-- transaction or the atomicity guarantee this table exists for is gone. So a
-- caller may INSERT an outbound row for their OWN customer, and still cannot read
-- back a single row of the table.
CREATE POLICY integration_message_access ON integration_message
  USING (app.is_internal())
  WITH CHECK (
    app.is_internal()
    OR (
      direction = 'outbound'
      AND customer_group_id IS NOT NULL
      AND customer_group_id = app.current_group()
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE integration_message TO portal_app;

-- Deliberately no DELETE grant: retention is a scheduled job that runs as the
-- owner, so nothing in a request path can erase the record of an exchange.

-- --- the write door -------------------------------------------------------
--
-- A customer must be able to record an outbound message inside their own
-- transaction, and must never be able to read this table. Those two are in
-- tension: PostgreSQL applies the SELECT policy to rows returned by
-- `INSERT ... RETURNING`, so a plain insert succeeds for a customer and the same
-- insert with RETURNING is refused - and the caller needs the id back.
--
-- So writes go through this function. It runs as the owner, and re-checks the
-- tenancy rule itself rather than relying on the policy it bypasses.
--
-- The OUT value is a scalar named `v_id`, not a RETURNS TABLE column: a table
-- column named `id` or `expires_at` becomes a PL/pgSQL variable and every bare
-- reference to the real column turns ambiguous (SQLSTATE 42702).
CREATE FUNCTION app.record_outbound_message(
  p_operation       text,
  p_portal_ref      text,
  p_idempotency_key text,
  p_payload         jsonb,
  p_customer_group  uuid,
  p_created_by      uuid,
  p_correlation_id  text,
  p_source_instance text,
  p_status          integration_message_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- The tenancy rule, enforced here because the policy is bypassed.
  IF NOT app.is_internal() THEN
    IF p_customer_group IS NULL OR p_customer_group IS DISTINCT FROM app.current_group() THEN
      RAISE EXCEPTION 'refusing to record an outbound message for another customer'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  INSERT INTO integration_message (
    direction, status, operation, portal_ref, idempotency_key, payload,
    customer_group_id, created_by_user_id, correlation_id, source_instance,
    next_attempt_at
  )
  VALUES (
    'outbound', p_status, p_operation, p_portal_ref, p_idempotency_key, p_payload,
    p_customer_group, p_created_by, p_correlation_id,
    COALESCE(p_source_instance, 'unassigned'),
    CASE WHEN p_status = 'pending' THEN now() ELSE NULL END
  )
  ON CONFLICT (direction, idempotency_key) DO NOTHING
  RETURNING integration_message.id INTO v_id;

  -- NULL means this exact message was already recorded, which is a no-op rather
  -- than an error: a retried business action must not fail.
  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION app.record_outbound_message(
  text, text, text, jsonb, uuid, uuid, text, text, integration_message_status
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.record_outbound_message(
  text, text, text, jsonb, uuid, uuid, text, text, integration_message_status
) TO portal_app;
