import type { CustomerStatus } from '@prisma/client';

/**
 * The customer lifecycle, as one table nobody has to reverse-engineer from
 * service code. Design: docs/design/13-Customer-Onboarding-Flow-Design.md §4.
 *
 *   draft ──▶ onboarding ──▶ active ──▶ suspended ──▶ active
 *     │            │            │            │
 *     └── discard  └── discard  └──────────▶ closed ◀┘
 */
export const CUSTOMER_TRANSITIONS: Readonly<Record<CustomerStatus, readonly CustomerStatus[]>> = {
  draft: ['onboarding', 'active'],
  onboarding: ['active', 'draft'],
  active: ['suspended', 'closed'],
  suspended: ['active', 'closed'],
  closed: [],
};

/** Statuses whose customers may see any data at all. */
export const LIVE_CUSTOMER_STATUSES: readonly CustomerStatus[] = ['active'];

/** Statuses that may still be deleted outright rather than closed. */
export const DISCARDABLE_CUSTOMER_STATUSES: readonly CustomerStatus[] = ['draft', 'onboarding'];

export function canTransition(from: CustomerStatus, to: CustomerStatus): boolean {
  return CUSTOMER_TRANSITIONS[from].includes(to);
}

export interface GoLiveReadiness {
  ready: boolean;
  /** Human-readable, already ordered for display. Empty when ready. */
  missing: string[];
}

export interface GoLiveFacts {
  linkedOrganisations: number;
  invitedAdministrators: number;
  acceptedAdministrators: number;
  hasServicingBranch: boolean;
}

/**
 * CO-D01, decided 13.09.2026: going live is blocked, not merely warned.
 *
 * Blocked on the three things that make the portal unusable, all of which Noatum
 * controls. Deliberately NOT blocked on the invitation being accepted: that is
 * the customer's action, and waiting on it would park a customer half-finished
 * for reasons nobody here can fix.
 *
 * The servicing branch joined this list once it was clear what its absence does.
 * The pricing queue finds a quote through the account's servicing branch, or the
 * customer's default when the request names no account - so a customer with
 * neither can submit a request, be told we have it, and have it appear in no
 * queue at all. The checklist already listed it; only the gate did not.
 */
export function goLiveReadiness(facts: GoLiveFacts): GoLiveReadiness {
  const missing: string[] = [];
  if (facts.linkedOrganisations < 1) missing.push('at least one linked organisation');
  if (facts.invitedAdministrators < 1) missing.push('an invited administrator');
  if (!facts.hasServicingBranch) missing.push('a default servicing office');
  return { ready: missing.length === 0, missing };
}
