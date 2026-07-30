# Fleet Operations Core - Decision Register

## Decision D-SEQ-001 - Domain-first operational delivery

| Field | Value |
|---|---|
| Status | `APPROVED` |
| Decision date | 2026-07-21 |
| Authority | User/product direction |
| Affected plans | Booking and Vehicle Management phases 0-19; Organization O4/O6; Decision/Workflow Phase 8 |
| Owner | Delivery Orchestrator |
| Revisit trigger | Core domain contracts cannot preserve required organization/scope/provenance boundaries, or a core journey cannot be secured without full O4/O6 implementation. |

### Decision

Use `docs/implementation-plan/booking_and_vehiclemanagement/` as the primary delivery backbone for real-time fleet operations. Deliver and verify the basic Vehicle, Pool Booking, Handover and Dedicated Entitlement journeys before completing broad O4/O6 propagation and final Decision/Workflow platform adoption.

The later platform integration must wire into stable domain-owned records, commands, events and user journeys. It must not replace or duplicate domain ownership.

### Rationale

- Vehicle, Booking, Handover and Entitlement own the operational truth used by fleet users.
- The current application already contains partial domain implementations, so a verified current-state reconciliation is cheaper and safer than treating the project as greenfield.
- Policy, workflow and hierarchy integration are easier to validate against working domain journeys with concrete facts, states and side effects.
- Phase-specific frontend mockups are not yet approved, so backend/data reconciliation can proceed while UI remains gated.

### Guardrails

O6 remains completed foundation evidence. Final cross-domain O4 closure is deferred, but each domain must implement its required O4 controls before its own live paths pass. These controls are not deferred:

1. authenticated actor binding;
2. persisted organization plus direct effective scope or approved immutable event-time scope evidence;
3. cross-organization denial and database consistency;
4. ownership checks for employee self-service;
5. explicit bounded authority for operational on-behalf actions;
6. separation of actor, requester/beneficiary, driver, approver, allocator and handover actor;
7. audit/outbox evidence for operational mutations;
8. no claim of full N-level, multi-organization or scoped-policy readiness before INT-1/INT-2 pass.

If a proposed core implementation cannot satisfy these guardrails without a specific O4 capability, that capability becomes a just-in-time prerequisite rather than being bypassed. Completed O6 behavior is consumed as a foundation and is not reopened without regression evidence.

### Consequences

- CORE-0 through CORE-6 become the immediate planning sequence.
- O6 remains complete. O4 domain propagation is split into just-in-time core prerequisites, followed by final matrix closure at INT-1.
- Booking authorization remains part of CORE-2 because it is basic domain safety, not deferred platform hardening.
- Existing Phase 8.0-8.2 evidence is retained. Remaining Phase 8 adoption follows INT-1 unless a bounded adapter task is required earlier to preserve stable contracts.
- Vendor/Lease automation and advanced booking are later streams unless a core leased-vehicle or scenario dependency is explicitly approved.
- No frontend phase begins until its mockups are supplied, reconciled and explicitly approved by the user.

### Verification

- [Master status](MASTER-STATUS.md) reflects CORE-0 through CORE-6 before INT-1/INT-2.
- Every implementation context pack cites this decision and the minimum authorization floor.
- Every phase critique checks for premature multi-organization/policy/workflow readiness claims.

## Decision D-ENT-PREF-001 - Optional non-binding Dedicated Vehicle preference

| Field | Value |
|---|---|
| Status | `APPROVED` |
| Decision date | 2026-07-24 |
| Authority | User/product direction |
| Affected plans | DEDICATED-00, DEDICATED-01, DEDICATED-03, DEDICATED-04 and DEDICATED-06 |
| Owner | Product Manager + Entitlement domain owner |
| Revisit trigger | Product requests requester-controlled reservation/guarantee, or Fleet allocation policy no longer permits equivalent substitution. |

### Decision

After eligibility identifies permitted classes and currently eligible Vehicle options, the Dedicated Vehicle request form provides two optional preference fields:

1. one preferred Vehicle selected from a server-projected, bounded list of currently eligible Vehicles; and
2. a free-text preference note of no more than 500 characters, for example `I'd prefer a Toyota Fortuner if available` or `Left-hand drive preferred - driving on E11`.

The preference is non-binding. It creates no hold, reservation, assignment or guarantee. Fleet Manager retains final authority to allocate the preferred Vehicle, a policy-permitted equivalent with an auditable variance reason, or return the request for modification. The original preference remains immutable request evidence.

### Guardrails

- The dropdown exposes only Employee-safe make/model, class, fuel and safe location facts.
- Material request changes or stale eligibility revalidate or clear an ineligible preferred Vehicle.
- The UI states that preferences are not guaranteed.
- Contract naming distinguishes requester `preferredVehicleId` from allocated `vehicleId`; the allocation command alone creates the exclusive Vehicle assignment.
- A policy-permitted equivalent cannot widen the approved class or entitlement.
- Free text is length-validated and rendered safely; it cannot override policy or create entitlement facts.

## Open Decisions

| ID | Decision | Required before | Safe behavior until closure | Status |
|---|---|---|---|---|
| D-UI-V | Approve Vehicle phase mockups | Any Vehicle UI edit | Backend/data inspection and contract work only | `OPEN` |
| D-UI-B | Approve Booking phase mockups | Any B1-B4 UI edit | Approved content and business-derived states may be implemented against verified APIs; do not retain the static mock | `CLOSED` - approved 2026-07-21; evidence E-0011 |
| D-UI-H | Approve Handover phase mockups | Any H1 UI edit | Backend/data inspection and contract work only | `OPEN` |
| D-UI-D | Approve Dedicated Entitlement mockups | Any D1-D2 UI edit | Approved screen 22 and business-derived D2 states may be implemented against verified APIs; no Pool Booking reuse or fixture success | `CLOSED` - approved 2026-07-21 in mockup review; reconciled 2026-07-24 |
| D-SCOPE-PROVISIONAL | Confirm provisional Fleet Manager scope model before on-behalf Booking | CORE-2 on-behalf mutation | Fleet roles cover requester, driver and Vehicle scopes through persisted hierarchy assignments; actor remains separate from beneficiary/driver and cannot sign their consent | `CLOSED` - development contract implemented and verified 2026-07-29 |
| D16 | Configure Dedicated Vehicle professional-driver scope | Dedicated WithDriver request | Active person plus effective `ProfessionalDriver` role covering request location; selected driver is bound into eligibility fingerprint and must consent | `DEVELOPMENT_ACTIVE_CONFIGURABLE` - Users & Access + Policy Studio 2026-07-29 |
| D-VEH-READ | Approve Vehicle read-role, field-masking and opaque cross-org behavior | Vehicle detail/history implementation | Do not authorize the Vehicle read repair | `OPEN` |