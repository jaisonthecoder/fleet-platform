import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlatformRole } from '../../../common/database/schema';
import type {
  CredentialFieldDto,
  CredentialStatus,
  MeCredentialsResponse,
  MeResponse,
  UpdateCredentials,
} from '../../../contracts/platform.contract';
import {
  PlatformRepository,
  type PersonCredentialUpdate,
} from '../repositories/platform.repository';
import { AuditService } from './audit.service';

/** Warn window before a credential expiry (days). */
const EXPIRING_SOON_DAYS = 30;

/** Classifies a date-only expiry into a credential status (UTC date compare). */
export function credentialStatusFor(expiry: string): CredentialStatus {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const exp = new Date(`${expiry}T00:00:00Z`);
  if (exp < today) return 'Expired';
  const soon = new Date(today);
  soon.setUTCDate(soon.getUTCDate() + EXPIRING_SOON_DAYS);
  return exp <= soon ? 'ExpiringSoon' : 'Valid';
}

/** Builds a credential field DTO (Missing when number or expiry is absent). */
export function credentialField(
  number: string | null,
  expiry: string | null,
  source: string | null,
  verified: boolean,
): CredentialFieldDto {
  const status: CredentialStatus =
    !number || !expiry ? 'Missing' : credentialStatusFor(expiry);
  return {
    number: number ?? null,
    expiry: expiry ?? null,
    status,
    source: source ?? null,
    verified,
  };
}

@Injectable()
export class AccessService {
  constructor(
    private readonly repo: PlatformRepository,
    private readonly audit: AuditService,
  ) {}

  /** Returns identity + roles/scopes for a person (backs RBAC + the Scope Switcher). */
  async getMe(personId: string): Promise<MeResponse> {
    const found = await this.repo.findPerson(personId);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown person',
        reasons: [`person-not-found:${personId}`],
      });
    }
    const roles = await this.repo.listActiveRoles(personId);
    return {
      organizationId: found.organizationId,
      personId: found.id,
      fullName: found.fullName,
      email: found.email,
      grade: found.grade,
      employmentStatus: found.employmentStatus,
      homePoolNodeId: found.homePoolNodeId,
      roles: roles.map((r) => ({
        role: r.role,
        scopeNodeId: r.scopeNodeId,
        scopeName: r.scopeName,
      })),
    };
  }

  /** Returns the caller's own driver-credential status (autofill/warnings). */
  async getMyCredentials(personId: string): Promise<MeCredentialsResponse> {
    const found = await this.repo.findPerson(personId);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown person',
        reasons: [`person-not-found:${personId}`],
      });
    }
    return {
      licence: credentialField(
        found.licenceNumber,
        found.licenceExpiry,
        found.licenceSource,
        found.licenceVerified,
      ),
      emiratesId: credentialField(
        found.emiratesId,
        found.emiratesIdExpiry,
        found.emiratesIdSource,
        found.emiratesIdVerified,
      ),
    };
  }

  /** Self-service credential capture (source=manual, stays Unverified). */
  async updateMyCredentials(
    personId: string,
    input: UpdateCredentials,
  ): Promise<MeCredentialsResponse> {
    return this.applyCredentials(personId, input, personId, false);
  }

  /** Admin/steward credential capture for any person (marks Verified). */
  async updatePersonCredentials(
    personId: string,
    input: UpdateCredentials,
    actorPersonId: string,
  ): Promise<MeCredentialsResponse> {
    return this.applyCredentials(personId, input, actorPersonId, true);
  }

  /**
   * Writes the changed credential fields with provenance + audit. `verified`
   * reflects trust: self-entry is Unverified; admin/steward entry is Verified.
   * The audit record captures only which fields changed (never PII values).
   */
  private async applyCredentials(
    personId: string,
    input: UpdateCredentials,
    actorPersonId: string,
    verified: boolean,
  ): Promise<MeCredentialsResponse> {
    const found = await this.repo.findPerson(personId);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown person',
        reasons: [`person-not-found:${personId}`],
      });
    }
    const set: PersonCredentialUpdate = {};
    const changed: string[] = [];
    if (input.licenceNumber !== undefined || input.licenceExpiry !== undefined) {
      if (input.licenceNumber !== undefined) set.licenceNumber = input.licenceNumber;
      if (input.licenceExpiry !== undefined) set.licenceExpiry = input.licenceExpiry;
      set.licenceSource = 'manual';
      set.licenceVerified = verified;
      set.licenceUpdatedByPersonId = actorPersonId;
      changed.push('licence');
    }
    if (input.emiratesId !== undefined || input.emiratesIdExpiry !== undefined) {
      if (input.emiratesId !== undefined) set.emiratesId = input.emiratesId;
      if (input.emiratesIdExpiry !== undefined) {
        set.emiratesIdExpiry = input.emiratesIdExpiry;
      }
      set.emiratesIdSource = 'manual';
      set.emiratesIdVerified = verified;
      set.emiratesIdUpdatedByPersonId = actorPersonId;
      changed.push('emiratesId');
    }
    await this.repo.updatePersonCredentials(personId, set);
    await this.audit.record({
      organizationId: found.organizationId,
      actorRef: actorPersonId,
      action: 'PERSON_CREDENTIALS_UPDATED',
      entityRef: `person:${personId}`,
      after: { fields: changed, verified, self: actorPersonId === personId },
    });
    return this.getMyCredentials(personId);
  }

  /** Returns organization plus active scoped roles for authentication context. */
  async contextFor(personId: string): Promise<{
    organizationId: string;
    roles: Array<{ role: PlatformRole; scopeNodeId: string }>;
  }> {
    const found = await this.repo.findPerson(personId);
    if (!found) {
      throw new NotFoundException({
        title: 'Unknown person',
        reasons: [`person-not-found:${personId}`],
      });
    }
    return {
      organizationId: found.organizationId,
      roles: await this.rolesFor(personId),
    };
  }

  /**
   * Active roles + scopes for a person, or `[]` if unknown/unlinked (never
   * throws). Used by the auth guard to build the request principal.
   */
  async rolesFor(
    personId: string | null,
  ): Promise<Array<{ role: PlatformRole; scopeNodeId: string }>> {
    if (!personId) {
      return [];
    }
    const roles = await this.repo.listActiveRoles(personId);
    return roles.map((r) => ({ role: r.role, scopeNodeId: r.scopeNodeId }));
  }
}
