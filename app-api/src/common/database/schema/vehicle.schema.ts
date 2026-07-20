import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { fleet, orgId, timestamps } from './_shared';
import { hierarchyNode, person } from './platform.schema';

/** Seven lifecycle states — "where the vehicle is in its life" (FR-INV-02). */
export const vehicleLifecycleStatusEnum = pgEnum('fleet_vehicle_lifecycle_status', [
  'Active',
  'InUse',
  'UnderMaintenance',
  'OffHirePending',
  'Decommissioned',
  'Sold',
  'Transferred',
]);

/** Five operational dispositions — orthogonal to lifecycle, nullable (FR-INV-03). */
export const vehicleOperationalStatusEnum = pgEnum('fleet_vehicle_operational_status', [
  'Reserve',
  'Standby',
  'VIPOnly',
  'Quarantined',
  'TemporaryHold',
]);

export const vehicleOwnershipEnum = pgEnum('fleet_vehicle_ownership', ['Owned', 'Leased']);
export const vehicleAssignmentModelEnum = pgEnum('fleet_vehicle_assignment_model', [
  'Pool',
  'Dedicated',
]);
export const vehicleGpsStatusEnum = pgEnum('fleet_vehicle_gps_status', [
  'Installed',
  'NotInstalled',
  'Online',
  'Offline',
  'Faulty',
  'UnderReplacement',
]);

/**
 * The single governed group-wide vehicle master (C1, 6 field groups). Closed
 * behavioural sets (lifecycle/operational/ownership/gps) are enums; configurable
 * classifications (body type, use category, fuel type, make, model) are stored
 * as **lookup codes** validated against the lookup engine (ADR-009), never enums.
 */
export const vehicle = fleet.table(
  'vehicle',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    // Identity & classification
    plate: text('plate').notNull(),
    chassisVin: text('chassis_vin').notNull(),
    makeCode: text('make_code'),
    modelCode: text('model_code'),
    year: integer('year'),
    colour: text('colour'),
    bodyTypeCode: text('body_type_code').notNull(),
    useCategoryCode: text('use_category_code'),
    seatingCapacity: integer('seating_capacity'),
    fuelTypeCode: text('fuel_type_code'),
    fuelEfficiencyKmpl: numeric('fuel_efficiency_kmpl', { precision: 6, scale: 2 }),
    // Ownership & commercial
    ownership: vehicleOwnershipEnum('ownership').notNull().default('Owned'),
    purchaseOrLeaseStart: date('purchase_or_lease_start'),
    leaseEnd: date('lease_end'),
    purchaseCost: numeric('purchase_cost', { precision: 14, scale: 2 }),
    monthlyRental: numeric('monthly_rental', { precision: 14, scale: 2 }),
    currency: text('currency').notNull().default('AED'),
    vendorId: uuid('vendor_id'),
    leaseContractRef: text('lease_contract_ref'),
    depreciationRate: numeric('depreciation_rate', { precision: 6, scale: 3 }),
    // Compliance & documents
    mulkiyaNumber: text('mulkiya_number'),
    mulkiyaExpiry: date('mulkiya_expiry'),
    insuranceProvider: text('insurance_provider'),
    insurancePolicyNumber: text('insurance_policy_number'),
    insuranceExpiry: date('insurance_expiry'),
    insuranceCoverageType: text('insurance_coverage_type'),
    salikTag: text('salik_tag'),
    darbTag: text('darb_tag'),
    fuelCardNumber: text('fuel_card_number'),
    // Operational state
    lifecycleStatus: vehicleLifecycleStatusEnum('lifecycle_status').notNull().default('Active'),
    operationalStatus: vehicleOperationalStatusEnum('operational_status'),
    bookingPoolFlag: boolean('booking_pool_flag').notNull().default(true),
    lastConfirmedOdometer: numeric('last_confirmed_odometer', { precision: 12, scale: 1 }),
    nextMaintenanceDue: date('next_maintenance_due'),
    assignmentModel: vehicleAssignmentModelEnum('assignment_model').notNull().default('Pool'),
    assignedDriverPersonId: uuid('assigned_driver_person_id').references(() => person.id),
    // Telematics (optional in Phase 1)
    trackerVendor: text('tracker_vendor'),
    trackerSerial: text('tracker_serial'),
    sim: text('sim'),
    gpsStatus: vehicleGpsStatusEnum('gps_status').notNull().default('NotInstalled'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vehicle_plate_uq').on(t.organizationId, t.plate),
    uniqueIndex('vehicle_chassis_vin_uq').on(t.chassisVin),
    uniqueIndex('vehicle_salik_tag_uq').on(t.salikTag).where(sql`${t.salikTag} IS NOT NULL`),
    uniqueIndex('vehicle_darb_tag_uq').on(t.darbTag).where(sql`${t.darbTag} IS NOT NULL`),
    index('vehicle_booking_pool_idx').on(t.bookingPoolFlag),
    index('vehicle_mulkiya_expiry_idx').on(t.mulkiyaExpiry),
    index('vehicle_insurance_expiry_idx').on(t.insuranceExpiry),
    index('vehicle_assigned_driver_idx').on(t.assignedDriverPersonId),
  ],
);

/** Versioned, insert-only document vault pointer (Mulkiya, insurance, …). */
export const vehicleDocument = fleet.table(
  'vehicle_document',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    docTypeCode: text('doc_type_code').notNull(),
    issueDate: date('issue_date'),
    expiryDate: date('expiry_date'),
    blobRef: text('blob_ref'),
    version: integer('version').notNull().default(1),
    createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vehicle_document_vehicle_idx').on(t.vehicleId, t.docTypeCode, t.version)],
);

/** Append-only lifecycle/operational transition history (soft-state). */
export const vehicleLifecycleHistory = fleet.table(
  'vehicle_lifecycle_history',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    reason: text('reason'),
    actorRef: text('actor_ref'),
    atUtc: timestamp('at_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vehicle_lifecycle_history_vehicle_idx').on(t.vehicleId, t.atUtc)],
);

/** Inter-node transfer records (effective-dated reassignment audit). */
export const vehicleTransfer = fleet.table('vehicle_transfer', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: uuid('vehicle_id').notNull().references(() => vehicle.id),
  fromNodeId: uuid('from_node_id').references(() => hierarchyNode.id),
  toNodeId: uuid('to_node_id').notNull().references(() => hierarchyNode.id),
  effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
  createdAtUtc: timestamp('created_at_utc', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Effective-dated assignment of a vehicle to a hierarchy node (carried from
 * Phase 0). A `btree_gist` EXCLUDE constraint (added in hand-authored SQL)
 * prevents overlapping active assignments for the same vehicle.
 */
export const vehicleHierarchyAssignment = fleet.table(
  'vehicle_hierarchy_assignment',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    organizationId: orgId(),
    vehicleId: uuid('vehicle_id').notNull().references((): AnyPgColumn => vehicle.id),
    nodeId: uuid('node_id').notNull().references(() => hierarchyNode.id),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('vehicle_hierarchy_assignment_vehicle_idx').on(t.vehicleId),
    index('vehicle_hierarchy_assignment_node_idx').on(t.nodeId),
  ],
);
