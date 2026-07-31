# BOOKING-05 - Handover and Completion Boundary

> **Current status (2026-07-30):** `ATOMIC_BASELINE_VERIFIED_MOCKUP_EVIDENCE_REFACTOR_REQUIRED`. Atomic scoped open/return/damage, migration `0053` durable replay, contention and rollback evidence pass. The live UI does not follow mandatory screens `26`-`28`/`handover-page-demo.tsx`, and register/history/photo/signature/key-loss/amendment evidence is incomplete. Corrective plan: [Handover, Return and Approval Mockup Realignment](../HANDOVER-APPROVAL-MOCKUP-REALIGNMENT-PLAN.md).

## Objective

Make physical custody the authoritative trigger for `Approved -> Active -> Completed` Booking transitions without cross-domain partial commits.

## Entry Criteria

- BOOKING-03 provides Approved preparation items.
- Handover actor/scope, inspection, key, signature and return contracts are frozen.
- The supplied Handover register/walkaround mockups and derived Return contract remain the UI baseline.

## Mandatory Visual Source

Follow [26-handover-custody-register-list.png](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/26-handover-custody-register-list.png), [27-handover-return-walkaround-inspection-with-scroll.png](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/27-handover-return-walkaround-inspection-with-scroll.png), [28-handover-return-walkaround-inspection-without-scroll.png](../../../../implementation-plan/booking_and_vehiclemanagement/mockups/28-handover-return-walkaround-inspection-without-scroll.png), and the approved derived Return/receipt contract. Preserve the register, walkaround/checklist, condition evidence, odometer/fuel, key/signature and sticky-action composition inside the existing shell.

## Transaction and Domain Work

1. Close `G-0011`: Handover open and Booking pick-up must commit as one unit or through a proven exactly-once domain-command boundary with compensation/reconciliation.
2. Return and Booking completion follow the same atomicity rule.
3. Lock/revision-check Booking and Handover so concurrent handovers/returns produce one winner.
4. Verify persisted driver, Approved/Active state, Vehicle, scope, consent and eligibility at release time.
5. Record actor, driver, key issue/return, odometer/fuel, condition, evidence refs, time/location and late/early result.
6. Lost-key and damage evidence remain append-only and create review work; they do not silently assign liability.
7. Completed records are immutable; corrections append amendments.
8. A failed photo/storage dependency leaves recoverable in-progress evidence and never a false Completed Booking.

## API and Frontend Work

1. Add/verify scoped custody/preparation list APIs before enabling the register.
2. Wire existing Handover UI controls to real create, return and damage commands.
3. Use the approved comparison-based Return screen: handover baseline versus return capture.
4. Completion receipt shows persisted Booking status, return time/location, odometer/fuel reconciliation, key result, damage review, late/early flag and evidence references.
5. Offline completion is excluded from Phase 1; show explicit retry/manual continuity state.

## Tests

- Release denial for wrong driver, stale consent, wrong scope/org, non-Approved Booking and non-bookable Vehicle deterioration.
- Injected failure after either domain write: no orphan Handover/Booking state.
- Concurrent open/return commands and duplicate idempotency keys.
- Key lost, evidence upload failure, stale telemetry and manual reading fallback.
- Audit hash chain and outbox exactly-once verification.
- Browser Booking approval -> handover -> active -> return -> completed receipt in EN/AR/RTL.

## Exit Gate

Physical release and return drive Booking state exactly once with complete custody evidence. `G-0011` is closed; no partial Booking/Handover transition survives failure.
