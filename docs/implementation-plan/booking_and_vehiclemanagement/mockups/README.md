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
| S1 Vendor Master/onboarding | Approved content baseline; later phase | `01`, `04`-`08` | External integrations remain visible future options until adapters exist |
| S2 Lease contracts/reconciliation | Approved supplied screens; later phase | `02`-`03` | Derive missing detail/renewal/resolution only from S2 contracts |
| S3 Scorecard/off-hire | Approved supplied screens; later phase | `01`, `03` | Derive action workflow only from S3 contracts |
| V1 Vehicle onboarding | **Approved - first UI phase** | `10`-`14` | Import/migrate excluded; manual upload confirmation; OCR future |
| V2 Vehicle registry/detail | **Approved** | `09`, `15`-`20`, `vehicle-overview-tab.png` | Both quick view and full Overview required |
| V3-V4 Vehicle lifecycle/compliance | Approved supplied screens; missing flows authorized for phase-derived design | `17`-`20` plus referenced controls | Follow V3/V4 contracts; no invented actions |
| B1-B5 Pool Booking | Approved supplied screens; business-required missing flows authorized for derivation | `21`, `23`-`25` | Inline consent, confirmation and My Bookings follow B1-B5 contracts |
| D1-D2 Dedicated | Approved request plus complete business-derived lifecycle | `22` | D1-D2 eligibility, approval, consent, allocation and BSD required |
| H1 Handover/Return | Approved supplied screens plus business-derived Return flow | `26`-`28` | Complete reconciliation, receipt, lost-key and degraded states required |
| X1 Operations/Reports | Approved for phase-derived design when scheduled | None supplied | Follow X1 requirements and existing shell |

See [the consolidated review](mockup-review.md) for adopted design-system direction, phase boundaries and the recommended first approval statement.

See [approved derived screen contracts](derived-screen-contracts.md) for Booking consent/confirmation, My Bookings, Dedicated D1-D2, Handover Return/reconciliation, Vehicle Overview/quick-view behavior, external-integration fallback and map-provider rules.

Approval is recorded in [the consolidated review](mockup-review.md). Implementation remains phased; an approved visual baseline does not bypass backend, authorization, testing or independent critique gates.

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
