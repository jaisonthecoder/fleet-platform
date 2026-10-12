-- ---------------------------------------------------------------------------
-- Local authentication foundation (ADR-006, pilot scope).
--
-- Invited customers and the provisioned bootstrap administrator sign in with a
-- password held here. Staff Entra SSO is untouched: nothing in this migration
-- changes the existing issuer/subject binding or app.resolve_identity.
--
-- THE ACCESS RULE THAT MAKES THIS SAFE
--
-- Every other table in this schema grants DML to portal_app and relies on RLS to
-- scope the rows. These five hold credential material, so they do the opposite:
--
--   * portal_app receives NO table privilege at all. Table privileges are checked
--     before RLS, so the runtime role cannot read a password hash, a session
--     digest or a TOTP secret by any query, with or without a tenant context.
--   * RLS is still enabled and FORCED, with a policy that only opens while
--     app.local_auth_scope is set. That flag is set inside the SECURITY DEFINER
--     functions below and cleared again before they return. It is defence in
--     depth for the day someone adds a GRANT by accident, not the primary lock.
--   * The runtime reaches the data only through app.local_* functions, each of
--     which answers exactly one question. There is no general read.
--
-- Because of that, the Prisma models for these tables are never queried through
-- the Prisma client; they exist so the schema still describes the database.
-- ---------------------------------------------------------------------------

CREATE TYPE "local_challenge_purpose" AS ENUM (
  'activation',
  'password_reset',
  'mfa_enrolment',
  'bootstrap'
);

-- --- tables ----------------------------------------------------------------

CREATE TABLE "local_credential" (
  "user_id"          UUID NOT NULL,
  "password_hash"    VARCHAR(255) NOT NULL,
  "security_version" INTEGER NOT NULL DEFAULT 1,
  "password_set_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "disabled_at"      TIMESTAMPTZ(6),
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "local_credential_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "local_credential_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE "local_session" (
  "token_hash"          CHAR(64) NOT NULL,
  "user_id"             UUID NOT NULL,
  "assurance"           VARCHAR(20) NOT NULL DEFAULT 'pending_mfa',
  "security_version"    INTEGER NOT NULL,
  "data"                JSONB NOT NULL DEFAULT '{}',
  "idle_expires_at"     TIMESTAMPTZ(6) NOT NULL,
  "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at"          TIMESTAMPTZ(6),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_used_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "local_session_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "local_session_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "local_session_assurance_check"
    CHECK ("assurance" IN ('pending_mfa', 'authenticated'))
);

CREATE INDEX "local_session_user_idx" ON "local_session" ("user_id");
CREATE INDEX "local_session_absolute_expires_idx" ON "local_session" ("absolute_expires_at");

CREATE TABLE "local_security_challenge" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "purpose"       "local_challenge_purpose" NOT NULL,
  "token_hash"    CHAR(64) NOT NULL,
  "user_id"       UUID NOT NULL,
  "invitation_id" UUID,
  "expires_at"    TIMESTAMPTZ(6) NOT NULL,
  "consumed_at"   TIMESTAMPTZ(6),
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "local_security_challenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "local_security_challenge_token_key" UNIQUE ("token_hash"),
  CONSTRAINT "local_security_challenge_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "local_security_challenge_invitation_fkey"
    FOREIGN KEY ("invitation_id") REFERENCES "invitation"("id") ON DELETE SET NULL
);

CREATE INDEX "local_security_challenge_user_idx"
  ON "local_security_challenge" ("user_id", "purpose");
CREATE INDEX "local_security_challenge_expires_idx"
  ON "local_security_challenge" ("expires_at");

CREATE TABLE "local_mfa_factor" (
  "user_id"          UUID NOT NULL,
  "type"             VARCHAR(20) NOT NULL DEFAULT 'totp',
  "secret_encrypted" TEXT NOT NULL,
  "confirmed_at"     TIMESTAMPTZ(6),
  "last_used_step"   BIGINT,
  "created_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "local_mfa_factor_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "local_mfa_factor_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE "local_recovery_code" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL,
  "code_hash"  CHAR(64) NOT NULL,
  "used_at"    TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "local_recovery_code_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "local_recovery_code_code_key" UNIQUE ("code_hash"),
  CONSTRAINT "local_recovery_code_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "local_recovery_code_user_idx" ON "local_recovery_code" ("user_id");

-- --- row level security ----------------------------------------------------
-- Enabled and forced so the table owner is subject to it too, then opened only
-- for the window a local_auth function holds app.local_auth_scope. No GRANT is
-- issued below, so portal_app is refused before RLS is even consulted.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'local_credential',
    'local_session',
    'local_security_challenge',
    'local_mfa_factor',
    'local_recovery_code'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL '
      || 'USING (current_setting(''app.local_auth_scope'', true) = ''on'') '
      || 'WITH CHECK (current_setting(''app.local_auth_scope'', true) = ''on'')',
      t || '_definer_only', t
    );
  END LOOP;
