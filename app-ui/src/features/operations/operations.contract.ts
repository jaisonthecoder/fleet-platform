import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

const attentionItemSchema = z.object({
  id: z.string(),
  level: z.enum(['danger', 'warning', 'info']),
  kind: z.enum(['compliance', 'access-block']),
  itemType: z.string().nullable(),
  subjectLabel: z.string().nullable(),
  status: z.enum(['ExpiringSoon', 'Expired']).nullable(),
  expiryDate: z.string().nullable(),
  count: z.number().int().nonnegative().nullable(),
})

const operationsOverviewSchema = z.object({
  scope: z.object({ id: z.string(), label: z.string() }),
  generatedAt: z.string().datetime(),
  summary: z.object({
    availableVehicles: z.number().int().nonnegative(),
    totalVehicles: z.number().int().nonnegative(),
    bookingsToday: z.number().int().nonnegative(),
    activeBookings: z.number().int().nonnegative(),
    attentionCount: z.number().int().nonnegative(),
    complianceAttentionCount: z.number().int().nonnegative(),
    utilizationPercent: z.number().min(0).max(100),
    utilizationChangePercent: z.number(),
  }),
  availability: z.object({
    available: z.number().int().nonnegative(),
    inUse: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  }),
  attentionItems: z.array(attentionItemSchema),
  upcomingBookings: z.array(z.object({
    id: z.string(),
    time: z.string(),
    route: z.string(),
    plate: z.string(),
    status: z.enum(['Ready', 'Hold', 'Pending']),
  })),
})

const entitlementInventorySchema = z.object({
  allocated: z.number().int().nonnegative(),
  pendingApproval: z.number().int().nonnegative(),
  awaitingConsent: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  bsdActive: z.number().int().nonnegative(),
  bsdConflict: z.number().int().nonnegative(),
  byCategory: z.array(z.object({
    justificationCategory: z.string(),
    count: z.number().int().nonnegative(),
  })),
})

const reconciliationReasonSchema = z.enum([
  'terminal-entitlement-active-allocation',
  'allocated-entitlement-missing-active-allocation',
  'dedicated-vehicle-pool-outside-active-bsd',
  'open-bsd-window-missing-active-allocation',
  'renewal-predecessor-invalid',
  'referenced-eligibility-preview-missing',
])

const reconciliationReportSchema = z.object({
  detectedAtUtc: z.string().datetime(),
  findingCount: z.number().int().nonnegative(),
  findings: z.array(z.object({
    reasonCode: reconciliationReasonSchema,
    entitlementRef: z.string(),
    vehicleRef: z.string().nullable(),
    relatedRef: z.string().nullable(),
    detectedAtUtc: z.string().datetime(),
    recommendedOwner: z.enum(['FleetOperations', 'PlatformSupport']),
  })),
  metrics: z.record(z.string(), z.number()),
  unavailableMetrics: z.array(z.string()),
})

export type OperationsOverview = z.infer<typeof operationsOverviewSchema>
export type EntitlementInventory = z.infer<typeof entitlementInventorySchema>
export type ReconciliationReport = z.infer<typeof reconciliationReportSchema>

/** Appends the selected hierarchy scope to a read-model URL. */
function withScope(path: string, scopeId: string | null): string {
  if (!scopeId) return path
  return `${path}?${new URLSearchParams({ scopeId }).toString()}`
}

/** Loads the live scope-aware operations overview. */
export async function getOperationsOverview(scopeId: string | null): Promise<OperationsOverview> {
  return operationsOverviewSchema.parse(
    await apiClient.get(withScope('/v1/operations/overview', scopeId)),
  )
}

/** Loads privacy-safe aggregate Dedicated lifecycle inventory. */
export async function getEntitlementInventory(scopeId: string | null): Promise<EntitlementInventory> {
  return entitlementInventorySchema.parse(
    await apiClient.get(withScope('/v1/dashboards/entitlement-inventory', scopeId)),
  )
}

/** Loads bounded read-only Dedicated reconciliation findings for audit/support roles. */
export async function getEntitlementReconciliation(): Promise<ReconciliationReport> {
  return reconciliationReportSchema.parse(
    await apiClient.get('/v1/entitlements/reconciliation?limit=200'),
  )
}
