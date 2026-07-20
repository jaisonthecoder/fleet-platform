import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import type { HierarchyNodeDto } from '../../../contracts/platform.contract';
import { buildTree, descendantsOf } from '../internal/hierarchy-tree';
import { PlatformRepository } from '../repositories/platform.repository';

@Injectable()
export class HierarchyService {
  constructor(private readonly repo: PlatformRepository) {}

  /** Builds the nested hierarchy tree from the flat node list (roll-up ready). */
  async getTree(): Promise<HierarchyNodeDto[]> {
    const nodes = await this.repo.listHierarchy();
    return buildTree(nodes);
  }

  /** Returns only role-authorized subtrees plus ancestors needed for context. */
  async getAuthorizedTree(principal: Principal): Promise<HierarchyNodeDto[]> {
    const nodes = await this.repo.listHierarchy(principal.organizationId);
    const scopeIds = new Set(principal.roles.map((role) => role.scopeNodeId));
    if (scopeIds.size === 0) return [];

    const scopes = nodes.filter((node) => scopeIds.has(node.id));
    const visible = nodes.filter((candidate) =>
      scopes.some(
        (scope) =>
          candidate.id === scope.id ||
          candidate.path.startsWith(`${scope.path}.`) ||
          scope.path.startsWith(`${candidate.path}.`),
      ),
    );
    return buildTree(visible);
  }

  /** Drill-down: the scope node and every node beneath it (roll-up scope). */
  async scopeSubtree(nodeId: string, organizationId?: string): Promise<string[]> {
    const nodes = await this.repo.listHierarchy(organizationId);
    return descendantsOf(nodes, nodeId).map((n) => n.id);
  }

  /** Resolves an optional requested scope against the caller's authorized closure. */
  async resolveAuthorizedScope(
    principal: Principal,
    requestedScopeId?: string,
  ): Promise<string | undefined> {
    const nodes = await this.repo.listHierarchy(principal.organizationId);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const scopes = principal.roles
      .map((role) => byId.get(role.scopeNodeId))
      .filter((node): node is (typeof nodes)[number] => Boolean(node));
    if (scopes.length === 0) {
      throw new ForbiddenException({
        title: 'No authorized hierarchy scope',
        reasons: ['no-authorized-hierarchy-scope'],
      });
    }
    if (!requestedScopeId) {
      return scopes.some((scope) => scope.parentId === null)
        ? undefined
        : scopes[0].id;
    }
    const requested = byId.get(requestedScopeId);
    const allowed =
      requested &&
      scopes.some(
        (scope) =>
          requested.id === scope.id || requested.path.startsWith(`${scope.path}.`),
      );
    if (!allowed) {
      throw new ForbiddenException({
        title: 'Hierarchy scope is not authorized',
        reasons: [`hierarchy-scope-not-authorized:${requestedScopeId}`],
      });
    }
    return requestedScopeId;
  }
}
