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
    if (await this.canRolesAtScope(principal, roles, targetScopeNodeId)) return;
    throw new ForbiddenException({
      title: 'Hierarchy scope is not authorized',
      reasons: [`hierarchy-scope-not-authorized:${targetScopeNodeId}`],
    });
  }

  /** Whether one allowed role covers the exact target scope or an ancestor. */
  async canRolesAtScope(
    principal: Principal,
    roles: readonly PlatformRole[],
    targetScopeNodeId: string,
  ): Promise<boolean> {
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
    return Boolean(allowed);
  }

  /** Node IDs under any active role scope, excluding context-only ancestors. */
  async authorizedDescendantIds(principal: Principal): Promise<string[]> {
    const nodes = await this.repo.listHierarchy(principal.organizationId);
    const scopes = principal.roles
      .map((role) => nodes.find((node) => node.id === role.scopeNodeId))
      .filter((node): node is (typeof nodes)[number] => Boolean(node));
    return nodes
      .filter((node) =>
        scopes.some(
          (scope) => node.id === scope.id || node.path.startsWith(`${scope.path}.`),
        ),
      )
      .map((node) => node.id);
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
