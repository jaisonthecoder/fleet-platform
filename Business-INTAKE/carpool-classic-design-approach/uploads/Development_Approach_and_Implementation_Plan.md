# Carpool & Fleet Management Platform
# Development Approach & Implementation Plan

**Version 1.0 · Companion to Phase 1 MVP PRD (v3.1-P1) · Target: GS Pool, Mina Zayed pilot**

Stack: **NestJS + TypeScript + React + PostgreSQL + Azure (UAE North)**

---

## 1. Guiding Principles

Five rules that govern every technical decision in this document. When a trade-off appears, resolve it against these in order.

| # | Principle | Consequence |
|---|---|---|
| P1 | **The booking path is sacred** | Anything that can spike CPU (telemetry, OCR, exports, bulk migration) runs in a **different process**. The API only ever awaits I/O. |
| P2 | **Build generic, deploy for AD Ports** | Tenant keys, N-level hierarchy and externalized rules are in the MVP. They cannot be retrofitted. AD Ports is the first deployment of a product, not the product. |
| P3 | **Rules live in the policy engine, never in code** | No threshold, chain or buffer is hard-coded anywhere. A build-time checklist maps every PRD threshold to a registered rule type. |
| P4 | **Fail safe, never fail open** | Policy engine unreachable → deny + escalate. Compliance hard-blocks must never silently disable. |
| P5 | **Prove the architecture before building features** | The load test and the audit chain exist in week 4, before the first booking screen. |

---

## 2. Technology Stack — Decisions & Rationale

### 2.1 Confirmed stack

| Layer | Choice | Rationale |
|---|---|---|
| Cloud | **Azure, UAE North (Dubai)** | Consequence, not preference: Entra is the identity provider, Oracle Fusion integration is cloud-to-cloud, and the Data Hosting & Residency Policy mandates UAE residency. |
| Backend | **NestJS + TypeScript** on **Fastify** adapter | Module boundaries + DI discipline suit a modular monolith. Fastify over Express for ~2× throughput — we have hard latency budgets. |
| Frontend | **React 18 + TypeScript + Vite** | Shared types and Zod schemas with the backend. Vite for build speed. |
| Database | **PostgreSQL** (Azure Flexible Server) + **TimescaleDB** extension | One engine to operate in Phase 1. RLS gives cheap, real tenant isolation. Timescale hypertables handle telemetry writes. |
| Cache | **Azure Cache for Redis** | PDP decision cache, eligibility gate cache, BullMQ backing store, Socket.IO adapter. |
| Object storage | **Azure Blob Storage** | Documents, photos, signatures. **Immutable containers** for the consent store. |
| Eventing | **Azure Service Bus** (domain events) + **Event Hubs** (telemetry ingress) | Different tools for different shapes: Service Bus for reliable business events, Event Hubs for high-volume streaming. |
| Identity | **Microsoft Entra ID** (OIDC via MSAL / passport-azure-ad) | Already the group standard. MFA for elevated roles. |
| Compute | **Azure Container Apps** | Simpler than AKS until scale demands it; KEDA scaling built in. |
| IaC / CI | **Bicep** or Terraform + **GitHub Actions** (or Azure DevOps) | Environments reproducible from day one. |
| Observability | **OpenTelemetry → Application Insights** | Satisfies NFR-OBS out of the box; one trace view across all deployables. |

### 2.2 Library choices that matter

| Concern | Choice | Why not the obvious alternative |
|---|---|---|
| ORM | **Drizzle ORM** | **Not Prisma.** Row-Level Security requires `SET LOCAL app.tenant_id` per transaction. Prisma fights this; Drizzle is SQL-shaped with raw escape hatches and still generates TS types. |
| Validation | **Zod** (+ `nestjs-zod`) | One schema definition serves: API DTO validation, React `react-hook-form` validation, **and the policy engine's per-rule-type input schemas (FR-POL-01)**. Not a coincidence — it's the design. |
| Background jobs | **BullMQ** (`@nestjs/bullmq`) | Retries, DLQ, scheduling. **Use sandboxed processors** for heavy work — default processors run on the main thread. |
| CPU parallelism | **Piscina** worker pool | Only inside `telematics-ingest`. Real OS threads, own V8 isolate, promise API. |
| Maps | **MapLibre GL** + Azure Maps tiles | Open-source; no per-load billing surprise at fleet-tracking refresh rates. |
| Server state (React) | **TanStack Query** | This app is almost entirely server state. Redux would be ceremony. |
| Realtime | Nest WebSocket gateway + **Redis adapter** | Must scale past one API replica. Azure Web PubSub is a valid alternative if sticky sessions are unwelcome. |
| Migrations | **Drizzle Kit**, checked in, run in CI | Never `synchronize: true`. |
| Logging | **nestjs-pino** | Structured, low overhead — matters when the event loop is a budgeted resource. |

