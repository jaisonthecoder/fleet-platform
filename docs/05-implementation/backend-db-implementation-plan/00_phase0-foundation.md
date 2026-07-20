# Phase 0 — Foundation (Backend + DB)

**Goal:** stand up the non-retrofittable core — the platform module, the real PDP, the hash-chained audit, the DB baseline, and the shared contracts — and prove it before a single feature. Nothing here is user-facing; everything here is impossible to add cleanly later.

**Entry state:** `app-api` foundation is green; DB is empty; `policy`/`operations`/`telematics` are stubs. **Exit:** the production-readiness gate in §7 is fully green.

> This is the core of the application. Treat every item as production code from day one — not a spike to be rewritten.

---

## 1. Slices

### Slice 0.1 — Contracts package + CI drift guard
- **Contracts:** promote `app-api/src/contracts/` into the authoritative Zod schemas; add the canonical **RFC-7807 problem + reason-code** contract; establish code-generation of UI types.
- **CI:** drift guard (regenerate → `git diff` must be clean); `tsc --noEmit` whole-project; `oxlint`; `dependency-cruiser`; **`organization_id` grep guard** (`src/modules/**` except `drizzle/**`); migration-test harness.
- **Tests:** contract round-trip tests; a deliberately-broken drift test proves the guard fails CI.
- **Exit:** all guards run in CI and fail on injected violations.

### Slice 0.2 — DB baseline I: platform tables (migration `0001_platform`)
- **DB:** enable `pgcrypto`, `ltree`, `btree_gist` (timescaledb already on). Create `organization` (seed row `00000000-0000-4000-8000-000000000001`), `hierarchy_node` (`ltree path`, `valid_from/to`, GIST index), `person`, `role`, `role_assignment` (unique `person,role,scope_node_id`), `delegation`, `sod_exception`, `vehicle_hierarchy_assignment` (effective-dated, exclusion constraint). Dormant `organization_id` on every core table.
- **Tests:** fresh-migration test; FK/seed test; hierarchy 3/4/5-level + transfer + restructure-history query tests (closes B-07).
- **Exit:** `pnpm db:migrate` builds the schema on local Postgres; tests green.

### Slice 0.3 — DB baseline II: policy, workflow, audit, eventing (migration `0002_platform_core`)
- **DB:** `policy_rule`, `policy_version` (immutable JSONB), `decision_log`; `workflow_instance`, `workflow_step`; `audit_log` (hash-chain trigger + per-org advisory lock); `outbox_event`, `inbox_message`, `scheduled_work`.
- **Tests:** audit hash-chain integrity under **concurrent writes** (closes P0-R2-1/B-10); outbox insert-in-same-transaction test; scheduled_work lease/reconcile test.
- **Exit:** concurrent-write chain verification passes; migration reversible via compensating pattern.

### Slice 0.4 — Platform module (M1) + auth
- **Module:** `platform/` — `HierarchyService` (N-level tree, scope roll-up via `path`), `AccessService` (RBAC by `role_assignment` scope), **`SodGuard`** (8 rules), `AuditService` (hash-chained append), `DelegationService`. **Entra auth (OIDC/JWT)** + a **dev-login mode** so build proceeds without IT (P0-R1-2).
- **Endpoints:** `GET /me` (roles+scopes), `GET /hierarchy`, `POST /delegations`, `GET /audit` (Internal Audit, read-only), `GET /reports/exceptions`.
- **Tests:** **SoD-01** (no self-approval) integration test; scope-resolution tests; audit-on-every-write.
- **Exit:** SoD-01 proven by test; `/me` returns correct roles+scopes for a seeded user.

### Slice 0.5 — The real PDP (replace the stub)
- **Module:** `policy/` PDP — replace `policy-evaluator.service.ts` with the real evaluator over **versioned immutable JSONB decision tables**, top-down first-match-wins + mandatory default, **Redis compiled-rule cache** with bounded Postgres read-through on miss, `decision_log` write in the caller transaction, **fail-safe = DENY + escalate**.
- **Phase 0 registers 2 rule types** (booking-buffer, driver-eligibility) end-to-end as the pattern; the other 10 land in Phase 1 Block A.
- **Endpoints:** `POST /v1/decisions/evaluate` (internal contract).
- **Tests:** `evaluate()` p95 **< 200 ms**; **PDP outage ⇒ DENY** (fail-safe); version activation invalidates cache; decision logged.
- **Exit:** latency + fail-safe + activation/invalidation tests green (closes B-08).

