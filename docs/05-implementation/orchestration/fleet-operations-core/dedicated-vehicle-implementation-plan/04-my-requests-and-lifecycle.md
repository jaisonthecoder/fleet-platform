# DEDICATED-04 - My Requests and Entitlement Lifecycle

> **Status:** `VERIFIED_SUPPORTED_LIFECYCLE`

## Implemented - 2026-07-26

- Migration `0050` adds linked renewal lineage and immutable Entitlement events.
- Every DTO projects server-owned capabilities; React does not infer actions from statuses.
- Owner cancel is revision/idempotency bound and allowed only before active allocation. Pending workflows expire atomically on cancellation.
- Fleet return/expiry locks Entitlement, active allocation and Vehicle; closes allocation, writes chronology/audit/outbox, and restores Pool only when Vehicle lifecycle, Vendor health, registration and insurance remain valid.
- Renewal creates a linked fresh Draft and carries no eligibility preview, workflow, consent, preferred Vehicle, final Vehicle or allocation.
- My Requests exposes Continue/Modify/Submit/Consent/Cancel/Renew according to capabilities with EN/AR dialogs.
- Owner-safe event chronology omits actor identities and sensitive operational evidence.

Evidence: migration forward/idempotent; backend focused 30/30 plus Workflow/Entitlement 28/28 after cancellation repair; PostgreSQL 5/5 through return/restoration/events/renewal; frontend 9/9 and build; three critique rounds.

Renewal Drafts do not hold resources. Overlap is re-evaluated at eligibility/approval/allocation, and final Vehicle allocation remains protected structurally. Full future-effective person-entitlement overlap policy remains a product hardening item.

## Objective

Provide the owner-scoped Dedicated Vehicle record through Draft, approval, modification, consent, allocation, renewal, cancellation, return and expiry without inferring actions in the client.

## Entry Criteria

- DEDICATED-00 owner/scope/capability contract verified.
- DEDICATED-02 approval states stable.
- DEDICATED-03 allocation state and preference/variance projection stable.
- Product decides renewal/extension semantics and lifecycle cutoffs.

## Backend Work

1. Owner-scoped cursor-paged list and detail/events projections with server-derived capabilities and blocking reasons.
2. Status filters: Draft, PendingApproval, ModificationRequested, Approved, AwaitingConsent, Allocated and terminal states.
3. Draft/ModificationRequested edit with optimistic revision and durable idempotency.
4. Material edits invalidate eligibility, preferred Vehicle where needed, workflow/consent as governed, while preserving historical evidence.
5. Cancellation rules by state; allocated cancellation routes to governed return rather than orphaning assignment.
6. Renewal never silently extends. It creates a linked request/version and re-runs eligibility/approval/consent as policy requires.
7. Return/expiry atomically closes allocation, restores safe Vehicle state, records custody dependency and audit/outbox.
8. Requester, Fleet and approver views expose only role-appropriate evidence.

## Frontend Work

- Dedicated page tabs: `Request a vehicle` and `My requests`.
- List grouped by Action required, In progress, Active and History.
- Detail shows ask, class, original preference/note, eligibility, route/decisions, consent, allocated Vehicle, variance reason and effective dates.
- State-aware actions: Continue Draft, Respond to modification, Cancel, Request renewal and Return guidance.
- Explicitly distinguish `Preferred Vehicle` from `Allocated Vehicle`.

## Tests and Evidence

- Owner/non-owner/foreign-org list/detail authorization.
- Capability matrix for every lifecycle state and role composition.
- Revision races, edit/resubmit history, eligibility/consent invalidation and stable retry.
- Renewal creates a new linked request; expiry cannot retain active allocation.
- EN/AR/RTL, empty/error/offline, keyboard and responsive evidence.

## Three Critique Rounds

### Round 1 - Contract, Security and Data

Review owner/scope predicates, masking, capabilities, event chronology, renewal lineage and evidence immutability. Repair and rerun HTTP/contract tests.

### Round 2 - Behavior and Concurrency

Challenge modify/approve/cancel/return/expire races, stale revisions, renewal overlap and exactly-once side effects. Repair and rerun PostgreSQL/E2E evidence.

### Round 3 - UX and Operations

Review lifecycle comprehension, Action required prioritization, preference/allocation distinction, reason clarity, accessibility, RTL and support diagnostics. Repair and capture browser/build evidence.

## Exit Gate

An owner can track and act on every supported state using server capabilities; Fleet can govern return/expiry; history and original preference remain intact; no unresolved Blocking/High finding remains.
