#!/usr/bin/env node
/**
 * Provisions the first Portal Admin, who cannot be invited because there is nobody to
 * invite them.
 *
 * Deliberately not an endpoint and not a seed: it is run by an operator, on purpose,
 * and it issues a single-use link rather than a password. Nothing here sets a
 * credential, so there is no default password to leak and no first-caller-wins race.
 * Safe to run in production, and safe to run twice - the second run supersedes the
 * first link and refuses outright once a working password exists.
 *
 *   node --env-file=.env.local scripts/provision-portal-admin.cjs \
 *     --email someone@noatum.com --name "Some One"
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { createHash, randomBytes } = require('node:crypto');

const LINK_TTL_HOURS = 24;
const ROLE_KEY = 'platform_admin';

function argument(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1].trim();
  const pair = process.argv.find((value) => value.startsWith(`${flag}=`));
  return pair ? pair.slice(flag.length + 1).trim() : undefined;
}

async function main() {
  const email = (argument('email') ?? process.env.PORTAL_ADMIN_EMAIL ?? '').toLowerCase();
  const name = argument('name') ?? process.env.PORTAL_ADMIN_NAME ?? '';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Give a valid address: --email someone@noatum.com');
  }
  if (name.length < 2) {
    throw new Error('Give the person\'s name: --name "Some One"');
  }
  if (process.env.LOCAL_AUTH_ENABLED !== 'true') {
    throw new Error('LOCAL_AUTH_ENABLED is not true, so a portal password could not be used.');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');

  const base = (process.env.PORTAL_BASE_URL ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('PORTAL_BASE_URL is not set, so the link would point nowhere.');

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
  const expiresAt = new Date(Date.now() + LINK_TTL_HOURS * 60 * 60 * 1000);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const rows = await prisma.$queryRaw`
      SELECT user_id, created, role_granted
        FROM app.local_bootstrap_admin(${email}, ${name}, ${ROLE_KEY}, ${tokenHash}, ${expiresAt})`;

    const result = rows[0];
    process.stdout.write(
      [
        '',
        `Portal Admin ${result.created ? 'created' : 'already existed'}: ${email}`,
        `Role ${ROLE_KEY}: ${result.role_granted ? 'granted' : 'already held'}`,
        '',
        'Give this person the link below. It can be used once and expires in ' +
          `${LINK_TTL_HOURS} hours. It is not stored anywhere, so it cannot be shown again.`,
        '',
        `  ${base}/portal-admin-setup/${token}`,
        '',
      ].join('\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n\n`);
  process.exitCode = 1;
});
