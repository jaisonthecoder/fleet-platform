import type { HierarchyNodeDto } from '../../../contracts/platform.contract';

/** A flat hierarchy node row (subset needed for tree/roll-up computation). */
export interface FlatNode {
  id: string;
  parentId: string | null;
  levelIndex: number;
  levelLabel: string;
  name: string;
  path: string;
}

/**
 * Builds the nested hierarchy tree from a flat node list (roll-up ready). Pure —
 * no I/O — so the N-level tree rules are exhaustively unit-testable.
 */
export function buildTree(nodes: FlatNode[]): HierarchyNodeDto[] {
  const byId = new Map<string, HierarchyNodeDto>();
  for (const n of nodes) {
    byId.set(n.id, {
      id: n.id,
      parentId: n.parentId,
      levelIndex: n.levelIndex,
      levelLabel: n.levelLabel,
      name: n.name,
      path: n.path,
      children: [],
    });
  }
  const roots: HierarchyNodeDto[] = [];
  for (const dto of byId.values()) {
    if (dto.parentId && byId.has(dto.parentId)) {
      byId.get(dto.parentId)!.children.push(dto);
    } else {
      roots.push(dto);
    }
  }
  return roots;
}

/**
 * Drill-down: every node at or below `nodeId` (roll-up scope). Uses the `ltree`
 * `path` prefix so it is correct for any depth (Cluster→Pool→Location or any
 * other org's N-level config). Returns `[]` if the node is unknown.
 */
export function descendantsOf(nodes: FlatNode[], nodeId: string): FlatNode[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    return [];
  }
  const prefix = `${node.path}.`;
  return nodes.filter((n) => n.id === nodeId || n.path.startsWith(prefix));
}

/**
 * Roll-up: aggregates a numeric measure over `nodeId` and all its descendants
 * (e.g. vehicle count, cost) given a per-node value map. Pure fold used by the
 * dashboards read models (Sub-Phase 1F).
 */
export function rollUp(
  nodes: FlatNode[],
  nodeId: string,
  valueByNodeId: ReadonlyMap<string, number>,
): number {
  return descendantsOf(nodes, nodeId).reduce(
    (sum, n) => sum + (valueByNodeId.get(n.id) ?? 0),
    0,
  );
}

/**
 * Restructure-with-history: given effective-dated node rows, returns the set
 * effective at `asOf` (a node is effective when `validFrom <= asOf` and
 * `validTo` is null or `> asOf`). Lets historical queries resolve the tree as
 * it was at a point in time — moves/renames are never destructive (closes B-07).
 */
export function effectiveAt<T extends { validFrom: Date; validTo: Date | null }>(
  rows: T[],
  asOf: Date,
): T[] {
  return rows.filter(
    (r) => r.validFrom <= asOf && (r.validTo === null || r.validTo > asOf),
  );
}
