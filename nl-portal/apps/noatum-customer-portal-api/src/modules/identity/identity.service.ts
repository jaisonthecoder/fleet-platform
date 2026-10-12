import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EntraClaims } from '../../common/auth/entra-token.verifier';
import { UserResolver, type ResolvedIdentity } from '../../common/guards/auth.guard';
import { PrismaService } from '../../common/tenancy/prisma.service';
import type { DevIdentityDto } from '../../contracts/dto/dev-identity.dto';
import { ROLES, ROLE_PRESETS } from '../../contracts/permissions';

interface IdentityRow {
  user_id: string;
  customer_group_id: string | null;
  customer_group_status: string | null;
  is_internal: boolean;
  status: string;
  display_name: string;
  email: string;
  branch_code: string | null;
  branch_name: string | null;
  region_code: string | null;
  region_name: string | null;
  role_keys: string[] | null;
  permissions: string[] | null;
  account_ids: string[] | null;
}

interface DevIdentityRow {
  subject: string;
  email: string;
  display_name: string;
  status: string;
  role_keys: string[] | null;
}

/**
 * Resolves a validated Entra identity to a portal user, with roles flattened to
 * permission keys.
 *
 * This runs before any tenant context exists, which is why it goes through the
 * `app.resolve_identity` function rather than querying tables directly: that function
 * opens exactly the four identity tables for the duration of one statement, instead of
 * granting the runtime role a blanket RLS exemption.
 */
@Injectable()
export class IdentityService extends UserResolver {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async resolve(claims: EntraClaims): Promise<ResolvedIdentity | null> {
    let row = await this.lookup(claims);

    if (!row && this.isEligibleStaff(claims)) {
      await this.register(claims);
      row = await this.lookup(claims);
    }

    if (!row) return null;

    const permissions = new Set(row.permissions ?? []);
    const roleKeys = new Set(row.role_keys ?? []);
    const bootstrap = this.isBootstrapAdmin(claims);
    if (bootstrap) {
      for (const permission of ROLE_PRESETS[ROLES.PLATFORM_ADMIN]) permissions.add(permission);
      roleKeys.add(ROLES.PLATFORM_ADMIN);
    }

    return {
      id: row.user_id,
      customerGroupId: row.customer_group_id,
      customerGroupStatus: row.customer_group_status,
      displayName: row.display_name,
      email: row.email,
      branchCode: row.branch_code,
      branchName: row.branch_name,
      regionCode: row.region_code,
      regionName: row.region_name,
      roleKeys: [...roleKeys],
      // A bootstrap administrator is by definition Noatum staff.
      isInternal: row.is_internal || bootstrap,
      // Bootstrap access must survive a first sign-in that has no roles yet.
      status: bootstrap && row.status === 'registered' ? 'active' : row.status,
      accountIds: row.account_ids ?? [],
      permissions: [...permissions],
    };
  }

  private async lookup(claims: EntraClaims): Promise<IdentityRow | undefined> {
    const rows = await this.prisma.$queryRaw<IdentityRow[]>`
      SELECT user_id, customer_group_id, customer_group_status, is_internal, status, display_name, email,
             branch_code, branch_name, region_code, region_name, role_keys, permissions, account_ids
      FROM app.resolve_identity(${claims.issuer}, ${claims.subject})
    `;
    return rows[0];
  }

  /**
   * The seeded identities behind the development sign-in picker. Returns nothing
   * unless the header bypass is enabled, and the underlying function only ever
   * matches `dev://` issuers, which a real token cannot produce.
   */
  async listDevIdentities(): Promise<DevIdentityDto[]> {
    if (!this.config.get<boolean>('identity.devAuthEnabled')) return [];

    const rows = await this.prisma.$queryRaw<DevIdentityRow[]>`
      SELECT subject, email, display_name, status, role_keys FROM app.list_dev_identities()
    `;
    return rows.map((row) => ({
      subject: row.subject,
      email: row.email,
      displayName: row.display_name,
      status: row.status as DevIdentityDto['status'],
      roleKeys: row.role_keys ?? [],
    }));
  }

  /**
   * First sign-in for a member of staff. The row is created with no roles, so being
   * an employee grants recognition and nothing else (FR-IAM-002). Concurrent first
   * sign-ins collapse onto one row inside the function.
   */
  private async register(claims: EntraClaims): Promise<void> {
    const email = claims.email?.trim().toLowerCase();
    if (!email) return;

    await this.prisma.$queryRaw`
      SELECT app.register_staff_identity(
        ${claims.issuer}, ${claims.subject}, ${email}, ${claims.name ?? email}
      )
    `;
    this.logger.log({ event: 'AuditEvent', action: 'staff.identity.registered' });
  }

  /**
   * Who may self-register. The verifier has already proved the token came from the
   * trusted tenant; an empty domain list accepts any identity from it, which is the
   * interim position until the eligibility policy is signed off (D-01).
   */
  private isEligibleStaff(claims: EntraClaims): boolean {
    const email = claims.email?.trim().toLowerCase();
    if (!email?.includes('@')) return false;

    const domains = this.config.get<string[]>('identity.staffEmailDomains') ?? [];
    if (domains.length === 0) return true;

    const domain = email.slice(email.lastIndexOf('@') + 1);
    return domains.includes(domain);
  }

  /**
   * The controlled bootstrap for the first Platform Admin (FR-IAM-004). It is a
   * deployment setting, never first-login-wins, and it is re-evaluated per request so
   * removing the entry removes the access.
   */
  private isBootstrapAdmin(claims: EntraClaims): boolean {
    const configured = this.config.get<string[]>('identity.bootstrapAdmins') ?? [];
    if (configured.length === 0) return false;

    return [claims.email, claims.subject]
      .filter((value): value is string => Boolean(value))
      .some((value) => configured.includes(value.trim().toLowerCase()));
  }
}
