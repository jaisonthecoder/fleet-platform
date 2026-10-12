/**
 * Loads a data snapshot into a deployed database, once.
 *
 * Runs on the VNet agent pool from the migration bundle, as portal_owner, against the
 * private PostgreSQL server. This REPLACES the contents of every table in `public`:
 * the snapshot is a complete picture of a database, not a set of additions, so the
 * target is emptied first and anything already there is lost.
 *
 * Why it is safe to do that in one shot:
 *   - everything happens inside ONE transaction, so a failure anywhere leaves the
 *     target exactly as it was;
 *   - foreign keys are dropped and re-added rather than worked around, and re-adding
 *     them re-validates every row, so an inconsistent snapshot aborts the load;
 *   - `quote` and `quote_option` reference each other, and three tables reference
 *     themselves, so no ordering of inserts alone can satisfy the constraints.
 *
 * Environment: DATABASE_MIGRATION_URL (owner), SNAPSHOT_PATH, SNAPSHOT_SHA256.
 * Optional: DRY_RUN=true to roll back at the end, ALLOW_RERUN=true to load over a
 * database that has already been seeded this way.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

import { RLS_SETTINGS, allTables, appliedMigrations, insertableColumns } from './data-snapshot-tables.mjs';

const fromApi = createRequire(new URL('../../apps/noatum-customer-portal-api/package.json', import.meta.url));
const { Client } = createRequire(fromApi.resolve('@prisma/adapter-pg'))('pg');

const flag = (name) => /^(1|true|yes)$/i.test(process.env[name]?.trim() ?? '');
const dryRun = flag('DRY_RUN');
const allowRerun = flag('ALLOW_RERUN');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} must be set.`);
    process.exit(1);
  }
  return value;
}

const connectionString = required('DATABASE_MIGRATION_URL');
const snapshotPath = required('SNAPSHOT_PATH');
const expectedChecksum = process.env.SNAPSHOT_SHA256?.trim();

const body = readFileSync(snapshotPath);
const checksum = createHash('sha256').update(body).digest('hex');
if (expectedChecksum && expectedChecksum !== checksum) {
  throw new Error(`Snapshot checksum is ${checksum}, expected ${expectedChecksum}. Refusing to load a file that is not the one that was approved.`);
}

const snapshot = JSON.parse(gunzipSync(body).toString('utf8'));
if (snapshot.format !== 'noatum-data-snapshot/1') throw new Error(`Unknown snapshot format ${snapshot.format}.`);

console.log(`Snapshot   ${snapshotPath}`);
console.log(`Taken      ${snapshot.createdAt} from ${snapshot.database}`);
console.log(`Checksum   ${checksum}`);
console.log(`Credentials${snapshot.withCredentials ? ' included' : ' not included'}`);
console.log(dryRun ? '\nDRY RUN - every change is rolled back at the end.\n' : '');

const client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
await client.connect();

try {
  // The guard lives in `app`, beside the schema's other portal-owned objects: it must
  // survive the truncation of `public`, and it is not a Prisma-modelled table.
  await client.query(`
    CREATE TABLE IF NOT EXISTS app.data_snapshot_import (
      id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      taken_at      timestamptz NOT NULL,
      loaded_at     timestamptz NOT NULL DEFAULT now(),
      checksum      char(64)    NOT NULL,
      source        text        NOT NULL,
      rows_loaded   integer     NOT NULL,
      credentials   boolean     NOT NULL
    )`);
  await client.query('REVOKE ALL ON TABLE app.data_snapshot_import FROM portal_app');

  const { rows: previous } = await client.query('SELECT loaded_at, checksum FROM app.data_snapshot_import ORDER BY loaded_at');
  if (previous.length && !allowRerun) {
    const last = previous[previous.length - 1];
    throw new Error(
      `This database was already seeded from a snapshot on ${last.loaded_at.toISOString()} (checksum ${last.checksum.slice(0, 12)}...). ` +
        'This pipeline is meant to run once. Tick "Allow a repeat load" if replacing that data is genuinely intended.',
    );
  }

  const targetMigrations = await appliedMigrations(client);
  const missing = snapshot.migrations.filter((name) => !targetMigrations.includes(name));
  const extra = targetMigrations.filter((name) => !snapshot.migrations.includes(name));
  if (missing.length || extra.length) {
    throw new Error(
      `Source and target are not on the same schema. ${missing.length} migration(s) missing from the target` +
        `${missing.length ? ` (first: ${missing[0]})` : ''}, ${extra.length} only in the target` +
        `${extra.length ? ` (first: ${extra[0]})` : ''}. Deploy the matching build before loading data.`,
    );
  }
  console.log(`Schema     ${targetMigrations.length} migrations, identical on both sides.`);

  const tables = await allTables(client);
  const carried = Object.keys(snapshot.tables);
  const unknown = carried.filter((name) => !tables.includes(name));
  if (unknown.length) throw new Error(`Snapshot carries tables the target does not have: ${unknown.join(', ')}.`);

  // Every table here forces row-level security, so it applies to the owner too unless the
  // server administrator was able to hand out BYPASSRLS. Where it was not, the owner runs
  // with the four session settings below instead, and a table whose policies read none of
  // them cannot be written at all. Checked before anything is destroyed, because the
  // alternative is discovering it halfway through a load that then rolls back.
  const {
    rows: [role],
  } = await client.query('SELECT rolbypassrls AS bypasses FROM pg_roles WHERE rolname = current_user');
  if (!role?.bypasses) {
    const loading = carried.filter((name) => (snapshot.counts[name] ?? 0) > 0);
    const { rows: blocked } = await client.query(
      `SELECT t AS name FROM unnest($1::text[]) AS t
        WHERE NOT EXISTS (
          SELECT 1 FROM pg_policies p
           WHERE p.schemaname = 'public' AND p.tablename = t AND p.cmd IN ('ALL', 'INSERT')
             AND coalesce(p.with_check, p.qual, '') ~ $2)
        ORDER BY 1`,
      [loading, RLS_SETTINGS.map(([name]) => name.replace('app.', '')).join('|')],
    );
    if (blocked.length) {
      throw new Error(
        `The owner role cannot write to ${blocked.map((row) => row.name).join(', ')}: ` +
          'no row-level security policy on those tables reads any session setting this loader sets. ' +
          'Grant portal_owner BYPASSRLS, or give those tables an internal-only policy.',
      );
    }
    console.log('Access     no BYPASSRLS; every table to load has a policy the session settings satisfy.');
  } else {
    console.log('Access     owner bypasses row-level security.');
  }

  const { rows: before } = await client.query(
    `SELECT coalesce(sum((xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', c.relname), false, true, '')))[1]::text::bigint), 0) AS n
       FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'`,
  );
  console.log(`Target     holds ${before[0].n} rows, which this load replaces.`);

  await client.query('BEGIN');
  for (const [name, value] of RLS_SETTINGS) await client.query('SELECT set_config($1, $2, true)', [name, value]);

  const { rows: keys } = await client.query(
    `SELECT con.conname AS name,
            format('%I.%I', n.nspname, c.relname) AS table_name,
            pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'`,
  );
  for (const key of keys) await client.query(`ALTER TABLE ${key.table_name} DROP CONSTRAINT "${key.name}"`);
  console.log(`Keys       dropped ${keys.length} foreign keys for the load.`);

  // Emptied, not merged: tables the snapshot deliberately leaves behind (sessions,
  // throttle counters) must not keep rows pointing at users that no longer exist.
  const emptied = tables.filter((name) => name !== '_prisma_migrations');
  await client.query(`TRUNCATE ${emptied.map((name) => `public."${name}"`).join(', ')}`);

  let loaded = 0;
  for (const table of carried) {
    const payload = snapshot.tables[table];
    const expected = snapshot.counts[table] ?? 0;
    if (expected === 0) continue;
    const columns = await insertableColumns(client, table);
    const quoted = columns.map((column) => `"${column}"`).join(', ');
    const { rowCount } = await client.query(
      `INSERT INTO public."${table}" (${quoted})
       SELECT ${quoted} FROM json_populate_recordset(NULL::public."${table}", $1::json)`,
      [payload],
    );
    if (rowCount !== expected) throw new Error(`${table}: loaded ${rowCount} rows, snapshot recorded ${expected}.`);
    loaded += rowCount;
    console.log(`  ${String(rowCount).padStart(6)}  ${table}`);
  }

  // Re-adding validates every row; an inconsistent snapshot fails here and rolls back.
  for (const key of keys) await client.query(`ALTER TABLE ${key.table_name} ADD CONSTRAINT "${key.name}" ${key.definition}`);
  console.log(`Keys       restored ${keys.length} foreign keys; every row revalidated.`);

  await client.query(
    'INSERT INTO app.data_snapshot_import (taken_at, checksum, source, rows_loaded, credentials) VALUES ($1, $2, $3, $4, $5)',
    [snapshot.createdAt, checksum, snapshot.database, loaded, snapshot.withCredentials],
  );

  if (dryRun) {
    await client.query('ROLLBACK');
    console.log(`\nDry run complete: ${loaded} rows would load. Nothing was changed.`);
  } else {
    await client.query('COMMIT');
    console.log(`\nLoaded ${loaded} rows into ${snapshot.database}.`);
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
