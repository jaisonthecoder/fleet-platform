import { UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { identityConfig } from '../config/identity.config';
import type { AccessService } from '../../modules/platform/services/access.service';
import type { UserProvisioningService } from '../../modules/identity/services/user-provisioning.service';
import { AuthGuard } from './auth.guard';
import { IS_PUBLIC_KEY } from './auth.decorators';
import type { JwtVerifier } from './jwt-verifier';
import type { RequestWithPrincipal } from './principal';

function context(request: RequestWithPrincipal, isPublic = false): { ctx: ExecutionContext; reflector: Reflector } {
  const reflector = {
    getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? isPublic : undefined),
  } as unknown as Reflector;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, reflector };
}

const jwtVerifier = {
  verify: async () => ({ oid: 'oid-1', email: 'a@b.ae', name: 'A B' }),
} as unknown as JwtVerifier;
const provisioning = {
  provisionOnLogin: async () => ({ id: 'user-1', personId: 'person-1' }),
} as unknown as UserProvisioningService;
const access = {
  contextFor: async () => ({
    organizationId: '00000000-0000-4000-8000-000000000001',
    roles: [{ role: 'SystemAdmin' as const, scopeNodeId: 'scope-1' }],
  }),
  rolesFor: async () => [{ role: 'SystemAdmin' as const, scopeNodeId: 'scope-1' }],
} as unknown as AccessService;

const cfg = (over: Partial<ConfigType<typeof identityConfig>>) =>
  ({ entraConfigured: false, devLoginEnabled: false, ...over }) as ConfigType<typeof identityConfig>;

describe('AuthGuard', () => {
  it('lets a public route through without a principal', async () => {
    const req: RequestWithPrincipal = { headers: {} };
    const { ctx, reflector } = context(req, true);
    const guard = new AuthGuard(reflector, jwtVerifier, provisioning, access, cfg({}));
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.principal).toBeUndefined();
  });

  it('authenticates via a verified Entra bearer token and sets the principal', async () => {
    const req: RequestWithPrincipal = { headers: { authorization: 'Bearer abc.def.ghi' } };
    const { ctx, reflector } = context(req);
    const guard = new AuthGuard(reflector, jwtVerifier, provisioning, access, cfg({ entraConfigured: true }));
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.principal?.personId).toBe('person-1');
    expect(req.principal?.organizationId).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(req.principal?.isDevLogin).toBe(false);
    expect(req.principal?.roles).toHaveLength(1);
  });

  it('authenticates via dev-login header when enabled', async () => {
    const req: RequestWithPrincipal = { headers: { 'x-dev-person-id': 'person-1' } };
    const { ctx, reflector } = context(req);
    const guard = new AuthGuard(reflector, jwtVerifier, provisioning, access, cfg({ devLoginEnabled: true }));
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(req.principal?.isDevLogin).toBe(true);
    expect(req.principal?.personId).toBe('person-1');
  });

  it('denies when neither a token nor dev-login is available', async () => {
    const req: RequestWithPrincipal = { headers: {} };
    const { ctx, reflector } = context(req);
    const guard = new AuthGuard(reflector, jwtVerifier, provisioning, access, cfg({}));
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does NOT accept dev-login when it is disabled (higher environment)', async () => {
    const req: RequestWithPrincipal = { headers: { 'x-dev-person-id': 'person-1' } };
    const { ctx, reflector } = context(req);
    const guard = new AuthGuard(reflector, jwtVerifier, provisioning, access, cfg({ devLoginEnabled: false }));
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
