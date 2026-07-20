import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Principal } from '../../../common/auth/principal';
import { AccessService } from '../services/access.service';
import { DelegationService } from '../services/delegation.service';
import { HierarchyService } from '../services/hierarchy.service';
import { IdentityController } from './identity.controller';

const DELEGATOR_ID = '11111111-1111-4111-8111-111111111111';
const DELEGATE_ID = '22222222-2222-4222-8222-222222222222';

const principal = (personId: string | null): Principal => ({
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: '33333333-3333-4333-8333-333333333333',
  personId,
  entraObjectId: '44444444-4444-4444-8444-444444444444',
  email: 'delegator@example.test',
  roles: [{ role: 'Approver', scopeNodeId: '55555555-5555-4555-8555-555555555555' }],
  isDevLogin: false,
});

describe('IdentityController delegation actor binding', () => {
  const delegation = { create: jest.fn() };
  let controller: IdentityController;

  beforeEach(async () => {
    delegation.create.mockReset().mockResolvedValue({ id: 'delegation-1' });
    const moduleRef = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        { provide: AccessService, useValue: { getMe: jest.fn() } },
        { provide: HierarchyService, useValue: { getTree: jest.fn() } },
        { provide: DelegationService, useValue: delegation },
      ],
    }).compile();
    controller = moduleRef.get(IdentityController);
  });

  it('uses the authenticated person as the delegator', async () => {
    const body = {
      delegatePersonId: DELEGATE_ID,
      requestType: 'booking-approval',
      validFrom: '2026-07-20T08:00:00Z',
      validTo: '2026-07-21T08:00:00Z',
    };

    await controller.createDelegation(body, principal(DELEGATOR_ID));

    expect(delegation.create).toHaveBeenCalledWith(body, DELEGATOR_ID);
  });

  it('rejects a delegatorPersonId supplied in the request body', () => {
    expect(() =>
      controller.createDelegation(
        {
          delegatorPersonId: DELEGATE_ID,
          delegatePersonId: DELEGATE_ID,
          requestType: 'booking-approval',
          validFrom: '2026-07-20T08:00:00Z',
          validTo: '2026-07-21T08:00:00Z',
        },
        principal(DELEGATOR_ID),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects delegation creation from an identity without a linked person', () => {
    expect(() =>
      controller.createDelegation(
        {
          delegatePersonId: DELEGATE_ID,
          requestType: 'booking-approval',
          validFrom: '2026-07-20T08:00:00Z',
          validTo: '2026-07-21T08:00:00Z',
        },
        principal(null),
      ),
    ).toThrow(ForbiddenException);
    expect(delegation.create).not.toHaveBeenCalled();
  });
});