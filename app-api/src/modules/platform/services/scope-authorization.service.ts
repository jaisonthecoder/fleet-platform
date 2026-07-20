import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import type { PlatformRole } from '../../../common/database/schema';
import { PlatformRepository } from '../repositories/platform.repository';

@Injectable()
export class ScopeAuthorizationService {
  constructor(private readonly repo: PlatformRepository) {}

  /** Requires one allowed role whose assigned scope contains the target node. */
  async assertRolesAtScope(
    principal: Principal,
    roles: readonly PlatformRole[],
    targetScopeNodeId: string,
  ): Promise<void> {
    const nodes = await this.repo.listHierarchy(principal.organizationId);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const target = byId.get(targetScopeNodeId);
    const allowed =
      target &&
      principal.roles.some((assignment) => {
        if (!roles.includes(assignment.role)) return false;
        const scope = byId.get(assignment.scopeNodeId);
        return Boolean(
          scope &&
            (scope.id === target.id || target.path.startsWith(`${scope.path}.`)),
        );
      });
    if (!allowed) {
      throw new ForbiddenException({
        title: 'Hierarchy scope is not authorized',
        reasons: [`hierarchy-scope-not-authorized:${targetScopeNodeId}`],
      });
    }
  }

  /** Requires one allowed role assigned at an organization root. */
  async assertRootRole(
    principal: Principal,
    roles: readonly PlatformRole[],
  ): Promise<void> {
    const nodes = await this.repo.listHierarchy(principal.organizationId);
    const roots = new Set(
      nodes.filter((node) => node.parentId === null).map((node) => node.id),
    );
    if (
      !principal.roles.some(
        (assignment) =>
          roles.includes(assignment.role) && roots.has(assignment.scopeNodeId),
      )
    ) {
      throw new ForbiddenException({
        title: 'Organization-wide scope is required',
        reasons: ['organization-root-scope-required'],
      });
    }
  }
}
