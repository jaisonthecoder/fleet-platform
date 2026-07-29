# BOOKING-05 Two-Round Critique - Handover and Completion

| Date | Decision |
|---|---|
| 2026-07-29 | `TECHNICALLY_VERIFIED_REPLAY_HARDENING_ASSIGNED_TO_BOOKING_06` |

## Round 1 - Transaction, Security and Scope

- Found and repaired a Blocking transaction gap: Handover committed before Booking transition in a second transaction. Open/return now share one Drizzle transaction with Booking lifecycle, audit and outbox.
- Injected failure after custody writes and during Booking outbox proves no Handover row and no Booking state transition survive.
- Found and repaired High authorization gaps: removed SystemAdmin operational access, required linked Fleet Principal, hierarchy scope, guarded reads/key history and fail-closed worklist admission.
- Added organization/scope-bound custody register for Approved and Active Bookings.

## Round 2 - Live UX and Evidence

- Replaced all hardcoded Booking/Vehicle/driver/telemetry/success data with live worklist/open/return APIs.
- Added EN/AR register, evidence capture, required checklist/key/signer/condition validation, damage evidence and persisted reconciliation receipt.
- Advisory fuel/odometer/late flags never assign liability automatically.
- Residual: open/return currently produce deterministic conflict through state/unique guards but do not durably replay the original result. BOOKING-06 owns the command ledger and contention proof before final technical closure.

Evidence: Booking/Handover units 48/48; Handover PostgreSQL 3/3 including rollback/worklist/role denial; frontend Handover 3/3; Booking role/UI regression 42/42; typecheck/lint pass. Unrelated `auth-http` hierarchy-move fixture remains 409 and is not a Booking regression.