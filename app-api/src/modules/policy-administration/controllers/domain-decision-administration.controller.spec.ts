import { ForbiddenException } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { HierarchyService } from '../../platform/services/hierarchy.service';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { DomainDecisionAdministrationService } from '../services/domain-decision-administration.service';
import { DomainDecisionAdministrationController } from './domain-decision-administration.controller';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const SCOPE_ID = '10000000-0000-4000-8000-000000000001';
const principal: Principal = {
  organizationId: ORGANIZATION_ID,
  userId: null,
  personId: '20000000-0000-4000-8000-000000000001',
  entraObjectId: null,
  email: null,
  roles: [{ role: 'SystemAdmin', scopeNodeId: SCOPE_ID }],
  isDevLogin: true,
};

describe('DomainDecisionAdministrationController', () => {
  const administration = {
    selectorState: jest.fn(),
    updateSelector: jest.fn(),
    comparisonSummary: jest.fn(),
  };
  const scopeAuthorization = { assertRolesAtScope: jest.fn(), assertRootRole: jest.fn() };
  const hierarchy = { scopeSubtree: jest.fn() };
  let controller: DomainDecisionAdministrationController;

  beforeEach(() => {
    jest.clearAllMocks();
    scopeAuthorization.assertRolesAtScope.mockResolvedValue(undefined);
    scopeAuthorization.assertRootRole.mockResolvedValue(undefined);
    hierarchy.scopeSubtree.mockResolvedValue([SCOPE_ID]);
    administration.selectorState.mockResolvedValue({ configured: null, effective: { mode: 'legacy-only' } });
    administration.updateSelector.mockResolvedValue({ configured: { revision: 1 }, effective: { mode: 'shadow' } });
    administration.comparisonSummary.mockResolvedValue({ total: 0, counts: [] });
    controller = new DomainDecisionAdministrationController(
      administration as unknown as DomainDecisionAdministrationService,
      scopeAuthorization as unknown as ScopeAuthorizationService,
      hierarchy as unknown as HierarchyService,
    );
  });

  it('scope-authorizes an optimistic selector update before mutation', async () => {
    await controller.updateSelector('booking-approval-chain', {
      environment: 'uat', scopeNodeId: SCOPE_ID, mode: 'shadow', canaryPercentage: 0,
      comparisonSamplePercentage: 100, expectedRevision: 0,
    }, principal);
    expect(scopeAuthorization.assertRolesAtScope).toHaveBeenCalledWith(principal, ['SystemAdmin'], SCOPE_ID);
    expect(administration.updateSelector).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      'booking-approval-chain',
      expect.objectContaining({ mode: 'shadow', expectedRevision: 0 }),
      principal.personId,
    );
  });

  it('does not mutate an unauthorized selector scope', async () => {
    scopeAuthorization.assertRolesAtScope.mockRejectedValueOnce(new ForbiddenException());
    await expect(controller.updateSelector('booking-approval-chain', {
      environment: 'uat', scopeNodeId: SCOPE_ID, mode: 'shadow', canaryPercentage: 0,
      comparisonSamplePercentage: 100, expectedRevision: 0,
    }, principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(administration.updateSelector).not.toHaveBeenCalled();
  });

  it('limits comparison summaries to the requested authorized subtree', async () => {
    await controller.comparisonSummary({
      decisionKey: 'booking-approval-chain', environment: 'uat', scopeNodeId: SCOPE_ID,
    }, principal);
    expect(hierarchy.scopeSubtree).toHaveBeenCalledWith(SCOPE_ID, ORGANIZATION_ID);
    expect(administration.comparisonSummary).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      expect.objectContaining({ decisionKey: 'booking-approval-chain' }),
      [SCOPE_ID],
    );
  });
});