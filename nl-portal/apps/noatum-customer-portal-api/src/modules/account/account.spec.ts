import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../../common/decorators/require-permission.decorator';
import { TenantContext, type TenantContextData } from '../../common/tenancy/tenant-context';
import type { TenantClient, TenantRepository } from '../../common/tenancy/tenant.repository';
import { InviteColleagueSchema, PERMISSIONS, ROLE_PRESETS, ROLES } from '../../contracts';

import { AccountController } from './account.controller';
import { AccountService } from './account.service';

/* ────────────────────────────────────────────────────────────────────────────
 * The rules that must hold on the server, whatever the screen does.
 *
 * Every one of these is a way for a customer administrator to damage their own
 * account or reach outside it, so none may be left to the form: the SPA's zod
 * schema is a convenience, this is the rulebook.
 * ──────────────────────────────────────────────────────────────────────────── */

const groupId = '1f1f3d2c-0f4c-4f1e-9a3e-6d1a3f0b2c11';
const actorId = '2a2a4e3d-1e5d-4021-8b4f-7e2b4a1c3d22';
const otherId = '3b3b5f4e-2f6e-4132-9c5a-8f3c5b2d4e33';

const context = (permissions: string[]): TenantContextData => ({
  userId: actorId,
  customerGroupId: groupId,
  isInternal: false,
  accountIds: [],
  permissions: new Set(permissions),
  correlationId: 'account-test',
});

/** A transaction whose tables answer from the fixtures each test sets up. */
function transaction(overrides: Record<string, unknown> = {}) {
  const base = {
    customerGroup: { findUnique: async () => ({ id: groupId, name: 'Acme', emailDomains: ['acme.example'] }) },
    user: { findFirst: async () => null, findUnique: async () => null, findMany: async () => [], count: async () => 1, update: async () => ({}) },
    invitation: { findFirst: async () => null, findUnique: async () => null, findMany: async () => [], count: async () => 0, create: async (a: { data: unknown }) => ({ id: 'inv', createdAt: new Date(), expiresAt: new Date(), resendCount: 0, status: 'pending', displayName: null, roleKeys: [], email: 'x@acme.example', ...(a.data as object) }), update: async () => ({}) },
    customerAccount: { findUnique: async () => null, findMany: async () => [] },
    userRole: { count: async () => 0, deleteMany: async () => ({}), createMany: async () => ({}) },
    userAccountAccess: { deleteMany: async () => ({}), create: async () => ({}) },
    role: { findMany: async () => [] },
    addressBookEntry: { count: async () => 0 },
    quote: { count: async () => 0 },
    auditEvent: { create: async () => ({}) },
  };
  return { ...base, ...overrides } as unknown as TenantClient;
}

function service(tx: TenantClient, permissions = [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_MANAGE]) {
  const ctx = new TenantContext();
  const repo = { run: async <T>(fn: (t: TenantClient) => Promise<T>) => fn(tx) } as unknown as TenantRepository;
  const run = <T>(fn: () => T) => ctx.run(context(permissions), fn);
  return { account: new AccountService(repo, ctx), run };
}

