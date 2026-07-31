import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

export const vehicleSchema = z.object({
  id: z.string().uuid(),
  plate: z.string(),
  chassisVin: z.string(),
  bodyTypeCode: z.string(),
  makeCode: z.string().nullable(),
  modelCode: z.string().nullable(),
  useCategoryCode: z.string().nullable(),
  fuelTypeCode: z.string().nullable(),
  fuelEfficiencyKmpl: z.string().nullable(),
  ownership: z.string(),
  purchaseOrLeaseStart: z.string().nullable(),
  leaseEnd: z.string().nullable(),
  purchaseCost: z.string().nullable(),
  monthlyRental: z.string().nullable(),
  currency: z.string(),
  vendorId: z.string().uuid().nullable(),
  leaseContractId: z.string().uuid().nullable(),
  leaseContractRef: z.string().nullable(),
  lifecycleStatus: z.string(),
  operationalStatus: z.string().nullable(),
  lastConfirmedOdometer: z.string().nullable(),
  bookingPoolFlag: z.boolean(),
  vendorHealthHold: z.boolean().nullish(),
  vendorHealthHoldReason: z.string().nullish(),
  assignmentModel: z.string(),
  assignedDriverPersonId: z.string().nullable(),
  fuelCardNumber: z.string().nullable(),
  salikTag: z.string().nullable(),
  darbTag: z.string().nullable(),
  trackerVendor: z.string().nullable(),
  trackerSerial: z.string().nullable(),
  gpsStatus: z.string(),
  mulkiyaNumber: z.string().nullable(),
  mulkiyaExpiry: z.string().nullable(),
  insuranceProvider: z.string().nullable(),
  insurancePolicyNumber: z.string().nullable(),
  insuranceExpiry: z.string().nullable(),
  year: z.number().nullish(),
  colour: z.string().nullish(),
  seatingCapacity: z.number().nullish(),
  sim: z.string().nullish(),
  nextMaintenanceDue: z.string().nullish(),
  insuranceCoverageType: z.string().nullish(),
  depreciationRate: z.string().nullish(),
  hierarchyNodeId: z.string().uuid().nullable(),
  hierarchyNodeName: z.string().nullable(),
  hierarchyNodeNameAr: z.string().nullable(),
})

export type Vehicle = z.infer<typeof vehicleSchema>

export interface VehicleQuery {
  search?: string
  sort?: string
  page?: number
  pageSize?: number
}

