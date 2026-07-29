import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acknowledgeAlert,
  addVehicleDocument,
  createVehicle,
  fetchDevices,
  fetchVehicleAlerts,
  fetchVehicleDevice,
  fetchVehicleDocuments,
  fetchVehicleHistory,
  fetchVehicleLive,
  fetchVehicles,
  fetchVehicleSummary,
  fetchVehicleTransfers,
  fetchVehicleTrips,
  pairDevice,
  registerDevice,
  transferVehicle,
  transitionVehicle,
  unpairDevice,
  updateVehicle,
  type AddVehicleDocumentInput,
  type CreateVehicleInput,
  type RegisterDeviceInput,
  type TransitionVehicleInput,
  type UpdateVehicleInput,
  type VehicleQuery,
} from '../vehicle.contract'

/** Loads the authenticated principal's hierarchy-scoped Vehicle registry. */
export function useVehicles(query: VehicleQuery = {}) {
  return useQuery({
    queryKey: ['vehicles', query],
    queryFn: () => fetchVehicles(query),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

/** Scoped registry summary counts for the metric tiles. */
export function useVehicleSummary() {
  return useQuery({
    queryKey: ['vehicle-summary'],
    queryFn: fetchVehicleSummary,
    staleTime: 30_000,
  })
}

/** Creates one governed vehicle and refreshes every Vehicle read model. */
export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateVehicleInput) => createVehicle(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] })
    },
  })
}

/** Loads the lifecycle/audit history for one vehicle. */
export function useVehicleHistory(id: string | null) {
  return useQuery({
    queryKey: ['vehicle-history', id],
    queryFn: () => fetchVehicleHistory(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  })
}

/**
 * Polls the latest telemetry snapshot for one vehicle while `enabled` (e.g. the
 * telematics tab is open). Each read is audited server-side, so we poll modestly.
 */
export function useVehicleLive(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-live', id],
    queryFn: () => fetchVehicleLive(id as string),
    enabled: enabled && Boolean(id),
    refetchInterval: enabled ? 30_000 : false,
    staleTime: 15_000,
  })
}

/** Patches a vehicle's mutable attributes and refreshes the registry + history. */
export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVehicleInput }) =>
      updateVehicle(id, input),
    onSuccess: async (_data, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-history', id] }),
      ])
    },
  })
}

/** Records a guarded lifecycle transition and refreshes the registry + history. */
export function useTransitionVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransitionVehicleInput }) =>
      transitionVehicle(id, input),
    onSuccess: async (_data, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-history', id] }),
      ])
    },
  })
}

/** The GPS device currently paired to a vehicle (Phase 2). */
export function useVehicleDevice(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-device', id],
    queryFn: () => fetchVehicleDevice(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  })
}

/** The device registry, for pairing pickers. */
export function useDevices() {
  return useQuery({ queryKey: ['devices'], queryFn: fetchDevices, staleTime: 30_000 })
}

function useDevicePairingRefresh() {
  const queryClient = useQueryClient()
  return (vehicleId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vehicle-device', vehicleId] }),
      queryClient.invalidateQueries({ queryKey: ['vehicle-live', vehicleId] }),
      queryClient.invalidateQueries({ queryKey: ['devices'] }),
      queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
    ])
}

/** Registers a new GPS device. */
export function useRegisterDevice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RegisterDeviceInput) => registerDevice(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
  })
}

/** Pairs a device to a vehicle (closes any prior active pairing server-side). */
export function usePairDevice() {
  const refresh = useDevicePairingRefresh()
  return useMutation({
    mutationFn: (input: { deviceId: string; vehicleId: string }) =>
      pairDevice(input),
    onSuccess: async (_data, { vehicleId }) => {
      await refresh(vehicleId)
    },
  })
}

/** Unpairs the device from a vehicle. */
export function useUnpairDevice() {
  const refresh = useDevicePairingRefresh()
  return useMutation({
    mutationFn: ({ deviceId }: { deviceId: string; vehicleId: string }) =>
      unpairDevice(deviceId),
    onSuccess: async (_data, { vehicleId }) => {
      await refresh(vehicleId)
    },
  })
}

/** Inter-node transfer history for a vehicle (Phase 3). */
export function useVehicleTransfers(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-transfers', id],
    queryFn: () => fetchVehicleTransfers(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  })
}

/** Transfers a vehicle to another hierarchy node and refreshes reads. */
export function useTransferVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: { toNodeId: string; reason?: string }
    }) => transferVehicle(id, input),
    onSuccess: async (_data, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
        queryClient.invalidateQueries({ queryKey: ['vehicle-transfers', id] }),
        queryClient.invalidateQueries({ queryKey: ['hierarchy'] }),
      ])
    },
  })
}

/** Document versions held for a vehicle (Phase 4). */
export function useVehicleDocuments(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-documents', id],
    queryFn: () => fetchVehicleDocuments(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  })
}

/** Adds the next version of a document and refreshes the vault + registry. */
export function useAddVehicleDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddVehicleDocumentInput }) =>
      addVehicleDocument(id, input),
    onSuccess: async (_data, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['vehicle-documents', id] }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      ])
    },
  })
}

/** Telematics alerts raised for a vehicle (Phase 5). */
export function useVehicleAlerts(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-alerts', id],
    queryFn: () => fetchVehicleAlerts(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  })
}

/** Recent derived trips for a vehicle (Phase 5). */
export function useVehicleTrips(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-trips', id],
    queryFn: () => fetchVehicleTrips(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  })
}

/** Acknowledges a telematics alert and refreshes the vehicle's alert list. */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId }: { alertId: string; vehicleId: string }) =>
      acknowledgeAlert(alertId),
    onSuccess: async (_data, { vehicleId }) => {
      await queryClient.invalidateQueries({
        queryKey: ['vehicle-alerts', vehicleId],
      })
    },
  })
}
