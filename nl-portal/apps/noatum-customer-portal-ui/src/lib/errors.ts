import { AccessError } from '../features/auth/api/current-user';
import { StaffError } from '../features/staff/api/staff';

/**
 * Turns a failed request into the i18n key that explains it.
 *
 * This function existed seven times, byte for byte, one copy per screen — which
 * is what happens when there is nowhere shared to put it. It lives here rather
 * than under a feature because the staff screens need it as much as the
 * administration ones, and a page reaching across into another feature's folder
 * is how the next copy gets made.
 *
 * Keys resolve in the `staff` namespace: `denied`, `unavailable`, or whichever
 * `kind` the StaffError carries — `conflict` among them.
 */
export function errorKey(error: unknown): string {
  if (error instanceof StaffError) return error.kind;
  if (error instanceof AccessError) return 'denied';
  return 'unavailable';
}
