import { randomUUID } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import {
  createEntraVerifier,
  type EntraClaims,
  type TokenVerifier,
} from '../auth/entra-token.verifier';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext, type TenantContextData } from '../tenancy/tenant-context';

/** What the identity layer returns once a token has been matched to a person. */
export interface ResolvedIdentity {
  id: string;
  customerGroupId: string | null;
  /** The customer's lifecycle status. Null for Noatum staff, who have no customer. */
  customerGroupStatus?: string | null;
  displayName: string;
  email: string;
  branchCode: string | null;
  branchName: string | null;
  regionCode: string | null;
  regionName: string | null;
  roleKeys: string[];
  isInternal: boolean;
  status: string;
  accountIds: string[];
  permissions: string[];
}

export abstract class UserResolver {
  abstract resolve(claims: EntraClaims): Promise<ResolvedIdentity | null>;
}

/**
 * The pilot's portal-managed sign-in (ADR-006), injected optionally so the whole
 * local-auth module can be removed without touching this file's Entra path.
 */
export abstract class LocalSessionResolver {
  abstract resolve(request: unknown): Promise<ResolvedIdentity | null>;
}

/**
 * Statuses that may hold a session.
 *
 * `registered` is deliberately included: a member of staff who has signed in but holds
 * no roles must reach /me to see the access-pending screen. They carry no permissions,
 * so every protected route still refuses them.
 */
const SIGN_IN_ALLOWED = new Set(['registered', 'active']);

/**
 * A customer whose lifecycle is anything but `active` grants its people nothing.
 *
 * Read from the customer on every request rather than stamped onto user rows, so
 * restoring a customer cannot accidentally re-enable someone an administrator had
 * blocked individually.
 */
const CUSTOMER_ACCESS_ALLOWED = new Set(['active']);

/**
 * Validates the Entra ID access token and loads the matching portal user.
 *
 * Signature, issuer and audience are all checked against configuration. Claims are used
 * only to identify the user; roles, permissions and tenancy come from our own database,
 * never from the token.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private verifier?: TokenVerifier;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly tenantContext: TenantContext,
    // Injected lazily by IdentityModule to avoid a circular import at module load.
    private readonly resolveUser: UserResolver,
    @Optional() private readonly localSession?: LocalSessionResolver,
  ) {}

  private getVerifier(): TokenVerifier {
    this.verifier ??= createEntraVerifier({
      tenantId: this.config.getOrThrow<string>('entra.tenantId'),
      audience: this.config.getOrThrow<string>('entra.audience'),
    });
    return this.verifier;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // A portal session cookie, if there is one. Returns null for every staff request,
    // so the Entra path below is reached exactly as it was before.
    const local = (await this.localSession?.resolve(request)) ?? null;
    const user = local ?? (await this.resolveUser.resolve(this.devClaims(request) ?? (await this.verifiedClaims(request))));

    if (!user) {
      throw new UnauthorizedException('No portal account exists for this identity.');
    }
    if (!SIGN_IN_ALLOWED.has(user.status)) {
      throw new UnauthorizedException(`Account is ${user.status}.`);
    }
    // Staff carry no customer, so this never fires for them. For everyone else it
    // fails CLOSED: an identity that arrives without a status is refused rather
    // than admitted, so a resolver that forgets to populate it cannot silently
    // restore access to every suspended customer.
    if (!user.isInternal && !CUSTOMER_ACCESS_ALLOWED.has(user.customerGroupStatus ?? '')) {
      throw new UnauthorizedException('Portal access for this company is not active.');
    }

    const data: TenantContextData = {
      customerGroupId: user.customerGroupId,
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      branchCode: user.branchCode,
      regionCode: user.regionCode,
      branchName: user.branchName,
      roleKeys: user.roleKeys,
      isInternal: user.isInternal,
      onBehalfOfUserId: null,
      accountIds: user.accountIds,
      permissions: new Set(user.permissions),
      correlationId:
        (request.headers['x-correlation-id'] as string | undefined) ?? randomUUID(),
    };

    request.user = data;

    this.tenantContext.authenticate(data);
    return true;
  }

  private async verifiedClaims(request: AuthenticatedRequest): Promise<EntraClaims> {
    const authorization = request.headers.authorization;
    const token = this.extractBearer(
      typeof authorization === 'string' ? authorization : undefined,
    );
    try {
      return await this.getVerifier()(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      // Do not leak why: expired, wrong audience and bad signature all read the same.
      throw new UnauthorizedException('Invalid token.');
    }
  }

  /**
   * Local "act as" bypass. Off unless DEV_AUTH_ENABLED=true, and outside development it
   * additionally needs DEV_AUTH_ALLOW_IN_PRODUCTION. It trusts a self-asserted header
   * identity, so anyone who can reach the site can become whoever the headers name.
   *
   * Outside development it is therefore narrowed to the seeded demonstration accounts:
   * the subject must carry the `dev-` prefix the seed uses, and the address and name
   * headers are ignored entirely. Both matter. An arbitrary subject would register a
   * brand new staff account on first use, and a self-asserted address is enough to be
   * granted platform administration when it appears in PLATFORM_BOOTSTRAP_ADMINS.
   */
  private devClaims(request: AuthenticatedRequest): EntraClaims | null {
    if (!this.config.get<boolean>('identity.devAuthEnabled')) return null;

    const header = (name: string): string | undefined => {
      const value = request.headers[name];
      const raw = Array.isArray(value) ? value[0] : value;
      return raw?.trim() ? raw.trim() : undefined;
    };

    const subject = header('x-dev-user-subject');
    if (!subject) return null;

    const seededOnly = this.config.get<string>('env') === 'production';
    if (seededOnly && !subject.startsWith('dev-')) return null;

    return {
      issuer: `dev://${this.config.getOrThrow<string>('entra.tenantId')}`,
      subject,
      email: seededOnly ? undefined : header('x-dev-user-email'),
      name: seededOnly ? undefined : header('x-dev-user-name') ?? header('x-dev-user-email'),
    };
  }

  private extractBearer(header: string | undefined): string {
    const [scheme, value] = (header ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    return value;
  }
}

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: TenantContextData;
}