export const vehiclePageSchema = z.object({
  items: z.array(vehicleSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})
export type VehiclePage = z.infer<typeof vehiclePageSchema>

function toVehicleQueryString(query: VehicleQuery): string {
  const params = new URLSearchParams()
  const search = query.search?.trim()
  if (search) params.set('search', search)
  if (query.sort) params.set('sort', query.sort)
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Returns a page of the principal's hierarchy-scoped Vehicle registry. */
export async function fetchVehicles(
  query: VehicleQuery = {},
): Promise<VehiclePage> {
  return vehiclePageSchema.parse(
    await apiClient.get(`/v1/vehicles${toVehicleQueryString(query)}`),
  )
}

/** Fetches a single hierarchy-scoped Vehicle by id (deep-link / click-through). */
export async function fetchVehicle(id: string): Promise<Vehicle> {
  return vehicleSchema.parse(await apiClient.get(`/v1/vehicles/${id}`))
}

/** Downloads the scoped registry as CSV text (honours search + sort). */
export async function fetchVehiclesCsv(query: VehicleQuery = {}): Promise<string> {
  const params = new URLSearchParams()
  const search = query.search?.trim()
  if (search) params.set('search', search)
  if (query.sort) params.set('sort', query.sort)
  const qs = params.toString()
  return apiClient.getText(`/v1/vehicles/export${qs ? `?${qs}` : ''}`)
}

export const vehicleSummarySchema = z.object({
  total: z.number(),
  active: z.number(),
  inUse: z.number(),
  maintenance: z.number(),
  blocked: z.number(),
})
export type VehicleSummary = z.infer<typeof vehicleSummarySchema>

/** Scoped registry counts for the summary tiles (full scope, not one page). */
export async function fetchVehicleSummary(): Promise<VehicleSummary> {
  return vehicleSummarySchema.parse(
    await apiClient.get('/v1/vehicles/summary'),
  )
}

export interface CreateVehicleInput {
  plate: string
  chassisVin: string
  bodyTypeCode: string
  makeCode?: string
  modelCode?: string
  year?: number
  useCategoryCode?: string
  seatingCapacity?: number
  fuelTypeCode?: string
  fuelEfficiencyKmpl?: string
  ownership?: 'Owned' | 'Leased'
  purchaseOrLeaseStart?: string
  leaseEnd?: string
  purchaseCost?: string
  monthlyRental?: string
  currency?: string
  vendorId?: string
  leaseContractId?: string
  mulkiyaNumber?: string
  mulkiyaExpiry?: string
  insuranceProvider?: string
  insurancePolicyNumber?: string
  insuranceExpiry?: string
  fuelCardNumber?: string
  salikTag?: string
  darbTag?: string
  operationalStatus?:
    'Reserve' | 'Standby' | 'VIPOnly' | 'Quarantined' | 'TemporaryHold' | null
  bookingPoolFlag?: boolean
  trackerVendor?: string
  trackerSerial?: string
  gpsStatus?:
    | 'Installed'
    | 'NotInstalled'
    | 'Online'
    | 'Offline'
    | 'Faulty'
    | 'UnderReplacement'
  homeNodeId?: string
}

export async function createVehicle(
  input: CreateVehicleInput,
): Promise<Vehicle> {
  return vehicleSchema.parse(await apiClient.post('/v1/vehicles', input))
}

/** The seven vehicle lifecycle states (mirrors the DB enum + server machine). */
export const VEHICLE_LIFECYCLE_STATUSES = [
  'Active',
  'InUse',
  'UnderMaintenance',
  'OffHirePending',
  'Decommissioned',
  'Sold',
  'Transferred',
] as const
export type VehicleLifecycleStatus = (typeof VEHICLE_LIFECYCLE_STATUSES)[number]

/**
 * Allowed lifecycle transitions — mirrors the server state machine (FR-INV-02)
 * so the UI only offers legal moves. Terminal states have no exits.
 */
export const ALLOWED_VEHICLE_TRANSITIONS: Record<
  VehicleLifecycleStatus,
  VehicleLifecycleStatus[]
> = {
  Active: [
    'InUse',
    'UnderMaintenance',
    'OffHirePending',
    'Transferred',
    'Decommissioned',
    'Sold',
  ],
  InUse: ['Active'],
  UnderMaintenance: ['Active'],
  OffHirePending: ['Transferred', 'Active'],
  Transferred: [],
  Decommissioned: [],
  Sold: [],
}

export const VEHICLE_OPERATIONAL_STATUSES = [
  'Reserve',
  'Standby',
  'VIPOnly',
  'Quarantined',
  'TemporaryHold',
] as const
export type VehicleOperationalStatus =
  (typeof VEHICLE_OPERATIONAL_STATUSES)[number]

export const VEHICLE_GPS_STATUSES = [
  'Installed',
  'NotInstalled',
  'Online',
  'Offline',
  'Faulty',
  'UnderReplacement',
] as const
export type VehicleGpsStatus = (typeof VEHICLE_GPS_STATUSES)[number]

/** Mutable attributes accepted by `PATCH /v1/vehicles/:id` (subset of create). */
export interface UpdateVehicleInput {
  colour?: string
  useCategoryCode?: string
  fuelTypeCode?: string
  mulkiyaNumber?: string
  mulkiyaExpiry?: string
  insuranceProvider?: string
  insurancePolicyNumber?: string
  insuranceExpiry?: string
  fuelCardNumber?: string
  salikTag?: string
  darbTag?: string
  operationalStatus?: VehicleOperationalStatus | null
  bookingPoolFlag?: boolean
  trackerVendor?: string
  trackerSerial?: string
  gpsStatus?: VehicleGpsStatus
  assignedDriverPersonId?: string | null
  year?: number
  seatingCapacity?: number
  nextMaintenanceDue?: string
  insuranceCoverageType?: string
}

/** Patches a vehicle's mutable attributes and returns the refreshed record. */
export async function updateVehicle(
  id: string,
  input: UpdateVehicleInput,
): Promise<Vehicle> {
  return vehicleSchema.parse(await apiClient.patch(`/v1/vehicles/${id}`, input))
}

export interface TransitionVehicleInput {
  toStatus: VehicleLifecycleStatus
  reason?: string
}

/** Records a guarded lifecycle transition and returns the refreshed record. */
export async function transitionVehicle(
  id: string,
  input: TransitionVehicleInput,
): Promise<Vehicle> {
  return vehicleSchema.parse(
    await apiClient.post(`/v1/vehicles/${id}/transition`, input),
  )
}

export const vehicleLifecycleHistorySchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  fromStatus: z.string().nullable(),
  toStatus: z.string(),
  reason: z.string().nullable(),
  actorRef: z.string().nullable(),
  atUtc: z.string(),
})

