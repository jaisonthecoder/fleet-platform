import { Injectable, NotFoundException } from '@nestjs/common';
import type { PlatformRole } from '../../../common/database/schema';
import type { MeResponse } from '../../../contracts/platform.contract';
import { PlatformRepository } from '../repositories/platform.repository';

@Injectable()
export class AccessService {
  constructor(private readonly repo: PlatformRepository) {}

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
