import { randomUUID } from 'node:crypto';
import type { PrismaClient, Role, User } from '@prisma/client';

import { ROLES } from '../../src/contracts/permissions';

export interface TenantFixture {
  groupId: string;
  accountId: string;
  quoteId: string;
  addressId: string;
  templateId: string;
  userId: string;
}

export interface TwoTenants {
  a: TenantFixture;
  b: TenantFixture;
}

export interface StaffRoleFixture {
  admin: User;
  secondAdmin: User;
  target: User;
  retainedRole: Role;
}

export async function seedStaffRoles(db: PrismaClient): Promise<StaffRoleFixture> {
  return db.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.is_internal', 'true', true)`;
    // PORTAL_ADMIN was retired and merged into PLATFORM_ADMIN; the old constant
    // resolved to undefined here, which Prisma reported as a malformed `where`.
    const preset = await transaction.role.findUniqueOrThrow({ where: { key: ROLES.PLATFORM_ADMIN } });
    const retainedRole = await transaction.role.create({ data: {
      key: `staff-retained-${randomUUID()}`, name: 'Retained test role', isInternal: true,
    } });
    const createStaff = (name: string, roleId: string) => transaction.user.create({ data: {
      email: `staff-${randomUUID()}@example.test`, displayName: name, isInternal: true, status: 'active',
      updatedAt: new Date('2026-09-12T10:00:00.000Z'), roles: { create: { roleId } },
    } });
    const admin = await createStaff('Staff test administrator', preset.id);
    const secondAdmin = await createStaff('Second staff test administrator', preset.id);
    const target = await createStaff('Staff test target', retainedRole.id);
    return { admin, secondAdmin, target, retainedRole };
  });
}

export async function removeStaffRoles(db: PrismaClient, fixture: StaffRoleFixture): Promise<void> {
  await db.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.is_internal', 'true', true)`;
    await transaction.user.deleteMany({ where: { id: { in: [fixture.admin.id, fixture.secondAdmin.id, fixture.target.id] } } });
    await transaction.role.delete({ where: { id: fixture.retainedRole.id } });
  });
}

/**
 * Two complete, adjacent tenants - the minimum needed to prove isolation.
 *
 * Seeded with an internal context so RLS does not block the setup itself; the assertions
 * then run as ordinary tenants. Idempotent, so the suite can be re-run without a reset.
 */
export async function seedTwoTenants(db: PrismaClient): Promise<TwoTenants> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_internal', 'true', true)`;

    const a = await seedTenant(tx as unknown as PrismaClient, 'iso-tenant-a');
    const b = await seedTenant(tx as unknown as PrismaClient, 'iso-tenant-b');

    return { a, b };
  });
}

async function seedTenant(tx: PrismaClient, slug: string): Promise<TenantFixture> {
  // Live on purpose: the tenant resolver only returns codes for an active
  // customer, so a fixture left in the default `draft` would resolve to nothing.
  const group = await tx.customerGroup.upsert({
    where: { slug },
    update: { status: 'active' },
    create: { slug, name: slug, tier: 'standard', status: 'active' },
  });

  const account = await tx.customerAccount.upsert({
    where: { customerGroupId_cw1OrgCode: { customerGroupId: group.id, cw1OrgCode: `${slug}-ORG` } },
    update: {},
    create: { customerGroupId: group.id, name: `${slug} account`, cw1OrgCode: `${slug}-ORG` },
  });

  const user = await tx.user.upsert({
    where: { email: `${slug}@example.test` },
    update: {},
    create: {
      customerGroupId: group.id,
      email: `${slug}@example.test`,
      displayName: `${slug} user`,
      status: 'active',
    },
  });

  const quote = await tx.quote.upsert({
    where: { customerGroupId_reference: { customerGroupId: group.id, reference: 'Q-000001' } },
    update: {},
    create: {
      customerGroupId: group.id,
      accountId: account.id,
      reference: 'Q-000001',
      mode: 'sea',
      originCode: 'ESVLC',
      destinationCode: 'AEJEA',
      status: 'draft',
    },
  });

  const template = await tx.quoteTemplate.upsert({
    where: { customerGroupId_name: { customerGroupId: group.id, name: 'Default template' } },
    update: {},
    create: { customerGroupId: group.id, name: 'Default template' },
  });

  // No natural key, so guard the insert rather than upserting.
  const existingAddress = await tx.addressBookEntry.findFirst({
    where: { customerGroupId: group.id, name: `${slug} warehouse` },
  });
  const address =
    existingAddress ??
    (await tx.addressBookEntry.create({
      data: { customerGroupId: group.id, name: `${slug} warehouse`, city: 'Valencia' },
    }));

  const existingInvite = await tx.invitation.findFirst({
    where: { customerGroupId: group.id, email: `invitee-${slug}@example.test` },
  });
  if (!existingInvite) {
    await tx.invitation.create({
      data: {
        customerGroupId: group.id,
        email: `invitee-${slug}@example.test`,
        tokenHash: `hash-${slug}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const existingAudit = await tx.auditEvent.findFirst({
    where: { customerGroupId: group.id, action: 'fixture.seed' },
  });
  if (!existingAudit) {
    await tx.auditEvent.create({
      data: {
        customerGroupId: group.id,
        action: 'fixture.seed',
        entityType: 'customer_group',
        entityId: group.id,
      },
    });
  }

  return {
    groupId: group.id,
    accountId: account.id,
    quoteId: quote.id,
    addressId: address.id,
    templateId: template.id,
    userId: user.id,
  };
}
