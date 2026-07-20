# Phase Mockup Intake Register

Do not overwrite supplied mockups. Store or link each approved set under a phase folder:

- `V1-onboarding-import/`
- `V2-registry-detail/`
- `V3-lifecycle-transfer-maintenance/`
- `V4-documents-compliance-telematics-custody/`
- `B1-booking-foundation-actors/`
- `B2-availability-consent-confirmed/`
- `B3-approval-fleet-operations/`
- `B4-my-bookings-changes/`
- `B5-waitlist/`, `B5-recurring/`, `B5-emergency/`, `B5-cross-node/`, `B5-no-show/`
- `D1-dedicated-request-eligibility/`
- `D2-dedicated-decision-allocation-bsd/`
- `H1-handover-return/`
- `X1-operations-reports/`
- `S1-vendor-master-onboarding/`
- `S2-lease-contracts-reconciliation/`
- `S3-scorecards-off-hire/`

Each folder should contain `mockup-review.md` recording:

- Source/version/date and supplied files/links.
- Actors, routes and viewport/state coverage.
- Business-requirement matches.
- Conflicts or missing states.
- Adopt/adapt/reject/defer decisions with owner.
- EN/AR/RTL and accessibility notes.
- Approved implementation boundaries.
- Explicit line: `User approval: Mockups approved — proceed`, date/time and conversation/reference.
- Design-system components required/available/missing and deviation decisions.
- Required EN/AR and 320/768/1024/1440 viewport evidence.

No UI phase starts until its review exists and is confirmed by the user.

## Approval status register

| Phase set | Status | Supplied evidence | Missing before implementation |
| --- | --- | --- | --- |
| S1 Vendor Master/onboarding | Supplied, review pending | Current `Carpool-Theme-2-*` vendor master and onboarding images | Empty/error/manual/Fusion mismatch/approval/rejection/AR/mobile; rename into phase folder |
| S2 Lease contracts/reconciliation | Supplied, review pending | Current lease-contract and discrepancy images | Create/edit/detail/renewal/version/variance resolution/AR/mobile |
| S3 Scorecard/off-hire | Supplied, review pending | Current scorecard/off-hire progress images | Initiate/condition/penalty/ack/dispute/complete/AR/mobile |
| V1–V4 Vehicle Management | Partially supplied, review pending | Current onboarding/list/detail images | Exact phase split, remaining states, AR/mobile |
| B1–B5 Pool Booking | Partially supplied, review pending | Current booking image | Wizard states, on-behalf, consent, approval, My Bookings, advanced states, AR/mobile |
| D1–D2 Dedicated | Partially supplied, review pending | Current dedicated request image | Eligibility results, approval, consent, allocation, BSD/lifecycle, AR/mobile |
| H1 Handover/Return | Pending | None classified | Full phase mockup set |
| X1 Operations/Reports | Pending | None classified | Full phase mockup set |

`Supplied` is not `Approved`. Before implementation, move/copy links into the named phase folder, create review, resolve critical gaps and obtain user approval.

## Mockup review template

```markdown
# Mockup Review — <phase>

- Status: Pending | Supplied | Approved | Rejected | Superseded
- Source files/links and version/date:
- User approval reference/date: Pending
- Actors/routes:
- Viewports/languages/states supplied:
- Requirement matches:
- Missing/error/degraded states:
- Security/scope/SoD observations:
- Accessibility/RTL/component mapping:
- Adopt/adapt/reject/defer decisions:
- Open blockers and owners:
- Approved boundary:
```
