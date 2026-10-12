/**
 * Issues one-time activation links for staff accounts that have no portal password.
 *
 * The demo staff records (platform.admin@, pricing@, ops@ and the rest) exist in every
 * environment, but locally they sign in through the development header bypass, which is
 * refused outside development - it is a bypass, not a login. This gives those same
 * accounts a real way in: each person opens their link, chooses a password, and enrols a
 * second factor, which portal-managed sign-in requires of every internal user.
 *
 * Roles are never touched. A staff member with no roles keeps none, so the "access
 * pending" account stays a useful demonstration of exactly that.
 *
 * Refuses an account that already has a working password: replacing one would lock out
 * whoever is using it. Use the portal's own password recovery for that.
 *
 * Environment: DATABASE_MIGRATION_URL (owner), PORTAL_BASE_URL.
 * Optional: STAFF_EMAILS (comma separated, defaults to every internal account without a
 * password), LINK_TTL_HOURS (default 2), DEMO_STAFF_ACCOUNTS (so the closing note says
 * whether a second factor still follows), DRY_RUN=true to list who would get a link
 * without issuing one.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const fromApi = createRequire(new URL('../../apps/noatum-customer-portal-api/package.json', import.meta.url));
const { Client } = createRequire(fromApi.resolve('@prisma/adapter-pg'))('pg');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} must be set.`);
    process.exit(1);
  }
  return value;
}

const connectionString = required('DATABASE_MIGRATION_URL');
const base = required('PORTAL_BASE_URL').replace(/\/+$/, '');
const ttlHours = Number(process.env.LINK_TTL_HOURS ?? 2);
const dryRun = /^(1|true|yes)$/i.test(process.env.DRY_RUN?.trim() ?? '');
const only = (process.env.STAFF_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const client = new Client({ connectionString, connectionTimeoutMillis: 15_000 });
await client.connect();

try {
  await client.query("SELECT set_config('app.is_internal', 'true', true)");
  await client.query("SELECT set_config('app.local_auth_scope', 'on', true)");
  await client.query("SELECT set_config('app.identity_lookup', 'on', true)");

  const { rows: staff } = await client.query(
    `SELECT u.id, u.email::text AS email, u.display_name, u.status,
            EXISTS (SELECT 1 FROM local_credential c WHERE c.user_id = u.id AND c.disabled_at IS NULL) AS has_password,
            coalesce((SELECT string_agg(r.key, ', ' ORDER BY r.key)
                        FROM user_role ur JOIN role r ON r.id = ur.role_id
                       WHERE ur.user_id = u.id), 'no roles yet') AS roles
       FROM "user" u
      WHERE u.is_internal = TRUE
        AND u.customer_group_id IS NULL
        AND u.status = 'active'
        AND ($1::text[] IS NULL OR lower(u.email::text) = ANY($1))
      ORDER BY u.email`,
    [only.length ? only : null],
  );

  if (!staff.length) throw new Error('No active internal accounts matched.');

  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const issued = [];

  await client.query('BEGIN');
  for (const person of staff) {
    if (person.has_password) {
      console.log(`  skipped   ${person.email} - already has a password`);
      continue;
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');

    // A person should only ever hold one live link; the newest supersedes the rest.
    await client.query(
      `UPDATE local_security_challenge SET consumed_at = now()
        WHERE user_id = $1 AND purpose = 'activation' AND consumed_at IS NULL`,
      [person.id],
    );
    await client.query(
      `INSERT INTO local_security_challenge (purpose, token_hash, user_id, expires_at)
       VALUES ('activation', $1, $2, $3)`,
      [tokenHash, person.id, expiresAt],
    );
    issued.push({ ...person, token });
  }
  await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');

  if (dryRun) {
    console.log(`\nDRY RUN - ${issued.length} account(s) would receive a link. Nothing was issued.\n`);
    for (const person of issued) console.log(`  ${person.email}  (${person.roles})`);
    process.exit(0);
  }

  console.log(`\n${issued.length} link(s), valid for ${ttlHours} hour(s), each usable once.\n`);
  const exempt = (process.env.DEMO_STAFF_ACCOUNTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  for (const person of issued) {
    const factor = exempt.includes(person.email.toLowerCase()) ? 'password only' : 'password, then an authenticator app';
    console.log(`  ${person.email}  (${person.roles})  - ${factor}`);
    console.log(`    ${base}/invitation/${person.token}\n`);
  }
  if (issued.some((person) => !exempt.includes(person.email.toLowerCase()))) {
    console.log('An account not named in DEMO_STAFF_ACCOUNTS must also enrol a second');
    console.log('factor, which portal sign-in requires of every internal account.');
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
