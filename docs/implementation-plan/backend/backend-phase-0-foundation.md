# Backend — Phase 0 (Foundation / Sprint 0, Weeks 1–4)

**Goal:** prove the architecture before any feature. Exit only when the load test passes and the four non-retrofittable foundations exist and are tested. **No booking/vehicle/entitlement feature is built in this phase.**

**Source:** [`../03_Backend_Design.md`](../03_Backend_Design.md) §1–§3, §5–§10 · [`../06_Phase_Plan_and_Delivery.md`](../06_Phase_Plan_and_Delivery.md) Phase 0 · [`../01_Architecture_and_Tech_Stack.md`](../01_Architecture_and_Tech_Stack.md).

---

## 1. Objectives

- Stand up the **three deployables** (`api`, `pdp`, `telematics-ingest`) from one repo, deploying green to `dev`.
- Establish the **`contracts/` spine** (Zod) shared by all deployables.
- Build the **`platform` skeleton**: Entra auth, RBAC `AccessService`, `SodGuard` (prove SoD-01), and the **hash-chained audit interceptor**.
- Build the **PDP** with 2 rule types + minimized decision evidence + Redis read-through cache + fail-safe.
- Build the transactional **outbox/inbox** and Postgres **scheduled-work ledger** foundations.
- Build the **`telematics-ingest` skeleton** with `SimulatorSource` + Piscina + batched COPY.
- Wire **CI** (dependency-cruiser boundary, `tsc --noEmit`, unit + integration via Testcontainers, migration dry-run) and **OpenTelemetry** incl. the event-loop-lag metric.

## 2. Build order & scope

| Wk | Slice | What to build | Key files |
|----|-------|---------------|-----------|
| 1 | **Repo scaffold** | Monorepo, one `package.json`; `main.ts` / `main.pdp.ts` / `main.ingest.ts`; `Dockerfile.api/.pdp/.ingest`; Fastify adapter; `nestjs-pino`; OTel bootstrap; health/readiness probes; `.dependency-cruiser.js` boundary rule | `src/main*.ts`, `Dockerfile.*`, `.dependency-cruiser.js` |
| 1 | **`contracts/`** | Zod baseline: common scalars, `Verdict`, PDP rule-type input/output contract shape, canonical telemetry `CanonicalPoint`, first domain-event schemas; codegen of UI types + CI drift check | `src/contracts/**` |
| 1–2 | **Auth (Entra)** | `passport-azure-ad`/JWKS validation, session-token exchange, role+scope claims; **dev-login mode** for local | `platform/auth/**` |
| 1–2 | **RBAC + SoD guard** | `AccessService` (scope check vs `role_assignment`), `SodGuard` (rule registry; **SoD-01** wired) | `platform/access/**` |
| 1–2 | **Audit interceptor** | Nest interceptor → append-only, **hash-chained** `audit_log` writes; correlation-id propagation | `platform/audit/**` |
| 3 | **PDP deployable** | `PdpService.evaluate(ruleType, ctx)`; JSONB decision-table eval; bounded Postgres read-through on cache miss; minimized context fingerprint; **fail-safe DENY**; 2 rule types | `policy/**`, `main.pdp.ts` |
| 3 | **Durable delivery** | command transaction writes state + audit + outbox; dispatcher + inbox dedupe; scheduled-work lease/reconciliation worker | `platform/messaging/**`, `platform/work/**` |
| 4 | **`telematics-ingest` skeleton** | `EventProcessorClient` (Blob checkpoint) → Piscina normalize → **batched COPY** to Timescale → emit domain event; `TelemetrySource` interface + `SimulatorSource` (Level A → Event Hubs) | `telematics/ingest/**`, `main.ingest.ts` |
| 4 | **Load test** | Drive the §Phase-0 burst; publish event-loop-lag, PDP p95, gate p95, ingest lag dashboards | (Azure Load Testing) |

## 3. Component detail

- **`contracts/`** — the only place DTO/event/rule-type schemas live; `api`/`pdp`/`ingest` import directly (no package). CI regenerates UI types and fails on a dirty diff.
- **Auth** — validate Entra token → issue session token carrying `roles[]` + `scopes[]`; `AccessService` re-checks every request server-side (client claims are hints only). MFA is conditional-access (infra), enforced for elevated roles.
- **`SodGuard`** — a rule registry keyed by `sod_rule_code`; Phase 0 wires **SoD-01** (no self-approval) with an integration test; the remaining 7 rules land in Phase 1 Block A but the guard contract is fixed now.
- **Audit interceptor** — wraps every state-changing command, capturing actor/action/entity/before/after/reason/correlation-id; the DB trigger computes the per-organization hash chain (see DB Phase 0). Sensitive read auditing is added with the location-data slice before any live data flows.
- **PDP** — exactly the `evaluate` contract in 03 §3. Registry maps `ruleType → Zod input schema + safe default`. Unreachable/no-match ⇒ `{DENY, ['policy-unavailable'], escalate}`. Latency budget **< 200 ms** proven under the load test.
- **`telematics-ingest`** — dumb pipe only; **must not import** `bookings`/`entitlements`/`handover` (dependency-cruiser fails the build otherwise). Backpressure: bounded Piscina queue; stop pulling from Event Hubs when full (lag is a metric, not an outage).

