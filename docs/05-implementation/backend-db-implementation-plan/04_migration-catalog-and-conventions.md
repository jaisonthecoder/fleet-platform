# Migration Catalog & Conventions (Backend + DB)

The ordered, forward-only Drizzle migration list across all phases, plus the DB and backend conventions and the per-slice Definition of Done. Pairs with [`02_Database_Design`](../../implementation-plan/02_Database_Design.md).

---

## 1. Ordered migration catalog

Migrations are **forward-only**, checked in, run in CI, reviewed like code. Each has a **compensating migration** for rollback. `organization_id` is present from the first migration (inert). Numbers below are the **actual `drizzle/migrations/` filename numbers** — Phase 0 shipped as `0000`–`0003` (the baseline plus two hardening migrations), so Phase-1 feature migrations begin at `0004`.

| # | Migration | Phase | Tables / changes | Notes |
|---|---|---|---|---|
| 0000 | `platform_core` | 0 | organization (seed), hierarchy_node (ltree), person, role_assignment, delegation, sod_exception, policy_rule, policy_version, decision_log, workflow_instance, workflow_step, audit_log, outbox_event, inbox_message, scheduled_work | enable pgcrypto/ltree/btree_gist; dormant organization_id; GIST(path); audit hash-chain trigger + per-org advisory lock; policy_version insert-only; unique(consumer,message_id) |
| 0001 | `telemetry_hypertable` | 0 | telemetry | TimescaleDB `create_hypertable('fleet.telemetry','time')` |
| 0002 | `audit_chain_seq` | 0 | +audit_log.chain_seq, unique(org, chain_seq); trigger rewrite | per-org monotonic chain sequence (concurrency fix P0-R2-1) |
| 0003 | `workflow_status_modification` | 0 | `fleet_workflow_status` += `ModificationRequested` | request-modification outcome (Sub-Phase 1A) |
| 0004 | `lookup_identity` | 1 | lookup_type, lookup_value (incl. seeded `hierarchy-level`), user_account; +hierarchy_node.name_ar/level_code; +role_assignment.source/assigned_by_person_id | bilingual EN/AR; parent-child; **code-not-label (ADR-009)**; SSO JIT provisioning + admin role assignment; HCM-ready |
| 0005 | `vehicle` | 1 | vehicle, vehicle_document, vehicle_lifecycle_history, vehicle_transfer, vehicle_hierarchy_assignment | uniqueness plate/vin/salik/darb; bus/equipment ⇒ not bookable trigger; expiry indexes; assignment exclusion |
| 0006 | `migration` | 1 | import_batch, import_row, dedup_candidate | completeness score |
| 0007 | `telematics` | 1 | device, device_pairing, trip, telematics_alert | domain tables; retention/continuous-aggregates on the telemetry hypertable |
| 0008 | `compliance` | 1 | compliance_item, eligibility_evaluation, access_block | partial indexes on expiries where not-expired |
| 0009 | `booking` | 1 | booking, waitlist_entry, booking_event, consent_record, consent_lifecycle_event | **btree_gist exclusion** on (vehicle_id, reservation range) for active statuses; consent insert-only |
| 0010 | `handover` | 1 | handover, damage_pin, key_log | damage_pin normalized x/y + region + template_version |
| 0011 | `entitlement` | 1 | entitlement_request, bsd_return_window | |
| 0012 | `fines` | 1 | fine, black_point, accident, recovery_record, substitution_window | attribution_basis; substitution model live in P1 |
| 0013 | `geofence` | 2 | geofence_corridor, route_deviation_event | D21 |
| 0014 | `fuel` | 2 | fuel_transaction, fuel_card, ocr_proposal | ocr-worker |
| 0015 | `toll` | 2 | toll_account, toll_transaction | recharge policy |
| 0016 | `vendor_lease` | 2 | vendor, lease_contract, off_hire, vendor_scorecard | renewal ladder |
| 0017 | `behaviour` | 2 | behaviour_score, behaviour_event | HR gate |
| 0018 | `recovery_api` | 2 | recovery_instruction, api_client, webhook_subscription, replacement_link | payroll (D13-gated); public API |
| 0019 | `ai_intelligence` | 3 | recommendation, recommendation_feedback, maintenance_prediction, anomaly_flag, damage_comparison | one recommendation+decision pattern |
| 0020 | `copilot` | 3 | copilot_session, copilot_action | attributed + logged |
| 0021 | `esg_intl` | 3 | esg_snapshot, emission_factor, jurisdiction_pack, currency_rate | D10 |
| 0022 | `decision_log_hypertable` | 3 | migrate decision_log → Timescale hypertable | high-write at scale |