END
$$;

-- --- identity resolution by portal user id ---------------------------------
-- app.resolve_identity keys on issuer+subject, which a local session does not
-- have. This returns the same projection for a known user id so both sign-in
-- paths produce one principal shape and one source of roles.

CREATE FUNCTION app.resolve_identity_by_id(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  customer_group_id uuid,
  is_internal boolean,
  status text,
  display_name text,
  email text,
  branch_code text,
  branch_name text,
  role_keys text[],
  permissions text[],
  account_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.identity_lookup', 'on', true);

  RETURN QUERY
  SELECT
    u.id,
    u.customer_group_id,
    u.is_internal,
    u.status::text,
    u.display_name::text,
    u.email::text,
    b.code::text,
    b.name::text,
    COALESCE((
      SELECT array_agg(r.key::text ORDER BY r.key)
      FROM user_role ur
      JOIN role r ON r.id = ur.role_id
      WHERE ur.user_id = u.id
    ), ARRAY[]::text[]),
    COALESCE((
      SELECT array_agg(DISTINCT rp.permission_key::text)
      FROM user_role ur
      JOIN role_permission rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = u.id
    ), ARRAY[]::text[]),
    COALESCE((
      SELECT array_agg(a.account_id)
      FROM user_account_access a
      WHERE a.user_id = u.id
    ), ARRAY[]::uuid[])
  FROM "user" u
  LEFT JOIN branch b ON b.id = u.branch_id
  WHERE u.id = p_user_id;

  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

-- --- credentials -----------------------------------------------------------

-- One question: "what does signing in as this email have to check?". Returns a
-- row even when no credential exists, so the caller can spend the same time on a
-- dummy verification and not leak which addresses are enrolled.
CREATE FUNCTION app.local_credential_for_login(p_email text)
RETURNS TABLE (
  user_id uuid,
  status text,
  is_internal boolean,
  customer_group_id uuid,
  password_hash text,
  security_version integer,
  credential_disabled boolean,
  mfa_enrolled boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);
  PERFORM set_config('app.identity_lookup', 'on', true);

  RETURN QUERY
  SELECT
    u.id,
    u.status::text,
    u.is_internal,
    u.customer_group_id,
    c.password_hash::text,
    COALESCE(c.security_version, 0),
    c.disabled_at IS NOT NULL,
    (f.user_id IS NOT NULL AND f.confirmed_at IS NOT NULL)
  FROM "user" u
  LEFT JOIN local_credential c ON c.user_id = u.id
  LEFT JOIN local_mfa_factor f ON f.user_id = u.id
  WHERE u.email = p_email::citext;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

-- Sets or replaces a password. Bumping the security version is what makes every
-- existing session stop resolving, so a password change signs other devices out.
CREATE FUNCTION app.local_credential_set(
  p_user_id uuid,
  p_password_hash text,
  p_bump_version boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_version integer;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  INSERT INTO local_credential (user_id, password_hash, security_version, password_set_at, updated_at)
  VALUES (p_user_id, p_password_hash, 1, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET password_hash    = EXCLUDED.password_hash,
        security_version = local_credential.security_version + CASE WHEN p_bump_version THEN 1 ELSE 0 END,
        password_set_at  = now(),
        disabled_at      = NULL,
        updated_at       = now()
  RETURNING security_version INTO v_version;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  RETURN v_version;
END;
$$;

-- --- sessions --------------------------------------------------------------

-- Resolves a cookie digest to a live session. A session is live only while it is
-- unrevoked, inside both expiry clocks, and still pinned to the credential's
-- current security version - so a password change or a forced revocation is felt
-- on the very next request without touching the session rows.
CREATE FUNCTION app.local_session_load(p_token_hash text)
RETURNS TABLE (
  user_id uuid,
  assurance text,
  data jsonb,
  idle_expires_at timestamptz,
  absolute_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  RETURN QUERY
  SELECT s.user_id, s.assurance::text, s.data, s.idle_expires_at, s.absolute_expires_at
  FROM local_session s
  JOIN local_credential c ON c.user_id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.idle_expires_at > now()
    AND s.absolute_expires_at > now()
    AND c.disabled_at IS NULL
    AND c.security_version = s.security_version;

  PERFORM set_config('app.local_auth_scope', 'off', true);
END;
$$;

-- Insert or update, never resurrect. The WHERE on the update is the whole point:
-- express-session writes the session again at the end of a response, and without
-- it a logout followed by that write would put the session back.
CREATE FUNCTION app.local_session_save(
  p_token_hash text,
  p_user_id uuid,
  p_assurance text,
  p_security_version integer,
  p_data jsonb,
  p_idle_expires_at timestamptz,
  p_absolute_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_saved boolean := false;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  INSERT INTO local_session (
    token_hash, user_id, assurance, security_version, data,
    idle_expires_at, absolute_expires_at, last_used_at
  )
  VALUES (
    p_token_hash, p_user_id, p_assurance, p_security_version, p_data,
    p_idle_expires_at, p_absolute_expires_at, now()
  )
  ON CONFLICT (token_hash) DO UPDATE
    SET assurance       = EXCLUDED.assurance,
        data            = EXCLUDED.data,
        idle_expires_at = EXCLUDED.idle_expires_at,
        last_used_at    = now()
    WHERE local_session.revoked_at IS NULL
      AND local_session.absolute_expires_at > now()
      AND local_session.user_id = EXCLUDED.user_id
  RETURNING true INTO v_saved;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  RETURN COALESCE(v_saved, false);
END;
$$;

CREATE FUNCTION app.local_session_touch(p_token_hash text, p_idle_expires_at timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_touched boolean := false;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  UPDATE local_session
  SET idle_expires_at = p_idle_expires_at,
      last_used_at    = now()
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
    AND idle_expires_at > now()
    AND absolute_expires_at > now()
  RETURNING true INTO v_touched;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  RETURN COALESCE(v_touched, false);
END;
$$;

-- Revocation is a mark, not a delete: the row is the evidence that the session
-- existed, and keeping it is what stops a late write from recreating it.
CREATE FUNCTION app.local_session_destroy(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_revoked boolean := false;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  UPDATE local_session
  SET revoked_at = now()
  WHERE token_hash = p_token_hash
    AND revoked_at IS NULL
  RETURNING true INTO v_revoked;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  RETURN COALESCE(v_revoked, false);
END;
$$;

-- Sign out everywhere, optionally keeping the session that asked for it.
CREATE FUNCTION app.local_session_revoke_user(
  p_user_id uuid,
  p_except_token_hash text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  UPDATE local_session
  SET revoked_at = now()
  WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND (p_except_token_hash IS NULL OR token_hash <> p_except_token_hash);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  RETURN v_count;
END;
$$;

-- --- purpose-bound challenges ----------------------------------------------

CREATE FUNCTION app.local_challenge_issue(
  p_user_id uuid,
  p_purpose text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_invitation_id uuid DEFAULT NULL,
  p_supersede boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  -- Issuing a new link puts the old one beyond use, so a resend cannot leave two
  -- live tokens for the same purpose.
  IF p_supersede THEN
    UPDATE local_security_challenge
    SET consumed_at = now()
    WHERE user_id = p_user_id
      AND purpose = p_purpose::local_challenge_purpose
      AND consumed_at IS NULL;
  END IF;

  INSERT INTO local_security_challenge (purpose, token_hash, user_id, invitation_id, expires_at)
  VALUES (p_purpose::local_challenge_purpose, p_token_hash, p_user_id, p_invitation_id, p_expires_at)
  RETURNING id INTO v_id;

  PERFORM set_config('app.local_auth_scope', 'off', true);
  RETURN v_id;
END;
$$;

-- Read without spending. The activation page needs to know a link is good before
-- the person has typed anything, and an email scanner following the link must not
-- burn it.
CREATE FUNCTION app.local_challenge_peek(p_purpose text, p_token_hash text)
RETURNS TABLE (
  challenge_id uuid,
  user_id uuid,
  invitation_id uuid,
  email text,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);
  PERFORM set_config('app.identity_lookup', 'on', true);

  RETURN QUERY
  SELECT ch.id, ch.user_id, ch.invitation_id, u.email::text, u.display_name::text
  FROM local_security_challenge ch
  JOIN "user" u ON u.id = ch.user_id
  WHERE ch.token_hash = p_token_hash
    AND ch.purpose = p_purpose::local_challenge_purpose
    AND ch.consumed_at IS NULL
    AND ch.expires_at > now();

  PERFORM set_config('app.local_auth_scope', 'off', true);
  PERFORM set_config('app.identity_lookup', 'off', true);
END;
$$;

-- Spend the token. The UPDATE ... RETURNING is atomic, so two simultaneous
-- activations of the same link cannot both succeed.
CREATE FUNCTION app.local_challenge_consume(p_purpose text, p_token_hash text)
RETURNS TABLE (
  challenge_id uuid,
  user_id uuid,
  invitation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  RETURN QUERY
  UPDATE local_security_challenge ch
  SET consumed_at = now()
  WHERE ch.token_hash = p_token_hash
    AND ch.purpose = p_purpose::local_challenge_purpose
    AND ch.consumed_at IS NULL
    AND ch.expires_at > now()
  RETURNING ch.id, ch.user_id, ch.invitation_id;

  PERFORM set_config('app.local_auth_scope', 'off', true);
END;
$$;

-- --- retention -------------------------------------------------------------
-- Spent and expired security rows are removed once they can no longer affect a
-- decision. Audit rows are untouched: this deletes mechanism, not evidence.

CREATE FUNCTION app.local_auth_cleanup(p_retain_days integer DEFAULT 30)
RETURNS TABLE (sessions_removed integer, challenges_removed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  v_sessions integer;
  v_challenges integer;
BEGIN
  PERFORM set_config('app.local_auth_scope', 'on', true);

  DELETE FROM local_session
  WHERE absolute_expires_at < now() - make_interval(days => p_retain_days)
     OR (revoked_at IS NOT NULL AND revoked_at < now() - make_interval(days => p_retain_days));
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  DELETE FROM local_security_challenge
  WHERE expires_at < now() - make_interval(days => p_retain_days);
  GET DIAGNOSTICS v_challenges = ROW_COUNT;

  PERFORM set_config('app.local_auth_scope', 'off', true);

  sessions_removed := v_sessions;
  challenges_removed := v_challenges;
  RETURN NEXT;
END;
$$;

-- --- privileges ------------------------------------------------------------
-- EXECUTE on the functions, and deliberately nothing on the tables.
--
-- The REVOKE is not belt and braces, it is the lock. 20260101000000 sets
-- ALTER DEFAULT PRIVILEGES ... GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES
-- TO portal_app, so these five tables arrived with full DML already granted.
-- Left alone, portal_app could set app.local_auth_scope itself - any role may
-- set its own custom GUC - satisfy the policy and read every password hash.

REVOKE ALL ON TABLE
  "local_credential",
  "local_session",
  "local_security_challenge",
  "local_mfa_factor",
  "local_recovery_code"
FROM portal_app;

GRANT EXECUTE ON FUNCTION app.resolve_identity_by_id(uuid) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_credential_for_login(text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_credential_set(uuid, text, boolean) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_session_load(text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_session_save(text, uuid, text, integer, jsonb, timestamptz, timestamptz) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_session_touch(text, timestamptz) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_session_destroy(text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_session_revoke_user(uuid, text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_challenge_issue(uuid, text, text, timestamptz, uuid, boolean) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_challenge_peek(text, text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_challenge_consume(text, text) TO portal_app;
GRANT EXECUTE ON FUNCTION app.local_auth_cleanup(integer) TO portal_app;

-- Prove the lock held. A future default-privilege change that re-opens these
-- tables should fail the migration, not be discovered in an incident.
DO $$
DECLARE
  t text;
  p text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'local_credential',
    'local_session',
    'local_security_challenge',
    'local_mfa_factor',
    'local_recovery_code'
  ] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege('portal_app', t::regclass, p) THEN
        RAISE EXCEPTION 'portal_app must hold no % privilege on %', p, t
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    END LOOP;
  END LOOP;
END
$$;
