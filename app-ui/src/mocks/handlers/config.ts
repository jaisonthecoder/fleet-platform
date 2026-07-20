import { http, HttpResponse } from 'msw'
import type {
  LookupType,
  LookupTypeWithCount,
  LookupValue,
  LookupValueAdmin,
  LookupValueTreeChild,
} from '@/features/config/config.contract'

/** Configurable list domains used by the reference-data admin screen + tests. */
export const mockLookupTypes: LookupType[] = [
  { id: 'lt-body', code: 'vehicle-body-type', labelEn: 'Vehicle body type', labelAr: 'نوع هيكل المركبة', isHierarchical: false, parentTypeId: null, parentTypeCode: null, parentTypeLabelEn: null },
  { id: 'lt-fuel', code: 'fuel-type', labelEn: 'Fuel type', labelAr: 'نوع الوقود', isHierarchical: false, parentTypeId: null, parentTypeCode: null, parentTypeLabelEn: null },
  { id: 'lt-make', code: 'vehicle-make', labelEn: 'Vehicle make', labelAr: 'صانع المركبة', isHierarchical: true, parentTypeId: null, parentTypeCode: null, parentTypeLabelEn: null },
]

/** Management catalogue (types + value counts + child types). */
export const mockLookupTypesWithCounts: LookupTypeWithCount[] = [
  { id: 'lt-body', code: 'vehicle-body-type', labelEn: 'Vehicle body type', labelAr: 'نوع هيكل المركبة', descriptionEn: 'Chassis body class', descriptionAr: null, isHierarchical: false, isSystem: true, activeCount: 3, totalCount: 3, parentTypeId: null, parentTypeCode: null, parentTypeLabelEn: null, childTypes: [] },
  { id: 'lt-fuel', code: 'fuel-type', labelEn: 'Fuel type', labelAr: 'نوع الوقود', descriptionEn: null, descriptionAr: null, isHierarchical: false, isSystem: true, activeCount: 2, totalCount: 2, parentTypeId: null, parentTypeCode: null, parentTypeLabelEn: null, childTypes: [] },
  { id: 'lt-make', code: 'vehicle-make', labelEn: 'Vehicle make', labelAr: 'صانع المركبة', descriptionEn: null, descriptionAr: null, isHierarchical: true, isSystem: false, activeCount: 2, totalCount: 2, parentTypeId: null, parentTypeCode: null, parentTypeLabelEn: null, childTypes: [{ code: 'vehicle-model', labelEn: 'Vehicle model', labelAr: 'طراز المركبة' }] },
  { id: 'lt-model', code: 'vehicle-model', labelEn: 'Vehicle model', labelAr: 'طراز المركبة', descriptionEn: 'Depends on Vehicle make', descriptionAr: null, isHierarchical: false, isSystem: false, activeCount: 2, totalCount: 2, parentTypeId: 'lt-make', parentTypeCode: 'vehicle-make', parentTypeLabelEn: 'Vehicle make', childTypes: [] },
]

const value = (over: Partial<LookupValue> & Pick<LookupValue, 'id' | 'code' | 'labelEn' | 'labelAr'>): LookupValue => ({
  descriptionEn: null,
  descriptionAr: null,
  parentId: null,
  sortOrder: 0,
  ...over,
})

const adminValue = (
  over: Partial<LookupValueAdmin> & Pick<LookupValueAdmin, 'id' | 'code' | 'labelEn' | 'labelAr'>,
): LookupValueAdmin => ({
  descriptionEn: null,
  descriptionAr: null,
  parentId: null,
  sortOrder: 0,
  isActive: true,
  retiring: false,
  status: 'Active',
  parentCode: null,
  parentLabelEn: null,
  usageCount: null,
  hasChildren: false,
  ...over,
})

const valuesByType: Record<string, LookupValue[]> = {
  'vehicle-body-type': [
    value({ id: 'v-sedan', code: 'SEDAN', labelEn: 'Sedan', labelAr: 'سيدان', sortOrder: 1 }),
    value({ id: 'v-suv', code: 'SUV', labelEn: 'SUV', labelAr: 'دفع رباعي', sortOrder: 2 }),
    value({ id: 'v-bus', code: 'BUS', labelEn: 'Bus', labelAr: 'حافلة', sortOrder: 3 }),
  ],
  'fuel-type': [
    value({ id: 'f-petrol', code: 'PETROL', labelEn: 'Petrol', labelAr: 'بنزين', sortOrder: 1 }),
    value({ id: 'f-ev', code: 'EV', labelEn: 'Electric', labelAr: 'كهربائي', sortOrder: 2 }),
  ],
}