describe('inviting a colleague', () => {
  it('refuses an address outside the company domains, with no override to find', async () => {
    const { account, run } = service(transaction());

    await expect(
      run(() =>
        account.invite({
          displayName: 'Outside Person',
          email: 'someone@gmail.example',
          roleKeys: ['customer_standard'],
          officeAccountId: null,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts an address inside them', async () => {
    const { account, run } = service(transaction());

    const invitation = await run(() =>
      account.invite({
        displayName: 'Inside Person',
        email: 'ana@acme.example',
        roleKeys: ['customer_quoting_booking'],
        officeAccountId: null,
      }),
    );

    expect(invitation.email).toBe('ana@acme.example');
    // The raw link comes back once, on creation, and never again.
    expect(invitation.inviteUrl).toBeTruthy();
  });

  it('refuses a second invitation while one is still waiting', async () => {
    const tx = transaction({
      invitation: { ...transaction().invitation, findFirst: async () => ({ id: 'pending' }), count: async () => 0 },
    });
    const { account, run } = service(tx);

    await expect(
      run(() =>
        account.invite({ displayName: 'A', email: 'ana@acme.example', roleKeys: ['customer_standard'], officeAccountId: null }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stops at the daily limit', async () => {
    const tx = transaction({
      invitation: { ...transaction().invitation, count: async () => 20 },
    });
    const { account, run } = service(tx);

    await expect(
      run(() =>
        account.invite({ displayName: 'A', email: 'ana@acme.example', roleKeys: ['customer_standard'], officeAccountId: null }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('the invitation schema', () => {
  it('will not grant an internal role', () => {
    const result = InviteColleagueSchema.safeParse({
      displayName: 'A',
      email: 'a@acme.example',
      roleKeys: ['platform_admin'],
      officeAccountId: null,
    });
    expect(result.success).toBe(false);
  });

  it('will not grant nothing at all', () => {
    const result = InviteColleagueSchema.safeParse({
      displayName: 'A',
      email: 'a@acme.example',
      roleKeys: [],
      officeAccountId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('resending', () => {
  it('stops after three', async () => {
    const tx = transaction({
      invitation: { ...transaction().invitation, findUnique: async () => ({ id: 'inv', status: 'pending', resendCount: 3 }) },
    });
    const { account, run } = service(tx);

    await expect(run(() => account.resend('inv', { reason: 'again' }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses one that has already been accepted', async () => {
    const tx = transaction({
      invitation: { ...transaction().invitation, findUnique: async () => ({ id: 'inv', status: 'accepted', resendCount: 0 }) },
    });
    const { account, run } = service(tx);

    await expect(run(() => account.resend('inv', { reason: 'again' }))).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('the last administrator', () => {
  const admin = {
    id: otherId,
    isInternal: false,
    status: 'active',
    roles: [{ role: { key: 'customer_admin', name: 'Customer Admin' } }],
  };

  it('cannot be demoted when nobody else holds the role', async () => {
    const tx = transaction({
      user: { ...transaction().user, findUnique: async () => admin },
      userRole: { ...transaction().userRole, count: async () => 0 },
    });
    const { account, run } = service(tx);

    await expect(
      run(() => account.changeRoles(otherId, { roleKeys: ['customer_standard'], officeAccountId: null, reason: 'moving on' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cannot be deactivated when nobody else holds the role', async () => {
    const tx = transaction({
      user: { ...transaction().user, findUnique: async () => admin },
      userRole: { ...transaction().userRole, count: async () => 0 },
    });
    const { account, run } = service(tx);

    await expect(run(() => account.setStatus(otherId, false, { reason: 'left' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('can be demoted once a second administrator exists', async () => {
    const tx = transaction({
      user: { ...transaction().user, findUnique: async () => admin, findMany: async () => [] },
      userRole: { ...transaction().userRole, count: async () => 1 },
      role: { findMany: async () => [{ id: 'r1', key: 'customer_standard', isInternal: false }] },
    });
    const { account, run } = service(tx);

    // The guard is what is under test: with a second administrator present the
    // change goes through instead of being refused.
    await expect(
      run(() => account.changeRoles(otherId, { roleKeys: ['customer_standard'], officeAccountId: null, reason: 'moving on' })),
    ).resolves.toBeUndefined();
  });
});

describe('you cannot lock yourself out', () => {
  it('refuses to deactivate the account making the request', async () => {
    const { account, run } = service(transaction());
    await expect(run(() => account.setStatus(actorId, false, { reason: 'oops' }))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('every route declares a permission', () => {
  /*
   * Foundation rule 3, checked here rather than trusted. A customer-facing route
   * that forgets its decorator is open to every signed-in customer user, which
   * on this controller means one company administering another's people.
   */
  const reflector = new Reflector();

  it.each([
    ['overview', PERMISSIONS.DASHBOARD_READ],
    ['users', PERMISSIONS.USERS_READ],
    ['rolePresets', PERMISSIONS.USERS_READ],
    ['invitations', PERMISSIONS.USERS_READ],
    ['invite', PERMISSIONS.USERS_MANAGE],
    ['resend', PERMISSIONS.USERS_MANAGE],
    ['revoke', PERMISSIONS.USERS_MANAGE],
    ['changeRoles', PERMISSIONS.USERS_MANAGE],
    ['deactivate', PERMISSIONS.USERS_MANAGE],
    ['reactivate', PERMISSIONS.USERS_MANAGE],
  ])('%s requires %s', (method, expected) => {
    const declared = reflector.get<string[]>(
      PERMISSIONS_KEY,
      AccountController.prototype[method as keyof AccountController],
    );
    expect(declared).toEqual([expected]);
  });
});

describe('the widened Customer Admin preset', () => {
  it('carries the customer capabilities the role now needs', () => {
    const preset = ROLE_PRESETS[ROLES.CUSTOMER_ADMIN];
    for (const key of [
      PERMISSIONS.QUOTES_CREATE,
      PERMISSIONS.BOOKINGS_READ,
      PERMISSIONS.INVOICES_READ,
      PERMISSIONS.CLAIMS_CREATE,
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.USERS_MANAGE,
    ]) {
      expect(preset).toContain(key);
    }
  });

  it('still carries nothing reserved to Noatum', () => {
    const preset = ROLE_PRESETS[ROLES.CUSTOMER_ADMIN];
    for (const key of [
      PERMISSIONS.PRICING_PRICE,
      PERMISSIONS.PRICING_COST_VIEW,
      PERMISSIONS.ADMIN_CUSTOMERS_MANAGE,
      PERMISSIONS.ADMIN_IMPERSONATE,
      PERMISSIONS.ADMIN_STAFF_READ,
    ]) {
      expect(preset).not.toContain(key);
    }
  });
});
