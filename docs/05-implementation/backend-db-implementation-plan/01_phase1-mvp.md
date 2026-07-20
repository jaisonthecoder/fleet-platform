# Phase 1 — MVP Backend + DB (GS Pool)

> **Detailed sub-phase plan:** this document is the block-level summary. The full, split-by-sub-phase plan (one file per block A–G, plus consolidated critique and gate) lives in **[`phase1/`](phase1/README.md)**.

**Goal:** the complete accountability loop live at one pool — book → consent → approve → handover → return → fine auto-attributed → nothing on expired documents — with GPS via simulator, no hardware. Delivered as **contract-first vertical slices** in dependency order (blocks A–G). **Governing docs:** `03_Phase1_MVP_PRD_ADPorts.md`, `02_Database_Design.md`, `03_Backend_Design.md`.

**Entry:** Phase 0 production-readiness gate green. **Exit:** §8 production-readiness gate green.

---

## Block A — Platform completion (extend the foundation)

| Item | Detail |
|---|---|
| **PDP → full 12 rule types** | Register the remaining 10 (max-duration, booking-approval-chain, entitlement-approval-chain, dedicated-vehicle-eligibility, driver-eligibility-gate, compliance-alert-ladders, hard-block-conditions, fines-hr-threshold, black-point-timeframe, consent-re-consent-tolerance, fuel-deviation-threshold). Each: Zod input schema + reason codes + safe default + decision-table test. |
| **Workflow engine (full)** | Chains, delegation (one hop), timeout escalation (24h booking / 48h entitlement), "request modification" outcome, no-orphan reroute. |
| **Hierarchy engine (full)** | N-level config, roll-up/drill-down, restructure-with-history. |
| **Notification dispatcher (P9)** | Email/M365 port; policy floors (compliance alerts unmutable); used by compliance ladders + booking reminders. |
| **DB** | No new tables beyond Phase 0 core; seed populated rule tables (fixtures where a D-decision is open). |
| **Exit** | All 12 rule types pass decision-table tests + logged; escalation timers fire; **engine complete ≠ tables populated** — populated+second-approved tables tracked per rule type (P1-R1-2). |

> **Configuration tier (Sub-Phase 1A₂):** lookup / reference-data management (bilingual EN/AR, parent-child, backs *every* dropdown) and user / access management (SSO JIT provisioning, admin role assignment with SoD, HCM-ready) are a **dedicated sub-phase** between Block A and the feature blocks — see [phase1/01b](phase1/01b_sub-phase-1a2_lookup-and-user-management.md) and **ADR-009** (hierarchy nodes = entity; level taxonomy + pick-lists = lookups). Migration `0004_lookup_identity`.

---

## Block B — Master data (M2 vehicle, M3 migration)

### M2 — `vehicles`
- **Contracts:** `vehicle.request/response`, `vehicle-document`, `vehicle-transfer`.
- **DB (`0005_vehicle`):** `vehicle` (6 field groups, enums), `vehicle_document` (versioned), `vehicle_lifecycle_history` (append-only), `vehicle_transfer`. Uniqueness: plate, chassis_vin, salik_tag, darb_tag. Indexes: booking_pool_flag, mulkiya_expiry, insurance_expiry, assigned_driver. Trigger: body_type ∈ {Bus,Equipment} ⇒ booking_pool_flag=false.
- **Module:** `vehicles/` — `VehicleService` (CRUD, lifecycle/status transitions, pool include/exclude, uniqueness), `DocumentVaultService`, `TransferService`.
- **Endpoints:** `GET/POST/PATCH /vehicles`, `GET /vehicles/:id`, `POST /vehicles/:id/documents`, `POST /vehicles/:id/transfer`, `GET /vehicles/:id/history`. Event-publish on every change (FR-INV-11).
- **PDP:** none (config only). **Events:** VehicleChanged.

### M3 — `migration`
- **DB (`0006_migration`):** `import_batch`, `import_row` (row status+reason), `dedup_candidate`.
- **Module:** `migration/` — `ImportService` (CSV/XLSX, **BullMQ sandboxed** parse), `ValidationService` (pre-commit), `DedupService`, `ReconciliationService` (completeness score).
- **Endpoints:** `POST /imports` (202+jobId), `GET /imports/:id`, `POST /imports/:id/resolve`, `POST /imports/:id/sign-off`.
- **Exit:** a real pilot inventory imports to **≥98% completeness** with steward sign-off; uniqueness/lifecycle enforced (mitigates R5).

---

## Block C — Telematics domain (M10) — parallel after Block A

- **DB (`0007_telematics`):** `device`, `device_pairing`, `trip` (booking_id, unassigned), `telematics_alert`. (`telemetry` hypertable from Phase 0.)
- **Module:** `telematics/domain` (in `api`) — device registry & pairing, live map, auto-odometer, **trip→booking auto-attach** (behind a bookings **port + test-double** until Block D — P1-R1-1), unplug/tamper alerts, "is it online?". Consumes canonical events; calls PDP for privacy/access.
- **Privacy:** access logged, retention per **D4**, off-shift masking — proven on simulated data.
- **Exit:** one simulated device per pool vehicle; live map + auto-odometer + trip attach verified; unplug alert via injected event; `TelemetrySource` swap-tested (simulator → stub aggregator) **with no domain change**; trip-attach measured against **adversarial** (non-booking-aware) trips (P1-R2-3).

