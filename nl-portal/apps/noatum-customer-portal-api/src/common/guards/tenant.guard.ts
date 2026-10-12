import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext } from '../tenancy/tenant-context';

/**
 * Confirms a tenant is in scope before a handler runs, and validates the
 * X-Customer-Group header that Noatum staff use to target a customer.
 *
 * A customer user may never set that header to another group. Staff must set it (or use
 * an explicitly internal endpoint) so no query runs with an ambiguous scope.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly context: TenantContext,
  ) {}

  canActivate(execution: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      execution.getHandler(),
      execution.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = execution.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const requested = request.headers['x-customer-group'];
    const requestedGroupId = Array.isArray(requested) ? requested[0] : requested;

    const ctx = this.context.require();

    if (!requestedGroupId) {
      // Customer users always have their own group; staff may legitimately have none
      // on internal endpoints, where TenantRepository.runInternal is used.
      if (!ctx.customerGroupId && !ctx.isInternal) {
        throw new BadRequestException('No customer group in scope.');
      }
      return true;
    }

    if (!ctx.isInternal && requestedGroupId !== ctx.customerGroupId) {
      // A customer session asking for another tenant. Refuse, and let the audit log see it.
      throw new ForbiddenException('Cannot act on another customer group.');
    }

    // Staff targeting a specific customer: narrow the context for the rest of the request.
    ctx.customerGroupId = requestedGroupId;
    return true;
  }
}
