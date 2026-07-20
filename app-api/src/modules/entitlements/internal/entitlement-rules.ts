import { ENTITLEMENT_REASON } from '../../../contracts/entitlement.contract';

/** Validates the requested entitlement duration (end on/after start). Pure. */
export function validateDateWindow(start: string, end: string): string[] {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e.getTime() < s.getTime()) {
    return [ENTITLEMENT_REASON.windowInvalid];
  }
  return [];
}

/**
 * Resolves an approval chain of role names to distinct approver person ids,
 * excluding the requester (SoD-02 — never approve your own entitlement).
 * `resolve` maps a role to a person id (or null). Order is preserved.
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

/** Whether the requester has a grade the PDP can judge (fixture proxy until D8). */
export function gradeEligibleFact(grade: string | null | undefined): boolean {
  return typeof grade === 'string' && grade.trim().length > 0;
}
