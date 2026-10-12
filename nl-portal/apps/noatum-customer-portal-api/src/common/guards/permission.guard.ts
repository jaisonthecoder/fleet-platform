import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@/contracts';

import { AUTHENTICATED_ONLY_KEY } from '../decorators/authenticated-only.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { TenantContext } from '../tenancy/tenant-context';

/**
 * Enforces @RequirePermission. Applied globally, so an endpoint that declares no
 * permissions and is not @Public() is refused rather than allowed - a forgotten
 * decorator fails closed.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly context: TenantContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authenticatedOnly) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      throw new ForbiddenException(
        `${context.getClass().name}.${context.getHandler().name} declares no permission. Add @RequirePermission(...) or @Public().`,
      );
    }

    const { permissions } = this.context.require();
    const missing = required.filter((permission) => !permissions.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
    }

    return true;
  }
}