### 2.3 Deliberately deferred

- **Microservices** — Phase 1 is one pool and ten modules. Two carve-outs only (below).
- **Nx workspace** — not in use. Boundaries enforced by `dependency-cruiser` in CI instead.
- **.NET for ingest** — the seam is designed so this becomes a two-week swap if Phase 3 telemetry volume demands it. Do not pay the polyglot tax before the load test says you must (see §8.4).
- **Kubernetes (AKS)** — a Phase 2/3 conversation, if ever.

---

## 3. System Architecture

### 3.1 One project, three deployables

**One repo. One `package.json`. One build. Three entrypoints, three Dockerfiles, three Azure Container Apps.**

This is not "three projects" — shared types are a plain import, with no workspace, no published package, no version drift. What differs is only which modules each entrypoint composes, and — critically — **which event loop bears the load**.

```
fleet-platform/
  src/
    contracts/              ← Zod schemas + canonical telemetry schema (shared)
    modules/
      platform/             ← identity, RBAC + SoD guard, hierarchy, audit
      policy/               ← the PDP
      workflow/             ← chains, delegation, escalation timers
      vehicles/  bookings/  entitlements/
      handover/  compliance/  fines/  migration/
      telematics/
        ingest/             ← Event Hubs consumer, Piscina pool, Timescale writer
        domain/             ← trip→booking attach, unplug alerts (runs in api)
    main.ts                 ← boots HTTP API
    main.pdp.ts             ← boots PDP (thin HTTP)
    main.ingest.ts          ← boots standalone context — NO HTTP server
  Dockerfile.api  Dockerfile.pdp  Dockerfile.ingest
```

| Deployable | Type | Scales on | Must never |
|---|---|---|---|
| `api` | Nest HTTP (Fastify) | HTTP concurrency | do CPU-bound work |
| `pdp` | Nest HTTP (thin) | HTTP concurrency | do I/O beyond a Redis read |
| `telematics-ingest` | Nest standalone context | **Event Hub consumer lag** (KEDA) | serve user traffic |

### 3.2 Why the processes are split (the honest explanation)

Node is not single-threaded — but **one Node process has one JavaScript execution thread**. Process isolation does not make Node parallel; it decides **whose event loop is allowed to suffer**.

- Same process: 40ms of GPS parsing blocks the eligibility gate that has a 500ms budget.
- Separate processes: ingest saturates its own loop; the API's loop stays idle-on-I/O and answers in ~12ms.

Three layers of parallelism, none contradicting the one-loop-per-process model:

| Layer | Mechanism | Gives |
|---|---|---|
| Replicas | Container Apps + KEDA | Horizontal throughput |
| Threads | Piscina pool inside ingest | Multi-core CPU within a replica |
| **Processes** | Separate `api` / `ingest` apps | **Latency isolation — the booking path stays clean** |

### 3.3 Data flow

```
Aggregator (flespi / equiv.) ──MQTT/REST──▶ Azure Event Hubs
                                                  │
                                    telematics-ingest (KEDA-scaled)
                                    ├─ Piscina workers: normalize → canonical schema
                                    ├─ Timescale: batched COPY (one round trip)
                                    └─ Service Bus: domain events
                                                  │
                                            api (NestJS)
                                    ├─ telematics/domain: trip→booking attach,
                                    │  unplug alerts, odometer conflict (FR-HAND-11)
                                    ├─ calls pdp for every rule decision
                                    └─ Postgres (RLS) ─▶ React (TanStack Query)
                                                  │
                                            SignalR/Socket.IO ─▶ live fleet map
```

**Keep the ingest worker dumb.** It normalizes, persists telemetry, emits events. All domain logic — trip attachment, unplug alerting, odometer conflict resolution — lives in `api`, because that is where the policy engine and the domain model live.

---

## 4. The Policy Engine (PDP) — Implementation

The crown jewel. Follows the standard **PAP / PDP / PEP** separation.

| Role | Where | Does |
|---|---|---|
| **PAP** (Administration) | Admin studio (React) | Authors rules as decision tables; submit → review → approve → effective-date |
| **PDP** (Decision) | `pdp` deployable | The **only** component that interprets rules |
| **PEP** (Enforcement) | booking, entitlements, compliance gate, fines, workflow | Ask, then obey. Contain **zero** rule logic |

