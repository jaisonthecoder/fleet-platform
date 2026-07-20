import type { PlatformRole } from '../../../common/database/schema';

/** The kind of action being authorised (drives which SoD rules apply). */
export type SodActionType =
  | 'approve-booking'
  | 'approve-entitlement'
  | 'investigate-fine'
  | 'approve-operational';

/** Facts the guard needs to evaluate the 8 SoD rules (supplied by callers/DB). */
export interface SodContext {
  actionType: SodActionType;
  actorPersonId: string;
  /** Who raised the request being approved (SoD-01/02/06). */
  raisedByPersonId?: string;
  /** The delegator, when the actor is acting under delegation (SoD-06). */
  delegatorPersonId?: string;
  /** Roles the actor holds on the relevant scope (SoD-04/05). */
  actorRolesOnScope?: PlatformRole[];
  /** True if the actor assigned the vehicle to the booking under investigation (SoD-03). */
  actorAssignedVehicle?: boolean;
  /** True if a second authorised reviewer is present (clears SoD-03). */
  secondReviewerPresent?: boolean;
  /** True if the actor edited the record within the same change window (SoD-07). */
  actorEditedRecordInWindow?: boolean;
}

export interface SodViolation {
  rule: string;
  message: string;
}

/**
 * Evaluates the 8 structural Segregation-of-Duties rules and returns the first
 * violation, or `null` if the action is permitted. Pure function — the caller
 * supplies the facts (roles, delegation, edit windows) from the DB.
 */
export function evaluateSod(ctx: SodContext): SodViolation | null {
  const isApproval =
    ctx.actionType === 'approve-booking' ||
    ctx.actionType === 'approve-entitlement' ||
    ctx.actionType === 'approve-operational';

  // SoD-01: no one approves a booking they raised.
  if (
    ctx.actionType === 'approve-booking' &&
    ctx.raisedByPersonId &&
    ctx.actorPersonId === ctx.raisedByPersonId
  ) {
    return { rule: 'SoD-01', message: 'Cannot approve a booking you raised.' };
  }

  // SoD-02: no one approves an entitlement they raised.
  if (
    ctx.actionType === 'approve-entitlement' &&
    ctx.raisedByPersonId &&
    ctx.actorPersonId === ctx.raisedByPersonId
  ) {
    return {
      rule: 'SoD-02',
      message: 'Cannot approve an entitlement you raised.',
    };
  }

  // SoD-03: the fleet manager who assigned the vehicle is not the sole investigator.
  if (
    ctx.actionType === 'investigate-fine' &&
    ctx.actorAssignedVehicle &&
    !ctx.secondReviewerPresent
  ) {
    return {
      rule: 'SoD-03',
      message: 'A second authorised reviewer is required to investigate this fine.',
    };
  }

  // SoD-04: Finance and Fleet Manager never co-held on the same scope.
  const roles = ctx.actorRolesOnScope ?? [];
  if (roles.includes('Finance') && roles.includes('FleetManager')) {
    return {
      rule: 'SoD-04',
      message: 'Finance and Fleet Manager roles cannot be co-held on the same scope.',
    };
  }

  // SoD-05: System Admin cannot approve operational bookings/entitlements.
  if (isApproval && roles.includes('SystemAdmin')) {
    return {
      rule: 'SoD-05',
      message: 'System Admin cannot approve operational bookings or entitlements.',
    };
  }

  // SoD-06: a delegate cannot approve requests raised by themselves or the delegator.
  if (
    isApproval &&
    ctx.delegatorPersonId &&
    (ctx.actorPersonId === ctx.raisedByPersonId ||
      ctx.delegatorPersonId === ctx.raisedByPersonId)
  ) {
    return {
      rule: 'SoD-06',
      message: 'A delegate cannot approve requests raised by themselves or the delegator.',
    };
  }

  // SoD-07: a data steward cannot approve transactions on records they edited in the window.
  if (isApproval && ctx.actorEditedRecordInWindow) {
    return {
      rule: 'SoD-07',
      message: 'Cannot approve a transaction on a record you edited in the same change window.',
    };
  }

  return null;
}

/**
 * Structural SoD check applied at **role-assignment time** (1A₂ / LU-2): the
 * resulting set of roles a person would hold on a single scope must not create
 * a forbidden combination. Prevents building a self-approval / conflicted seat
 * by granting roles, rather than only catching it when an action is attempted.
 */
export function evaluateRoleAssignmentSod(
  rolesAfterOnScope: PlatformRole[],
): SodViolation | null {
  const roles = new Set(rolesAfterOnScope);

  // SoD-04: Finance and Fleet Manager cannot be co-held on the same scope.
  if (roles.has('Finance') && roles.has('FleetManager')) {
    return {
      rule: 'SoD-04',
      message: 'Finance and Fleet Manager roles cannot be co-held on the same scope.',
    };
  }

  // SoD-05: System Admin cannot also hold an operational approval role on a scope.
  if (roles.has('SystemAdmin') && (roles.has('Approver') || roles.has('FleetManager'))) {
    return {
      rule: 'SoD-05',
      message: 'System Admin cannot also hold an operational approval role on the same scope.',
    };
  }

  return null;
}
