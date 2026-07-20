import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export interface OrganizationHierarchyNode {
  id: string
  organizationId: string
  parentId: string | null
  parentCode: string | null
  parentName: string | null
  code: string
  levelIndex: number
  levelCode: string
  levelLabel: string
  name: string
  nameAr: string
  path: string
  validFrom: string
  validTo: string | null
  revision: number
  childCount: number
  vehicleCount: number
  userCount: number
  utilizedVehicleCount: number
  utilizationPercent: number
  children: OrganizationHierarchyNode[]
}

const hierarchyNodeSchema: z.ZodType<OrganizationHierarchyNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    organizationId: z.string().uuid(),
    parentId: z.string().uuid().nullable(),
    parentCode: z.string().nullable(),
    parentName: z.string().nullable(),
    code: z.string(),
    levelIndex: z.number().int().nonnegative(),
    levelCode: z.string(),
    levelLabel: z.string(),
    name: z.string(),
    nameAr: z.string(),
    path: z.string(),
    validFrom: z.string(),
    validTo: z.string().nullable(),
    revision: z.number().int().positive(),
    childCount: z.number().int().nonnegative(),
    vehicleCount: z.number().int().nonnegative(),
    userCount: z.number().int().nonnegative(),
    utilizedVehicleCount: z.number().int().nonnegative(),
    utilizationPercent: z.number().min(0).max(100),
    children: z.array(hierarchyNodeSchema),
  }),
)

const qualitySchema = z.object({
  activeNodes: z.number().int().nonnegative(),
  activeRoots: z.number().int().nonnegative(),
  missingCodes: z.number().int().nonnegative(),
  missingArabicNames: z.number().int().nonnegative(),
  missingLevelCodes: z.number().int().nonnegative(),
  peopleWithoutHomeScope: z.number().int().nonnegative(),
  activeRoleAssignments: z.number().int().nonnegative(),
  activeVehicleAssignments: z.number().int().nonnegative(),
  healthy: z.boolean(),
  reasons: z.array(z.string()),
})

const workspaceSchema = z.object({
  organization: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    defaultCurrency: z.string(),
    defaultTimezone: z.string(),
    revision: z.number().int().positive(),
    createdAtUtc: z.string(),
    updatedAtUtc: z.string(),
  }),
  levels: z.array(z.object({
    id: z.string().uuid(),
    code: z.string(),
    position: z.number().int().nonnegative(),
    labelEn: z.string(),
    labelAr: z.string(),
    mandatory: z.boolean(),
    active: z.boolean(),
    revision: z.number().int().positive(),
    nodeCount: z.number().int().nonnegative(),
  })),
  hierarchy: z.array(hierarchyNodeSchema),
  quality: qualitySchema,
})
export type OrganizationWorkspace = z.infer<typeof workspaceSchema>
export type OrganizationHierarchyLevel = OrganizationWorkspace['levels'][number]

export interface OrganizationNodeDetail {
  node: OrganizationHierarchyNode
  scopedRoles: Array<{ assignmentId: string; personId: string; fullName: string; role: string }>
  recentTransfers: Array<{ id: string; vehicleId: string; plate: string; fromCode: string | null; fromName: string | null; toCode: string; toName: string; effectiveDate: string; reason: string | null }>
  recentChanges: HierarchyHistoryEvent[]
}

export interface HierarchyImpact {
  nodeId: string
  childNodes: number
  people: number
  roles: number
  vehicles: number
  entitlements: number
  policyRules: number
  blocking: boolean
  reasons: string[]
  impactToken: string
}

export interface CreateHierarchyNodeInput {
  parentId: string
  code: string
  name: string
  nameAr: string
  levelCode: string
  levelLabel: string
  reason: string
}

export interface RenameHierarchyNodeInput {
  expectedRevision: number
  name: string
  nameAr: string
  reason: string
}

/** Loads the SystemAdmin organization workspace and validates its contract. */
export async function fetchOrganizationWorkspace(): Promise<OrganizationWorkspace> {
  return workspaceSchema.parse(await apiClient.get('/v1/admin/organization'))
}

