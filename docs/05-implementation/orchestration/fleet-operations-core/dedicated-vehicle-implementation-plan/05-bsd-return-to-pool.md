# DEDICATED-05 - BSD Return-to-Pool

> **Status:** `TECHNICALLY_VERIFIED_MANUAL_SOURCE`

## Implemented - 2026-07-26

- Migration `0051` adds organization/confirmation/timestamps, closed statuses, overlap exclusion and active-allocation containment trigger.
- Authorized Fleet manually proposes and separately confirms minimized BSD windows; requester cannot expose the Vehicle.
- Advisory-lock worker activates confirmed windows at start only for compliant Vehicles, then restores Dedicated assignment exactly once at end.
- Restoration moves to `Conflict` while an active Booking crosses the return boundary.
- Booking Draft/consent requires the entire reservation range to fit inside one Active BSD window for Dedicated Vehicles; no leave reason/person data is exposed.
- Fleet allocation page provides propose/confirm controls and status; persisted BSD schedule API supports reload-safe detail enhancement.

Evidence: migration forward/idempotent; Dedicated PostgreSQL 5/5 with clock-controlled activation/restoration; Booking PostgreSQL 17/17; unit regressions 61/61; frontend BSD 3/3 and build; three critiques with allocated-worklist reachability defect repaired.

Residual: full persisted calendar/list and conflict-resolution UI are compact/future. Manual Fleet source is authoritative until HR leave integration is approved; no sensitive HR leave facts are stored.

## Objective

Temporarily return an allocated Dedicated Vehicle to the shared pool for an approved absence window, then restore the exclusive assignment automatically and safely.

## Entry Criteria

- DEDICATED-03 exclusive allocation and Vehicle state transitions verified.
- DEDICATED-04 active lifecycle/read model verified.
- HR/Fleet/Privacy approve leave-source authority, minimum disclosed facts, confirmation owner, early-return rules and notification timing.
- Booking/Handover lock order and active-custody conflict behavior frozen.

## State Model

```text
DedicatedActive
-> BSDPoolScheduled
-> BSDPoolActive
-> DedicatedActive

Scheduled -> Cancelled
Active -> Completed -> DedicatedActive
```

## Backend Work

1. Propose BSD window from approved minimized leave signal or authorized manual command.
2. Fleet confirmation required before pool activation; requester cannot unilaterally expose a Vehicle.
3. Window must lie inside allocation range and cannot overlap another BSD window.
4. Scheduled worker uses advisory lock/idempotent commands across replicas.
5. At start, lock allocation/Vehicle, recheck compliance/custody/maintenance, open exact pool window and audit/outbox.
6. At end, block restoration while an active Booking/Handover exists; mediate or wait according to approved rule, then restore dedicated assignment exactly once.
7. Early beneficiary return cannot interrupt active custody; Fleet resolves conflicts and future bookings explicitly.
8. Pool Booking projection shows dedicated return deadline without exposing leave reason/person data.

## Frontend Work

- Active entitlement BSD calendar with Proposed, Confirmed, Active, Completed and Cancelled states.
- Fleet actions: confirm, adjust, cancel and resolve conflict.
- Requester sees minimized schedule/status, not sensitive HR leave facts.
- Booking users see availability window and return deadline only.

## Tests and Evidence

- Window outside allocation, overlap, DST/timezone boundaries and revoked leave signal.
- Concurrent scheduler instances, start/end replay and injected failure rollback.
- Active Booking/Handover at end, early return conflict and future booking mediation.
- Automatic pool inclusion/removal exactly at window bounds.
- Privacy/masking, EN/AR/RTL and operational alert evidence.

## Three Critique Rounds

### Round 1 - Contract, Security and Data

Review leave privacy, BSD scope/FKs/state machine, time semantics, audit retention and worker idempotency. Repair and rerun migration/security tests.

### Round 2 - Behavior and Concurrency

Attack overlapping windows, replica races, Booking/Handover conflicts, early return and restoration failure. Repair and rerun clock-controlled PostgreSQL/E2E tests.

### Round 3 - UX and Operations

Review calendar clarity, conflict remediation, privacy-safe copy, notifications, RTL/mobile and support runbook. Repair and capture browser/operational evidence.

## Exit Gate

A confirmed BSD window exposes the Vehicle only for the exact safe period and restores the dedicated allocation exactly once without privacy leakage or active-custody loss.