### Slice 0.6 — Workflow engine skeleton + escalation
- **Module:** `workflow/` — chain execution, delegation binding, timeout escalation on `scheduled_work` + BullMQ; interim **escalation stub** so the PDP fail-safe "+ escalate" half is testable (closes P0-R2-2).
- **Tests:** escalation timer fires; delegated decision logged "on behalf of".
- **Exit:** a two-step chain runs; timeout escalates.

### Slice 0.7 — `telematics-ingest` skeleton (real pipe)
- **Module:** replace the heartbeat stub with the real pipe — `SimulatorSource` → canonical schema → **batched Timescale COPY** → emit domain events. `telemetry` hypertable + retention/continuous-aggregate config. No domain logic in ingest.
- **Tests:** batched COPY (not per-row); backpressure bound; event-loop-lag stays low under burst.
- **Exit:** the load-test **floor** (§6) passes with simulator data.

### Slice 0.8 — Observability & ops gates
- **Build:** event-loop-lag p99 alert (>10 ms on `api`), latency dashboards, budget alerts (70/90/100%), OpenTelemetry across all deployables (P0-R1-5, P0-R2-6).
- **Exit:** alert fires in a synthetic test; dashboards live.

---

## 2. DB deliverables (Phase 0)

| Migration | Tables | Key constraints |
|---|---|---|
| `0001_platform` | organization, hierarchy_node, person, role, role_assignment, delegation, sod_exception, vehicle_hierarchy_assignment | ltree GIST on path; unique(person,role,scope_node_id); exclusion on assignment windows; dormant organization_id |
| `0002_platform_core` | policy_rule, policy_version, decision_log, workflow_instance, workflow_step, audit_log, outbox_event, inbox_message, scheduled_work | audit hash-chain trigger + advisory lock; policy_version insert-only; unique(consumer_name,message_id) |

## 3. Backend deliverables (Phase 0)

| Module | Endpoints | PDP rule types | Events |
|---|---|---|---|
| `platform` | `GET /me`, `GET /hierarchy`, `POST /delegations`, `GET /audit`, `GET /reports/exceptions` | — | audit writes |
| `policy` (PDP) | `POST /v1/decisions/evaluate` | booking-buffer, driver-eligibility | decision_log |
| `workflow` | (internal) | approval-chain (skeleton) | scheduled_work |
| `telematics/ingest` | (no HTTP) | — | TripStarted/Ended, DeviceSilent |

---

## 4. Critique & gap analysis — Round 1 (completeness, dependencies, sequencing)

| # | Gap / critique | Sev | Resolution |
|---|---|---|---|
| P0B-R1-1 | Azure/Entra provisioning (quota, WORM, app regs, MFA CA) has lead time; "deploy to dev" assumes it done | H | Week-0 pre-flight (all `09_Azure_Resource_Request` items); dev-login mode unblocks build (P0-R1-1/2) |
| P0B-R1-2 | No `dev` seed data → no integration test can run | H | Seed script (hierarchy nodes, roles, a test person) as a Slice-0.2 deliverable (P0-R1-4) |
| P0B-R1-3 | PDP built with only 2 rule types → load test passes trivially on a near-empty DB | M | Label the Wk4 run a **floor**; the binding run is Phase 1 Block G with real modules + migrated data (P0-R1-6) |
| P0B-R1-4 | Contracts package ownership vs the concurrent app-ui session (drift both ways) | H | Lock contract shapes jointly before hardening; drift guard fails CI on either side |
| P0B-R1-5 | Notification dispatcher (P9) unowned but audit/compliance/booking will need it | M | Build the dispatcher **port** in Phase 1 Block A/D; stub delivery in Phase 0 |
| P0B-R1-6 | `organization_id` grep guard undefined → false failures on legit migration refs | M | Define: no `src/modules/**` reference except `drizzle/**`; allowlist + guard test (P0-R1-3) |
| P0B-R1-7 | Migration rollback path unproven | M | Establish compensating-migration convention + migration-test harness in Phase 0 (P0-R2-5) |

