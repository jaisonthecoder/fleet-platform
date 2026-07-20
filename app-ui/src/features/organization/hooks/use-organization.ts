import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createHierarchyNode,
  createHierarchyLevel,
  fetchHierarchyImpact,
  fetchHierarchyHistory,
  fetchRetiredHierarchy,
  fetchOrganizationWorkspace,
  fetchOrganizationNodeDetail,
  renameHierarchyNode,
  moveHierarchyNode,
  reactivateHierarchyNode,
  reorderHierarchyLevels,
  retireHierarchyNode,
  updateHierarchyLevel,
  type CreateHierarchyNodeInput,
  type RenameHierarchyNodeInput,
} from '../organization.contract'

/** Loads the full SystemAdmin organization hierarchy and readiness projection. */
export function useOrganizationWorkspace() {
  return useQuery({
    queryKey: ['organization', 'workspace'],
    queryFn: fetchOrganizationWorkspace,
    staleTime: 30_000,
  })
}

export function useOrganizationNodeDetail(nodeId: string | null) {
  return useQuery({
    queryKey: ['organization', 'node-detail', nodeId],
    queryFn: () => fetchOrganizationNodeDetail(nodeId as string),
    enabled: Boolean(nodeId),
  })
}

/** Loads active dependency counts for a selected hierarchy node. */
export function useHierarchyImpact(nodeId: string | null, enabled: boolean, targetParentId?: string) {
  return useQuery({
    queryKey: ['organization', 'impact', nodeId, targetParentId],
    queryFn: () => fetchHierarchyImpact(nodeId as string, targetParentId),
    enabled: enabled && Boolean(nodeId),
  })
}

export function useRetiredHierarchy() {
  return useQuery({ queryKey: ['organization', 'retired'], queryFn: fetchRetiredHierarchy })
}

export function useHierarchyHistory(nodeId: string | null) {
  return useQuery({
    queryKey: ['organization', 'history', nodeId],
    queryFn: () => fetchHierarchyHistory(nodeId as string),
    enabled: Boolean(nodeId),
  })
}

function invalidateOrganization(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['organization'] })
  void queryClient.invalidateQueries({ queryKey: ['hierarchy'] })
}

/** Creates a child node and refreshes hierarchy consumers. */
export function useCreateHierarchyNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHierarchyNodeInput) => createHierarchyNode(input),
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

/** Renames a hierarchy node and refreshes hierarchy consumers. */
export function useRenameHierarchyNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, input }: { nodeId: string; input: RenameHierarchyNodeInput }) =>
      renameHierarchyNode(nodeId, input),
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

/** Retires a dependency-free node and refreshes hierarchy consumers. */
export function useRetireHierarchyNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, revision, reason }: { nodeId: string; revision: number; reason: string }) =>
      retireHierarchyNode(nodeId, revision, reason),
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

export function useMoveHierarchyNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, targetParentId, revision, impactToken, reason }: { nodeId: string; targetParentId: string; revision: number; impactToken: string; reason: string }) =>
      moveHierarchyNode(nodeId, targetParentId, revision, impactToken, reason),
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

export function useReactivateHierarchyNode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, revision, reason }: { nodeId: string; revision: number; reason: string }) =>
      reactivateHierarchyNode(nodeId, revision, reason),
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

export function useCreateHierarchyLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createHierarchyLevel,
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

export function useUpdateHierarchyLevel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ levelId, input }: { levelId: string; input: { expectedRevision: number; labelEn: string; labelAr: string; reason: string } }) =>
      updateHierarchyLevel(levelId, input),
    onSuccess: () => invalidateOrganization(queryClient),
  })
}

export function useReorderHierarchyLevels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reorderHierarchyLevels,
    onSuccess: () => invalidateOrganization(queryClient),
  })
}