const adminValuesByType: Record<string, LookupValueAdmin[]> = {
  'vehicle-body-type': [
    adminValue({ id: 'v-sedan', code: 'SEDAN', labelEn: 'Sedan', labelAr: 'سيدان', sortOrder: 1, usageCount: 12 }),
    adminValue({ id: 'v-suv', code: 'SUV', labelEn: 'SUV', labelAr: 'دفع رباعي', sortOrder: 2, usageCount: 40 }),
    adminValue({ id: 'v-bus', code: 'BUS', labelEn: 'Bus', labelAr: 'حافلة', sortOrder: 3, retiring: true, status: 'Retiring', usageCount: 3 }),
  ],
  'fuel-type': [
    adminValue({ id: 'f-petrol', code: 'PETROL', labelEn: 'Petrol', labelAr: 'بنزين', sortOrder: 1, usageCount: 50 }),
    adminValue({ id: 'f-ev', code: 'EV', labelEn: 'Electric', labelAr: 'كهربائي', sortOrder: 2, usageCount: 5 }),
  ],
  'vehicle-make': [
    adminValue({ id: 'm-toyota', code: 'TOYOTA', labelEn: 'Toyota', labelAr: 'تويوتا', sortOrder: 1, hasChildren: true }),
    adminValue({ id: 'm-nissan', code: 'NISSAN', labelEn: 'Nissan', labelAr: 'نيسان', sortOrder: 2, hasChildren: true }),
  ],
}

const childrenByParent: Record<string, LookupValueAdmin[]> = {
  TOYOTA: [
    adminValue({ id: 'md-landcruiser', code: 'LANDCRUISER', labelEn: 'Land Cruiser', labelAr: 'لاند كروزر', parentId: 'm-toyota', parentCode: 'TOYOTA', parentLabelEn: 'Toyota', sortOrder: 1 }),
    adminValue({ id: 'md-hiace', code: 'HIACE', labelEn: 'Hiace', labelAr: 'هايس', parentId: 'm-toyota', parentCode: 'TOYOTA', parentLabelEn: 'Toyota', sortOrder: 2 }),
  ],
  NISSAN: [
    adminValue({ id: 'md-patrol', code: 'PATROL', labelEn: 'Patrol', labelAr: 'باترول', parentId: 'm-nissan', parentCode: 'NISSAN', parentLabelEn: 'Nissan', sortOrder: 1 }),
  ],
}

const treeChild = (
  over: Partial<LookupValueTreeChild> &
    Pick<LookupValueTreeChild, 'id' | 'code' | 'labelEn' | 'labelAr' | 'typeCode' | 'typeLabelEn'>,
): LookupValueTreeChild => ({
  ...adminValue(over),
  typeCode: over.typeCode,
  typeLabelEn: over.typeLabelEn,
})

/** Cross-type children keyed by the PARENT value's id (by-valueId endpoint). */
const treeChildrenByValueId: Record<string, LookupValueTreeChild[]> = {
  'm-toyota': [
    treeChild({ id: 'md-corolla', code: 'COROLLA', labelEn: 'Corolla', labelAr: 'كورولا', parentId: 'm-toyota', parentCode: 'TOYOTA', parentLabelEn: 'Toyota', typeCode: 'vehicle-model', typeLabelEn: 'Vehicle model' }),
    treeChild({ id: 'md-landcruiser', code: 'LANDCRUISER', labelEn: 'Land Cruiser', labelAr: 'لاند كروزر', parentId: 'm-toyota', parentCode: 'TOYOTA', parentLabelEn: 'Toyota', typeCode: 'vehicle-make', typeLabelEn: 'Vehicle make' }),
  ],
  'm-nissan': [
    treeChild({ id: 'md-patrol', code: 'PATROL', labelEn: 'Patrol', labelAr: 'باترول', parentId: 'm-nissan', parentCode: 'NISSAN', parentLabelEn: 'Nissan', typeCode: 'vehicle-make', typeLabelEn: 'Vehicle make' }),
  ],
}

