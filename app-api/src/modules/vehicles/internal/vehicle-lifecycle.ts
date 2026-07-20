/** The seven vehicle lifecycle states (mirrors the DB enum). */
export type VehicleLifecycleStatus =
  | 'Active'
  | 'InUse'
  | 'UnderMaintenance'
  | 'OffHirePending'
  | 'Decommissioned'
  | 'Sold'
  | 'Transferred';

/** Allowed lifecycle transitions (FR-INV-02). Terminal states have no exits. */
const ALLOWED_TRANSITIONS: Record<VehicleLifecycleStatus, VehicleLifecycleStatus[]> = {
  Active: ['InUse', 'UnderMaintenance', 'OffHirePending', 'Transferred', 'Decommissioned', 'Sold'],
  InUse: ['Active'],
  UnderMaintenance: ['Active'],
  OffHirePending: ['Transferred', 'Active'],
  Transferred: [],
  Decommissioned: [],
  Sold: [],
};

/** Lifecycle states in which a vehicle can be booked (still gated by pool flag + compliance). */
export const BOOKABLE_LIFECYCLE: VehicleLifecycleStatus = 'Active';

/** Returns true if a lifecycle transition is permitted. */
export function canTransition(
  from: VehicleLifecycleStatus,
  to: VehicleLifecycleStatus,
): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Throws a machine-readable reason string if a transition is not permitted. */
export function assertTransition(
  from: VehicleLifecycleStatus,
  to: VehicleLifecycleStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`vehicle-transition-invalid:${from}->${to}`);
  }
}
