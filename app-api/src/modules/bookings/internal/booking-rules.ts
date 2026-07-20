import { BOOKING_REASON } from '../../../contracts/booking.contract';

/** A reservation window [start, end). */
export interface Window {
  start: Date;
  end: Date;
}

/** Vehicle classes the buffer / duration decision tables key on. */
export type VehicleClass = 'executive' | 'pool';

/**
 * Validates a requested pick-up/return window. Returns machine reason codes
 * (empty = valid). Pure — no I/O — so it is exhaustively unit-testable.
 */
export function validateWindow(pickup: Date, ret: Date, now: Date): string[] {
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(ret.getTime())) {
    return [BOOKING_REASON.windowInvalid];
  }
  const reasons: string[] = [];
  if (ret.getTime() <= pickup.getTime()) {
    reasons.push(BOOKING_REASON.windowInvalid);
  }
  if (pickup.getTime() < now.getTime()) {
    reasons.push(BOOKING_REASON.windowInPast);
  }
  return reasons;
}

/**
 * Expands the reservation window by the configurable buffer on the trailing
 * edge, so the next booking on the same vehicle cannot start until the buffer
 * (inspection / cleaning / refuelling / handover) has elapsed. Availability and
 * the commit both use this range, so it is the single overlap authority.
 */
export function applyBuffer(pickup: Date, ret: Date, bufferMinutes: number): Window {
  return {
    start: pickup,
    end: new Date(ret.getTime() + Math.max(bufferMinutes, 0) * 60_000),
  };
}

/** Whole-hours duration of the booked window (buffer excluded). */
export function durationHours(pickup: Date, ret: Date): number {
  return (ret.getTime() - pickup.getTime()) / 3_600_000;
}

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  'PendingApproval',
  'Approved',
  'Active',
]);

/** True when a status reserves the vehicle (participates in the exclusion). */
export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Maps a vehicle's use-category lookup code to its buffer/duration class. */
export function vehicleClassOf(
  useCategoryCode: string | null | undefined,
): VehicleClass | null {
  const code = useCategoryCode?.toUpperCase();
  if (code === 'EXECUTIVE' || code === 'VIP') return 'executive';
  if (code === 'POOL' || code === 'OPERATIONS' || code === 'DEDICATED') return 'pool';
  return null;
}

/**
 * Whether a modification stays within the re-consent tolerance (no re-consent
 * needed). A vehicle change always requires re-consent; a window change is
 * tolerated only if both edges move within `toleranceMinutes` (0 ⇒ any change
 * re-consents). Beyond tolerance, the signed consent is voided (Chapter 26 /
 * FR-BOOK-23).
 */
export function withinReConsentTolerance(
  original: { vehicleId: string; pickup: Date; ret: Date },
  next: { vehicleId: string; pickup: Date; ret: Date },
  toleranceMinutes: number,
): boolean {
  if (original.vehicleId !== next.vehicleId) {
    return false;
  }
  const tolerance = Math.max(toleranceMinutes, 0) * 60_000;
  return (
    Math.abs(original.pickup.getTime() - next.pickup.getTime()) <= tolerance &&
    Math.abs(original.ret.getTime() - next.ret.getTime()) <= tolerance
  );
}

/**
 * Generates a unique-ish human booking number `BK-<year>-<6 digits>`. The DB
 * `booking_number_uq` unique index is the true guarantee; on the rare collision
 * the insert raises 23505 and the caller retries.
 */
export function generateBookingNumber(now: Date = new Date(), rand: () => number = Math.random): string {
  const year = now.getUTCFullYear();
  const suffix = Math.floor(rand() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `BK-${year}-${suffix}`;
}

/**
 * Resolves an approval chain of role names to distinct approver person ids,
 * excluding the requester (SoD-01 — never approve your own booking). `resolve`
 * maps a role to a person id (or null when unresolved). Order is preserved.
 */
export function resolveApprovers(
  route: string[],
  requesterPersonId: string,
  resolve: (role: string) => string | null,
): string[] {
  const approvers: string[] = [];
  for (const role of route) {
    const personId = resolve(role);
    if (personId && personId !== requesterPersonId && !approvers.includes(personId)) {
      approvers.push(personId);
    }
  }
  return approvers;
}
