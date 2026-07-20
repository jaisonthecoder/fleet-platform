import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

/** A node in the configurable org hierarchy (mirrors backend `HierarchyNodeDto`). */
export interface HierarchyNode {
  id: string
  parentId: string | null
  levelIndex: number
  levelLabel: string
  name: string
  path: string
  children: HierarchyNode[]
}

export const hierarchyNodeSchema: z.ZodType<HierarchyNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    levelIndex: z.number(),
    levelLabel: z.string(),
    name: z.string(),
    path: z.string(),
    children: z.array(hierarchyNodeSchema),
  }),
)

/** Fetches + validates the configurable hierarchy tree (`GET /api/v1/hierarchy`). */
export async function fetchHierarchy(): Promise<HierarchyNode[]> {
  return z.array(hierarchyNodeSchema).parse(await apiClient.get('/v1/hierarchy'))
}

/** A hierarchy node flattened for list rendering (carries its tree depth). */
export interface FlatHierarchyNode {
  id: string
  parentId: string | null
  levelIndex: number
  levelLabel: string
  name: string
  path: string
  depth: number
}

/** Pre-order flatten of the tree, tagging each node with its depth (for indent). */
export function flattenHierarchy(
  nodes: HierarchyNode[],
  depth = 0,
): FlatHierarchyNode[] {
  const out: FlatHierarchyNode[] = []
  for (const node of nodes) {
    const { children, ...rest } = node
    out.push({ ...rest, depth })
    if (children.length) out.push(...flattenHierarchy(children, depth + 1))
  }
  return out
}

/** Ids of a node and all of its descendants (the roll-up scope of a node). */
export function descendantsOf(nodes: HierarchyNode[], id: string): string[] {
  const collect = (node: HierarchyNode): string[] => [
    node.id,
    ...node.children.flatMap(collect),
  ]
  const find = (list: HierarchyNode[]): HierarchyNode | null => {
    for (const node of list) {
      if (node.id === id) return node
      const inner = find(node.children)
      if (inner) return inner
    }
    return null
  }
  const found = find(nodes)
  return found ? collect(found) : []
}