---

## Block D — Core loop (M4 booking+consent, M6 handover, M7 compliance)

### M7 — `compliance` (build before booking — the gate)
- **DB (`0008_compliance`):** `compliance_item` (next_alert_at), `eligibility_evaluation` (append-only), `access_block`.
- **Module:** `compliance/` — `EligibilityService` (the single "can this driver take this vehicle now?" truth — FR-COMP-10), `ComplianceEngine` (scheduled ladders via `scheduled_work`), **hard block (no override)** on expired Mulkiya/insurance.
- **PDP:** compliance-alert-ladders, hard-block-conditions, driver-eligibility-gate. **Endpoints:** `GET /eligibility`, `GET /compliance/expiries`, `GET /compliance/blocks`.

### M4 — `bookings`
- **DB (`0009_booking`):** `booking` (persisted `reservation_start/end` + policy version; **`btree_gist` exclusion** on active statuses), `waitlist_entry`, `booking_event` (append-only), `consent_record` (insert-only pointer to WORM blob), `consent_lifecycle_event`.
- **Module:** `bookings/` — search→select→**consent (after selection, before submit)**→submit; buffer/duration/eligibility via PDP; unique number **only after consent**; 409 on overlap; no-show/late capture; mid-trip extend.
- **PDP:** driver-eligibility, booking-buffer, max-booking-duration, booking-approval-chain, consent-re-consent-tolerance. **Events:** BookingConfirmed/Cancelled, ConsentSigned.
- **Endpoints:** `GET /vehicles/available`, `POST /bookings`, `.../consent`, `.../submit`, `.../{approve,decline,modify,cancel}`, `.../extend`.

### M6 — `handover`
- **DB (`0010_handover`):** `handover` (phase Handover/Return, odometer/fuel/gps/signature, fuel_deviation, offline_captured), `damage_pin` (normalized x/y + region + template_version + photo + state), `key_log`.
- **Module:** `handover/` — verify booking+employee, capture, return reconciliation, fuel-deviation flag (advisory, PDP `fuel-deviation-threshold`), odometer-conflict rule (telematics = system of record), key log; offline-ready shapes.
- **Endpoints:** `POST /handovers`, `.../return`, `.../damage`, `GET /vehicles/:id/keys`.
- **Exit (Block D):** end-to-end loop works; **zero bookings on expired documents**; override attempts denied + logged; double-booking race prevented (concurrent create/modify/extend tests — P1-R2-1).

---

## Block E — Governance (M5 entitlements, M8 fines + substitution)

### M5 — `entitlements`
- **DB (`0011_entitlement`):** `entitlement_request`, `bsd_return_window`.
- **Module:** `entitlements/` — request types, eligibility pre-check (PDP `dedicated-vehicle-eligibility`, D8), justification, approval chain to **Cluster CEO** (PDP `entitlement-approval-chain` via workflow), driver consent before allocation, BSD leave return (from HCM calendar, auto-revert), utilisation/justification report.
- **Endpoints:** `POST /entitlements`, `.../submit`, approval via workflow, `GET /entitlements/:id`, `POST /entitlements/:id/bsd-windows`.

### M8 — `fines` (+ substitution model)
- **DB (`0012_fines`):** `fine` (booking_id nullable, attributed_person_id, attribution_basis), `black_point`, `accident`, `recovery_record`, **`substitution_window`** (data model live in Phase 1; UI Phase 2).
- **Module:** `fines/` — auto-attribution to booking-active driver (else assigned driver, honouring substitution windows), fines-per-user + ≥3/12mo HR alert (PDP `fines-hr-threshold`), accidents register, **black-point transfer** deadline + platform-wide `access_block` (PDP `black-point-timeframe`), minimal recovery record. **Minimal admin/API entry** for substitution windows (P1-R2-4).
- **Endpoints:** `POST /fines`, `POST /accidents`, `GET /fines`, `POST /fines/:id/recovery`, `POST /vehicles/:id/substitution-windows`.
- **Exit (Block E):** entitlement runs the Cluster-CEO chain; a fine in a substitution window attributes to the substitute; overdue black-point blocks the driver platform-wide.

---

## Block F — Read models (M9 dashboards)
- **Module:** `dashboards/` — read-optimised query services / materialized views over the slices above; **role + scope cost-masking** (Finance unmasked; Executive aggregate-only). Feeds utilisation, fines-per-user, compliance heat map, entitlement inventory, telematics coverage %.
- **Endpoints:** `GET /operations/overview` (replace the mock), dashboard read endpoints.
- **Exit:** cost masked per role; KPI tiles live; scope changes refetch.

## Block G — Hardening → production readiness
- Load/soak/failover with **real modules + migrated data** (binding run); migration dry-runs; security-pipeline + pen test; **PDPL D4 sign-off**; timed RPO/RTO + outbox/DLQ replay; GS Pool UAT; sponsor go/no-go.

---

