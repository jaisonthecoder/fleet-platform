import { ConflictException } from '@nestjs/common';

import { QUOTE_STATUSES, type CustomerQuoteBadge, type QuoteStatus } from '../../contracts';

/**
 * The quote lifecycle, in one place.
 *
 * Written as data rather than as `if` statements scattered through the service, because
 * the only way to be sure a customer cannot accept a quote nobody has priced is to be able
 * to read the whole machine at once.
 *
 * The five live staff states are the five stages the pricing screen's stepper shows, in the
 * same words: requested, claimed, priced, approved, published. Where the API and the screen
 * disagree on a word they will eventually disagree on a meaning.
 *
 * DEPRECATED, and never a valid TARGET of any transition:
 *  - `submitted`, `quoted`, `pending_sync` - superseded by `requested`, `published` and
 *    `priced` respectively in C3. Rows migrated; the values survive because an enum value
 *    cannot be dropped in place.
 *  - `rated`, `rate_failed` - the instant-rate path, which has no configured source and, on
 *    director-level evidence of 17.09.2026, no prospect of one. Kept because
 *    `quotations.instant_rate` still has to mean something if it is ever switched on.
 *
 * They keep OUTBOUND transitions so a row that somehow still holds one is not stuck.
 */
export const QUOTE_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  draft: ['requested', 'withdrawn'],
  // Straight to `priced` is the implicit claim: `price()` writes `claimedById` and the
  // status in one statement, so "one click, not two" is a single atomic act rather than
  // two moves. Ownership is still recorded - it is not a way to price anonymously.
  requested: ['claimed', 'priced', 'withdrawn', 'expired'],
  // Back to `requested` is a release: the claim is dropped and it returns to the queue.
  claimed: ['priced', 'requested', 'withdrawn', 'expired'],
  // `priced` -> `published` is allowed directly. Whether it is ALLOWED for a given quote
  // depends on the `quotations.approval` setting and the threshold, which this table cannot
  // see - it is a per-quote value, not a per-status rule, so the service enforces it.
  // `priced` -> `priced` is editing the options before anyone has seen them.
  priced: ['approved', 'published', 'claimed', 'priced', 'withdrawn', 'expired'],
  // Back to `priced` is a send-back with a mandatory reason. An approved quote that was
  // never published can still run out of validity - approval does not stop the clock.
  approved: ['published', 'priced', 'withdrawn', 'expired'],
  // Back to `claimed` is a release after pricing. Straight to `priced` is a re-price,
  // which `price()` performs in one transaction and which bumps the customer-visible
  // version - an intermediate write to `claimed` would be a phantom state nobody is in.
  published: ['accepted', 'rejected', 'expired', 'claimed', 'priced'],
  accepted: [],
  rejected: [],
  expired: [],
  withdrawn: [],

  // Deprecated. Outbound only - nothing may move INTO these.
  submitted: ['claimed', 'withdrawn', 'expired'],
  quoted: ['accepted', 'rejected', 'expired', 'claimed'],
  pending_sync: ['published', 'claimed'],
  rated: ['accepted', 'rejected', 'expired', 'claimed'],
  rate_failed: ['requested', 'withdrawn'],
} as const;

/**
 * Values no quote may move INTO. This is what actually retires an enum value: the
 * database still accepts it, and the machine refuses to put anything there.
 */
export const RETIRED_QUOTE_STATUSES: readonly QuoteStatus[] = [
  'submitted',
  'quoted',
  'pending_sync',
  'rated',
  'rate_failed',
];

/** Terminal states carry a commercial outcome and are never edited afterwards. */
export const TERMINAL_QUOTE_STATUSES: readonly QuoteStatus[] = [
  'accepted',
  'rejected',
  'expired',
  'withdrawn',
];

/**
 * What the customer's quote list shows. Three internal states collapse into one badge,
 * and that collapse IS the confidentiality control: a customer cannot tell a priced but
 * unpublished quote from an unclaimed one, so a half-finished price cannot leak through
 * a status label.
 */
export const CUSTOMER_QUOTE_BADGE: Readonly<Record<QuoteStatus, CustomerQuoteBadge>> = {
  draft: 'draft',
  requested: 'requested',
  claimed: 'in_progress',
  priced: 'in_progress',
  approved: 'in_progress',
  published: 'quoted',
  accepted: 'accepted',
  rejected: 'rejected',
  expired: 'expired',
  withdrawn: 'withdrawn',

  submitted: 'requested',
  quoted: 'quoted',
  pending_sync: 'in_progress',
  rated: 'quoted',
  rate_failed: 'requested',
} as const;

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  if (RETIRED_QUOTE_STATUSES.includes(to)) {
    return false;
  }

  return QUOTE_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: QuoteStatus): boolean {
  return TERMINAL_QUOTE_STATUSES.includes(status);
}

export function allowedTransitions(from: QuoteStatus): readonly QuoteStatus[] {
  return QUOTE_TRANSITIONS[from];
}

/**
 * Thrown rather than returned so a caller cannot forget to check. The message names both
 * states because "invalid status" in a support ticket is worth nothing.
 *
 * A `ConflictException`, not a bare Error: every call site checks the status first, so
 * this only fires on a genuine race - and a race is precisely when the person should be
 * told "this changed, look again" rather than shown an error page.
 */
export class QuoteTransitionError extends ConflictException {
  readonly from: QuoteStatus;
  readonly to: QuoteStatus;

  constructor(from: QuoteStatus, to: QuoteStatus) {
    super({
      message: `A quote cannot move from ${from} to ${to}.`,
      details: { code: 'QUOTE_TRANSITION_NOT_ALLOWED', from, to },
    });
    this.from = from;
    this.to = to;
  }
}

export function assertTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!canTransition(from, to)) {
    throw new QuoteTransitionError(from, to);
  }
}

/** Guards against an enum value being added to the database and forgotten here. */
export function assertEveryStatusMapped(): void {
  const missing = QUOTE_STATUSES.filter((status) => !(status in QUOTE_TRANSITIONS));

  if (missing.length > 0) {
    throw new Error(`Quote statuses with no transition rule: ${missing.join(', ')}.`);
  }
}