### 4.1 The contract

```ts
evaluate(ruleType, context) → {
  decision,            // ALLOW | DENY | ROUTE_TO | VALUE
  reasons[],           // machine-readable reason codes → user-facing messages
  policyVersion,       // recorded on every transaction
  scopeThatAnswered    // group | cluster | pool
}
```

Each rule type declares: **input schema** (a Zod schema in `contracts/`), **output contract** with reason codes, and a **safe-default fallback** (deny/escalate when no row matches).

### 4.2 A PEP in practice

```ts
// bookings.service.ts — asks; never decides
const verdict = await this.pdp.evaluate('driver-eligibility', {
  driverId, vehicleId, window, clusterId,
});
if (verdict.decision === 'DENY') {
  throw new ForbiddenException(verdict.reasons);
  // → "Licence expired 12 Mar" · "Black-point transfer overdue"
}
```

The booking module knows nothing about licences, grades or black points. **This discipline is what makes the platform re-deployable to another organization by editing decision tables instead of code.**

### 4.3 Storage & evaluation

- Decision tables stored as **versioned, immutable JSONB** in Postgres.
- Evaluation: rows top-down, **first match wins**, mandatory default row.
- Compiled rules cached in Redis; cache invalidated on version activation.
- **Every evaluation logged** (inputs, decision, reasons, version) → audit layer. Internal Audit can reconstruct why any transaction was allowed, denied or routed.
- **No rules engine library.** NRules/Drools/Camunda fight the versioning-and-audit model. Plain evaluation over JSONB + Zod is ~200 lines and entirely ours.

### 4.4 Non-negotiable properties

- **Latency < 200ms** (FR-POL-08) — it sits inside the booking path.
- **Fails safe.** Unreachable PDP → `DENY` + escalate to fleet manager. A policy engine that fails open would silently make expired-insurance vehicles bookable. This is a safety property, and it is why the PDP is isolated.

### 4.5 Phase 1 rule-type catalog (12, registered at MVP)

booking buffer · max booking duration · booking approval chain · entitlement approval chain · dedicated-vehicle eligibility · driver eligibility gate · compliance alert ladders · hard-block conditions · fines HR threshold · black-point transfer timeframe · consent re-consent tolerance · fuel deviation threshold.

Phase 2 **registers new rule types on the same engine** (toll recharge, behaviour weights, break-glass categories). The engine is never re-architected.

---

## 5. Data Layer

### 5.1 Multi-tenancy via Row-Level Security (FR-ARC-01)

Every table carries `tenant_id` **from the first migration**. Phase 1 runs single-tenant (AD Ports); no query, report or index may assume single-tenancy.

```ts
// Nest interceptor sets the session variable per transaction
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId}`);
  return tx.select().from(vehicles).where(eq(vehicles.poolId, poolId));
});
```

```sql
CREATE POLICY tenant_isolation ON vehicles
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
```

This makes "no cross-tenant query path" enforceable **at the database**, not by code review.

### 5.2 Tamper-evident audit (FR-AUD-04)

Append-only table + Postgres trigger writing a hash chain: `row_hash = sha256(prev_hash || row_payload)`. Verifiable, no ledger product required. Internal Audit gets a read-only role and an export.

### 5.3 Telemetry

TimescaleDB hypertable, partitioned by time + vehicle. **Write via batched COPY / multi-row insert.** Retention and continuous aggregates configured from day one (route replay in Phase 2 reads Phase 1's raw data retroactively).

### 5.4 Consent store

Blob Storage **immutable container** + Postgres pointer row. Employee ID, timestamp, IP, device, policy version. Never updated, only appended.

---

## 6. Telematics Ingest — Getting It Right

The pipeline, precisely:

```
EventProcessorClient (Blob checkpoint store)
  → pull batch of ~500 raw events
  → piscina.run(batch)                     // parallel, off the main event loop
  → canonical telemetry rows
  → Timescale: ONE batched COPY            // not 500 inserts
  → Service Bus: domain events (trip started/ended, device silent)
  → checkpoint
