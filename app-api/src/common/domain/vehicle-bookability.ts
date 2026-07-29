/** The only lifecycle state eligible for booking-pool use. */
export const BOOKABLE_VEHICLE_LIFECYCLE = 'Active';

/** Returns whether persisted Vehicle state permits booking-pool use. */
export function isVehicleBookable(
  lifecycleStatus: string,
  bookingPoolFlag: boolean,
): boolean {
  return (
    lifecycleStatus === BOOKABLE_VEHICLE_LIFECYCLE && bookingPoolFlag === true
  );
}