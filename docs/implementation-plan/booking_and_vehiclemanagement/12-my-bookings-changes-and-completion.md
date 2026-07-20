# Phase 12 (B4) — My Bookings, Modification, Extension, Cancellation and Completion

## Objective

Deliver the employee’s ongoing booking lifecycle after submission, including active-trip actions and complete historical evidence.

## Mandatory mockup gate — ask before implementation

Request: My Bookings Upcoming/Active/Past; active pinned card; detail drawer; consent/evidence; modify/re-consent; extend conflict/mediation; cancel; early return; no-show/late indicators; receipt/download; empty/loading/error/mobile/RTL.

## My Bookings access

Own bookings only for Employee. Fleet Manager views managed-scope bookings through operational screens, not by impersonating My Bookings. Tabs, paging, status, vehicle/plate/window/number and actions determined by state/capability.

| Status | Modify | Extend | Cancel | Early return | Notes |
| --- | --- | --- | --- | --- | --- |
| Draft | Yes | No | Yes | No | No active consent/workflow |
| PendingBeneficiaryAcceptance | Limited actor fields | No | Yes | No | Beneficiary may decline |
| PendingApproval | Material change only if workflow cancellable | Policy/conflict check | Per cutoff | No | Never mutate committed decision |
| Approved | Restricted; usually cancel/rebook | Conflict/approval | Per cutoff | No | Ready for handover |
| Active/InUse | No | Policy + next reservation | No | Yes | Handover owns completion |
| Terminal | No | No | No | No | History only |

## Modify/re-consent

Draft/Pending rules; server-derived materiality based on vehicle/driver/category/window tolerance; material change voids consent and current workflow atomically, returns to Draft and requires new consent+submit. Append-only old/new decision provenance.

Use `PendingReConsent` after an accepted material change until the driver signs. It cannot become Approved without new consent; timeout follows approved policy. If workflow cancellation races a committed decision, reject modification and preserve the original booking.

## Extension

Active booking only. Check next reservation and buffer; clear extension may auto-approve only if policy says so, otherwise expedited approval/Fleet Manager mediation. Conflict names actionable reason without leaking another user.

Conflict mediation creates `BookingExtensionConflict` work for the managing Fleet Manager with configurable SLA (proposed 4h; human approval required). Fleet Manager may reject, approve only after downstream conflict is explicitly resolved, or escalate. SLA expiry expires the extension request; original booking remains unchanged.

## Cancellation

State/time rules, reason, waitlist trigger, notifications, release reservation. After collection offer early return rather than cancellation.

## Early return/completion

Handover/return owns actual trip completion. Early return releases after buffer and notifies waitlist. Past detail shows consent and handover receipt.

## No-show/late return

Detect and append events; notify Fleet Manager/requester; feed later behavior scoring. No-show utilization is zero while reserved-wasted is tracked.

## Database/backend

User-scoped list/read APIs; append-only modification/cancel/extension/no-show/late events; provenance history; conflict-safe reservation updates; receipts/evidence references.

## Tests

Ownership isolation; every status/action matrix; material/nonmaterial modification; re-consent atomicity; extension collision; concurrent cancel/approve; early return; no-show/late; waitlist notification; EN/AR/keyboard/mobile.

Add modification-vs-approval race, PendingReConsent timeout/recovery, cancel during Active/handover blocked, extension mediation SLA and downstream-booking privacy.

## Rollback

Disable new action capability per command; preserve readable histories. Selector rollback affects future decisions only.

## Mandatory critique

Check ownership leakage, stale status actions, consent/workflow orphaning, recalculated historical values, conflict data leakage, duplicate release/notifications and inaccessible drawers.

## Exit gate

Employees can understand and act on every booking state with server-authorized commands and complete immutable evidence.
