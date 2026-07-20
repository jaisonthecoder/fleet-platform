# Database — Phase 0 (Foundation / Sprint 0, Weeks 1–4)

**Goal:** establish schema conventions, the baseline platform/policy/workflow/telemetry skeleton, the tamper-evident audit chain, the dormant multi-org seam, and the migration + seed pipeline — all in CI — before any feature table.

**Source:** [`../02_Database_Design.md`](../02_Database_Design.md) §1–§5, §9–§10 · [`../06_Phase_Plan_and_Delivery.md`](../06_Phase_Plan_and_Delivery.md) Phase 0.

---

## 1. Objectives

- Provision extensions (`pgcrypto`, `timescaledb`, `ltree`, `btree_gist`) and the naming-neutral `fleet` (+ `telemetry`) schema.
- Ship migration 0 with **conventions** (UUID PKs, UTC timestamps, money type, `updated_at` trigger, **dormant `organization_id`**).
- Create the **platform** tables, **policy** tables (for 2 rule types), **workflow** skeleton, **`audit_log`** with the hash-chain trigger, and the **`telemetry` hypertable** skeleton.
- Establish **Drizzle Kit** migrations in CI (forward-only) + the **compensating-migration** convention + **seed** data.

## 2. Schema delta (this phase)

| Group | Tables (columns per 02) | Notes |
|-------|-------------------------|-------|
| Platform | `organization`, `hierarchy_node`, `person`, `role`, `role_assignment`, `delegation`, `sod_exception` | `hierarchy_node.path` via `ltree`; `role_assignment` unique `(person_id, role, scope_node_id)` |
| Audit | `audit_log` (+ hash-chain trigger) | append-only; `UPDATE`/`DELETE` revoked at role level |
| Policy | `policy_rule`, `policy_version` (JSONB), `decision_log` | seed 2 rule types: `booking-buffer`, `driver-eligibility` |
| Workflow | `workflow_instance`, `workflow_step` | skeleton only; escalation timers wired in Phase 1 |
| Delivery | `outbox_event`, `inbox_message`, `scheduled_work` | transactional event delivery, consumer idempotency, durable critical-work ledger |
| Telemetry | `telemetry` hypertable | `create_hypertable('telemetry','time', partitioning 'vehicle_id')`; retention + continuous-aggregate policy stubs |

## 3. Cross-cutting DDL

- **Extensions:** `CREATE EXTENSION pgcrypto; CREATE EXTENSION timescaledb; CREATE EXTENSION ltree; CREATE EXTENSION btree_gist;` (requires the Azure `azure.extensions` allowlist — infra prerequisite, see gap P0D-1).
- **Dormant seam:** seed `fleet.organization` with valid UUID `00000000-0000-4000-8000-000000000001`; every core table gets the same `organization_id` default plus an FK to that row; **RLS stays OFF**; no policy created.
- **`updated_at` trigger:** a shared trigger function maintains `updated_at_utc` on write.
- **Audit hash chain (02 §9):** insert trigger acquires `pg_advisory_xact_lock(hashtextextended(organization_id::text, 0))`, reads the latest organization hash, and computes the next versioned canonical hash. The same canonicalization function powers verification.
- **Migrations:** Drizzle Kit, checked in, forward-only; a documented **compensating-migration** pattern (no destructive down-migrations on prod data); migration dry-run in CI.

## 4. Seed data (dev/test)

`organization` (AD Ports) · `hierarchy_node` tree: 1 Cluster (Ports) → 1 Pool (GS Pool, Mina Zayed) → 1 Location · the 16 `role` values · 3 `person` rows (employee, line manager, fleet manager) with `role_assignment`s · the 2 seed `policy_rule`/`policy_version` decision tables. Seed is idempotent and reused by backend integration tests.

## 5. Acceptance (Phase-0 exit)

- [ ] Migration 0 applies cleanly forward in CI on a fresh Postgres+Timescale (Testcontainers).
- [ ] `audit_log` insert trigger produces a **verifiable chain**; a **concurrent-insert test** shows no fork/duplicate.
- [ ] `UPDATE`/`DELETE` on `audit_log` **denied** to the app role (proven by test).
- [ ] Command transaction writes state + audit + `outbox_event` atomically; crash-before-publish replay delivers once to an `inbox_message`-protected consumer.
- [ ] Redis/worker-loss test proves due `scheduled_work` rows are re-enqueued and completed after recovery.
- [ ] CI grep guard proves no app code references `organization_id`.
- [ ] `telemetry` hypertable accepts a **batched COPY** and a retention policy is set.
- [ ] Seed produces a runnable dev dataset.

## 6. Inspection Gate — Gaps, Planned Remediation & Evidence

| # | Gap found on inspection | Sev | Impact | Planned remediation | Owner |
|---|---|---|---|---|---|
| P0D-1 | `timescaledb`/`pgcrypto` require the Azure **`azure.extensions` allowlist** + WORM consent container — infra lead time | H | Migration 0 cannot run | Raise the allowlist + WORM request in **Week 0** (Azure Resource Request §5); block Sprint-0 start on confirmation | Platform |
| P0D-2 | **Audit chain fork under concurrency** — naive `prev_hash` read is racy | H | Tamper-evidence unreliable | Transaction-scoped advisory lock per organization + versioned canonical payload; concurrent-insert test in exit criteria | DB |
| P0D-3 | `hierarchy_node.path` (`ltree`) vs plain text not decided; roll-up/scope queries depend on it | M | Slow scope queries / rework | Commit to `ltree` + `GIST(path)` index now; document the write path that maintains `path` on insert/move | DB |
| P0D-4 | `decision_log` is **high-write**; a plain table will bloat | M | Query/vacuum pressure by Phase 2 | Keep it a normal table in P0/P1 with a time index; **plan its migration to a Timescale hypertable in Phase 2** (recorded) | DB |
| P0D-5 | Forward-only stated but **no compensating-migration convention / test harness** | M | No safe prod rollback | Establish the convention + a migration-test in CI this phase | DB |
| P0D-6 | `updated_at` trigger + soft-state rules not encoded as a shared function | L | Drift across tables | Ship one shared trigger function applied to all core tables | DB |
| P0D-7 | Seed data ownership overlaps backend (P0B-5) | L | Duplicate/ް conflicting seeds | Single canonical seed script owned by DB, consumed by backend tests | DB + Backend |

**Exit criteria (all green):** §5 acceptance passes; P0D-1 and P0D-2 have passing evidence; P0D-3..P0D-5 are closed or formally deferred with accepted risk; migration 0 + seed + chain tests green in CI. → proceed to [Phase 1](db-phase-1-mvp.md).
