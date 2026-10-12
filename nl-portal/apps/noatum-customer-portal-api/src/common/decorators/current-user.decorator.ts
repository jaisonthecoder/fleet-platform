import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { TenantContextData } from '../tenancy/tenant-context';

/**
 * Inject the resolved caller into a handler.
 *
 * Read-only convenience. Never trust a value the client sent for identity or tenancy -
 * this comes from the validated token plus the database lookup done in AuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (key: keyof TenantContextData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: TenantContextData }>();
    const user = request.user;
    return key && user ? user[key] : user;
  },
);
