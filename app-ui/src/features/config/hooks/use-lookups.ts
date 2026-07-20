import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  activateLookupValue,
  createLookupType,
  createLookupValue,
  deactivateLookupValue,
  fetchLookupChildrenAdmin,
  fetchLookupParentOptions,
  fetchLookupTypes,
  fetchLookupTypesWithCounts,
  fetchLookupValueChildren,
  fetchLookupValues,
  fetchLookupValuesAdmin,
  importLookupValues,
  reorderLookupValue,
  updateLookupType,
  updateLookupValue,
  type CreateLookupType,
  type CreateLookupValue,
  type ListLookupValuesQuery,
  type LookupImportRow,
  type ReorderDirection,
  type UpdateLookupType,
  type UpdateLookupValue,
} from '../config.contract'

/** The configurable list domains (`GET /lookups`). */
export function useLookupTypes() {
  return useQuery({
    queryKey: ['lookups', 'types'],
    queryFn: fetchLookupTypes,
    staleTime: 5 * 60 * 1000,
  })
}

/** The values of one type (`GET /lookups/:typeCode`); disabled until a type is chosen. */
export function useLookupValues(typeCode: string | null) {
  return useQuery({
    queryKey: ['lookups', 'values', typeCode],
    queryFn: () => fetchLookupValues(typeCode as string),
    enabled: Boolean(typeCode),
    staleTime: 60 * 1000,
  })
}

// ── Admin management surface (Reference-data page) ──────────────────────────

/** The management catalogue of types with active/total value counts. */
export function useLookupTypesWithCounts() {
  return useQuery({
    queryKey: ['lookups', 'admin', 'types'],
    queryFn: fetchLookupTypesWithCounts,
    staleTime: 60 * 1000,
  })
}

/** Paged/filtered admin values for a type (query is part of the cache key). */
export function useLookupValuesAdmin(
  typeCode: string | null,
  query: ListLookupValuesQuery,
) {
  return useQuery({
    queryKey: ['lookups', 'admin', 'values', typeCode, query],
    queryFn: () => fetchLookupValuesAdmin(typeCode as string, query),
    enabled: Boolean(typeCode),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

/** A parent value's children (incl inactive) — lazy-loaded on tree expand. */
export function useLookupChildrenAdmin(
  typeCode: string | null,
  parentCode: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['lookups', 'admin', 'children', typeCode, parentCode],
    queryFn: () =>
      fetchLookupChildrenAdmin(typeCode as string, parentCode as string),
    enabled: enabled && Boolean(typeCode) && Boolean(parentCode),
    staleTime: 30 * 1000,
  })
}

/**
 * Every child of a value ACROSS types (Model values under a Make value, plus
 * self-nested same-type children), each tagged with its own type — lazy-loaded
 * on tree expand. Drives child-type-driven nesting.
 */
export function useLookupValueChildren(valueId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['lookups', 'admin', 'value-children', valueId],
    queryFn: () => fetchLookupValueChildren(valueId as string),
    enabled: enabled && Boolean(valueId),
    staleTime: 30 * 1000,
  })
}

/** Candidate parent values for a type's parent selector (cross-type aware). */
export function useLookupParentOptions(typeCode: string | null, enabled = true) {
  return useQuery({
    queryKey: ['lookups', 'admin', 'parent-options', typeCode],
    queryFn: () => fetchLookupParentOptions(typeCode as string),
    enabled: enabled && Boolean(typeCode),
    staleTime: 30 * 1000,
  })
}

/**
 * Invalidates every read/admin cache entry after a mutation. Nesting is
 * child-TYPE-driven, so a create can land in a DIFFERENT type than the one on
 * screen (e.g. a Model under a Make) and re-parents cross the parent's grid and
 * the by-value children view — so we invalidate the whole `lookups` surface
 * rather than a single type. `typeCode` is kept for call-site clarity.
 */
function invalidateType(
  queryClient: ReturnType<typeof useQueryClient>,
  _typeCode: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ['lookups'] })
}

/** Creates a new non-system lookup type; refreshes the catalogue. */
export function useCreateLookupType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateLookupType) => createLookupType(body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['lookups', 'admin', 'types'] }),
  })
}

/** Renames / re-flags a non-system type; refreshes the catalogue. */
export function useUpdateLookupType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLookupType }) =>
      updateLookupType(id, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['lookups', 'admin', 'types'] }),
  })
}

/** Reorders a value one position up/down; refreshes that type's grid + tree. */
export function useReorderLookupValue(typeCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: ReorderDirection }) =>
      reorderLookupValue(id, direction),
    onSuccess: () => invalidateType(queryClient, typeCode),
  })
}

/** Adds a value and refreshes that type's list (both read + admin caches). */
export function useCreateLookupValue(typeCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateLookupValue) => createLookupValue(typeCode, body),
    onSuccess: () => invalidateType(queryClient, typeCode),
  })
}

/** Deactivates a value and refreshes that type's list. */
export function useDeactivateLookupValue(typeCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateLookupValue(id),
    onSuccess: () => invalidateType(queryClient, typeCode),
  })
}

/** Updates a value's labels/order/flags and refreshes that type's list. */
export function useUpdateLookupValue(typeCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLookupValue }) =>
      updateLookupValue(id, body),
    onSuccess: () => invalidateType(queryClient, typeCode),
  })
}

/** Reactivates a deactivated value and refreshes that type's list. */
export function useActivateLookupValue(typeCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activateLookupValue(id),
    onSuccess: () => invalidateType(queryClient, typeCode),
  })
}

/** Bulk-imports values into a type and refreshes its list. */
export function useImportLookupValues(typeCode: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rows: LookupImportRow[]) => importLookupValues(typeCode, rows),
    onSuccess: () => invalidateType(queryClient, typeCode),
  })
}