```

**The three mistakes that cause 90% of "Node is slow" incidents:**

1. **Per-row inserts.** This — not parsing — is almost always the real bottleneck. Batch or die.
2. **`await` inside a `for` loop** over messages. Process the batch as a unit.
3. **No backpressure.** Bound the Piscina queue; when full, stop pulling from Event Hubs. **Consumer lag is a metric, not an outage.**

Rule of thumb: any function taking **>10ms of CPU with no `await`** belongs in a worker thread.

### 6.1 The metric that settles all arguments

Export **event loop lag** from every deployable:

```ts
import { monitorEventLoopDelay } from 'node:perf_hooks';
const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();
// emit h.percentile(99) / 1e6 as a gauge every 10s → App Insights
```

- `api` p99 lag **< 10ms at all times**, including during a telemetry storm. A rise means CPU work leaked into the API process. **Alert on it.**
- `ingest` lag may spike — expected. Give its health probe a generous timeout.

---

## 7. Enforcing Boundaries Without Nx

`dependency-cruiser` in CI. One rule pays for the afternoon it takes:

```js
{ name: 'ingest-must-not-import-request-path',
  severity: 'error',
  from: { path: '^src/modules/telematics/ingest' },
  to:   { path: '^src/modules/(bookings|entitlements|handover)' } }
