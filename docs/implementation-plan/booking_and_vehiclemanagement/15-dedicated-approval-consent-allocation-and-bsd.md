# Phase 15 (D2) — Dedicated Approval, Consent, Allocation, BSD and Return

## Objective

Complete the dedicated entitlement lifecycle from submitted request through approval, consent, scoped vehicle allocation, utilization review, BSD return and final expiry/return.

## Mandatory mockup gate — ask before implementation

Request: Line Manager/Fleet Lead/CEO evidence and decision screens; approval chain stepper; policy trace; modified-duration approval; consent sheet; Fleet Manager allocation vehicle picker; no-vehicle state; active entitlement detail; BSD leave return calendar; utilization review; expire/cancel/return; mobile/RTL.

## Approval workflow

`entitlement-approval-chain` pinned by version/scope/effective time. LM → Cluster Fleet Lead → Cluster CEO according to policy. Delegation/SoD/SLA/request change/decline. CEO sees policy threshold, justification, endorsements and cost evidence.

## Consent

Actual assigned driver signs versioned consent before allocation. With-driver requests may require beneficiary plus professional-driver acknowledgements as Legal decides. Modified request beyond tolerance re-consents.

## Allocation

Fleet Manager selects a live compliant vehicle authorized in scope and matching approved class. Vehicle cannot have conflicting active assignment/entitlement/booking/maintenance. Allocation and entitlement state, vehicle assignment, consent link, history, audit and outbox commit atomically. Dedicated vehicles are excluded from normal pool except active BSD windows.

Allocation transaction locks the vehicle row (`FOR UPDATE NOWAIT` or equivalent), rechecks organization/scope/compliance/assignment/booking/maintenance, and relies on an effective-range exclusion/unique constraint for active allocations. Two concurrent allocations cannot both commit. Dedicated allocation is exclusive for its effective range; overlapping pool bookings are not permitted except approved BSD pool windows.

## BSD leave return

HR leave-calendar or manual governed window; vehicle temporarily returns to pool for exact effective window, with availability/consent/accountability rules. Auto-revert on end; conflicts and early return handled. No permanent reassignment.

BSD state flow: `DedicatedActive -> BSDPoolScheduled -> BSDPoolActive -> DedicatedActive`. Window must be inside entitlement allocation range and BSD windows cannot overlap. During active BSD, normal pool booking rules apply and UI shows the dedicated return deadline. Early beneficiary return is blocked while another booking/handover is active; Fleet Manager mediates or adjusts future bookings. Scheduled work is idempotent and HCM leave privacy is minimized.

## Utilization review

Periodic actual-use/cost review, transparent evidence, continue/modify/return decision by authorized humans. AI may recommend later but never auto-revokes.

## Expiry/cancel/return/reassignment

Effective end, condition/key return, vehicle pool/next assignment, consent closure and history. Cancellation rules by lifecycle. Reassignment requires new eligibility/approval/consent as policy dictates.

Lifecycle continuation includes configurable expiry reminders, renewal request/approval, return, and reassignment. Renewal never silently extends; it creates a new approved effective window/version. Changing beneficiary or driver triggers eligibility and consent recheck. Expired entitlement cannot retain active exclusive allocation.

## Database/backend

Pinned workflow, approval tasks, immutable decisions, consent, allocation/exclusion, BSD windows, utilization review, scheduled work, history, constraints and APIs.

## Tests

All chains/thresholds/delegation/SoD; modified duration; consent; allocation conflict/concurrency; dedicated exclusion; BSD start/end/overlap; review; expiry/return; audit/outbox; UI/E2E/RTL.

Add concurrent double-allocation, BSD outside allocation, overlapping BSD, early-return conflict with pool booking, renewal no-silent-extension, beneficiary/driver reassignment and professional evidence expiry.

## Rollback

Selector rollback affects new routes only; in-flight workflows stay pinned. Disable allocation command if needed; committed entitlements remain readable and safely returnable.

## Mandatory critique

Check duplicate allocations, pool leakage, missing consent, approval/version drift, BSD timer races, leave privacy, professional-driver evidence, cost leakage and orphan vehicle state.

## Exit gate

Approved requests allocate exactly one eligible vehicle after consent, operate through BSD/review, and return/expire with complete evidence.
