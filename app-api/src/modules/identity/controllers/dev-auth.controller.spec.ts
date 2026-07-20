import { NotFoundException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { identityConfig } from '../../../common/config/identity.config';
import type { IdentityRepository } from '../repositories/identity.repository';
import { DevAuthController } from './dev-auth.controller';

type Row = Awaited<ReturnType<IdentityRepository['listPeopleWithRoles']>>[number];

const rows: Row[] = [
  { personId: 'p1', fullName: 'Aisha', email: 'a@x', grade: 'G3', role: 'Employee', scopeName: 'Pool' },
  { personId: 'p1', fullName: 'Aisha', email: 'a@x', grade: 'G3', role: 'Approver', scopeName: 'Pool' },
  { personId: 'p2', fullName: 'Omar', email: null, grade: null, role: null, scopeName: null },
];

function makeController(devLoginEnabled: boolean): DevAuthController {
  const repo = {
    listPeopleWithRoles: async () => rows,
  } as unknown as IdentityRepository;
  const config = { devLoginEnabled } as unknown as ConfigType<typeof identityConfig>;
  return new DevAuthController(repo, config);
}

describe('DevAuthController', () => {
  it('groups seeded rows into users with their roles', async () => {
    const users = await makeController(true).listDevUsers();

    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      personId: 'p1',
      fullName: 'Aisha',
      roles: [{ role: 'Employee' }, { role: 'Approver' }],
    });
    // A person with no active role assignment still appears, with an empty list.
    expect(users[1]).toMatchObject({ personId: 'p2', roles: [] });
  });

  it('is hidden (404) when dev-login is disabled', async () => {
    await expect(makeController(false).listDevUsers()).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
