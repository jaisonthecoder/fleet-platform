import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { identityConfig } from '../config/identity.config';
import { AccessService } from '../../modules/platform/services/access.service';
import { UserProvisioningService } from '../../modules/identity/services/user-provisioning.service';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { JwtVerifier } from './jwt-verifier';
import type { Principal, RequestWithPrincipal } from './principal';

/**
 * Global authentication guard. A route is reachable only with either a verified
 * **Entra JWT** (production) or the **dev-login** stand-in (lower environments
 * only — structurally off in uat/production, P0-R2-4). It provisions the user
 * just-in-time, loads their roles/scopes, and attaches a {@link Principal} to
 * the request. `@Public()` routes (health) bypass it.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifier,
    private readonly provisioning: UserProvisioningService,
    private readonly access: AccessService,
    @Inject(identityConfig.KEY)
    private readonly config: ConfigType<typeof identityConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const authorization = request.headers['authorization'];
    const bearer =
      typeof authorization === 'string' && authorization.startsWith('Bearer ')
        ? authorization.slice(7)
        : null;

    // Real Entra JWT path (production).
    if (bearer && this.config.entraConfigured) {
      const claims = await this.jwtVerifier.verify(bearer);
      const user = await this.provisioning.provisionOnLogin({
        entraObjectId: claims.oid,
        email: claims.email,
        displayName: claims.name,
      });
      if (!user.personId) {
        throw new UnauthorizedException({
          title: 'User not linked',
          reasons: ['user-not-linked-to-person'],
        });
      }
      const authContext = await this.access.contextFor(user.personId);
      request.principal = {
        organizationId: authContext.organizationId,
        userId: user.id,
        personId: user.personId,
        entraObjectId: claims.oid,
        email: claims.email,
        roles: authContext.roles,
        isDevLogin: false,
      };
      return true;
    }

    // Dev-login stand-in (lower environments only).
    if (this.config.devLoginEnabled) {
      const devPersonId = request.headers['x-dev-person-id'];
      if (typeof devPersonId === 'string' && devPersonId) {
        const authContext = await this.access.contextFor(devPersonId);
        request.principal = this.devPrincipal(
          devPersonId,
          authContext.organizationId,
          authContext.roles,
        );
        return true;
      }
    }

    throw new UnauthorizedException({
      title: 'Authentication required',
      reasons: [
        this.config.entraConfigured
          ? 'bearer-token-required'
          : 'dev-login-required (set x-dev-person-id header)',
      ],
    });
  }

  private devPrincipal(
    personId: string,
    organizationId: string,
    roles: Principal['roles'],
  ): Principal {
    return {
      organizationId,
      userId: null,
      personId,
      entraObjectId: null,
      email: null,
      roles,
      isDevLogin: true,
    };
  }
}
