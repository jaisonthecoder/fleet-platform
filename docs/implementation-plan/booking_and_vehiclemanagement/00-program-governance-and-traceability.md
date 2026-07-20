# Phase 0 — Program Governance, Business Traceability and Mockup Control

## Objective

Freeze the complete Vehicle Management, Pool Booking and Dedicated Entitlement scope before implementation, and ensure each screen is designed from approved mockups plus business requirements rather than from code or assumptions.

## Owners and dependencies

- Business: Group Fleet, Pool Fleet Manager, HR, Procurement, Finance, Legal, HSE, Data Steward
- Delivery: Product, Architecture, UX, DB, Backend, Frontend, QA, Security, SRE
- Depends on: none
- Gate authority: Product Owner plus relevant business owner for each journey

## Required source register

- `docs/startup-doccs/01_PROJECT_SUMMARY.md`
- `02_Fleet_Management_Platform_PRD_v3.0.md`
- `03_Phase1_MVP_PRD_ADPorts.md`
- `04_Phase2_Scale_Automate_ADPorts.md`
- `05_Phase3_Intelligence_International_ADPorts.md`
- `06_UX_Design_System_v2.md`
- `07_Page_Functional_Specifications.md`
- `08_Development_Approach_and_Implementation_Plan.md`
- Approved mockups stored under `mockups/<phase-id>/` or linked with immutable reference/version

## Business scenarios inventory

### Vehicle Management

Owned, leased, transfer-in and lease-replacement onboarding; bulk migration; identity/classification; hierarchy/location; lifecycle; booking-pool inclusion; assigned/dedicated driver; ownership/lease/vendor; documents; compliance; maintenance; off-hire/sold/decommissioned; telematics/device/GPS; key custody; inter-node transfer; history; completeness; scoped list/detail; import exceptions.

### Pool Booking

Employee self-booking; Fleet Manager booking on behalf of another active person within managed scope; separate requester/driver; professional/substitute driver; availability/buffer/category/passenger suitability; eligibility hard block; consent before number; approval/delegation/SoD; modify/re-consent; extension; cancel; early return; waitlist; recurring series; emergency break-glass; cross-node booking; no-show/late return; handover/return; notifications; My Bookings; audit/provenance.

### Dedicated Entitlement

Self/on-behalf request; long-term/temporary; with-driver/without-driver; professional driver; duration/location/cost centre/justification/evidence; eligibility by grade/role/cluster; line-manager/fleet-lead/CEO routing; consent before allocation; vehicle allocation; dedicated exclusion from pool; BSD leave return window; temporary pool availability; reassignment; periodic utilization review; expiry/cancel/return.

## Mockup intake gate for every UI phase

Before implementation ask the user for:

1. Desktop happy-path screens.
2. Mobile/tablet layout where relevant.
3. Empty/loading/error/blocked/permission-denied states.
4. Create/edit/detail/history/confirmation dialogs or drawers.
5. EN and AR/RTL evidence or approval to derive RTL from the same design.
6. Role variants (Employee, Fleet Manager, Approver, Fleet Lead, CEO, Data Steward).
7. State variants (Draft, Pending, Approved, Active, Maintenance, Blocked, Retired, etc.).
8. Any annotations clarifying drag/drop, keyboard, validation and navigation.

Mockup review produces a signed decision log: adopted, adapted to Wayfinder, rejected as conflicting, or deferred.

## Open decision register

Track at minimum: D3/D6–D14 and D18–D24 relevant to vehicle classification, entitlement, booking duration, consent tolerance, emergency booking, cross-node booking, personal use, utilization and cost. Each entry has owner, due date, safe temporary behavior and blocked features.

## Traceability method

Every deliverable maps:

`Business requirement → actor/use case → screen/API/event → schema/invariant → test → audit/telemetry → rollout evidence`.

## Tests and evidence

- Source register reviewed and versioned.
- Current implementation inventory marked Live/Partial/Mock/Missing.
- Mockup gate checklist embedded in every UI phase.
- Open decisions have owners; no guessed policy values.

## Rollback

Documentation-only phase. Revert the plan revision before downstream code begins; never remove approved requirement evidence.

## Mandatory critique

Check omissions across all actors, lifecycle states, degraded states, accessibility, scope/SoD, consent, historical integrity, and Phase 1/2/3 boundaries.

## Exit gate

Complete when business scope, mockup process, source priority, actor matrix, scenario inventory, open decisions and traceability template are approved.