## 4. CI gates (must exist by end of Sprint 0)

`tsc --noEmit` (whole project, incl. specs) · ESLint/Prettier · **dependency-cruiser** boundary · **`organization_id` grep guard** (no app-code reference outside `drizzle/**`) · unit + integration (Testcontainers: Postgres+Timescale, Redis) · migration dry-run · `contracts/`→UI-types drift check · Supertest smoke on all three deployables.

## 5. Acceptance (Phase-0 exit)

- [ ] `api` / `pdp` / `telematics-ingest` deploy to `dev`; health probes green; traces visible in App Insights.
- [ ] Integration test proves **SoD-01** (a user cannot approve a booking they raised — using a minimal stub command).
- [ ] Audit chain **verifies end-to-end** including a **concurrent-write** test (see gap P0B-2).
- [ ] `evaluate()` p95 **< 200 ms**; **PDP outage returns DENY** (fail-safe test) and emits an escalation event.
- [ ] **Load test passes**: eligibility-gate p95 < 500 ms · PDP p95 < 200 ms · `api` event-loop p99 lag < 10 ms · ingest lag → 0 within 60 s.
- [ ] Crash-between-state-commit-and-publish test proves outbox replay and inbox dedupe; Redis-loss test proves scheduled obligations recover.
- [ ] CI grep guard proves no app code references `organization_id`.

## 6. Inspection Gate — Gaps, Planned Remediation & Evidence

> Deliberate review before Phase 1. Severity: **H** blocks Phase 1 · **M** requires an approved deferral or closure · **L** track. The table records planned remediation; closure requires result, evidence URI and reviewer.

| # | Gap found on inspection | Sev | Impact | Planned remediation | Owner |
|---|---|---|---|---|---|
| P0B-1 | External **Entra provisioning** (app regs, security groups, conditional-access) not owned by eng; auth work (wk1–2) blocks on it | H | Sprint 0 stalls | Raise a **Week-0 pre-flight** ticket; ship **dev-login mode** so build proceeds without prod Entra | Platform + Cybersecurity |
| P0B-2 | **Audit hash-chain concurrency** — concurrent appends can fork/duplicate the chain, failing the go-live verification intermittently | H | Tamper-evidence broken under load | Serialize appends (advisory lock / `SERIALIZABLE` insert per DB Phase 0); add a **concurrent-write chain-integrity test** to the exit criteria | Backend + DB |
| P0B-3 | PDP fail-safe proves DENY but **"+ escalate to a human"** is untestable (no workflow until Block A) | M | Fail-safe only half-proven | Ship an **interim escalation stub** (emits `PolicyUnavailable` event to a queue); complete the escalation test in Block A | Backend |
| P0B-4 | `organization_id` grep guard undefined; migrations legitimately reference the column | M | False CI failures / leaky guard | Define guard = "no reference under `src/modules/**` except `src/**/drizzle/**`"; add allowlist + a guard unit test | Backend |
| P0B-5 | No `dev` **seed data** (hierarchy, roles, a test person) → integration tests can't run | M | SoD-01 test unauthorable | Seed script as a wk1 deliverable (coordinated with DB Phase 0 seed) | Backend + DB |
| P0B-6 | Event-loop-lag metric wired but **no alert threshold/dashboard**; acceptance only says "traces visible" | M | Regressions invisible | Add `api` p99 > 10 ms alert + latency dashboards to Sprint-0 DoD | SRE |
| P0B-7 | Wk4 load test runs on a 2-rule skeleton + near-empty DB → passes trivially | M | False confidence | Label it a **floor**; the binding run is Phase 1 Block G with real modules + migrated data (recorded in exit note) | Backend + QA |
| P0B-8 | `contracts/`→UI type **drift** not caught in CI | M | Silent FE/BE contract skew | Add "regenerate + git-diff must be clean" CI step | Backend |

**Exit criteria (all green):** §5 acceptance passes; P0B-1..P0B-5 have passing evidence; P0B-6..P0B-8 are closed or formally deferred with accepted risk; dependency-cruiser + grep guard + `tsc --noEmit` green in CI. → proceed to [Phase 1](backend-phase-1-mvp.md).
