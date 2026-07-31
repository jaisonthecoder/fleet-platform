import { ForbiddenException } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { ScopeAuthorizationService } from '../../platform/services/scope-authorization.service';
import { PolicyAdministrationService } from '../services/policy-administration.service';
import { PolicyAdministrationController } from './policy-administration.controller';

const ROOT_SCOPE_ID = '10000000-0000-4000-8000-000000000001';
const CHILD_SCOPE_ID = '20000000-0000-4000-8000-000000000001';
const principal: Principal = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: null,
  personId: '30000000-0000-4000-8000-000000000001',
  entraObjectId: null,
  email: null,
  roles: [{ role: 'SystemAdmin', scopeNodeId: ROOT_SCOPE_ID }],
  isDevLogin: true,
};

describe('PolicyAdministrationController scope authorization', () => {
  const policies = { get: jest.fn(), activate: jest.fn() };
  const scopeAuthorization = { assertRolesAtScope: jest.fn(), assertRootRole: jest.fn() };
  let controller: PolicyAdministrationController;

  beforeEach(() => {
    jest.clearAllMocks();
    policies.get.mockResolvedValue({ ruleType: 'booking-buffer' });
    policies.activate.mockResolvedValue({ status: 'Active' });
    scopeAuthorization.assertRolesAtScope.mockResolvedValue(undefined);
    scopeAuthorization.assertRootRole.mockResolvedValue(undefined);
    controller = new PolicyAdministrationController(
      policies as unknown as PolicyAdministrationService,
      scopeAuthorization as unknown as ScopeAuthorizationService,
    );
  });

  it('revalidates a requested hierarchy scope before reading policy state', async () => {
    await controller.get('booking-buffer', CHILD_SCOPE_ID, principal);
    expect(scopeAuthorization.assertRolesAtScope).toHaveBeenCalledWith(principal, ['SystemAdmin'], CHILD_SCOPE_ID);
    expect(policies.get).toHaveBeenCalledWith(principal.organizationId, 'booking-buffer', CHILD_SCOPE_ID);
  });

  it('denies a sibling policy scope before reading policy state', async () => {
    scopeAuthorization.assertRolesAtScope.mockRejectedValueOnce(new ForbiddenException({ reasons: ['hierarchy-scope-not-authorized'] }));
    await expect(controller.get('booking-buffer', CHILD_SCOPE_ID, principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(policies.get).not.toHaveBeenCalled();
  });

  it('requires organization-root authority for a default policy activation', async () => {
    await controller.activate('booking-buffer', undefined, principal);
    expect(scopeAuthorization.assertRootRole).toHaveBeenCalledWith(principal, ['SystemAdmin']);
    expect(policies.activate).toHaveBeenCalledWith(principal.organizationId, 'booking-buffer', undefined, principal.personId);
  });

  it('does not activate a default policy when root authority is absent', async () => {
    scopeAuthorization.assertRootRole.mockRejectedValueOnce(new ForbiddenException({ reasons: ['organization-root-scope-required'] }));
    await expect(controller.activate('booking-buffer', undefined, principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(policies.activate).not.toHaveBeenCalled();
  });
});