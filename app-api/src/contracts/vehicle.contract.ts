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
    leaseContractRef: z.string().optional(),
    mulkiyaNumber: z.string().optional(),
    mulkiyaExpiry: z.string().optional(),
    insuranceProvider: z.string().optional(),
    insurancePolicyNumber: z.string().optional(),
    insuranceExpiry: z.string().optional(),
    salikTag: z.string().optional(),
    darbTag: z.string().optional(),
    assignmentModel: vehicleAssignmentModelSchema.optional(),
    assignedDriverPersonId: z.string().uuid().optional(),
    homeNodeId: z.string().uuid().optional(),
  })
  .refine((v) => v.assignmentModel !== 'Dedicated' || Boolean(v.assignedDriverPersonId), {
    message: 'assignedDriverPersonId is required when assignmentModel is Dedicated',
    path: ['assignedDriverPersonId'],
  });
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
  salikTag: z.string().optional(),
  darbTag: z.string().optional(),
  operationalStatus: vehicleOperationalStatusSchema.nullable().optional(),
  bookingPoolFlag: z.boolean().optional(),
  assignedDriverPersonId: z.string().uuid().nullable().optional(),
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
  ownership: string;
  lifecycleStatus: string;
  operationalStatus: string | null;
  bookingPoolFlag: boolean;
  assignmentModel: string;
  assignedDriverPersonId: string | null;
  mulkiyaExpiry: string | null;
  insuranceExpiry: string | null;
}
