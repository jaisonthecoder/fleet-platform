import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const api = fileURLToPath(new URL('../../apps/noatum-customer-portal-api/', import.meta.url));
const local = parseEnv(readFileSync(new URL('../../apps/noatum-customer-portal-api/.env.local', import.meta.url), 'utf8'));
const owner = new URL(local.DATABASE_MIGRATION_URL);
const runtime = new URL(local.DATABASE_URL);
const command = process.argv[2] ?? 'up';

if (!['up', 'down', 'setup', 'status', 'test'].includes(command)) throw new Error('Expected up, down, setup, status or test.');
for (const url of [owner, runtime]) {
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || !url.password) {
    throw new Error('Local database commands require password-protected loopback PostgreSQL URLs.');
  }
}
if (owner.pathname !== runtime.pathname || owner.port !== runtime.port || owner.username !== 'portal_owner' || runtime.username !== 'portal_app') {
  throw new Error('Use portal_owner and portal_app on the same local database and port.');
}

const env = {
  ...process.env,
  ...local,
  POSTGRES_USER: decodeURIComponent(owner.username),
  POSTGRES_PASSWORD: decodeURIComponent(owner.password),
  POSTGRES_DB: decodeURIComponent(owner.pathname.slice(1)),
  POSTGRES_PORT: owner.port || '5432',
};

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: root, env, stdio: 'inherit', ...options });
  if (result.error) throw new Error(`Unable to run ${executable}: ${result.error.code}`);
  if (result.status !== 0) throw new Error(`${executable} failed; no database reset was attempted.`);
}

const compose = ['compose', '-f', 'infra/docker-compose.yml'];
if (command === 'down') run('docker', [...compose, 'down']);
else if (command === 'status') run('docker', [...compose, 'ps']);
else {
  run('docker', ['volume', 'create', 'infra_postgres-data']);
  run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '120']);
  if (command === 'test') {
    const database = `noatum_test_${randomUUID().replaceAll('-', '')}`;
    const testOwner = new URL(owner);
    const testRuntime = new URL(runtime);
    testOwner.pathname = `/${database}`;
    testRuntime.pathname = `/${database}`;
    const testEnv = {
      ...env,
      NODE_ENV: 'test',
      JOBS_ENABLED: 'false',
      DATABASE_URL: testRuntime.href,
      DATABASE_MIGRATION_URL: testOwner.href,
    };
    run('docker', [...compose, 'exec', '-T', 'postgres', 'createdb', '-U', env.POSTGRES_USER, database]);
    try {
      run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: api, env: testEnv });
      run(process.execPath, ['scripts/install-jobs-schema.mjs'], { cwd: api, env: testEnv });
      for (const config of ['test/jest-isolation.json', 'test/jest-e2e.json']) {
        run(process.execPath, ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', config, '--runInBand'], { cwd: api, env: testEnv });
      }
    } finally {
      run('docker', [...compose, 'exec', '-T', 'postgres', 'dropdb', '-U', env.POSTGRES_USER, '--force', database]);
      console.log(`Removed disposable test database ${database}.`);
    }
  }
  if (command === 'setup') {
    run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { cwd: api });
    const password = decodeURIComponent(runtime.password).replaceAll("'", "''");
    run('docker', [...compose, 'exec', '-T', 'postgres', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB], {
      input: `SET standard_conforming_strings = on;\nALTER ROLE portal_app LOGIN PASSWORD '${password}';\n`,
      stdio: ['pipe', 'inherit', 'pipe'],
    });
    run(process.execPath, ['node_modules/prisma/build/index.js', 'generate'], { cwd: api });
    // Installs the pg-boss schema as the OWNER and grants the runtime role. Without
    // this the API cannot finish starting - see scripts/install-jobs-schema.mjs.
    run(process.execPath, ['scripts/install-jobs-schema.mjs'], { cwd: api });
    console.log('Local database ready. Runtime: portal_app; migrations: portal_owner.');
  }
}
