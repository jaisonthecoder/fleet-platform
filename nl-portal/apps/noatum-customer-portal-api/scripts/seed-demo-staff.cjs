const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { randomUUID } = require('node:crypto');

async function seed() {
  if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_LOCAL_DEMO_SEED !== 'yes') {
    throw new Error('Local demo seeding requires NODE_ENV=development and ALLOW_LOCAL_DEMO_SEED=yes. Never run in UAT or production.');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Supply the local DATABASE_URL explicitly.');
  const database = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) || database.search || database.hash) {
    throw new Error('Only an explicit loopback PostgreSQL URL without query overrides is allowed.');
  }
  if (!process.env.DEMO_DATABASE_NAME || decodeURIComponent(database.pathname.slice(1)) !== process.env.DEMO_DATABASE_NAME) {
    throw new Error('DEMO_DATABASE_NAME must explicitly match the intended local database.');
  }
  const issuer = process.env.DEMO_ADMIN_ISSUER;
  const subject = process.env.DEMO_ADMIN_SUBJECT;
  if (Boolean(issuer) !== Boolean(subject)) throw new Error('Supply both DEMO_ADMIN_ISSUER and DEMO_ADMIN_SUBJECT, or neither.');
  if (issuer) {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(subject ?? '') || !uuid.test(tenantId ?? '') || issuer !== process.env.ENTRA_ISSUER || issuer !== `https://login.microsoftonline.com/${tenantId}/v2.0`) {
      throw new Error('Explicit subject must be the trusted staff Entra object ID (oid); issuer must match the configured Microsoft tenant issuer.');
    }
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.is_internal', 'true', true)`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(1950502, 1)`;
      // portal_admin was retired and merged into platform_admin by
      // 20260912010000_identity_function_fix_and_role_merge. The preset now carries more
      // than the two staff permissions, so require them to be present rather than exclusive.
      const role = await transaction.role.findUnique({ where: { key: 'platform_admin' }, include: { permissions: true } });
      const expected = ['admin.staff.read', 'admin.staff.roles.manage'];
      if (!role?.isInternal || expected.some((key) => !role.permissions.some(({ permissionKey }) => permissionKey === key))) {
        throw new Error('Apply and review the staff role preset migrations first; the platform_admin preset must carry both staff permissions.');
      }
      const fixtures = [
        { id: '9abc3338-a079-48c6-9105-0a93617f8f44', email: 'portal.admin@example.test', displayName: 'Demo Portal Admin', admin: true },
        { id: '62c2a080-c2e2-401b-9230-b7836da23b7e', email: 'registered.staff@example.test', displayName: 'Demo Registered Staff', admin: false },
      ];
      for (const fixture of fixtures) {
        const existing = await transaction.user.findFirst({ where: { OR: [{ id: fixture.id }, { email: fixture.email }, ...(fixture.admin && subject ? [{ entraObjectId: subject }] : [])] } });
        if (existing) {
          const existingRoles = await transaction.userRole.findMany({ where: { userId: existing.id }, include: { role: true } });
          const exactIdentity = existing.id === fixture.id && existing.email === fixture.email && existing.displayName === fixture.displayName && existing.isInternal && existing.customerGroupId === null;
          const exactBinding = existing.entraObjectId === (fixture.admin && subject ? subject : null) && existing.status === (fixture.admin && subject ? 'active' : 'disabled');
          const exactRoles = fixture.admin ? existingRoles.length === 1 && existingRoles[0].roleId === role.id : existingRoles.length === 0;
          if (!exactIdentity || !exactBinding || !exactRoles) throw new Error('Existing demo or identity record differs. Refusing to overwrite staff access or identity binding.');
          continue;
        }
        const user = await transaction.user.create({ data: {
          id: fixture.id, email: fixture.email, displayName: fixture.displayName, isInternal: true,
          status: fixture.admin && subject ? 'active' : 'disabled',
          entraObjectId: fixture.admin && subject ? subject : null,
          ...(fixture.admin ? { roles: { create: { roleId: role.id } } } : {}),
        } });
        await transaction.auditEvent.create({ data: {
          action: 'staff.demo.seeded', entityType: 'user', entityId: user.id,
          metadata: { roleKeys: fixture.admin ? ['platform_admin'] : [], trustedIssuer: fixture.admin ? issuer ?? null : null, identityBound: Boolean(fixture.admin && subject), correlationId: randomUUID() },
        } });
      }
    });
    console.log(issuer ? 'Fictional demo records created with an explicitly bound admin object ID. Microsoft sign-in and the existing pre-auth RLS lookup still need operator validation; this is not proof of usable sign-in.' : 'Disabled, unbound fictional demo records created. They cannot sign in. No Microsoft accounts or credentials were created.');
  } finally { await prisma.$disconnect(); }
}

seed().catch(() => {
  console.error('Demo seed refused or failed. Confirm the documented local flags, target database, migration and trusted identity; no existing records are overwritten.');
  process.exitCode = 1;
});
