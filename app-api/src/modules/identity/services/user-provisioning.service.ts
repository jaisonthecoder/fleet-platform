import { Injectable } from '@nestjs/common';
import { IdentityRepository } from '../repositories/identity.repository';

/** Details captured from the SSO token on first sign-in. */
export interface SsoIdentity {
  entraObjectId: string;
  email?: string | null;
  displayName?: string | null;
  /** HCM employee id from the token claims, if present (preferred match key). */
  hcmEmployeeId?: string | null;
  /** Pre-resolved HR person id, if the caller already matched it. */
  personId?: string | null;
}

/**
 * Just-in-time user provisioning (1A₂). On first successful SSO sign-in a
 * `user_account` is created and linked to the HR `person` — matched by (in
 * order) an explicit `personId`, the HCM employee id, then email. On subsequent
 * logins `last_login_at` is refreshed. An unmatched account is created
 * **without** a person link (and therefore no roles) until an admin links it —
 * never auto-granted (LU-3). This is the seam future HCM-driven provisioning
 * plugs in.
 */
@Injectable()
export class UserProvisioningService {
  constructor(private readonly repo: IdentityRepository) {}

  /** Returns the user account for an SSO identity, creating it on first login. */
  async provisionOnLogin(identity: SsoIdentity): Promise<{ id: string; personId: string | null }> {
    const existing = await this.repo.findUserByEntraId(identity.entraObjectId);
    if (existing) {
      const updated = await this.repo.updateUser(existing.id, { lastLoginAt: new Date() });
      return { id: updated.id, personId: updated.personId };
    }
    const personId = await this.resolvePersonId(identity);
    const created = await this.repo.insertUser({
      entraObjectId: identity.entraObjectId,
      email: identity.email ?? null,
      displayName: identity.displayName ?? null,
      personId,
      status: 'Active',
      lastLoginAt: new Date(),
    });
    return { id: created.id, personId: created.personId };
  }

  /** Resolves the HR person to link: explicit id → HCM employee id → email → null. */
  private async resolvePersonId(identity: SsoIdentity): Promise<string | null> {
    if (identity.personId) {
      return identity.personId;
    }
    if (identity.hcmEmployeeId) {
      const byHcm = await this.repo.findPersonByHcmId(identity.hcmEmployeeId);
      if (byHcm) {
        return byHcm.id;
      }
    }
    if (identity.email) {
      const byEmail = await this.repo.findPersonByEmail(identity.email);
      if (byEmail) {
        return byEmail.id;
      }
    }
    return null;
  }
}
