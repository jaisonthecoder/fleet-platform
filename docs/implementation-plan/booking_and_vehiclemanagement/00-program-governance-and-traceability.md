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

### Vendor & Lease Management

- Fusion-linked and manually verified vendor onboarding.
- Vendor compliance documents, commercial terms, integration/access and Procurement approval.
- Vendor Master list/detail, evidence-based scorecards and active contracts.
- Lease contracts, vehicle coverage, renewal ladder and no-silent-renewal controls.
- Contract-vs-invoice discrepancies owned by Finance + Procurement.
- Off-hire initiation, condition, penalty, vendor acknowledgement, return and closure.

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

- D6 Procurement source authority, source keys, conflict precedence and sync direction blocks live I3 automation.
- D1 tracker ownership affects off-hire tracker return for lessor-installed devices; platform-owned T1 trackers follow the existing transfer registry.
- D16 professional-driver liability affects vendor/employer recovery, not Vendor Master creation.
- D19 toll recharge remains outside vendor onboarding but affects later reconciliation/recovery.

Track at minimum: D3/D6–D14 and D18–D24 relevant to vehicle classification, entitlement, booking duration, consent tolerance, emergency booking, cross-node booking, personal use, utilization and cost. Each entry has owner, due date, safe temporary behavior and blocked features.

Use this mandatory register shape:

| Decision | Human owner | Due before | Safe fallback | Blocked capabilities | Evidence/status |
| --- | --- | --- | --- | --- | --- |
| D6 Procurement authority/I3 | Procurement Lead + Architecture | Phase 2 | Manual Mode + Data Steward/Procurement dual control; I3 automation off | I3 vendor/contract sync | Open |
| D8 dedicated eligibility | Group HR + Cluster CEOs | Phase 14 | Default deny/escalate; no allocation | Dedicated eligibility/allocation | Open |
| D9 black-point timeframe | HR + Legal | Compliance adoption | Existing approved hard block only | Automated warning/escalation | Open |
| D12 re-consent tolerance | Legal + Group Services | Phase 10/12 | Any material driver/vehicle/window change requires re-consent | Relaxed tolerance | Open |
| D14 utilization/max duration | Group Services + Finance | Phase 6/10 | Report raw measures; conservative max duration | Utilization targets/duration overrides | Open |
| D16 professional-driver liability | Legal + Procurement | Phase 14/15 | Data model only; active workflow disabled | Professional driver allocation/recovery | Open |
| D17 break-glass categories/SLA | Group Services + HR | Phase 13 | Feature disabled | Emergency booking | Open |
| D18 smart-key sites | Group Services + Procurement | Phase 8/16 | Manual custody log | Cabinet integration | Open |
| D24 cross-node pairs/approver | Group Services + Cluster CEOs | Phase 13 | Default deny | Cross-node booking | Open |
| Consent evidence/retention | Legal + Privacy | Phase 10 | No production consent capture | Booking submission | Open |
| Audit/document/location retention | Legal + Security + Records | Phase 1/18 | No destructive retention jobs | Production cutover | Open |

Owner names and calendar dates are filled during Phase 0 workshop; “TBD” cannot pass the exit gate.

## Actor and SoD vocabulary

- **Approval delegation:** one-hop, request-type and time-bound authority from an approver to a delegate. `decidedBy` and `onBehalfOf` are both retained.
- **Operational on-behalf action:** Fleet/HR role creates a booking or entitlement for a beneficiary. It is not approval delegation; requester, beneficiary and driver remain distinct.
- System Admin configures and audits; it cannot perform operational approval/allocation solely because it is System Admin.
- Procurement is read/alert-only in Phase 1 pilot; active Vendor/Lease operations are Phase 2 unless release scope is changed.
- Professional/Substitute drivers are data-model-only in Phase 1; active flows are Phase 2 and D16-gated.
- Each phase documents exact actor, scope, self-action, on-behalf and SoD tests.

## Program critique record

See [program-critique-round-1.md](program-critique-round-1.md) for findings, dispositions and closure conditions.

## Traceability method

Every deliverable maps:

`Business requirement → actor/use case → screen/API/event → schema/invariant → test → audit/telemetry → rollout evidence`.

## Current-data baseline gate

Before Phase 2/5 implementation, produce a signed data-quality report:

- Vendors/suppliers by source, duplicates by external ID/TRN/legal-name candidate and missing required evidence.
- Leased vehicles missing vendor, contract, dates, currency, cost or off-hire terms; invalid/free-text contract references.
- Plate/VIN/vehicle duplicates and hierarchy/organization mismatches.
- Active bookings, entitlements, maintenance, device/key and contract links affected by migration.
- Quarantine volumes, Data Steward/Procurement owners, SLA and remediation/cutover timeline.

Leased production activation is blocked until vendor/contract references meet the approved completeness threshold (target at least 95% before bulk cutover and 100% for rows activated). Owned-vehicle work may proceed independently.

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
