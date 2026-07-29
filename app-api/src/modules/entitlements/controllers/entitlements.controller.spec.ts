import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Principal } from '../../../common/auth/principal';
import { EntitlementService } from '../services/entitlement.service';
import { EntitlementsController } from './entitlements.controller';

const PERSON_ID = '10000000-0000-4000-8000-000000000001';
const SCOPE_ID = '20000000-0000-4000-8000-000000000001';

const employeePrincipal: Principal = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: null,
  personId: PERSON_ID,
  entraObjectId: null,
  email: 'employee@example.test',
  roles: [{ role: 'Employee', scopeNodeId: SCOPE_ID }],
  isDevLogin: false,
};

describe('EntitlementsController Draft authority', () => {
  const entitlements = {
    create: jest.fn(),
    context: jest.fn(),
    listOwn: jest.fn(),
    get: jest.fn(),
    updateDraft: jest.fn(),
    justificationCategories: jest.fn(),
    eligibilityPreview: jest.fn(),
  };
  const controller = new EntitlementsController(
    entitlements as unknown as EntitlementService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    entitlements.create.mockResolvedValue({ id: 'entitlement-1' });
    entitlements.context.mockResolvedValue({ capabilities: {} });
    entitlements.listOwn.mockResolvedValue([]);
    entitlements.get.mockResolvedValue({ id: 'entitlement-1' });
    entitlements.updateDraft.mockResolvedValue({ id: 'entitlement-1', revision: 2 });
    entitlements.justificationCategories.mockResolvedValue([]);
    entitlements.eligibilityPreview.mockResolvedValue({ decision: 'ALLOW' });
  });

  it('binds self-request identity and the retry key from authentication', async () => {
    const body = {
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      justificationCategory: 'operational-need',
      justificationText: 'Frequent travel between sites',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: SCOPE_ID,
    };

    await controller.create(body, employeePrincipal, 'dedicated-create-key');

    expect(entitlements.create).toHaveBeenCalledWith(
      { ...body, requesterPersonId: PERSON_ID },
      PERSON_ID,
      employeePrincipal,
      'dedicated-create-key',
    );
  });

  it('rejects requester authority supplied in the create body', () => {
    expect(() => controller.create({
      requestType: 'LongTerm',
      requesterPersonId: '30000000-0000-4000-8000-000000000001',
      justificationCategory: 'operational-need',
      justificationText: 'Forged requester',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: SCOPE_ID,
    }, employeePrincipal, 'forged-create-key')).toThrow(BadRequestException);
    expect(entitlements.create).not.toHaveBeenCalled();
  });

  it('passes the authenticated Principal, revision, and retry key to Draft update', async () => {
    const body = { expectedRevision: 1, preferenceNote: 'Fortuner if available' };

    await controller.updateDraft(
      'entitlement-1',
      body,
      employeePrincipal,
      'dedicated-update-key',
    );

    expect(entitlements.updateDraft).toHaveBeenCalledWith(
      'entitlement-1',
      body,
      employeePrincipal,
      'dedicated-update-key',
    );
  });

  it('fails closed when context is invoked without a Principal', () => {
    expect(() => controller.context()).toThrow(ForbiddenException);
    expect(entitlements.context).not.toHaveBeenCalled();
  });

  it('binds the configured eligibility preview to the authenticated Principal', async () => {
    const body = {
      requestType: 'LongTerm',
      driverOption: 'WithoutDriver',
      justificationCategory: 'OPERATIONAL_REQUIREMENT',
      durationStart: '2026-08-01',
      durationEnd: '2026-12-31',
      locationNodeId: SCOPE_ID,
      requestedVehicleClass: 'SUV',
    };

    await controller.eligibilityPreview(body, employeePrincipal);

    expect(entitlements.eligibilityPreview).toHaveBeenCalledWith(
      body,
      employeePrincipal,
    );
    expect(entitlements.get).not.toHaveBeenCalled();
  });

  it('protects the manual justification category route', async () => {
    await controller.justificationCategories(employeePrincipal);
    expect(entitlements.justificationCategories).toHaveBeenCalledTimes(1);
    expect(() => controller.justificationCategories()).toThrow(ForbiddenException);
  });
});

const APPROVER_ID = '11111111-1111-4111-8111-111111111111';
const DELEGATOR_ID = '22222222-2222-4222-8222-222222222222';

const approvalPrincipal = (personId: string | null): Principal => ({
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
      { expectedRevision: 2, expectedStepVersion: 1, reason: 'Reviewed', onBehalfOfPersonId: DELEGATOR_ID },
      approvalPrincipal(APPROVER_ID),
      'decision-key-1',
    );

    expect(entitlements.decide).toHaveBeenCalledWith(
      'entitlement-1',
      {
        actorPersonId: APPROVER_ID,
        expectedRevision: 2,
        expectedStepVersion: 1,
        reason: 'Reviewed',
        onBehalfOfPersonId: DELEGATOR_ID,
      },
      decision,
      approvalPrincipal(APPROVER_ID),
      'decision-key-1',
    );
  });

  it('rejects an actorPersonId supplied in the request body', () => {
    expect(() =>
      controller.approve(
        'entitlement-1',
        { actorPersonId: DELEGATOR_ID, expectedRevision: 2, expectedStepVersion: 1 },
        approvalPrincipal(APPROVER_ID),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects an approval from an identity without a linked person', () => {
    expect(() =>
      controller.approve('entitlement-1', { expectedRevision: 2, expectedStepVersion: 1 }, approvalPrincipal(null)),
    ).toThrow(ForbiddenException);
    expect(entitlements.decide).not.toHaveBeenCalled();
  });
});