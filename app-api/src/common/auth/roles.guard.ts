import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PlatformRole } from '../database/schema';
import { ROLES_KEY } from './auth.decorators';
import type { RequestWithPrincipal } from './principal';

/**
 * Global RBAC guard. Runs after {@link AuthGuard} (which sets the principal).
 * A route with `@Roles(...)` requires the caller to hold **at least one** of the
 * listed roles (on any scope in Phase 1; scope-aware checks arrive with the
 * feature blocks). Routes without `@Roles` are role-unrestricted (still
 * authenticated). Enforced at the authorization layer, never by UI hiding.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    const held = new Set((request.principal?.roles ?? []).map((r) => r.role));
    if (required.some((role) => held.has(role))) {
      return true;
    }

    throw new ForbiddenException({
      title: 'Insufficient role',
      reasons: [`requires-one-of:${required.join(',')}`],
    });
  }
}