```

Plus the convention: **each Nest module exports only its service**; everything else lives in `internal/`. Nest's DI makes this natural — you can only inject what a module exports.

Why it matters: with one repo, it is trivially easy for someone to "temporarily" call the normalizer from a controller because the code is right there. The CI rule turns a 3 a.m. incident into a failed pull request.

---

## 8. Implementation Plan

### 8.1 Sprint 0 — Foundations before features (Weeks 1–4)

**Do all of this before the first booking screen exists.** Everything else in this platform is a feature; these four cannot be added later without a rewrite.

| Week | Deliverable | Acceptance |
|---|---|---|
| 1 | Repo, three entrypoints, three Dockerfiles, IaC for UAE North, CI pipeline, OpenTelemetry wired | `api` / `pdp` / `ingest` deploy to dev, health probes green, traces visible in App Insights |
| 1–2 | **Entra auth + RBAC/SoD guard + audit interceptor** (hash-chained, append-only) | A user cannot approve their own booking (SoD-01) — proven by an integration test |
| 2 | **Postgres with RLS from the first migration**; `tenant_id` on every table; Drizzle schema + migrations in CI | A query without `SET LOCAL app.tenant_id` returns zero rows — proven by test |
| 3 | **PDP with two rule types** (booking buffer, driver eligibility gate) + decision log + Redis cache | `evaluate()` p95 < 200ms; unreachable PDP returns DENY (fail-safe test) |
| 4 | **`telematics-ingest` skeleton** with fake device emitter, Piscina, batched Timescale writes | **The load test (§8.4) passes with synthetic data** |

> **Why the load test in week 4, with fake data?** It is cheap now and locks the architecture. It will also catch the day someone imports the normalizer into a controller — which is the failure this whole design guards against.

### 8.2 Phase 1 build order (Weeks 5–24, indicative)

Order is dictated by dependency, not by visibility.

| Block | Weeks | Modules | Notes |
|---|---|---|---|
| A. Platform | 5–7 | Hierarchy engine (N-level), workflow engine (chains, delegation, escalation timers), policy engine to full 12 rule types | Workflow engine may embed a lightweight library; PDP stays hand-rolled |
| B. Master data | 7–11 | Vehicle master (M2), document vault, **data migration + quality tooling (M3)** | M3 before go-live is the mitigation for Risk R5 (High/High) |
| C. Telematics | 9–13 | **M10**: device registry & pairing, TAL, live map, auto-odometer, trip attach, unplug alerts | Procure ~50 TDRA-approved OBD-II units in parallel (D22) |
| D. Core loop | 12–18 | Booking (M4), consent (with sequencing rules), handover/return (M6) with signature + offline capture, compliance engine (M7) | Consent is the legal gate — it ships with booking, not after |
| E. Governance | 16–20 | Entitlements (M5) with Cluster CEO chain, fines & black points (M8), **substitution attribution model (FR-SUB-01/02)** | Substitution *model* in Phase 1 even though its UI is Phase 2 |
| F. Surfaces | 18–22 | Fleet console, employee web app, operational dashboards (M9), basic executive view | Wayfinding design system (see companion doc) |
| G. Hardening | 22–24 | Pen test, load test with real data, data migration dry-runs, hypercare readiness, PDPL sign-off (D4) | Go-live gates in §9 |

### 8.3 Parallel non-engineering tracks (start at kickoff)

These block the build and are outside engineering's control. Assign owners on day one.

| Track | Blocks | Owner |
|---|---|---|
| **D7** consent wording (EN + AR) | All booking — consent gates every booking number | Legal |
| **D8** dedicated-vehicle eligibility policy | The entitlement decision table | Group HR / Cluster CEOs |
| **D9** black-point transfer timeframe | The platform-wide driver block | Group HR / Legal |
| **D13** recovery mechanism + waiver authority | Recovery pipeline v1 | HR / Legal / Finance |
| **D14** utilisation definition | Every dashboard and AI right-sizing input | Group Services / Finance |
| **D22** telematics device + ingestion architecture | M10 procurement lead time | Procurement / D&T / Cybersecurity |
| **D4** location-data residency & retention (PDPL) | **M10 go-live gate** | Cybersecurity / Legal |
| **D3, D6, D12** | Disciplinary steps, depreciation rate, re-consent tolerance | HR / Finance / Legal |

> Risk R12 (open decisions block the build) is rated **High/High**. These belong on the programme critical path with named owners and dates from kickoff, not discovered at sprint planning.

### 8.4 The go-live load test (a formal acceptance criterion)

> Replay a **5,000-vehicle telemetry burst** (~167 msg/s sustained, 10× burst) while driving `POST /bookings` and the eligibility gate at target concurrency (500 concurrent users).
>
> **PASS =** eligibility gate p95 **< 500ms** · PDP p95 **< 200ms** · `api` event-loop p99 lag **< 10ms** · ingest consumer lag returns to zero within **60s** of burst end.

167 msg/s is genuinely modest for batched Node in its own process — this will pass. **The test exists to catch regressions**, specifically the day CPU work leaks into the API process.

If Phase 3 raises telemetry to 1-second granularity (5,000 msg/s) plus harsh-driving event streams, revisit — and note the seam is already drawn so swapping `telematics-ingest` for a .NET worker is a contained, two-week change with zero blast radius. **Do not pay the polyglot tax before the load test says you must.**

---

## 9. Go-Live Gates (GS Pool, Mina Zayed)

All eight must be green. Any red gate stops go-live.

1. Inventory migrated, **≥98% complete**, data steward signed off.
2. All GS Pool employees SSO-enabled; roles assigned; **SoD rules verified by test**.
3. Consent wording (D7) approved and loaded, **EN + AR**, including the location-tracking notice.
4. Compliance ladders live; **zero vehicles bookable with expired Mulkiya or insurance** (hard block proven, override attempts denied and logged).
5. **≥90% of pool vehicles paired with online trackers**; live map and auto-odometer verified; unplug alert tested end-to-end.
6. **PDPL privacy review (D4) signed off** for location data.
7. **Load test passed** (§8.4). Penetration test passed.
8. Mehwar Vehicle Allocation switched to read-only; all new bookings in the platform. Two weeks hypercare staffed; KPI dashboard live from day one.

---

## 10. Engineering Practices

- **Trunk-based development**, short-lived branches, PR + one review. CI runs: type-check, lint, `dependency-cruiser`, unit + integration tests, migration dry-run.
- **Test pyramid tuned to risk:** heavy integration testing on the PDP, SoD guard, RLS isolation, consent sequencing and fine attribution. These are the correctness-critical paths, and all four are cheap to test and expensive to get wrong.
- **Contract tests** on the canonical telemetry schema — it is the asset that outlives any device vendor.
- **Ephemeral environments** per PR (Container Apps revisions) with a seeded, anonymised dataset.
- **No feature flags on safety properties.** Hard blocks, consent gates and SoD are never flag-controlled.
- **Migrations are forward-only** and reviewed like code. Never `synchronize: true`.
- **Definition of Done** includes: audit entries emitted, policy version recorded on the transaction, reason codes translated (EN + AR), and event-loop-lag impact considered for any new synchronous work.

---

## 11. The Three Things That Cannot Be Retrofitted

If the plan is compressed under schedule pressure, protect these. Everything else is a feature.

1. **`tenant_id` + RLS on every table from the first migration** (FR-ARC-01).
2. **N-level hierarchy engine**, deployed as Cluster → Pool → Location (FR-ARC-02).
3. **All business rules in the policy engine, none in code** (FR-ARC-03) — plus the **substitution attribution model** (FR-SUB-01/02), so a fine recorded in month one is never pinned to the wrong driver for want of a data model.

Plus one architectural rule, which is the reason this document exists:

> **The booking path is sacred. Anything that can spike CPU runs in a different process, with a different scale rule. The API only ever awaits I/O.**

---

**END — Development Approach & Implementation Plan v1.0**
