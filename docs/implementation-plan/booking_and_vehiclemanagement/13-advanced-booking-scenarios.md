# Phase 13 (B5) — Waitlist, Recurring, Emergency, Cross-Node and Behaviour Scenarios

## Objective

Implement all advanced booking scenarios explicitly required by the full PRD while respecting Phase 1/Phase 2 release boundaries and unresolved policy decisions.

## Mandatory mockup gates — ask separately before each scenario

1. Waitlist enrollment/status/offer/expiry/re-consent.
2. Recurring series creator/calendar/occurrences/exceptions.
3. Emergency break-glass form, warning, post-hoc review.
4. Cross-node vehicle results/ownership approvals.
5. No-show/late-return evidence and Fleet Manager mediation.

Do not combine these into one generic dialog.

## Release boundaries

- Waitlist is Phase 1 MVP.
- Recurring and break-glass are full-PRD/Phase 2 unless sponsor explicitly promotes them.
- Cross-node is configuration/policy gated (D24).
- No-show/late event capture is foundational; behavior scoring automation is later.

## Waitlist

Scope/window/category/party facts, ordered fairness policy, eligibility recheck, cancellation/early-return trigger, time-boxed offer, consent recapture, accept/decline/expire and audit. Never auto-confirm without driver consent.

## Recurring series

Pattern/timezone/end/count, one approval as policy permits, occurrence generation, per-occurrence availability/eligibility, exceptions/cancel occurrence/series, policy/version semantics and DST/calendar boundaries.

## Emergency break-glass

Only designated roles/categories; consent remains mandatory; bypass approved normal route only; notify LM/Fleet Lead; mandatory post-hoc review by deadline; exception report; no compliance hard-block bypass.

## Cross-node

Policy allows source/target node pair and vehicle class; result shows owning scope; additional owning Fleet Lead approval; cost/accountability; return location; scope authorization; default deny until D24 approved.

## No-show/late return

Scheduled detection, grace policy, Fleet Manager confirmation where required, wasted reservation/utilization metrics, notifications and behavior-event append.

## Database/backend

Waitlist/offers; recurrence series/occurrences; emergency evidence/review timer; cross-node route/cost evidence; no-show/late events; scheduled work; idempotency/audit/outbox.

## Tests

Fairness/concurrency, offer races, re-consent, recurrence DST/overlap, emergency authorization/post-review, cross-node deny/approve, hard-block remains, no-show utilization, rollback and complete E2E per scenario.

## Rollback

Separate feature selector per scenario. Disable generation/offers safely; preserve existing accepted bookings/series/evidence and complete in-flight reviews.

## Mandatory critique

Run a separate critique after each scenario: fairness, consent, emergency abuse, cross-scope leakage, schedule explosion, timer races, behavior fairness/privacy and operational recovery.

## Exit gate

Each approved scenario is independently live, testable, auditable and rollbackable; unapproved decisions remain disabled rather than guessed.
