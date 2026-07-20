import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { PlatformRole } from '../database/schema';
import { RolesGuard } from './roles.guard';
import type { RequestWithPrincipal } from './principal';

function context(request: RequestWithPrincipal, required?: PlatformRole[]): { ctx: ExecutionContext; guard: RolesGuard } {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, guard: new RolesGuard(reflector) };
}

const withRoles = (...roles: PlatformRole[]): RequestWithPrincipal => ({
  headers: {},
  principal: {
    organizationId: '00000000-0000-4000-8000-000000000001',
    userId: 'u',
    personId: 'p',
    entraObjectId: null,
    email: null,
    isDevLogin: true,
    roles: roles.map((role) => ({ role, scopeNodeId: 's' })),
  },
});

describe('RolesGuard', () => {
  it('allows a route with no @Roles requirement', () => {
    const { ctx, guard } = context(withRoles(), undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when the principal holds one of the required roles', () => {
    const { ctx, guard } = context(withRoles('SystemAdmin'), ['SystemAdmin', 'DataSteward']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('forbids when the principal lacks all required roles', () => {
    const { ctx, guard } = context(withRoles('Employee'), ['SystemAdmin']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('forbids when there is no principal', () => {
    const { ctx, guard } = context({ headers: {} }, ['SystemAdmin']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