## 5. Critique & gap analysis — Round 2 (correctness, concurrency, security)

| # | Gap / critique | Sev | Resolution |
|---|---|---|---|
| P0B-R2-1 | Audit hash-chain forks under concurrent writes → tamper-evidence breaks; go-live verification fails intermittently | H | Per-org advisory lock (transaction-scoped) or SERIALIZABLE; **concurrent-write chain-integrity test** in Phase 0 (B-10) |
| P0B-R2-2 | PDP fail-safe proves DENY but "+ escalate" is untestable without workflow | M | Interim escalation stub in Slice 0.6; complete escalate test in Phase 1 Block A (P0-R2-2) |
| P0B-R2-3 | PDP Redis cache staleness on version activation → stale decisions | H | Cache invalidation on activation + a test that an activated version is used within one request cycle |
| P0B-R2-4 | Dev-login mode could leak to non-dev | H | Guard dev-login behind `NODE_ENV`/explicit flag; CI check rejects dev-login in prod config; security review |
| P0B-R2-5 | `decision_log`/`audit_log` may store excess PII (context payloads) | M | Store minimized field fingerprint, not raw context; privacy review (B-12) |
| P0B-R2-6 | Timescale write path could leak CPU into `api` if domain logic creeps into ingest | H | dependency-cruiser rule (ingest ⇏ bookings/entitlements/handover); event-loop-lag alert on `api` |
| P0B-R2-7 | Outbox dispatcher duplicate/lost publish on crash | M | Inbox idempotency + at-least-once + DLQ replay test (crash/replay) (B-11) |
| P0B-R2-8 | `btree_gist`/`ltree` extensions not in Azure allowlist for higher envs | M | Confirm `azure.extensions` allowlist includes them (local already has); Platform gate |

## 6. Validation & verification

| Property | How proven |
|---|---|
| SoD-01..(subset) | Integration test: a user cannot approve their own booking |
| Audit integrity | Concurrent-write chain verification job recomputes end-to-end |
| PDP latency | Load harness: `evaluate()` p95 < 200 ms |
| PDP fail-safe | Kill PDP → consumer returns DENY + escalation event |
| Migrations | Fresh-migrate + compensating-migrate in CI; seed/FK test |
| Boundaries | dependency-cruiser: ingest ⇏ request-path; 0 violations |
| Org seam | grep guard: no app-code `organization_id` branch |
| **Load-test floor** | 5,000-vehicle simulated burst + booking concurrency: eligibility p95 < 500 ms · PDP p95 < 200 ms · `api` event-loop p99 < 10 ms · ingest lag → 0 within 60 s |

## 7. ✅ Production-readiness gate — Phase 0

Phase 0 is **production-ready** only when **all** are green (reviewer-verified, evidence attached — not self-asserted):

- [ ] Both migrations apply forward + compensate cleanly in CI; seed + FK + 3/4/5-level hierarchy tests pass.
- [ ] `audit_log` hash chain verifies **under concurrent load**; no UPDATE/DELETE possible (role-revoked).
- [ ] PDP: p95 < 200 ms; outage ⇒ DENY + escalate (both halves); version activation invalidates cache — all tested.
- [ ] SoD-01 proven; `AccessService` scope resolution correct for 3/4/5-level trees.
- [ ] `organization_id` grep guard, `tsc --noEmit`, oxlint, dependency-cruiser, contract-drift, migration-test = required CI gates, all green.
- [ ] `telematics-ingest` writes via batched COPY; **load-test floor passes**; `api` event-loop p99 < 10 ms during burst.
- [ ] Outbox/inbox crash-replay + DLQ test passes.
- [ ] Dev-login cannot activate in prod config (CI-checked); decision/audit logs store minimized PII (privacy review noted).
- [ ] Event-loop-lag alert + latency dashboards + budget alerts live.
- [ ] Round 1 & Round 2 findings above are each **closed or accepted-with-dated-risk** by the reviewer.

> Do not begin Phase 1 features until this gate is green. Escalation "+ human" half and the *binding* load test complete in Phase 1 (Block A / Block G) — noted, not deferred silently.

**Next:** [Phase 1 — MVP](01_phase1-mvp.md).
