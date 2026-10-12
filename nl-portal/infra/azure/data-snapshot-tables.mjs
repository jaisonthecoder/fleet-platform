/**
 * What a data snapshot carries, and what it deliberately leaves behind.
 *
 * Shared by export-local-data.mjs and import-data-snapshot.mjs so the two can never
 * disagree about the contents of a file one writes and the other replays.
 *
 * The table list is read from the live catalogue rather than hard-coded: a table added
 * by a later migration is then carried automatically instead of being silently dropped
 * from every future snapshot. Only the exclusions are written down, each with a reason.
 */

/** Never carried, whatever the snapshot was taken from. */
export const NEVER_CARRIED = {
  _prisma_migrations:
    'the target keeps its own migration history; overwriting it breaks drift detection and the resolve-as-applied step in migrate.mjs',
  local_session:
    'live sign-in sessions bound to cookies issued locally; replaying them would transplant authenticated sessions into the target',
  auth_rate_limit: 'transient throttle counters, and its RLS policy refuses every direct write',
  job_run: 'job bookkeeping for a queue the target runs itself',
};

/** Carried only when the operator asks for credentials to travel. */
export const CREDENTIAL_TABLES = {
  local_credential: 'password hashes',
  local_mfa_factor: 'second-factor secrets',
  local_recovery_code: 'single-use recovery codes',
  local_security_challenge: 'pending activation and reset challenges',
};

/**
 * Session variables every RLS policy in this schema keys off. An owner session that sets
 * all four can write to every table; one that sets none can write to almost nothing, and
 * fails loudly rather than silently skipping rows.
 */
export const RLS_SETTINGS = [
  ['app.is_internal', 'true'],
  ['app.local_auth_scope', 'on'],
  ['app.identity_lookup', 'on'],
  ['app.org_batch', 'on'],
];

/** Every ordinary table in `public`, newest schema included. */
export async function allTables(client) {
  const { rows } = await client.query(
    `SELECT c.relname AS name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`,
  );
  return rows.map((row) => row.name);
}

/**
 * The tables a snapshot carries. `withCredentials` decides only whether the four
 * credential tables travel; every other decision is fixed.
 */
export async function carriedTables(client, withCredentials) {
  const skip = new Set(Object.keys(NEVER_CARRIED));
  if (!withCredentials) for (const name of Object.keys(CREDENTIAL_TABLES)) skip.add(name);
  return (await allTables(client)).filter((name) => !skip.has(name));
}

/**
 * Columns that may appear in an INSERT. Generated columns (master_org.code_norm,
 * customer_account.org_confirmed) are recomputed by the target and rejected if supplied.
 */
export async function insertableColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
      ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((row) => row.column_name);
}

/** The applied migration names, used to prove source and target share one schema. */
export async function appliedMigrations(client) {
  const { rows } = await client.query(
    `SELECT migration_name
       FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name`,
  );
  return rows.map((row) => row.migration_name);
}
