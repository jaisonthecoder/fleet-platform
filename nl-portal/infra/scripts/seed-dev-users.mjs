/**
 * Seeds one demo staff identity per internal role preset, plus one with no roles
 * at all so the access-pending screen can be exercised.
 *
 * These exist only for the development identity picker: their issuer is
 * `dev://<tenant>`, which the header bypass mints and a real Entra token never
 * produces. The script refuses to run unless the API is configured for the
 * bypass, so it cannot quietly create sign-in-able accounts anywhere real.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = parseEnv(
  readFileSync(new URL('../../apps/noatum-customer-portal-api/.env.local', import.meta.url), 'utf8'),
);

if (env.NODE_ENV === 'production') throw new Error('Demo identities are never seeded in production.');
if (env.DEV_AUTH_ENABLED !== 'true') {
  throw new Error('Set DEV_AUTH_ENABLED=true in the API .env.local before seeding demo identities.');
}
if (!env.ENTRA_TENANT_ID) throw new Error('ENTRA_TENANT_ID is required to build the demo issuer.');
if (!env.DATABASE_MIGRATION_URL) throw new Error('DATABASE_MIGRATION_URL is required.');

const owner = new URL(env.DATABASE_MIGRATION_URL);
const database = decodeURIComponent(owner.pathname.slice(1));
const ownerUser = decodeURIComponent(owner.username);

// Compose interpolates these; local-db.mjs derives them the same way.
const composeEnv = {
  ...process.env,
  ...env,
  POSTGRES_USER: ownerUser,
  POSTGRES_PASSWORD: decodeURIComponent(owner.password),
  POSTGRES_DB: database,
  POSTGRES_PORT: owner.port || '5432',
};

const issuer = `dev://${env.ENTRA_TENANT_ID}`;

/** roleKey null means the person is registered but still awaiting access. */
const identities = [
  { subject: 'dev-platform-admin',   email: 'platform.admin@adports.ae',   name: 'Demo Platform Admin',   roleKey: 'platform_admin',   branch: null },
  { subject: 'dev-customer-success', email: 'customer.success@adports.ae', name: 'Demo Customer Success', roleKey: 'customer_success', branch: null },
  { subject: 'dev-pricing',          email: 'pricing@adports.ae',          name: 'Demo Pricing',          roleKey: 'pricing',          branch: 'ES-MAD' },
  { subject: 'dev-pricing-approver', email: 'pricing.approver@adports.ae', name: 'Demo Pricing Approver', roleKey: 'pricing_approver', branch: 'ES-MAD' },
  { subject: 'dev-ops',              email: 'ops@adports.ae',              name: 'Demo Ops',              roleKey: 'ops',              branch: 'US-NYC' },
  { subject: 'dev-new-starter',      email: 'new.starter@adports.ae',      name: 'Demo New Starter',      roleKey: null,               branch: null },
];

/**
 * Operating structure, from the office addresses published on
 * noatumlogistics.com (global contact page and the USA locations page).
 *
 * The region grouping is a portal-owned label, not a published Noatum structure:
 * region membership and precedence are still open decisions (D-16/D-18). Branch
 * codes are likewise portal-owned; `source_branch_code` stays empty until the
 * CargoWise branch contract is confirmed, and nothing here is written back.
 */
const regions = [
  { code: 'EMEA', name: 'Europe, Middle East and Africa' },
  { code: 'AMER', name: 'Americas' },
];

const branches = [
  { code: 'ES-MAD', region: 'EMEA', name: 'Madrid (Coslada) head office', city: 'Coslada, Madrid', country: 'ES' },
  { code: 'US-NYC', region: 'AMER', name: 'New York global office',       city: 'Lynbrook, NY',     country: 'US' },
  { code: 'US-LAX', region: 'AMER', name: 'Los Angeles global office',    city: 'Compton, CA',      country: 'US' },
  { code: 'US-CHI', region: 'AMER', name: 'Chicago global office',        city: 'Schaumburg, IL',   country: 'US' },
  { code: 'US-HOU', region: 'AMER', name: 'Houston global office',        city: 'Houston, TX',      country: 'US' },
  { code: 'US-MIA', region: 'AMER', name: 'Miami global office',          city: 'Doral, FL',        country: 'US' },
];

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