export async function fetchOrganizationNodeDetail(nodeId: string): Promise<OrganizationNodeDetail> {
  return apiClient.get(`/v1/admin/organization/nodes/${nodeId}/detail`)
}

export async function createHierarchyLevel(input: { code: string; labelEn: string; labelAr: string; reason: string }): Promise<OrganizationHierarchyLevel> {
  return apiClient.post('/v1/admin/organization/levels', input)
}

export async function updateHierarchyLevel(levelId: string, input: { expectedRevision: number; labelEn: string; labelAr: string; reason: string }): Promise<OrganizationHierarchyLevel> {
  return apiClient.patch(`/v1/admin/organization/levels/${levelId}`, input)
}

export async function reorderHierarchyLevels(input: { orderedCodes: string[]; expectedOrganizationRevision: number; reason: string }): Promise<OrganizationHierarchyLevel[]> {
  return apiClient.post('/v1/admin/organization/levels/reorder', input)
}

/** Loads dependency impact before hierarchy retirement. */
export async function fetchHierarchyImpact(nodeId: string, targetParentId?: string): Promise<HierarchyImpact> {
  const query = targetParentId ? `?targetParentId=${encodeURIComponent(targetParentId)}` : ''
  return apiClient.get(`/v1/admin/organization/nodes/${nodeId}/impact${query}`)
}

/** Creates a child node under an existing hierarchy node. */
export async function createHierarchyNode(input: CreateHierarchyNodeInput): Promise<OrganizationHierarchyNode> {
  return apiClient.post('/v1/admin/organization/nodes', input)
}

/** Renames bilingual hierarchy labels at an expected revision. */
export async function renameHierarchyNode(nodeId: string, input: RenameHierarchyNodeInput): Promise<OrganizationHierarchyNode> {
  return apiClient.patch(`/v1/admin/organization/nodes/${nodeId}`, input)
}

/** Retires a dependency-free node at an expected revision. */
export async function retireHierarchyNode(nodeId: string, expectedRevision: number, reason: string): Promise<OrganizationHierarchyNode> {
  return apiClient.post(`/v1/admin/organization/nodes/${nodeId}/retire`, { expectedRevision, reason })
}

export interface RetiredHierarchyNode {
  id: string
  code: string
  name: string
  nameAr: string
  levelCode: string
  levelLabel: string
  path: string
  revision: number
  validTo: string | null
}

export interface HierarchyHistoryEvent {
  id: string
  action: string
  actorRef: string
  reason: string | null
  atUtc: string
}

export async function fetchRetiredHierarchy(): Promise<RetiredHierarchyNode[]> {
  return apiClient.get('/v1/admin/organization/retired')
}

export async function fetchHierarchyHistory(nodeId: string): Promise<HierarchyHistoryEvent[]> {
  return apiClient.get(`/v1/admin/organization/nodes/${nodeId}/history`)
}

export async function moveHierarchyNode(nodeId: string, targetParentId: string, expectedRevision: number, impactToken: string, reason: string): Promise<OrganizationHierarchyNode> {
  return apiClient.post(`/v1/admin/organization/nodes/${nodeId}/move`, { targetParentId, expectedRevision, impactToken, reason })
}

export async function reactivateHierarchyNode(nodeId: string, expectedRevision: number, reason: string): Promise<OrganizationHierarchyNode> {
  return apiClient.post(`/v1/admin/organization/nodes/${nodeId}/reactivate`, { expectedRevision, reason })
}

export interface FlatOrganizationNode extends Omit<OrganizationHierarchyNode, 'children'> {
  depth: number
  children: OrganizationHierarchyNode[]
}

/** Flattens arbitrary-depth hierarchy nodes in pre-order for accessible list rendering. */
export function flattenOrganizationTree(
  nodes: OrganizationHierarchyNode[],
  expanded: ReadonlySet<string>,
  depth = 0,
): FlatOrganizationNode[] {
  const result: FlatOrganizationNode[] = []
  for (const node of nodes) {
    result.push({ ...node, depth })
    if (node.children.length > 0 && expanded.has(node.id)) {
      result.push(...flattenOrganizationTree(node.children, expanded, depth + 1))
    }
  }
  return result
}