## 6. Critique & gap analysis — Round 1 (sequencing, dependencies, scope)

| # | Gap | Sev | Resolution |
|---|---|---|---|
| P1B-R1-1 | Trip-attach (Block C) built before Booking (Block D) → untestable | H | Bookings port + test-double in C; full integration at start of D |
| P1B-R1-2 | 6 of 12 rule tables need closed decisions (D8/D9/D12/D14/D3/D6) | H | Split "engine complete" (Block A) from "tables populated + 2nd-approved"; track per rule type; fixtures until closed |
| P1B-R1-3 | Consent hard-gate blocks all booking if D7 (EN+AR wording) slips | H | Pre-load Legal-reviewed v0 to unblock *build* (not go-live); escalate D7 with a date |
| P1B-R1-4 | Migration ≥98% gate needs a cleansing sprint not in a block | H | Run cleansing in parallel with Blocks B–E; steward assigned at kickoff |
| P1B-R1-5 | Compliance ladders + booking reminders need the notification dispatcher | M | Build the dispatcher in Block A/D (P1-R1-5) |
| P1B-R1-6 | Eligibility depends on HCM-synced person data; sync not scheduled | H | Define HCM sync + freshness SLA in Block A; fail-direction = block + escalate (P1-R2-2) |
| P1B-R1-7 | "Basic executive view" over-promises at one pool | M | Tag Phase-1 KPIs measurable-now vs Phase-2; scope M9 to measurable set |

## 7. Critique & gap analysis — Round 2 (correctness, concurrency, security, edges)

| # | Gap | Sev | Resolution |
|---|---|---|---|
| P1B-R2-1 | Double-booking race: availability vs commit must share one reservation range | H | Persist PDP-expanded `reservation_start/end` + policy version; `btree_gist` exclusion; concurrent create/modify/extend tests |
| P1B-R2-2 | Eligibility vs HCM freshness: stale sync allows ineligible driver / outage blocks everyone | H | Freshness SLA; fail-safe = block + escalate; show "data as of" at the gate |
| P1B-R2-3 | Consent atomicity: number issued but consent write fails (or vice-versa) | H | Single transaction: consent pointer + booking + audit + outbox; number issued only after consent row committed |
| P1B-R2-4 | Substitution model unreachable (UI is Phase 2) → mis-attribution persists | M | Minimal admin/API entry to record windows in Block E |
| P1B-R2-5 | Time-zone/DST: UTC store + Asia/Dubai UI across windows, buffers, 24h/1h reminders, expiry ladders | M | Centralize conversion; tz-boundary test cases; document the rule |
| P1B-R2-6 | D4 (PDPL) sign-off is late but telematics privacy built in Block C | M | Pull D4 to precede Block C; build to the decided policy |
| P1B-R2-7 | Fine attribution edge: fine at exact substitution-window boundary / overlapping windows | M | Define boundary rule (inclusive/exclusive); tests for overlap + no-active-booking |
| P1B-R2-8 | Post-go-live correction of a bad migrated record vs append-only/steward sign-off | L | Corrective-entry pattern (new versioned record + audit reason), never in-place edit |
| P1B-R2-9 | Hard-block override attempt must be a logged denial, never a silent pass | H | Attempts logged in exception report; test proves no override path exists |

## 8. ✅ Production-readiness gate — Phase 1 (all must pass, reviewer-verified)

- [ ] All **12 PDP rule types** pass decision-table tests; production values either signed-off (D-list) or explicitly running on flagged fixtures with dated risk.
- [ ] **SoD-01..08** proven by executable tests; hard-block override attempts denied + logged.
- [ ] **Consent hard gate:** no booking number / allocation without a committed, versioned consent record; re-consent on material change; single-transaction atomicity tested.
- [ ] **Zero bookings possible on expired Mulkiya/insurance** (hard block), proven.
- [ ] **Double-booking race** impossible (`btree_gist` + concurrent tests green).
- [ ] Inventory migrated **≥98% complete**, steward signed off; corrective-entry pattern defined.
- [ ] Telematics: ≥90% simulated coverage; trip-attach verified against adversarial trips; `TelemetrySource` swap-tested; **D4 PDPL sign-off**.
- [ ] Fine auto-attribution correct incl. substitution windows + boundary/overlap edges.
- [ ] **Binding load test** (real modules + migrated data) passes: eligibility p95 < 500 ms · PDP p95 < 200 ms · `api` event-loop p99 < 10 ms · ingest lag → 0 < 60 s.
- [ ] Timed **RPO ≤1h / RTO ≤4h** restore + outbox/inbox/DLQ/scheduled-work replay drill passes.
- [ ] Pen test + security pipeline pass; audit hash chain verifies end-to-end.
- [ ] GS Pool UAT signed; no open Sev-1/Sev-2; sponsor/security/ops go/no-go signed; rollback authority named.
- [ ] Round 1 & Round 2 findings each **closed or accepted-with-dated-risk**.

> Phase 1 is the core loop. It is **not** production-ready until every box is green with attached evidence (a doc edit is not evidence).

**Next:** [Phase 2 — Scale & Automate](02_phase2-scale-automate.md).
