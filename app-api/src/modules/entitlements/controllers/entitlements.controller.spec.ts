import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Principal } from '../../../common/auth/principal';
import { EntitlementService } from '../services/entitlement.service';
import { EntitlementsController } from './entitlements.controller';

const APPROVER_ID = '11111111-1111-4111-8111-111111111111';
const DELEGATOR_ID = '22222222-2222-4222-8222-222222222222';

const principal = (personId: string | null): Principal => ({
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: '33333333-3333-4333-8333-333333333333',
  personId,
  entraObjectId: '44444444-4444-4444-8444-444444444444',
  email: 'approver@example.test',
  roles: [{ role: 'Approver', scopeNodeId: '55555555-5555-4555-8555-555555555555' }],
  isDevLogin: false,
});

describe('EntitlementsController approval actor binding', () => {
  const entitlements = { decide: jest.fn() };
  let controller: EntitlementsController;

  beforeEach(async () => {
    entitlements.decide.mockReset().mockResolvedValue({ id: 'entitlement-1' });
    const moduleRef = await Test.createTestingModule({
      controllers: [EntitlementsController],
      providers: [{ provide: EntitlementService, useValue: entitlements }],
    }).compile();
    controller = moduleRef.get(EntitlementsController);
  });

  it.each([
    ['approve', 'APPROVED'],
    ['decline', 'REJECTED'],
  ] as const)('uses the authenticated person for %s', async (method, decision) => {
    await controller[method](
      'entitlement-1',
      { reason: 'Reviewed', onBehalfOfPersonId: DELEGATOR_ID },
      principal(APPROVER_ID),
    );

    expect(entitlements.decide).toHaveBeenCalledWith(
      'entitlement-1',
      {
        actorPersonId: APPROVER_ID,
        reason: 'Reviewed',
        onBehalfOfPersonId: DELEGATOR_ID,
      },
      decision,
    );
  });

  it('rejects an actorPersonId supplied in the request body', () => {
    expect(() =>
      controller.approve(
        'entitlement-1',
        { actorPersonId: DELEGATOR_ID },
        principal(APPROVER_ID),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects an approval from an identity without a linked person', () => {
    expect(() =>
      controller.approve('entitlement-1', {}, principal(null)),
    ).toThrow(ForbiddenException);
    expect(entitlements.decide).not.toHaveBeenCalled();
  });
});