## 2. DB conventions (from `02_Database_Design`)

- Schema `fleet` (telemetry may live in `telemetry`). PKs `uuid` (`gen_random_uuid()`), column `id`.
- Timestamps `*_at_utc timestamptz` (business time UTC; UI localises to Asia/Dubai). Money `numeric(14,2)` + `currency char(3) DEFAULT 'AED'` — never floats.
- Enums for closed sets; lookup tables where org-configurable.
- **Soft-state, not soft-delete** — nothing operational hard-deleted (history + audit depend on it).
- Dormant `organization_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'` on core tables; **RLS off**; app code never branches on it (CI grep guard).
- Hot path: `btree_gist` exclusion on booking reservation ranges; partial indexes on compliance expiries; Timescale hypertables + retention for telemetry and (Phase 3) decision_log.

## 3. Backend conventions (from `03_Backend_Design`)

- Modular monolith, 3 (→4) entrypoints; each Nest module **exports only its service**; internals in `internal/`; `dependency-cruiser` enforced in CI.
- REST under `/api/v1`, OpenAPI at `/api-docs` (non-prod). Every DTO a Zod schema in `contracts/`.
- **Every PEP asks the PDP; never decides.** **Every state change** = domain state + append-only audit + outbox in one transaction; Service Bus from the outbox dispatcher; consumers dedupe via inbox.
- Errors → RFC-7807 with stable machine reason codes → localised EN/AR on the client.
- Background/critical work in `scheduled_work` (Postgres ledger) + BullMQ execution + reconciler; heavy processors sandboxed, never on the `api` main thread.

## 4. Migration & rollback pattern
- Never `synchronize`. Each migration ships with a **compensating migration**; a migration-test harness applies forward + compensate in CI.
- Data backfills are separate, idempotent, resumable jobs (not inline in DDL migrations).
- Extension enablement (`pgcrypto`, `ltree`, `btree_gist`, `timescaledb`) confirmed against the Azure `azure.extensions` allowlist per environment before the migration runs.

## 5. Definition of Done (every backend/DB slice)
- [ ] FRs cited in the PR; behaviour matches the governing PRD.
- [ ] Business rules via the PDP, not hard-coded (CI grep guard passes).
- [ ] Relevant SoD rules have explicit passing tests.
- [ ] Every state-changing action emits an audit entry; policy version recorded on the transaction.
- [ ] Migration applies forward + compensates cleanly in CI; seed/FK tests pass.
- [ ] `dependency-cruiser`, `tsc --noEmit`, oxlint, contract-drift, `organization_id` grep guard all green.
- [ ] No new synchronous CPU work in `api` (event-loop-lag considered).
- [ ] Unit tests on logic; integration tests on the correctness-critical paths (PDP, SoD, consent sequencing, fine attribution, audit chain).
- [ ] Reason codes translated EN + AR; no secrets outside Key Vault / managed identity.

## 6. Production-readiness principle (applies to every phase)
A phase is **production-ready only when its gate is fully green with reviewer-attached evidence** — a document edit is never evidence. Each phase carries **two adversarial critique rounds**; every finding must be **closed or accepted-with-dated-risk** by the reviewer before the phase is declared done. This plan governs the **core** of the application; treat every slice as production code, not a spike.
