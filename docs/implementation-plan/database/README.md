# Database — Phase-by-Phase Implementation Plan

**Source of truth:** [`../02_Database_Design.md`](../02_Database_Design.md) (conventions, schema, audit hash chain, telemetry hypertable, indexing, migrations) · **Consumers:** [`../03_Backend_Design.md`](../03_Backend_Design.md) · **Sequencing/gates:** [`../06_Phase_Plan_and_Delivery.md`](../06_Phase_Plan_and_Delivery.md).

**Engine:** PostgreSQL (Azure Flexible Server, UAE North) + **TimescaleDB** + `pgcrypto`. **ORM/migrations:** Drizzle + Drizzle Kit — checked in, **forward-only**, run in CI. **One database per organization** (no active multi-tenancy; dormant `organization_id` seam per ADR-008).

---

## How to use this plan

Each phase is a **separate file** describing the schema delta for that phase (tables, columns, enums, indexes, constraints, migrations, and data tooling). Work a phase to its **Inspection Gate**, run the gap analysis, **fix every gap**, pass the exit criteria, then start the next phase.

| Phase | File | Schema scope (headline) |
|-------|------|--------------------------|
| 0 — Foundation (Sprint 0) | [db-phase-0-foundation.md](db-phase-0-foundation.md) | Conventions + baseline: `organization` (dormant seam), `hierarchy_node`, `person`, `role`/`role_assignment`, `delegation`, `sod_exception`, `audit_log` (hash-chain trigger), `policy_rule`/`policy_version`/`decision_log` (2 rule types), `workflow_*` skeleton, `telemetry` hypertable skeleton; migrations + CI grep guard + seed |
| 1 — MVP | [db-phase-1-mvp.md](db-phase-1-mvp.md) | Full `vehicle` (6 groups) + docs/history/transfer, `booking`/`waitlist`/`booking_event`/`consent_record`, `entitlement_request`/`bsd_return_window`, `handover`/`damage_pin`/`key_log`, `compliance_item`/`eligibility_evaluation`/`access_block`, `fine`/`black_point`/`accident`/`recovery_record`/`substitution_window`, migration tables, `device`/`device_pairing`/`trip`/`telematics_alert`; conflict-safe booking, expiry indexes, retention |
| 2 — Scale & Automate | [db-phase-2-scale-automate.md](db-phase-2-scale-automate.md) | `vendor`, `lease_contract`, `offhire`, `fuel_invoice`/`fuel_card`, `toll_transaction`, `behaviour_score`, `recovery_instruction`, break-glass, `recurring_booking_series`, OCR proposal tables; `decision_log` → hypertable |
| 3 — Intelligence & International | [db-phase-3-intelligence-international.md](db-phase-3-intelligence-international.md) | Feature/model tables, ESG factors, jurisdiction-pack config, BI/curated feed, CV comparison results; multi-region/residency schema stance |

## Non-negotiables carried into every phase (from 02 §1, §9)

1. **UUID PKs** (`gen_random_uuid()`), **UTC `timestamptz`** business time, **`numeric(14,2)` money** + currency.
2. **Dormant `organization_id`** on every core table (RLS OFF, never read by app code) — CI grep guard from migration 0.
3. **Append-only, hash-chained `audit_log`** — no `UPDATE`/`DELETE`; chain verified end-to-end.
4. **Soft state, not soft delete** — lifecycle/status transitions; history + audit depend on it.
5. **Forward-only migrations**, reviewed like code, run in CI; never `synchronize: true`.
6. **Consent + docs in immutable/WORM Blob** with Postgres pointer rows; never updated in place.

## The inspection-gate discipline

Every phase file ends with **§ Inspection Gate — Gaps, Planned Remediation & Evidence**: a review pass records gap ID, severity, impact, planned remediation and owner. Closure requires a result, evidence URI and reviewer before advancement; High gaps block advancement.
