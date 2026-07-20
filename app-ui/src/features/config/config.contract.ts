import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

/** A lookup type (list domain) — mirrors backend `LookupTypeDto`. */
export interface LookupType {
  id: string
  code: string
  labelEn: string
  labelAr: string
  isHierarchical: boolean
  parentTypeId: string | null
  parentTypeCode: string | null
  parentTypeLabelEn: string | null
}

/** A lookup value — mirrors backend `LookupValueDto`. */
export interface LookupValue {
  id: string
  code: string
  labelEn: string
  labelAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  parentId: string | null
  sortOrder: number
  children?: LookupValue[]
}

const lookupTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  isHierarchical: z.boolean(),
  parentTypeId: z.string().nullable(),
  parentTypeCode: z.string().nullable(),
  parentTypeLabelEn: z.string().nullable(),
})

const lookupValueSchema: z.ZodType<LookupValue> = z.lazy(() =>
  z.object({
    id: z.string(),
    code: z.string(),
    labelEn: z.string(),
    labelAr: z.string(),
    descriptionEn: z.string().nullable(),
    descriptionAr: z.string().nullable(),
    parentId: z.string().nullable(),
    sortOrder: z.number(),
    children: z.array(lookupValueSchema).optional(),
  }),
)

/** Admin: create a value under a type (mirrors backend `createLookupValueSchema`). */
export const createLookupValueSchema = z.object({
  code: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().min(1),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  parentCode: z.string().min(1).optional(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
})
export type CreateLookupValue = z.infer<typeof createLookupValueSchema>

/** Admin: update a value (mirrors backend `updateLookupValueSchema`; code is immutable). */
export const updateLookupValueSchema = z.object({
  labelEn: z.string().min(1).optional(),
  labelAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  parentCode: z.string().nullish(),
  sortOrder: z.coerce.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  retiring: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})
export type UpdateLookupValue = z.infer<typeof updateLookupValueSchema>

/** `GET /api/v1/lookups` — the configurable list domains. */
export async function fetchLookupTypes(): Promise<LookupType[]> {
  return z.array(lookupTypeSchema).parse(await apiClient.get('/v1/lookups'))
}

/** `GET /api/v1/lookups/:typeCode` — the values of one type (EN + AR; client localises). */
export async function fetchLookupValues(typeCode: string): Promise<LookupValue[]> {
  return z.array(lookupValueSchema).parse(await apiClient.get(`/v1/lookups/${typeCode}`))
}

/** `POST /api/v1/admin/lookups/:typeCode/values` — add a value (DataSteward/SystemAdmin). */
export async function createLookupValue(
  typeCode: string,
  body: CreateLookupValue,
): Promise<LookupValue> {
  return lookupValueSchema.parse(
    await apiClient.post(`/v1/admin/lookups/${typeCode}/values`, body),
  )
}

/** `POST /api/v1/admin/lookups/values/:id/deactivate` — soft-retire a value. */
export async function deactivateLookupValue(id: string): Promise<void> {
  await apiClient.post(`/v1/admin/lookups/values/${id}/deactivate`)
}

/** `PATCH /api/v1/admin/lookups/values/:id` — update labels / order (code immutable). */
export async function updateLookupValue(id: string, body: UpdateLookupValue): Promise<LookupValue> {
  return lookupValueSchema.parse(await apiClient.patch(`/v1/admin/lookups/values/${id}`, body))
}

// ── Admin management surface (Reference-data page) ──────────────────────────

/** A generic paged result envelope — mirrors backend `PagedResult<T>`. */
export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** A child type of a lookup type — mirrors backend `LookupChildTypeDto`. */
export interface LookupChildType {
  code: string
  labelEn: string
  labelAr: string
}

/** A lookup type with value counts — mirrors backend `LookupTypeWithCountDto`. */
export interface LookupTypeWithCount {
  id: string
  code: string
  labelEn: string
  labelAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  isHierarchical: boolean
  isSystem: boolean
  activeCount: number
  totalCount: number
  parentTypeId: string | null
  parentTypeCode: string | null
  parentTypeLabelEn: string | null
  /**
   * Types whose `parent_type_id` points at this type (its child TYPES). Drives
   * the value-level "+ Child" affordance and its target-type chooser.
   */
  childTypes: LookupChildType[]
}

/** Derived lifecycle status — mirrors backend `LookupValueStatus`. */
export type LookupValueStatus = 'Active' | 'Retiring' | 'Inactive'

/** An enriched admin value row — mirrors backend `LookupValueAdminDto`. */
export interface LookupValueAdmin {
  id: string
  code: string
  labelEn: string
  labelAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
  retiring: boolean
  status: LookupValueStatus
  parentCode: string | null
  parentLabelEn: string | null
  usageCount: number | null
  hasChildren: boolean
}

/**
 * A cross-type tree child — mirrors backend `LookupValueTreeChildDto`. A value
 * that is a child of some other value, tagged with its OWN type so the tree can
 * render Model values under a Make value (and self-nested same-type children)
 * each with a small type tag.
 */
export interface LookupValueTreeChild extends LookupValueAdmin {
  typeCode: string
  typeLabelEn: string
}

const lookupTypeWithCountSchema = z.object({
  id: z.string(),
  code: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string().nullable(),
  descriptionAr: z.string().nullable(),
  isHierarchical: z.boolean(),
  isSystem: z.boolean(),
  activeCount: z.number(),
  totalCount: z.number(),
  parentTypeId: z.string().nullable(),
  parentTypeCode: z.string().nullable(),
  parentTypeLabelEn: z.string().nullable(),
  childTypes: z
    .array(z.object({ code: z.string(), labelEn: z.string(), labelAr: z.string() }))
    .default([]),
})

const lookupValueStatusSchema = z.enum(['Active', 'Retiring', 'Inactive'])

const lookupValueAdminSchema = z.object({
  id: z.string(),
  code: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string().nullable(),
  descriptionAr: z.string().nullable(),
  parentId: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  retiring: z.boolean(),
  status: lookupValueStatusSchema,
  parentCode: z.string().nullable(),
  parentLabelEn: z.string().nullable(),
  usageCount: z.number().nullable(),
  hasChildren: z.boolean(),
})

const pagedLookupValueAdminSchema = z.object({
  items: z.array(lookupValueAdminSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

const lookupValueTreeChildSchema = lookupValueAdminSchema.extend({
  typeCode: z.string(),
  typeLabelEn: z.string(),
})

/** Admin: paged/filtered query for a type's values (mirrors `listLookupValuesQuerySchema`). */
export interface ListLookupValuesQuery {
  search?: string
  status?: LookupValueStatus
  parentCode?: string
  page?: number
  pageSize?: number
}

/** Admin: create a non-system lookup type (mirrors `createLookupTypeSchema`). */
export const createLookupTypeSchema = z.object({
  code: z.string().min(1),
  labelEn: z.string().min(1),
  labelAr: z.string().min(1),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  isHierarchical: z.boolean().optional(),
  parentTypeCode: z.string().optional(),
})
export type CreateLookupType = z.infer<typeof createLookupTypeSchema>

/** Admin: update a non-system lookup type (mirrors `updateLookupTypeSchema`). */
export const updateLookupTypeSchema = z.object({
  labelEn: z.string().min(1).optional(),
  labelAr: z.string().min(1).optional(),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  isHierarchical: z.boolean().optional(),
  parentTypeCode: z.string().nullish(),
})
export type UpdateLookupType = z.infer<typeof updateLookupTypeSchema>

/** Admin: reorder direction (mirrors `reorderSchema`). */
export type ReorderDirection = 'up' | 'down'

/** `GET /api/v1/admin/lookups/types` — the management catalogue with value counts. */
export async function fetchLookupTypesWithCounts(): Promise<LookupTypeWithCount[]> {
  return z
    .array(lookupTypeWithCountSchema)
    .parse(await apiClient.get('/v1/admin/lookups/types'))
}

/** Builds the query string for the admin values grid. */
function toValuesQueryString(query: ListLookupValuesQuery): string {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.status) params.set('status', query.status)
  if (query.parentCode) params.set('parentCode', query.parentCode)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** `GET /api/v1/admin/lookups/:typeCode/values` — paged, filtered, enriched values. */
export async function fetchLookupValuesAdmin(
  typeCode: string,
  query: ListLookupValuesQuery = {},
): Promise<PagedResult<LookupValueAdmin>> {
  return pagedLookupValueAdminSchema.parse(
    await apiClient.get(
      `/v1/admin/lookups/${typeCode}/values${toValuesQueryString(query)}`,
    ),
  )
}

/** `GET /api/v1/admin/lookups/:typeCode/:parentCode/children` — a parent's children (incl inactive). */
export async function fetchLookupChildrenAdmin(
  typeCode: string,
  parentCode: string,
): Promise<LookupValueAdmin[]> {
  return z
    .array(lookupValueAdminSchema)
    .parse(
      await apiClient.get(`/v1/admin/lookups/${typeCode}/${parentCode}/children`),
    )
}

/**
 * `GET /api/v1/admin/lookups/values/:valueId/children` — every child of a value
 * ACROSS types (Model values under a Make value, plus self-nested same-type
 * children), each tagged with its own type. Drives the cross-type tree.
 */
export async function fetchLookupValueChildren(
  valueId: string,
): Promise<LookupValueTreeChild[]> {
  return z
    .array(lookupValueTreeChildSchema)
    .parse(await apiClient.get(`/v1/admin/lookups/values/${valueId}/children`))
}

/** `POST /api/v1/admin/lookups/types` — create a non-system type (DataSteward/SystemAdmin). */
export async function createLookupType(body: CreateLookupType): Promise<LookupType> {
  return lookupTypeSchema.parse(await apiClient.post('/v1/admin/lookups/types', body))
}

/** `PATCH /api/v1/admin/lookups/types/:id` — rename / re-flag a non-system type. */
export async function updateLookupType(id: string, body: UpdateLookupType): Promise<LookupType> {
  return lookupTypeSchema.parse(await apiClient.patch(`/v1/admin/lookups/types/${id}`, body))
}

/** `POST /api/v1/admin/lookups/values/:id/reorder` — move a value up/down among siblings. */
export async function reorderLookupValue(
  id: string,
  direction: ReorderDirection,
): Promise<LookupValue> {
  return lookupValueSchema.parse(
    await apiClient.post(`/v1/admin/lookups/values/${id}/reorder`, { direction }),
  )
}

/** `POST /api/v1/admin/lookups/values/:id/activate` — reactivate a deactivated value. */
export async function activateLookupValue(id: string): Promise<LookupValue> {
  return lookupValueSchema.parse(
    await apiClient.post(`/v1/admin/lookups/values/${id}/activate`),
  )
}

// ── Parent options, import & export ─────────────────────────────────────────

/** A candidate parent value — mirrors backend `LookupParentOptionDto`. */
export interface LookupParentOption {
  code: string
  labelEn: string
  labelAr: string
  typeCode: string
}

const lookupParentOptionSchema = z.object({
  code: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  typeCode: z.string(),
})

/** `GET /api/v1/admin/lookups/:typeCode/parent-options` — candidate parents (cross-type aware). */
export async function fetchLookupParentOptions(
  typeCode: string,
): Promise<LookupParentOption[]> {
  return z
    .array(lookupParentOptionSchema)
    .parse(await apiClient.get(`/v1/admin/lookups/${typeCode}/parent-options`))
}

/** One exported value row — mirrors backend `LookupExportRow`. */
export interface LookupExportRow {
  code: string
  labelEn: string
  labelAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  parentCode: string | null
  sortOrder: number
  isActive: boolean
  retiring: boolean
  status: LookupValueStatus
}

const lookupExportRowSchema = z.object({
  code: z.string(),
  labelEn: z.string(),
  labelAr: z.string(),
  descriptionEn: z.string().nullable(),
  descriptionAr: z.string().nullable(),
  parentCode: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  retiring: z.boolean(),
  status: lookupValueStatusSchema,
})

/** `GET /api/v1/admin/lookups/:typeCode/export` — every value of a type (round-trips through import). */
export async function exportLookupType(typeCode: string): Promise<LookupExportRow[]> {
  return z
    .array(lookupExportRowSchema)
    .parse(await apiClient.get(`/v1/admin/lookups/${typeCode}/export`))
}

/** One import row — mirrors backend `importLookupRowSchema`. */
export interface LookupImportRow {
  code: string
  labelEn: string
  labelAr: string
  descriptionEn?: string
  descriptionAr?: string
  parentCode?: string
  sortOrder?: number
}

/** Import outcome summary — mirrors backend `LookupImportSummary`. */
export interface LookupImportSummary {
  created: number
  updated: number
  skipped: number
  errors: { code: string; reason: string }[]
}

const lookupImportSummarySchema = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  errors: z.array(z.object({ code: z.string(), reason: z.string() })),
})

/** `POST /api/v1/admin/lookups/:typeCode/import` — bulk upsert values keyed by code. */
export async function importLookupValues(
  typeCode: string,
  rows: LookupImportRow[],
): Promise<LookupImportSummary> {
  return lookupImportSummarySchema.parse(
    await apiClient.post(`/v1/admin/lookups/${typeCode}/import`, { rows }),
  )
}