const statements = [
  // The user insert needs the identity-resolution policy; reference tables sit
  // behind the internal policy. Both settings are local to this transaction.
  "SELECT set_config('app.identity_lookup', 'on', true);",
  "SELECT set_config('app.is_internal', 'true', true);",
];

for (const { code, name } of regions) {
  statements.push(
    `INSERT INTO region (code, name) VALUES (${quote(code)}, ${quote(name)})
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;`,
  );
}

for (const { code, region, name, city, country } of branches) {
  statements.push(
    `INSERT INTO branch (region_id, code, name, city, country_code, source)
     SELECT r.id, ${quote(code)}, ${quote(name)}, ${quote(city)}, ${quote(country)}, 'manual'
     FROM region r WHERE r.code = ${quote(region)}
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, city = EXCLUDED.city,
           country_code = EXCLUDED.country_code, region_id = EXCLUDED.region_id;`,
  );
}

for (const { subject, email, name, roleKey, branch } of identities) {
  const status = roleKey ? 'active' : 'registered';
  statements.push(
    `INSERT INTO "user" (idp_issuer, idp_subject, email, display_name, status, is_internal, created_at, updated_at)
     VALUES (${quote(issuer)}, ${quote(subject)}, ${quote(email)}, ${quote(name)}, ${quote(status)}::user_status, true, now(), now())
     ON CONFLICT (idp_issuer, idp_subject) DO UPDATE
       SET display_name = EXCLUDED.display_name, status = EXCLUDED.status;`,
  );
  statements.push(
    branch
      ? `UPDATE "user" SET branch_id = (SELECT id FROM branch WHERE code = ${quote(branch)})
         WHERE idp_issuer = ${quote(issuer)} AND idp_subject = ${quote(subject)};`
      : `UPDATE "user" SET branch_id = NULL
         WHERE idp_issuer = ${quote(issuer)} AND idp_subject = ${quote(subject)};`,
  );
  if (roleKey) {
    statements.push(
      `INSERT INTO user_role (user_id, role_id)
       SELECT u.id, r.id FROM "user" u, role r
       WHERE u.idp_issuer = ${quote(issuer)} AND u.idp_subject = ${quote(subject)} AND r.key = ${quote(roleKey)}
       ON CONFLICT (user_id, role_id) DO NOTHING;`,
    );
  } else {
    // The seed is authoritative: an identity meant to be access-pending keeps no
    // roles, whatever an earlier demo left behind.
    statements.push(
      `DELETE FROM user_role WHERE user_id IN (
         SELECT id FROM "user" WHERE idp_issuer = ${quote(issuer)} AND idp_subject = ${quote(subject)}
       );`,
    );
  }
}

statements.push(
  `SELECT r.code AS region, b.code AS branch, b.city, b.country_code FROM branch b LEFT JOIN region r ON r.id = b.region_id ORDER BY r.code, b.code;`,
  `SELECT u.display_name AS "demo identity", u.status, COALESCE(b.code, '-') AS branch FROM "user" u LEFT JOIN branch b ON b.id = u.branch_id WHERE u.idp_issuer = ${quote(issuer)} ORDER BY u.display_name;`,
);

const result = spawnSync(
  'docker',
  ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres',
    'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', ownerUser, '-d', database],
  { cwd: root, env: composeEnv, input: `BEGIN;\n${statements.join('\n')}\nCOMMIT;\n`, stdio: ['pipe', 'inherit', 'inherit'] },
);

if (result.status !== 0) throw new Error('Seeding demo identities failed; nothing was committed.');
console.log(`Seeded ${identities.length} demo identities for ${issuer}.`);
