# 8.8 - Alert Ladders, Unused Rules, and Seed Reconciliation

## Objective

Eliminate ambiguous registered policies by implementing a named consumer, retiring the policy, or recording a dated approved exception; ensure every active consumer has approved organization-default seeds before fallback removal.

## Owners and dependencies

- Primary: Policy Product owner and Backend
- Contributors: Compliance scheduler, SRE, Data Steward, QA
- Depends on: 8.4-8.7

## Decisions

- `compliance-alert-ladders`: implement scheduled consumer with recipients/urgency/cadence or retire.
- `hard-block-conditions`: classify non-weakenable template/stricter-policy/retire after 8.4 authority decision.
- `driver-eligibility`: assign a distinct consumer or retire as duplicate/unused.
- Seed missing `consent-re-consent-tolerance` and `fuel-deviation-threshold` defaults only after business approval.

## Consumer requirements

Scheduled alert consumer uses idempotent scheduled work/outbox, effective dates and scope; replay/shadow cannot send notifications. Recipient descriptors resolve through organization roles/scopes at execution time while decision provenance is pinned.

## Seed governance

Seeds are immutable imported versions with owner, reason, source decision and regression tests. Never rely on runtime in-memory seed in production after cutover.

## Tests

Every active registry key has consumer and golden corpus; scheduler idempotency/cadence/recipient scope; missing/retired policy behavior; no hardcoded fallback grep; no production in-memory fixture resolution.

## Rollback

Disable new scheduler/consumer and restore prior active deployment where approved. Retired policy history remains immutable.

## Critique checklist

Look for active-but-unused rules, duplicate authority, seed values without approval, notification duplication and scheduler replay side effects.

## Exit gate

8.8 passes when every registered policy is consumed, retired or excepted; all active consumer defaults are approved/versioned; and production no longer depends on hidden in-memory fixtures.
