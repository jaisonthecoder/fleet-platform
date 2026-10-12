/**
 * Ad-hoc psql against the local database, using the same compose environment
 * the seed scripts derive from. Pass SQL as the single argument.
 *
 *   node infra/scripts/psql.mjs "SELECT 1"
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = parseEnv(
  readFileSync(new URL('../../apps/noatum-customer-portal-api/.env.local', import.meta.url), 'utf8'),
);

const owner = new URL(env.DATABASE_MIGRATION_URL);
const database = decodeURIComponent(owner.pathname.slice(1));
const ownerUser = decodeURIComponent(owner.username);

const sql = process.argv[2];
if (!sql) throw new Error('Pass the SQL to run as the first argument.');

const result = spawnSync(
  'docker',
  ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
    'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', ownerUser, '-d', database],
  {
    cwd: root,
    env: {
      ...process.env,
      ...env,
      POSTGRES_USER: ownerUser,
      POSTGRES_PASSWORD: decodeURIComponent(owner.password),
      POSTGRES_DB: database,
      POSTGRES_PORT: owner.port || '5432',
    },
    input: `SELECT set_config('app.is_internal', 'true', true) \\gset\n${sql}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  },
);

process.exit(result.status ?? 1);
