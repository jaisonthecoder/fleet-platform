/**
 * Takes a data snapshot of the local development database, for a one-time load into a
 * deployed environment by the data-seed pipeline.
 *
 * Runs on a developer machine against the local Docker PostgreSQL, reading the API's
 * .env.local exactly as infra/scripts/psql.mjs does. Writes a gzipped snapshot and
 * prints its SHA-256, which the pipeline is given so it can prove it loaded this file.
 *
 *   pnpm data:snapshot                          everything, including passwords
 *   pnpm data:snapshot -- --without-credentials  leave password and MFA material behind
 *
 * Passwords travel by default so the demo accounts sign in to the target with the same
 * password they use locally. An Argon2 hash is self-contained and portable; a TOTP secret
 * is not, because it is sealed with LOCAL_AUTH_MFA_KEY and that key differs per
 * environment, so the export says so when any second factor is enrolled.
 *
 * Every value stays raw JSON text from PostgreSQL to the target's parameter: quote
 * totals are bigint minor units and charge lines are numeric, and both lose precision
 * the moment they become a JavaScript number.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { gzipSync } from 'node:zlib';

import { CREDENTIAL_TABLES, NEVER_CARRIED, RLS_SETTINGS, appliedMigrations, carriedTables, insertableColumns } from './data-snapshot-tables.mjs';

const fromApi = createRequire(new URL('../../apps/noatum-customer-portal-api/package.json', import.meta.url));
const { Client } = createRequire(fromApi.resolve('@prisma/adapter-pg'))('pg');

const args = process.argv.slice(2);
const withCredentials = !args.includes('--without-credentials');
const outArg = args.find((value) => value.startsWith('--out='));

const root = fileURLToPath(new URL('../../', import.meta.url));
const target = path.resolve(root, outArg ? outArg.slice('--out='.length) : '.data-snapshot/local-snapshot.json.gz');

const connectionString =
  process.env.DATABASE_MIGRATION_URL ??
  parseEnv(readFileSync(new URL('../../apps/noatum-customer-portal-api/.env.local', import.meta.url), 'utf8')).DATABASE_MIGRATION_URL;
if (!connectionString) throw new Error('DATABASE_MIGRATION_URL is not set and is absent from the API .env.local.');

const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
await client.connect();

try {
  // A snapshot must be one consistent moment, not a table-by-table walk of a live database.
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  for (const [name, value] of RLS_SETTINGS) await client.query('SELECT set_config($1, $2, true)', [name, value]);

  const migrations = await appliedMigrations(client);
  const tables = await carriedTables(client, withCredentials);

  const payloads = {};
  const counts = {};
  for (const table of tables) {
    const columns = await insertableColumns(client, table);
    const selected = columns.map((column) => `"${column}"`).join(', ');
    const {
      rows: [row],
    } = await client.query(
      `SELECT coalesce(json_agg(row_to_json(snapshot)), '[]')::text AS payload, count(*)::int AS n
         FROM (SELECT ${selected} FROM public."${table}") AS snapshot`,
    );
    payloads[table] = row.payload;
    counts[table] = row.n;
  }

  await client.query('COMMIT');

  const snapshot = {
    format: 'noatum-data-snapshot/1',
    createdAt: new Date().toISOString(),
    withCredentials,
    database: new URL(connectionString).pathname.slice(1),
    migrations,
    counts,
    tables: payloads,
  };

  const body = gzipSync(Buffer.from(JSON.stringify(snapshot), 'utf8'), { level: 9 });
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, body);
  const checksum = createHash('sha256').update(body).digest('hex');

  const carried = Object.entries(counts).filter(([, n]) => n > 0);
  const total = carried.reduce((sum, [, n]) => sum + n, 0);
  for (const [table, n] of carried.sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${table}`);
  console.log(`\n${total} rows across ${carried.length} tables, ${migrations.length} migrations.`);
  for (const [table, why] of Object.entries(NEVER_CARRIED)) console.log(`  left behind: ${table} - ${why}`);
  if (withCredentials) {
    console.log(`  carrying:    passwords - the ${counts.local_credential ?? 0} account(s) with one sign in to the target with the same password`);
    if (counts.local_mfa_factor > 0) {
      console.log(
        `  WARNING:     ${counts.local_mfa_factor} second factor(s) are sealed with this machine's LOCAL_AUTH_MFA_KEY. ` +
          'They will not verify in the target unless it uses the same key; those users must re-enrol.',
      );
    }
  } else {
    for (const [table, what] of Object.entries(CREDENTIAL_TABLES)) console.log(`  left behind: ${table} - ${what}`);
  }
  console.log(`\nSnapshot  ${path.relative(root, target)}`);
  console.log(`Size      ${(body.length / 1024).toFixed(1)} KiB`);
  console.log(`SHA-256   ${checksum}`);
  console.log('\nUpload it to Pipelines > Library > Secure files, then run the data-seed pipeline with that checksum.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
