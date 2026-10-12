#!/usr/bin/env node
/**
 * Seeds two invited customer users and prints their activation links, so the
 * invitation -> set password -> sign in flow can be walked end to end without a
 * mailbox.
 *
 * Development only, and loud about it: it refuses to run outside NODE_ENV=development,
 * without an explicit opt-in, or against anything but a loopback database. The users it
 * creates carry a .test address, which can never be a real mailbox.
 *
 *   node --env-file=.env.local scripts/seed-demo-customer.cjs
 *   node --env-file=.env.local scripts/seed-demo-customer.cjs --slug demo-acme
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { createHash, randomBytes } = require('node:crypto');

const INVITATION_TTL_DAYS = 7;

const FIXTURES = [
  { email: 'admin@demo-acme.test', displayName: 'Demo Customer Admin', roleKey: 'customer_admin' },
  { email: 'user@demo-acme.test', displayName: 'Demo Customer User', roleKey: 'customer_standard' },
];

function argument(name, fallback) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1].trim();
  const pair = process.argv.find((value) => value.startsWith(`${flag}=`));
  return pair ? pair.slice(flag.length + 1).trim() : fallback;
}

function guard() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Demo customer seeding requires NODE_ENV=development.');
  }
  if (process.env.LOCAL_AUTH_ENABLED !== 'true') {
    throw new Error('LOCAL_AUTH_ENABLED must be true, or the activation links lead nowhere.');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set.');
  const database = new URL(connectionString);
  if (
    !['postgres:', 'postgresql:'].includes(database.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
  ) {
    throw new Error('Only a loopback PostgreSQL URL is allowed for demo seeding.');
  }

  const base = (process.env.PORTAL_BASE_URL ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('PORTAL_BASE_URL is not set, so the links would point nowhere.');

  return { connectionString, base };
}

async function main() {
  const { connectionString, base } = guard();
  const slug = argument('slug', 'demo-acme');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const issued = [];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_internal', 'true', true)`;

      const group = await tx.customerGroup.findFirst({ where: { slug } });
      if (!group) throw new Error(`No customer group with slug "${slug}".`);

      for (const fixture of FIXTURES) {
        const role = await tx.role.findUnique({ where: { key: fixture.roleKey } });
        if (!role || role.isInternal) {
          throw new Error(`Role ${fixture.roleKey} is missing or is not a customer role.`);
        }

        const existing = await tx.user.findFirst({ where: { email: fixture.email } });
        if (existing && existing.customerGroupId !== group.id) {
          throw new Error(`${fixture.email} already belongs to another customer.`);
        }

        // Re-runnable: an address that has already been through this gets a fresh link
        // and keeps the status it had.
        //
        // It used to be forced back to 'invited' while local_credential kept the old
        // password. That pair is unreachable: sign-in refuses any status outside
        // 'active'/'registered', and the refusal is the same "details are not correct"
        // as a wrong password - so an account with a perfectly good password looked
        // like a forgotten one, and re-running this script to fix a login was what
        // broke it. Activation sets 'active' on its own, so a returning user loses
        // nothing by staying as they are.
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: { displayName: fixture.displayName },
            })
          : await tx.user.create({
              data: {
                customerGroupId: group.id,
                email: fixture.email,
                displayName: fixture.displayName,
                status: 'invited',
              },
            });

        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          create: { userId: user.id, roleId: role.id },
          update: {},
        });

        const token = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
        const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

        // Clear an earlier run before issuing the new link. Enable rather than disable:
        // local_password_set_from_challenge refuses a disabled credential, and
        // local_credential_disable cancels unspent challenges - including this one.
        await tx.$queryRaw`SELECT app.local_credential_enable(${user.id}::uuid)`;
        await tx.$queryRaw`SELECT app.local_mfa_reset(${user.id}::uuid)`;

        // The invitation and the challenge share one token, exactly as the real invite
        // flow does, so this exercises the same path a customer would take.
        const pending = await tx.invitation.findFirst({
          where: { customerGroupId: group.id, email: fixture.email, status: 'pending' },
        });
        const invitation = pending
          ? await tx.invitation.update({ where: { id: pending.id }, data: { tokenHash, expiresAt } })
          : await tx.invitation.create({
              data: { customerGroupId: group.id, email: fixture.email, tokenHash, expiresAt },
            });

        await tx.$queryRaw`
          SELECT app.local_challenge_issue(
            ${user.id}::uuid, 'activation', ${tokenHash}, ${expiresAt}, ${invitation.id}::uuid, true)`;

        issued.push({ ...fixture, group: group.name, link: `${base}/invitation/${token}` });
      }
    });

    process.stdout.write(
      [
        '',
        `Customer: ${issued[0].group}`,
        '',
        ...issued.flatMap((entry) => [
          `${entry.displayName}  (${entry.roleKey})`,
          `  ${entry.email}`,
          `  ${entry.link}`,
          '',
        ]),
        `Each link works once and expires in ${INVITATION_TTL_DAYS} days.`,
        'Open one and choose a password: at least 8 characters with an upper-case letter, a',
        'lower-case letter, a number and a symbol. Setting it signs you in straight away,',
        'so type it somewhere safe first - the link is spent and cannot be reused.',
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
