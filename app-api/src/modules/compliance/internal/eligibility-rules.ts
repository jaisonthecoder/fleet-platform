/** Facts the eligibility gate evaluates (loaded from person + vehicle + blocks). */
export interface EligibilityInputs {
  today: Date;
  licenceExpiry: string | null;
  employmentStatus: string;
  mulkiyaExpiry: string | null;
  insuranceExpiry: string | null;
  vehicleLifecycle: string;
  bookingPoolFlag: boolean;
  hasActiveBlock: boolean;
  blockReason?: string | null;
}

/** Outcome of the structural hard-block checks (no override possible). */
export interface HardBlockResult {
  blocked: boolean;
  reasons: string[];
}

const isExpired = (dateStr: string | null, today: Date): boolean => {
  if (!dateStr) return false;
  // Date-only comparison (expiry is a DATE); expired strictly before today.
  const expiry = new Date(`${dateStr}T00:00:00Z`);
  const t = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return expiry < t;
};

/**
 * Structural hard-block checks — **no override path exists** (FR-COMP, the
 * non-negotiable). Pure: the caller supplies the facts. An expired
 * Mulkiya/insurance, an active platform block, an expired licence, an inactive
 * employee, or a non-bookable vehicle each blocks the booking.
 */
export function hardBlockCheck(i: EligibilityInputs): HardBlockResult {
  const reasons: string[] = [];
  if (isExpired(i.mulkiyaExpiry, i.today)) reasons.push('hard-block-registration-expired');
  if (isExpired(i.insuranceExpiry, i.today)) reasons.push('hard-block-insurance-expired');
  if (i.hasActiveBlock) reasons.push(`access-blocked:${i.blockReason ?? 'unknown'}`);
  if (isExpired(i.licenceExpiry, i.today)) reasons.push('licence-expired');
  if (i.employmentStatus !== 'Active') reasons.push('employment-inactive');
  if (i.vehicleLifecycle !== 'Active' || !i.bookingPoolFlag) reasons.push('vehicle-not-bookable');
  return { blocked: reasons.length > 0, reasons };
}
