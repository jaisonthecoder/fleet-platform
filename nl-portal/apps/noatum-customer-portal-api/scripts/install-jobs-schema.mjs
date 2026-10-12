/**
 * Installs the pg-boss schema and grants the runtime role access to it.
 *
 * This existed only as a one-liner in the CI pipeline, which meant that on any
 * environment the pipeline did not build - a fresh UAT, a restored database, a
 * developer's machine after a reset - `boss.start()` threw inside
 * `onModuleInit`. That is a TOTAL BOOT FAILURE, not a degraded job runner: the
 * API never finishes starting and serves nothing at all.
 *
 * Why a script rather than a migration: pg-boss owns its own DDL and changes it
 * between versions. Copying that DDL into a migration means our copy drifts from
 * the library the moment anyone bumps it, and the failure would appear as
 * mysterious runtime errors in a queue rather than as a migration conflict. So
 * the library installs its own schema, and we do only the part that is ours -
 * the grants.
 *
 * Runs as the OWNER, never the runtime role. portal_app deliberately holds no
 * CREATE on the database, and giving it that right so it could bootstrap itself
 * would hand the application the power to reshape its own storage.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PgBoss } from 'pg-boss';

const schema = process.env.JOBS_SCHEMA || 'pgboss';
const ownerUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

if (!ownerUrl) {
  console.error('DATABASE_MIGRATION_URL or DATABASE_URL must be set.');
  process.exit(1);
}

/** The role the API connects as. Read from its own URL so the two cannot disagree. */
function runtimeRole() {
  const explicit = process.env.JOBS_RUNTIME_ROLE;
  if (explicit) return explicit;

  const runtimeUrl = process.env.DATABASE_URL;
  if (!runtimeUrl) return 'portal_app';

  const user = decodeURIComponent(new URL(runtimeUrl).username || '');
  return user || 'portal_app';
}

/** Quotes an identifier so a role or schema name can never be injected. */
function ident(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`Refusing to use "${name}" as an SQL identifier.`);
  }
  return `"${name}"`;
}

const role = runtimeRole();

const boss = new PgBoss({ connectionString: ownerUrl, schema, createSchema: true, migrate: true });

try {
  // Starting is what installs and migrates the schema. Nothing is queued here.
  await boss.start();
} finally {
  await boss.stop({ graceful: false });
}

const client = new PrismaClient({
  adapter: new PrismaPg({ connectionString: ownerUrl, connectionTimeoutMillis: 10_000 }),
});
await client.$connect();

try {
  // USAGE, not CREATE: the runtime role reads and writes the queue, and must not
  // be able to reshape it.
  await client.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ${ident(schema)} TO ${ident(role)}`);
  await client.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${ident(schema)} TO ${ident(role)}`,
  );
  await client.$executeRawUnsafe(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${ident(schema)} TO ${ident(role)}`,
  );
  // So a future pg-boss version that adds a table does not silently lock the
  // runtime role out on the next deployment.
  await client.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${ident(schema)} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ident(role)}`,
  );
  await client.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${ident(schema)} GRANT USAGE, SELECT ON SEQUENCES TO ${ident(role)}`,
  );

  // Proves the grant actually landed, rather than trusting that the statements
  // ran. A deployment that reports success and then fails to boot is the exact
  // outcome this script exists to prevent.
  const rows = await client.$queryRawUnsafe(
    `SELECT has_schema_privilege($1, $2, 'USAGE') AS usable,
            count(*) FILTER (WHERE has_table_privilege($1, c.oid, 'SELECT')) AS readable,
            count(*) AS total
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $2 AND c.relkind = 'r'`,
    role,
    schema,
  );

  const check = rows[0];

  if (!check?.usable || Number(check.total) === 0 || Number(check.readable) !== Number(check.total)) {
    throw new Error(
      `pg-boss grants incomplete for ${role} on ${schema}: usable=${check?.usable}, readable=${check?.readable}/${check?.total}.`,
    );
  }

  console.log(
    `pg-boss schema "${schema}" installed; ${check.total} table(s) readable by ${role}.`,
  );
} finally {
  await client.$disconnect();
}
