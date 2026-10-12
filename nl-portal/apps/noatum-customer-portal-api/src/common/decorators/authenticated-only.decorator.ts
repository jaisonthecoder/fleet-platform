import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ONLY_KEY = 'noatum:authenticatedOnly';

/**
 * For the handful of endpoints where being signed in is the entire requirement -
 * /me, locale preference, notification read receipts.
 *
 * Distinct from @Public() (no token at all) and required because PermissionGuard fails
 * closed: an endpoint with no marker is refused, so a forgotten decorator cannot become
 * an accidentally open endpoint. Never use this on anything that returns customer data
 * beyond the caller.
 */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);
