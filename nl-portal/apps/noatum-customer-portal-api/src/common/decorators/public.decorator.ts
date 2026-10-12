import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'noatum:isPublic';

/**
 * Opt an endpoint out of authentication. Use sparingly - health checks, the invitation
 * acceptance landing, and nothing else. A public endpoint must not read customer data.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
