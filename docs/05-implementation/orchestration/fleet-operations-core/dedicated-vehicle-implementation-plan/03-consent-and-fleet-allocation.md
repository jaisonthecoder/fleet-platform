# DEDICATED-03 - Driver Consent and Fleet Allocation

> **Status:** `TECHNICALLY_VERIFIED_GOVERNED_CONSENT_LOCAL`

## Implemented - 2026-07-26

- Migration `0049` adds immutable effective-range allocation evidence, one active allocation per request, and organization/Vehicle range exclusion.
- Assigned-driver consent is Principal/revision/idempotency bound and validates a governed template version. Production fails closed; explicit test/local EN/AR content enables complete lower-environment flow.
- Fleet allocation worklist is hierarchy scoped and returns final-qualified safe Vehicle options only.
- Allocation locks Entitlement then Vehicle, requalifies inside the transaction, inserts allocation evidence, removes the Vehicle from Pool, sets Dedicated assignment/driver, updates Entitlement, audit/outbox and command result atomically.
- Booking consent now locks Booking then Vehicle and rechecks bookability/overlap inside its transaction, serializing Pool reservation against Dedicated allocation.
- Different final Vehicle requires server-enforced variance reason; original preference remains immutable request evidence.
- Employee consent and Fleet Dedicated Allocation pages are live, role separated, bilingual, and variance aware.

Evidence: migration forward/idempotent; backend 30/30; Dedicated PostgreSQL 5/5 complete request-to-allocation; Booking PostgreSQL 17/17 after shared Vehicle lock; frontend allocation 2/2 plus DEDICATED-02 regressions/build; three critiques with direct lock/snapshot finding repaired.

The governed source, first-class content hash and independent-connection contention evidence are complete. Local version `dedicated-operational-ack-v3` is Active. Target environments must activate accepted wording through maker-checker. `WithDriver` remains disabled pending D16.

## Objective

Capture assigned-driver consent from an approved request and allocate exactly one live qualified Vehicle through an exclusive, auditable Fleet command.

## Entry Criteria

- DEDICATED-00 through 02 verified.
- Legal/Privacy approves EN/AR consent source, version/effective-time, retention and outage behavior.
- `G-0010` closed with effective-range database exclusivity and live Vehicle qualification.
- D16 approved for WithDriver or that path remains disabled.
- Fleet allocation variance reasons approved as governed reference data.

## Consent Work

1. Approved request transitions to `AwaitingConsent`; no Vehicle is allocated yet.
2. Actual assigned driver authenticates and signs the exact server-projected template/version.
3. Consent binds driver, requester, approved class, duration, driver mode, policy/template version and material request facts.
4. Material changes void consent and require a new versioned signature.
5. Consent command is durable/idempotent and writes immutable evidence, audit and outbox atomically.
6. Fleet roles cannot impersonate beneficiary or professional-driver consent.

## Allocation Work

1. Fleet allocation queue shows approved, consented requests in managed scope.
2. Server returns only Vehicles matching approved class/equivalent policy, effective scope, lifecycle, compliance, maintenance, existing assignment/booking and effective-window rules.
3. Display stored preferred Vehicle/note as advisory context. Never preselect or guarantee it.
4. If preferred Vehicle remains qualified, Fleet may select it.
5. If Fleet selects another Vehicle, require governed variance reason (`unavailable`, `maintenance`, `compliance`, `better operational fit`, `policy equivalent`, or approved lookup value). The equivalent must remain inside the approved class/equivalence policy and cannot silently widen the requester's entitlement.
6. In one transaction: lock request and Vehicle, recheck facts, create exclusive allocation, transition to Allocated, persist variance evidence, update Vehicle assignment/pool state, audit/outbox and complete durable command.
7. The original preferred Vehicle/note remain immutable request evidence.
8. Dedicated Vehicle is removed from ordinary pool availability except active BSD windows.

## Database and Concurrency

- Effective-range exclusion/unique constraint prevents overlapping active dedicated allocations.
- Allocation conflicts with pool bookings, maintenance and incompatible assignments according to frozen cross-domain lock order.
- Same-key replay returns original allocation; competing requests produce one winner.
- Injected audit/outbox failure rolls back allocation and Vehicle state completely.

## Frontend Work

- Full-attention assigned-driver consent stage with version and material request summary.
- Fleet allocation master-detail queue with qualified Vehicles and explicit preference context.
- Honest no-qualified-Vehicle and stale-option states.
- Requester allocation confirmation shows exact Vehicle, plate, collection location, dates and status.

## Tests and Evidence

- Wrong driver, Fleet impersonation, stale template, re-consent and retry.
- Foreign/sibling scope, noncompliant/held/maintenance/booked Vehicle denial.
- Preferred Vehicle valid/stale/unavailable; equivalent allocation requires variance reason.
- Contract tests prove `preferredVehicleId` cannot be interpreted as final `vehicleId`, and equivalent substitution cannot widen the approved class/policy entitlement.
- Concurrent same/different Vehicle allocations, deadlock/lock-timeout handling and rollback.
- Booking availability excludes dedicated allocation.

## Three Critique Rounds

### Round 1 - Contract, Security and Data

Review consent ownership/version/PII, allocation FKs/exclusion, Vehicle qualification, preference immutability, variance evidence and transaction boundary. Repair and rerun migration/HTTP tests.

### Round 2 - Behavior and Concurrency

Attack consent/allocation races, stale Vehicle options, concurrent allocators, cross-domain lock order, replay and failure injection. Repair and rerun real-PostgreSQL concurrency/E2E evidence.

### Round 3 - UX and Operations

Review consent attention, allocation decision clarity, no-vehicle remediation, preference-versus-guarantee language, EN/AR/RTL, keyboard and Fleet operational support. Repair and capture browser/build evidence.

## Exit Gate

Only the authenticated assigned driver can consent; authorized Fleet allocates exactly one qualified Vehicle atomically; preference variance is auditable; no unresolved Blocking/High finding remains.