export type VehicleLifecycleHistory = z.infer<
  typeof vehicleLifecycleHistorySchema
>

/** Lifecycle/audit trail for one vehicle (newest first). */
export async function fetchVehicleHistory(
  id: string,
): Promise<VehicleLifecycleHistory[]> {
  return z
    .array(vehicleLifecycleHistorySchema)
    .parse(await apiClient.get(`/v1/vehicles/${id}/history`))
}

/** Latest telemetry snapshot for one vehicle (position, KM, fuel, health). */
export const vehicleLiveSchema = z.object({
  vehicleId: z.string(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  speed: z.number().nullable(),
  ignition: z.boolean().nullable(),
  odometer: z.number().nullable(),
  fuelLevel: z.number().nullable(),
  dtcCodes: z.array(z.string()).nullish(),
  at: z.string().nullable(),
  online: z.boolean(),
})

export type VehicleLive = z.infer<typeof vehicleLiveSchema>

/** Reads the latest telemetry snapshot (each read is audited server-side). */
export async function fetchVehicleLive(id: string): Promise<VehicleLive> {
  return vehicleLiveSchema.parse(
    await apiClient.get(`/v1/vehicles/${id}/telemetry/live`),
  )
}

// ── GPS devices & pairing (Phase 2) ─────────────────────────────────────────

export const deviceSchema = z.object({
  id: z.string().uuid(),
  identifier: z.string(),
  status: z.string(),
})
export type Device = z.infer<typeof deviceSchema>

export const vehicleDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  identifier: z.string(),
  model: z.string().nullable(),
  firmware: z.string().nullable(),
  sim: z.string().nullable(),
  status: z.string(),
  lastHealthAt: z.string().nullable(),
  pairedSince: z.string().nullable(),
})
export type VehicleDevice = z.infer<typeof vehicleDeviceSchema>

/** The GPS device currently paired to a vehicle, or null when unpaired. */
export async function fetchVehicleDevice(id: string): Promise<VehicleDevice | null> {
  const body = z
    .object({ device: vehicleDeviceSchema.nullable() })
    .parse(await apiClient.get(`/v1/vehicles/${id}/device`))
  return body.device
}

/** The device registry (for pairing pickers). */
export async function fetchDevices(): Promise<Device[]> {
  return z.array(deviceSchema).parse(await apiClient.get('/v1/devices'))
}

export interface RegisterDeviceInput {
  identifier: string
  model?: string
  firmware?: string
  sim?: string
}

export async function registerDevice(input: RegisterDeviceInput): Promise<Device> {
  return deviceSchema.parse(await apiClient.post('/v1/devices', input))
}

