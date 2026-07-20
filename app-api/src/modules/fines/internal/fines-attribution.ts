import type { AttributionBasis } from '../../../contracts/fine.contract';

/** An active substitution window fact for attribution. */
export interface SubstitutionWindowFact {
  substitutePersonId: string;
  start: Date;
  end: Date;
}

export interface AttributionInputs {
  eventTime: Date;
  substitutionWindows: SubstitutionWindowFact[];
  activeBookingDriverPersonId: string | null;
  assignedDriverPersonId: string | null;
}

export interface AttributionResult {
  personId: string | null;
  basis: AttributionBasis;
}

/**
 * Window coverage boundary (P1B-R2-7): **`[start, end)`** — inclusive start,
 * exclusive end. A fine exactly at `start` is inside the window; exactly at
 * `end` is not (it belongs to whatever follows).
 */
function covers(window: SubstitutionWindowFact, at: Date): boolean {
  return at.getTime() >= window.start.getTime() && at.getTime() < window.end.getTime();
}

/**
 * Determines who a fine/accident attributes to, and why (auditable basis):
 * 1. an active **substitution window** (among overlapping windows, the one with
 *    the latest start wins — the most recent authorised substitute);
 * 2. else the **booking-active driver** at the event time;
 * 3. else the vehicle's **assigned driver**;
 * 4. else **unattributed**.
 * Pure — the service supplies the facts, so the edges are exhaustively tested.
 */
export function attributeFine(input: AttributionInputs): AttributionResult {
  const covering = input.substitutionWindows.filter((w) => covers(w, input.eventTime));
  if (covering.length > 0) {
    const chosen = covering.reduce((a, b) => (b.start.getTime() >= a.start.getTime() ? b : a));
    return { personId: chosen.substitutePersonId, basis: 'substitution-window' };
  }
  if (input.activeBookingDriverPersonId) {
    return { personId: input.activeBookingDriverPersonId, basis: 'booking-active-driver' };
  }
  if (input.assignedDriverPersonId) {
    return { personId: input.assignedDriverPersonId, basis: 'assigned-driver' };
  }
  return { personId: null, basis: 'unattributed' };
}

/** Computes the black-point transfer deadline from the event time + PDP days. */
export function transferDeadline(eventTime: Date, days: number): Date {
  return new Date(eventTime.getTime() + Math.max(days, 0) * 24 * 60 * 60 * 1000);
}
