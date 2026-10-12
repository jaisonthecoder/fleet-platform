import { Injectable } from '@nestjs/common';

import type { ResolvedIdentity } from '../../common/guards/auth.guard';
import { LocalSessionResolver } from '../../common/guards/auth.guard';

import { LocalAuthRepository } from './local-auth.repository';
import type { LocalRequest } from './local-auth.service';

/**
 * Lets the rest of the API accept a portal session cookie wherever it accepts a staff
 * token. Roles, permissions and tenancy still come from the database - the cookie
 * carries nothing but a session id.
 *
 * Inert by design: with the module switched off no session middleware runs, so
 * `request.session` is undefined and every call here returns null on the first line.
 */
@Injectable()
export class LocalSessionIdentityResolver extends LocalSessionResolver {
  constructor(private readonly repository: LocalAuthRepository) {
    super();
  }

  async resolve(request: LocalRequest & { headers?: Record<string, unknown> }): Promise<ResolvedIdentity | null> {
    const local = request.session?.local;
    if (!local) return null;

    // A bearer token means a staff request. Never let two identities into one call.
    if (request.headers?.['authorization']) return null;

    // Half a sign-in is not a sign-in: a session waiting on its second factor reaches
    // the MFA endpoints (which are public) and nothing else.
    if (local.assurance !== 'authenticated') return null;

    return this.repository.resolveIdentityById(local.userId);
  }
}