export async function pairDevice(input: {
  deviceId: string
  vehicleId: string
}): Promise<void> {
  await apiClient.post('/v1/devices/pair', input)
}

export async function unpairDevice(deviceId: string): Promise<void> {
  await apiClient.post(`/v1/devices/${deviceId}/unpair`)
}

// ── Transfer (hierarchy re-assignment, Phase 3) ─────────────────────────

export const vehicleTransferSchema = z.object({
  id: z.string().uuid(),
  fromNodeId: z.string().uuid().nullable(),
  toNodeId: z.string().uuid(),
  fromNodeName: z.string().nullable(),
  toNodeName: z.string().nullable(),
  reason: z.string().nullable(),
  effectiveDate: z.string(),
})
export type VehicleTransfer = z.infer<typeof vehicleTransferSchema>

/** Transfer history (newest first). */
export async function fetchVehicleTransfers(
  id: string,
): Promise<VehicleTransfer[]> {
  return z
    .array(vehicleTransferSchema)
    .parse(await apiClient.get(`/v1/vehicles/${id}/transfers`))
}

/** Transfers a vehicle to another hierarchy node. */
export async function transferVehicle(
  id: string,
  input: { toNodeId: string; reason?: string },
): Promise<void> {
  await apiClient.post(`/v1/vehicles/${id}/transfer`, input)
}

// ── Document vault (Phase 4) ───────────────────────────────────

export const vehicleDocumentSchema = z.object({
  id: z.string().uuid(),
  docTypeCode: z.string(),
  issueDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  blobRef: z.string().nullable(),
  version: z.number(),
  createdAtUtc: z.string(),
})
export type VehicleDocument = z.infer<typeof vehicleDocumentSchema>

/** All document versions for a vehicle. */
export async function fetchVehicleDocuments(
  id: string,
): Promise<VehicleDocument[]> {
  return z
    .array(vehicleDocumentSchema)
    .parse(await apiClient.get(`/v1/vehicles/${id}/documents`))
}

export interface AddVehicleDocumentInput {
  docTypeCode: string
  issueDate?: string
  expiryDate?: string
  blobRef?: string
}

/** Adds the next version of a document to the vault. */
export async function addVehicleDocument(
  id: string,
  input: AddVehicleDocumentInput,
): Promise<VehicleDocument> {
  return vehicleDocumentSchema.parse(
    await apiClient.post(`/v1/vehicles/${id}/documents`, input),
  )
}

// ── Alerts & trips (Phase 5) ───────────────────────────────────

export const vehicleAlertSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid().nullable(),
  deviceId: z.string().uuid().nullable(),
  alertType: z.string(),
  detail: z.string().nullable(),
  raisedAt: z.string(),
  acknowledgedAt: z.string().nullable(),
})
export type VehicleAlert = z.infer<typeof vehicleAlertSchema>

export const vehicleTripSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  deviceId: z.string().uuid().nullable(),
  bookingId: z.string().uuid().nullable(),
  driverPersonId: z.string().uuid().nullable(),
  attributionBasis: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  distanceKm: z.string().nullable(),
  startOdometer: z.string().nullable(),
  endOdometer: z.string().nullable(),
})
export type VehicleTrip = z.infer<typeof vehicleTripSchema>

/** Telematics alerts raised for a vehicle (newest first). */
export async function fetchVehicleAlerts(id: string): Promise<VehicleAlert[]> {
  return z
    .array(vehicleAlertSchema)
    .parse(await apiClient.get(`/v1/vehicles/${id}/alerts`))
}

/** Recent derived trips for a vehicle (newest first). */
export async function fetchVehicleTrips(id: string): Promise<VehicleTrip[]> {
  return z
    .array(vehicleTripSchema)
    .parse(await apiClient.get(`/v1/vehicles/${id}/trips`))
}

/** Acknowledges a telematics alert. */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  await apiClient.post(`/v1/telematics/alerts/${alertId}/ack`)
}
