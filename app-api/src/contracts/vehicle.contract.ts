import { z } from 'zod';

export const vehicleOwnershipSchema = z.enum(['Owned', 'Leased']);
export const vehicleAssignmentModelSchema = z.enum(['Pool', 'Dedicated']);
export const vehicleLifecycleStatusSchema = z.enum([
  'Active',
  'InUse',
  'UnderMaintenance',
  'OffHirePending',
  'Decommissioned',
  'Sold',
  'Transferred',
]);
export const vehicleOperationalStatusSchema = z.enum([
  'Reserve',
  'Standby',
  'VIPOnly',
  'Quarantined',
  'TemporaryHold',
]);
export const vehicleGpsStatusSchema = z.enum([
  'Installed',
  'NotInstalled',
  'Online',
  'Offline',
  'Faulty',
  'UnderReplacement',
]);

/** Money as a string to avoid float drift (numeric(14,2) in the DB). */
const money = z.union([z.number(), z.string()]).transform((v) => String(v));

/** Create a vehicle. Classification codes are validated against the lookup engine. */
export const createVehicleSchema = z
  .object({
    plate: z.string().min(1),
    chassisVin: z.string().min(1),
    bodyTypeCode: z.string().min(1),
    makeCode: z.string().optional(),
    modelCode: z.string().optional(),
    year: z.number().int().optional(),
    colour: z.string().optional(),
    useCategoryCode: z.string().optional(),
    seatingCapacity: z.number().int().positive().optional(),
    fuelTypeCode: z.string().optional(),
    fuelEfficiencyKmpl: money.optional(),
    ownership: vehicleOwnershipSchema.optional(),
    purchaseOrLeaseStart: z.string().optional(),
    leaseEnd: z.string().optional(),
    purchaseCost: money.optional(),
    monthlyRental: money.optional(),
    currency: z.string().length(3).optional(),
    vendorId: z.string().uuid().optional(),
    leaseContractId: z.string().uuid().optional(),
    mulkiyaNumber: z.string().optional(),
    mulkiyaExpiry: z.string().optional(),
    insuranceProvider: z.string().optional(),
    insurancePolicyNumber: z.string().optional(),
    insuranceExpiry: z.string().optional(),
    fuelCardNumber: z.string().optional(),
    salikTag: z.string().optional(),
    darbTag: z.string().optional(),
    operationalStatus: vehicleOperationalStatusSchema.nullable().optional(),
    bookingPoolFlag: z.boolean().optional(),
    assignmentModel: vehicleAssignmentModelSchema.optional(),
    assignedDriverPersonId: z.string().uuid().optional(),
    trackerVendor: z.string().optional(),
    trackerSerial: z.string().optional(),
    gpsStatus: vehicleGpsStatusSchema.optional(),
    homeNodeId: z.string().uuid().optional(),
  })
  .refine(
    (v) =>
      v.assignmentModel !== 'Dedicated' || Boolean(v.assignedDriverPersonId),
    {
      message:
        'assignedDriverPersonId is required when assignmentModel is Dedicated',
      path: ['assignedDriverPersonId'],
    },
  )
  .refine(
    (v) => v.ownership !== 'Leased' || Boolean(v.vendorId && v.leaseContractId),
    {
      message: 'vendorId and leaseContractId are required for leased vehicles',
      path: ['vendorId'],
    },
  )
  .refine(
    (v) => v.ownership === 'Leased' || (!v.vendorId && !v.leaseContractId),
    {
      message:
        'vendorId and leaseContractId are only valid for leased vehicles',
      path: ['vendorId'],
    },
  );
export type CreateVehicle = z.infer<typeof createVehicleSchema>;

/** Patch a vehicle's mutable attributes (classification codes re-validated). */
export const updateVehicleSchema = z.object({
  colour: z.string().optional(),
  useCategoryCode: z.string().optional(),
  fuelTypeCode: z.string().optional(),
  mulkiyaNumber: z.string().optional(),
  mulkiyaExpiry: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insurancePolicyNumber: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  fuelCardNumber: z.string().optional(),
  salikTag: z.string().optional(),
  darbTag: z.string().optional(),
  operationalStatus: vehicleOperationalStatusSchema.nullable().optional(),
  bookingPoolFlag: z.boolean().optional(),
  assignedDriverPersonId: z.string().uuid().nullable().optional(),
  trackerVendor: z.string().optional(),
  trackerSerial: z.string().optional(),
  gpsStatus: vehicleGpsStatusSchema.optional(),
});
export type UpdateVehicle = z.infer<typeof updateVehicleSchema>;

/** Record a lifecycle transition. */
export const vehicleTransitionSchema = z.object({
  toStatus: vehicleLifecycleStatusSchema,
  reason: z.string().optional(),
});
export type VehicleTransition = z.infer<typeof vehicleTransitionSchema>;

/** Add a versioned document to the vault. */
export const addVehicleDocumentSchema = z.object({
  docTypeCode: z.string().min(1),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  blobRef: z.string().optional(),
});
export type AddVehicleDocument = z.infer<typeof addVehicleDocumentSchema>;

/** Transfer a vehicle to another hierarchy node. */
export const vehicleTransferSchema = z.object({
  toNodeId: z.string().uuid(),
  reason: z.string().optional(),
});
export type VehicleTransferInput = z.infer<typeof vehicleTransferSchema>;

/** Vehicle response projection. */
export interface VehicleDto {
  id: string;
  plate: string;
  chassisVin: string;
  bodyTypeCode: string;
  makeCode: string | null;
  modelCode: string | null;
  useCategoryCode: string | null;
  fuelTypeCode: string | null;
  fuelEfficiencyKmpl: string | null;
  ownership: string;
  purchaseOrLeaseStart: string | null;
  leaseEnd: string | null;
  purchaseCost: string | null;
  monthlyRental: string | null;
  currency: string;
  vendorId: string | null;
  leaseContractId: string | null;
  leaseContractRef: string | null;
  lifecycleStatus: string;
  operationalStatus: string | null;
  lastConfirmedOdometer: string | null;
  bookingPoolFlag: boolean;
  vendorHealthHold: boolean;
  vendorHealthHoldReason: string | null;
  assignmentModel: string;
  assignedDriverPersonId: string | null;
  fuelCardNumber: string | null;
  salikTag: string | null;
  darbTag: string | null;
  trackerVendor: string | null;
  trackerSerial: string | null;
  gpsStatus: string;
  mulkiyaNumber: string | null;
  mulkiyaExpiry: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiry: string | null;
  year: number | null;
  colour: string | null;
  seatingCapacity: number | null;
  sim: string | null;
  nextMaintenanceDue: string | null;
  insuranceCoverageType: string | null;
  depreciationRate: string | null;
  hierarchyNodeId: string | null;
  hierarchyNodeName: string | null;
  hierarchyNodeNameAr: string | null;
}
