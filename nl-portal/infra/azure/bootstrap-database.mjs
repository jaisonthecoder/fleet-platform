/**
 * Prepares the portal database on a shared Azure PostgreSQL server. Safe to re-run.
 *
 * Runs as the server administrator, from a network that can reach the private server
 * (the UAT pipeline runs it on the VNet agent pool when `bootstrapDatabase` is ticked).
 * It creates the two login roles and hands the database to the owner role; migrations
 * and the pg-boss schema then run as portal_owner, never as the administrator.
 *
 * Environment: PG_HOST, PG_ADMIN_USER, PG_ADMIN_PASSWORD, PG_DATABASE,
 *              PORTAL_OWNER_PASSWORD, PORTAL_APP_PASSWORD.
 */
import { createRequire } from 'node:module';

// `pg` is not a direct dependency of any workspace package; resolve the copy the
// Prisma adapter ships with rather than adding one.
const fromApi = createRequire(new URL('../../apps/noatum-customer-portal-api/package.json', import.meta.url));
const { Client } = createRequire(fromApi.resolve('@prisma/adapter-pg'))('pg');

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} must be set.`);
    process.exit(1);
  }
  return value;
}

const host = required('PG_HOST');
const adminUser = required('PG_ADMIN_USER');
const adminPassword = required('PG_ADMIN_PASSWORD');
const database = required('PG_DATABASE');
const ownerPassword = required('PORTAL_OWNER_PASSWORD');
const appPassword = required('PORTAL_APP_PASSWORD');

// Role and database statements take no bind parameters, so values are validated and
// inlined rather than escaped.
function ident(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Refusing "${name}" as an SQL identifier.`);
  return `"${name}"`;
}

function literalPassword(value) {
  if (!/^[A-Za-z0-9_-]{24,}$/.test(value)) {
    throw new Error('Role passwords must be at least 24 URL-safe characters (A-Z a-z 0-9 _ -).');
  }
  return `'${value}'`;
}

function connect(db) {
  return new Client({
    host,
    port: 5432,
    user: adminUser,
    password: adminPassword,
    database: db,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
  });
}

async function ensureRole(client, name, password, attributes) {
  const { rowCount } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name]);
  const verb = rowCount ? 'ALTER' : 'CREATE';
  await client.query(`${verb} ROLE ${ident(name)} WITH ${attributes} PASSWORD ${literalPassword(password)}`);
  console.log(`${verb === 'CREATE' ? 'Created' : 'Updated'} role ${name}.`);
}

const server = connect('postgres');
await server.connect();
try {
  const {
    rows: [state],
  } = await server.query(
    `SELECT
       (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('portal_owner', 'portal_app')) AS roles,
       (SELECT r.rolname FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba WHERE d.datname = $1) AS owner`,
    [database],
  );

  // Role names are server-wide. Never adopt roles that some other database on this
  // shared server may already depend on.
  if (state.roles > 0 && state.owner !== 'portal_owner') {
    throw new Error(
      `portal_owner/portal_app already exist on ${host} and ${database} is owned by ${state.owner ?? 'nobody'}. Refusing to take them over.`,
    );
  }

  await ensureRole(server, 'portal_owner', ownerPassword, 'LOGIN CREATEROLE');
  await ensureRole(server, 'portal_app', appPassword, 'LOGIN');
  // The migrations create schema pgboss AUTHORIZATION portal_app and install pg-boss into
  // it as portal_owner; without a superuser that needs this membership (PostgreSQL 16+).
  await server.query('GRANT portal_app TO portal_owner WITH INHERIT TRUE, SET TRUE');

  // Migrations seed tables that FORCE row-level security, which the local superuser owner
  // bypasses. The runtime role portal_app never gets this; the owner is pipeline-only.
  const {
    rows: [admin],
  } = await server.query('SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user');
  if (admin.rolbypassrls) {
    await server.query('ALTER ROLE portal_owner BYPASSRLS');
    console.log('portal_owner bypasses row-level security (migrations only).');
  } else {
    // Without BYPASSRLS to hand on, run every owner session as an elevated internal one.
    await server.query("ALTER ROLE portal_owner SET app.is_internal = 'true'");
    console.log('portal_owner sessions run with app.is_internal = true (migrations only).');
  }
  // Handing a database to a role requires being able to SET ROLE to it (PostgreSQL 16+).
  await server.query(`GRANT portal_owner TO ${ident(adminUser)}`);

  if (!state.owner) {
    await server.query(`CREATE DATABASE ${ident(database)} OWNER portal_owner`);
    console.log(`Created database ${database}.`);
  } else if (state.owner !== 'portal_owner') {
    await server.query(`ALTER DATABASE ${ident(database)} OWNER TO portal_owner`);
    console.log(`Database ${database} is now owned by portal_owner.`);
  }
} finally {
  await server.end();
}

const portal = connect(database);
await portal.connect();
try {
  await portal.query('ALTER SCHEMA public OWNER TO portal_owner');
  // Azure only allows extensions listed in the server's azure.extensions parameter.
  await portal.query('CREATE EXTENSION IF NOT EXISTS citext');
} finally {
  await portal.end();
}

console.log(`Database ${database} on ${host} is ready for migrations as portal_owner.`);
