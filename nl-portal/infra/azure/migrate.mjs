/**
 * Applies the API's Prisma migrations on a managed PostgreSQL server (Azure), where no role
 * is a superuser. Runs from the UAT migration bundle as portal_owner. Safe to re-run.
 *
 * 20260911000000_runtime_grants ends with `ALTER ROLE portal_app NOSUPERUSER ...`, which
 * only a superuser may run even when it changes nothing. bootstrap-database.mjs creates
 * portal_app without any of those attributes, so that migration is recorded as applied,
 * its REVOKEs run after the deploy, and the attributes are asserted instead.
 *
 * Environment: DATABASE_MIGRATION_URL (owner role). Optional MIGRATION_ROLLED_BACK: the
 * name of a failed migration to mark rolled back first (Prisma's P3009 recovery).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const apiDir = fileURLToPath(new URL('../../apps/noatum-customer-portal-api/', import.meta.url));
const fromApi = createRequire(new URL('../../apps/noatum-customer-portal-api/package.json', import.meta.url));
const { Client } = createRequire(fromApi.resolve('@prisma/adapter-pg'))('pg');

const SUPERUSER_ONLY = '20260911000000_runtime_grants';

const connectionString = process.env.DATABASE_MIGRATION_URL;
if (!connectionString) {
  console.error('DATABASE_MIGRATION_URL must be set.');
  process.exit(1);
}

function prisma(...args) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
    cwd: apiDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`prisma ${args.join(' ')} failed.`);
}

const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });

async function state(name) {
  const {
    rows: [table],
  } = await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present");
  if (!table.present) return 'absent';
  const { rows } = await client.query(
    'SELECT finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name = $1 ORDER BY started_at DESC LIMIT 1',
    [name],
  );
  if (!rows.length || rows[0].rolled_back_at) return 'absent';
  return rows[0].finished_at ? 'applied' : 'failed';
}

await client.connect();
try {
  const rolledBack = process.env.MIGRATION_ROLLED_BACK?.trim();
  if (rolledBack && rolledBack !== 'none' && (await state(rolledBack)) === 'failed') {
    prisma('migrate', 'resolve', '--rolled-back', rolledBack);
  }

  const superuserOnly = await state(SUPERUSER_ONLY);
  if (superuserOnly === 'failed') prisma('migrate', 'resolve', '--rolled-back', SUPERUSER_ONLY);
  if (superuserOnly !== 'applied') prisma('migrate', 'resolve', '--applied', SUPERUSER_ONLY);

  prisma('migrate', 'deploy');

  // What 20260911000000_runtime_grants does that a non-superuser may do.
  await client.query('REVOKE ALL ON TABLE "_prisma_migrations" FROM portal_app');
  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query('REVOKE CREATE ON SCHEMA public FROM portal_app');
  const {
    rows: [role],
  } = await client.query(
    "SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls AS elevated FROM pg_roles WHERE rolname = 'portal_app'",
  );
  if (!role || role.elevated) throw new Error('portal_app is missing or holds an attribute the runtime role must not have.');
  console.log('Migrations applied; runtime role checked.');
} finally {
  await client.end();
}