/** Reference-data (lookup) read + admin-write handlers. */
export const configHandlers = [
  // Legacy read endpoints (kept for other consumers).
  http.get('/api/v1/lookups', () => HttpResponse.json(mockLookupTypes)),
  http.get('/api/v1/lookups/:typeCode', ({ params }) =>
    HttpResponse.json(valuesByType[params.typeCode as string] ?? []),
  ),

  // Admin management surface.
  http.get('/api/v1/admin/lookups/types', () =>
    HttpResponse.json(mockLookupTypesWithCounts),
  ),
  http.post('/api/v1/admin/lookups/types', async ({ request }) => {
    const body = (await request.json()) as { code: string; labelEn: string; labelAr: string; isHierarchical?: boolean; parentTypeCode?: string }
    return HttpResponse.json(
      { id: `lt-${body.code}`, code: body.code, labelEn: body.labelEn, labelAr: body.labelAr, isHierarchical: body.isHierarchical ?? false, parentTypeId: body.parentTypeCode ? `lt-${body.parentTypeCode}` : null, parentTypeCode: body.parentTypeCode ?? null, parentTypeLabelEn: body.parentTypeCode ?? null },
      { status: 201 },
    )
  }),
  http.patch('/api/v1/admin/lookups/types/:id', async ({ request, params }) => {
    const body = (await request.json()) as { labelEn?: string; labelAr?: string; isHierarchical?: boolean; parentTypeCode?: string | null }
    return HttpResponse.json({
      id: params.id as string,
      code: 'edited',
      labelEn: body.labelEn ?? 'Edited',
      labelAr: body.labelAr ?? 'معدل',
      isHierarchical: body.isHierarchical ?? false,
      parentTypeId: body.parentTypeCode ? `lt-${body.parentTypeCode}` : null,
      parentTypeCode: body.parentTypeCode ?? null,
      parentTypeLabelEn: body.parentTypeCode ?? null,
    })
  }),
  http.get('/api/v1/admin/lookups/:typeCode/parent-options', ({ params }) => {
    const typeCode = params.typeCode as string
    if (typeCode === 'vehicle-model') {
      return HttpResponse.json([
        { code: 'TOYOTA', labelEn: 'Toyota', labelAr: 'تويوتا', typeCode: 'vehicle-make' },
        { code: 'NISSAN', labelEn: 'Nissan', labelAr: 'نيسان', typeCode: 'vehicle-make' },
      ])
    }
    if (typeCode === 'vehicle-make') {
      return HttpResponse.json([
        { code: 'TOYOTA', labelEn: 'Toyota', labelAr: 'تويوتا', typeCode: 'vehicle-make' },
        { code: 'NISSAN', labelEn: 'Nissan', labelAr: 'نيسان', typeCode: 'vehicle-make' },
      ])
    }
    return HttpResponse.json([])
  }),
  http.get('/api/v1/admin/lookups/:typeCode/export', ({ params }) => {
    const items = adminValuesByType[params.typeCode as string] ?? []
    return HttpResponse.json(
      items.map((v) => ({
        code: v.code,
        labelEn: v.labelEn,
        labelAr: v.labelAr,
        descriptionEn: v.descriptionEn,
        descriptionAr: v.descriptionAr,
        parentCode: v.parentCode,
        sortOrder: v.sortOrder,
        isActive: v.isActive,
        retiring: v.retiring,
        status: v.status,
      })),
    )
  }),
  http.post('/api/v1/admin/lookups/:typeCode/import', async ({ request }) => {
    const body = (await request.json()) as { rows: unknown[] }
    return HttpResponse.json({ created: body.rows.length, updated: 0, skipped: 0, errors: [] })
  }),
  http.get('/api/v1/admin/lookups/:typeCode/values', ({ params, request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const search = url.searchParams.get('search')?.toLowerCase()
    let items = adminValuesByType[params.typeCode as string] ?? []
    if (status) items = items.filter((v) => v.status === status)
    if (search)
      items = items.filter(
        (v) =>
          v.code.toLowerCase().includes(search) ||
          v.labelEn.toLowerCase().includes(search) ||
          v.labelAr.includes(search),
      )
    return HttpResponse.json({ items, total: items.length, page: 1, pageSize: 25 })
  }),
  // Cross-type children by the parent value's id — MUST precede the two-param
  // `:typeCode/:parentCode/children` route (which would otherwise match
  // `values/:valueId/children` with typeCode="values").
  http.get('/api/v1/admin/lookups/values/:valueId/children', ({ params }) =>
    HttpResponse.json(treeChildrenByValueId[params.valueId as string] ?? []),
  ),
  http.get('/api/v1/admin/lookups/:typeCode/:parentCode/children', ({ params }) =>
    HttpResponse.json(childrenByParent[params.parentCode as string] ?? []),
  ),
  http.post('/api/v1/admin/lookups/:typeCode/values', async ({ request }) => {
    const body = (await request.json()) as { code: string; labelEn: string; labelAr: string; sortOrder?: number }
    return HttpResponse.json(
      value({ id: `v-${body.code.toLowerCase()}`, code: body.code, labelEn: body.labelEn, labelAr: body.labelAr, sortOrder: body.sortOrder ?? 0 }),
      { status: 201 },
    )
  }),
  http.post('/api/v1/admin/lookups/values/:id/reorder', ({ params }) =>
    HttpResponse.json(value({ id: params.id as string, code: 'REORDERED', labelEn: 'Reordered', labelAr: 'معاد ترتيبه', sortOrder: 0 })),
  ),
  http.post('/api/v1/admin/lookups/values/:id/deactivate', () => new HttpResponse(null, { status: 204 })),
  http.post('/api/v1/admin/lookups/values/:id/activate', ({ params }) =>
    HttpResponse.json(value({ id: params.id as string, code: 'ACTIVATED', labelEn: 'Activated', labelAr: 'مفعّل', sortOrder: 0 })),
  ),
  http.patch('/api/v1/admin/lookups/values/:id', async ({ request, params }) => {
    const body = (await request.json()) as Partial<LookupValue>
    return HttpResponse.json(
      value({ id: params.id as string, code: 'EDITED', labelEn: body.labelEn ?? 'Edited', labelAr: body.labelAr ?? 'معدل', sortOrder: body.sortOrder ?? 0 }),
    )
  }),
]
