# Database — Phase 1 (Foundation MVP, Weeks 5–24)

**Goal:** deliver the full Phase-1 schema — the vehicle master, the booking/consent/handover/compliance/accountability loop, entitlements, the substitution model, migration tooling, and the telematics tables — with conflict-safe booking and the indexes/retention the workload needs.

**Primary source:** [`../../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md`](../../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md) §5–§10 · **Design:** [`../02_Database_Design.md`](../02_Database_Design.md) §6–§10 · **Full-capability context:** [`../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`](../../startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md) · **Backend:** [backend-phase-1-mvp.md](../backend/backend-phase-1-mvp.md).

**Entry gate:** [DB Phase 0](db-phase-0-foundation.md) gate green (baseline + audit chain + dormant seam + telemetry hypertable + migrations in CI).

---

## 1. Schema delta (this phase)

| Group | Tables | FRs |
|-------|--------|-----|
| Fleet master | `vehicle` (6 groups), `vehicle_hierarchy_assignment`, `vehicle_document`, `vehicle_lifecycle_history`, `vehicle_transfer` | FR-INV-01..07, FR-CLU-03/07 |
| Migration | `import_batch`, `import_row`, `dedup_candidate` | FR-MIG-01..05 |
| Booking | `booking`, `waitlist_entry`, `booking_event`, `consent_record`, `consent_lifecycle_event` | FR-BOOK-01..15, FR-CON-01..06 |
| Entitlement | `entitlement_request`, `bsd_return_window` | FR-DVR-01..09 |
| Handover | `handover`, `damage_pin` (normalized), `key_log` | FR-HAND-01..07, FR-HAND-11 |
| Compliance | `compliance_item`, `eligibility_evaluation`, `access_block` | FR-COMP-01..05/10 |
| Accountability | `fine`, `black_point`, `accident`, `recovery_record`, `substitution_window` | FR-FINE-01..07, FR-SUB-01/02 |
| Telematics | `device`, `device_pairing`, `trip`, `telematics_alert` (+ `telemetry` from P0) | FR-GPS-P1-02..10 |

All tables carry the dormant `organization_id`, `created_at_utc`/`updated_at_utc`, and soft-state lifecycle (no hard delete). Column detail is in [02_Database_Design.md](../02_Database_Design.md) §6–§10.

## 2. Load-bearing constraints & indexes

- **Conflict-safe booking (the critical one):** migration enables `btree_gist`; `booking` persists PDP-derived `reservation_start`, `reservation_end`, and `reservation_policy_version_id`, then enforces `(vehicle_id WITH =, tstzrange(reservation_start, reservation_end, '[)') WITH &&)` for PendingApproval/Approved/Active rows. Create/modify/extend maps conflicts to HTTP 409. Existing approved future rows retain the policy/range used at approval.
- **Consent gate:** `booking.consent_record_id` is `NOT NULL` before a `booking_number` is issued (enforced in the service + a partial check).
- **Compliance expiry:** partial indexes on `vehicle(mulkiya_expiry)`, `vehicle(insurance_expiry)`, `compliance_item(next_alert_at)` where not-expired → cheap ladder scans.
- **Attribution:** `fine(booking_id)`, `fine(attributed_person_id)`, `substitution_window(vehicle_id, start, end)` for window lookups.
- **Fleet browse:** active `vehicle_hierarchy_assignment(node_id, assignment_kind, valid_to)` + `vehicle(lifecycle_status, booking_pool_flag)`; uniqueness on `plate`/`chassis_vin`/`salik_tag`/`darb_tag`.

## 3. Immutability & audit

- **`consent_record`** → WORM Blob object + insert-only pointer row; void/supersede/expire are append-only `consent_lifecycle_event` rows. Time-based retention lock per D7/D4.
- **`damage_pin`** → normalized `x,y` + `region_code` + `template_id/version` (portable + CV-ready).
- Every write on these tables emits a hash-chained `audit_log` entry (P0 chain).

## 4. Telemetry retention (decision that must anticipate Phase 2)

Set the `telemetry` hypertable **retention long enough that Phase-2 route-replay can read Phase-1 raw trips retroactively** (gap P1D-3). Continuous aggregates for live-map/coverage queries. Trip polylines stored on `trip`; raw points on `telemetry`.

## 5. Migrations

Ordered forward-only Drizzle migrations per block (A→G) so the schema lands as each backend block needs it; each reviewed like code; migration dry-run + a **compensating-migration** for any risky change. `decision_log` stays a normal table (its hypertable move is Phase 2).

## 6. Acceptance (Phase-1 exit)

- [ ] All Phase-1 tables migrated forward in CI; seed + a real pilot inventory load to **≥98%** completeness.
- [ ] **Concurrent double-booking test** proves the exclusion constraint blocks overlap (incl. buffer).
- [ ] Policy-change test proves existing bookings retain their approved reservation range while new bookings use the new policy version.
- [ ] Hierarchy restructure test proves current assignment and historical reporting without hard-coded level columns.
- [ ] Expiry ladder queries hit partial indexes (EXPLAIN evidence); eligibility gate query < 500 ms budget.
- [ ] Consent/doc objects are WORM; `damage_pin` stores normalized coords.
- [ ] Telemetry retention set to cover Phase-2 replay; batched COPY sustains the load-test rate.

## 7. Inspection Gate — Gap Analysis & Fixes

| # | Gap | Sev | Fix | Owner |
|---|---|---|---|---|
| P1D-1 | **Double-booking** not structurally prevented (index ≠ constraint) | H | `btree_gist` + exclusion constraint on persisted effective reservation range/policy version; concurrent create/modify/extend tests | DB + Backend |
| P1D-2 | **HCM sync freshness** unmodelled → eligibility reads stale `person` | H | Add `person.synced_at`; eligibility surfaces "data as of"; a staleness threshold flags for block+escalate | DB + Integration |
| P1D-3 | **Telemetry retention** default too short for P2 replay | H | Set retention/continuous-aggregate policy now to cover the P2 replay window | DB |
| P1D-4 | `decision_log` + `booking_event` + `telemetry` high-write on plain tables | M | Time indexes now; plan `decision_log`→hypertable in P2; partition `booking_event` if needed | DB |
| P1D-5 | Post-go-live **data correction** conflicts with append-only/steward sign-off | M | Corrective-entry pattern (new versioned row + audit reason), never in-place edit | DB |
| P1D-6 | Substitution attribution query correctness across overlapping windows | M | Unique/《exclusion on `substitution_window(vehicle_id, range)`; attribution test matrix | DB + Backend |
| P1D-7 | `organization_id` present but unindexed; a future accidental filter would seq-scan | L | Keep unindexed (dormant); grep guard already prevents references | DB |

**Exit criteria:** §6 acceptance passes; P1D-1..P1D-3 have passing evidence; migrations + concurrent-booking + retention tests green. → proceed to [Phase 2](db-phase-2-scale-automate.md).
