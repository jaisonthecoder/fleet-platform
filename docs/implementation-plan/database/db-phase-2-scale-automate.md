# Database — Phase 2 (Scale & Automate)

**Goal:** add the schema for automation and group-wide operation — fuel/OCR, tolls, vendor & lease, behaviour scoring, recovery/payroll, break-glass, recurring bookings, real-device telematics — and move the highest-write logs to hypertables.

**Scope source (opened to all capabilities):** [`../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`](../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md) (C5, C7, C9, C10, C13, C14) · **Phase scope:** [`../../startup-doccs/04_Phase2_Scale_Automate_ADPorts.md`](../../startup-doccs/04_Phase2_Scale_Automate_ADPorts.md) · **Design:** [`../02_Database_Design.md`](../02_Database_Design.md) · **Backend:** [backend-phase-2-scale-automate.md](../backend/backend-phase-2-scale-automate.md).

**Entry gate:** [DB Phase 1](db-phase-1-mvp.md) gate green (conflict-safe booking; telemetry retention set for replay).

---

## 1. Schema delta

| Group | Tables (new) | Capability |
|-------|--------------|-----------|
| Vendor & lease | `vendor`, `lease_contract`, `offhire_terms`, `vendor_scorecard`, `lease_renewal_alert` | C13 (fills `vehicle.vendor_id` FK from P1) |
| Fuel | `fuel_invoice`, `fuel_invoice_line`, `fuel_card`, `fuel_card_assignment`, `ocr_proposal` | C9 |
| Toll | `toll_transaction` (attribution basis + substitution-aware), `toll_recharge` | C14 |
| Behaviour | `behaviour_score`, `behaviour_event` (from P1 `booking_event` + harsh-driving) | C10 |
| Recovery | `recovery_instruction` (payroll outbound), extend `recovery_record` | C7 |
| Booking | `recurring_booking_series` (parent → `booking` children), break-glass fields on `booking` | C2 |
| Maintenance | `maintenance_schedule`, `downtime_event` | C1/C11 inputs |
| Telematics | `geofence_corridor`, `harsh_driving_event`; real-device rows in `device` | C8 |

Existing tables extended: `vehicle` commercial fields wired to `vendor`; `fine`/`toll_transaction` recharge → `recovery_instruction`.

## 2. High-write migrations (the important structural change)

- **`decision_log` → TimescaleDB hypertable** (flagged in P0/P1) — group-wide PDP volume needs it; retention + continuous aggregates.
- **`toll_transaction`, `fuel_invoice_line`, `behaviour_event`, `harsh_driving_event`** — time-indexed; partition/hypertable where volume warrants.
- Real-device telemetry increases `telemetry` write rate — validate batched COPY headroom at group scale.

## 3. Indexes & integrity

- `fuel_card_assignment(vehicle_id, valid_from, valid_to)` non-overlap; `lease_contract(vendor_id, end_date)` for renewal pipeline; `toll_transaction(vehicle_id, datetime)` for attribution; `behaviour_score(person_id, period)`.
- Substitution-aware attribution reused from P1 for tolls (same window logic).

## 4. Inspection Gate — Gap Analysis & Fixes

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P2D-1 | **`decision_log` bloat** at group scale (deferred from P0/P1) | H | Migrate to Timescale hypertable + retention this phase | DB |
| P2D-2 | Real-device telemetry may exceed P1 write headroom | H | Re-baseline batched-COPY throughput at group volume; tune partitions | DB + SRE |
| P2D-3 | **Non-AED currency** in `lease_contract`/`vendor` before multi-currency (P3) | M | Store contract currency + FX-at-record; roll-ups convert to AED | DB + Finance |
| P2D-4 | Toll/fuel attribution must honour substitution windows consistently | M | Reuse P1 `substitution_window` join; attribution test matrix incl. tolls | DB + Backend |
| P2D-5 | OCR proposals must be auditable (proposal→confirm→correction) | M | `ocr_proposal` stores confidence + corrections → training set; every step audited | DB |
| P2D-6 | Payroll `recovery_instruction` is money-sensitive | M | Immutable instruction rows + status transitions; reconciliation view; no in-place edit | DB + Finance |

**Exit criteria:** all P2 tables migrated; `decision_log` hypertable live; group-scale write throughput validated; substitution-aware toll attribution tested; **H** gaps fixed. → proceed to [Phase 3](db-phase-3-intelligence-international.md).
