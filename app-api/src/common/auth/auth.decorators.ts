import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { PlatformRole } from '../database/schema';
import type { Principal, RequestWithPrincipal } from './principal';

/** Metadata key marking a route as public (skips authentication). */
export const IS_PUBLIC_KEY = 'auth:isPublic';

/** Metadata key carrying the roles required to access a route. */
export const ROLES_KEY = 'auth:roles';

/** Marks a route (or controller) as public — the auth guard lets it through. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires the caller to hold at least one of the given roles (on any scope). */
export const Roles = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated {@link Principal} into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | undefined =>
    ctx.switchToHttp().getRequest<RequestWithPrincipal>().principal,
);
