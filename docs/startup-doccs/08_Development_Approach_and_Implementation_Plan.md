# Fleet Management Platform
# Development Approach & Implementation Plan

**Version 2.0 · Companion to Phase 1 MVP PRD (v3.1-P1) · Target: GS Pool, Mina Zayed pilot**

*v2.0 adds: §13 Azure resource request list · §14 IoT simulation strategy (IoT Hub, DPS, device-realistic simulation) · ADR-006/007 telematics decisions*

Stack: **NestJS + TypeScript + React + PostgreSQL + Azure (UAE North)**

---

## 1. Guiding Principles

Five rules that govern every technical decision in this document. When a trade-off appears, resolve it against these in order.

| # | Principle | Consequence |
|---|---|---|
| P1 | **The booking path is sacred** | Anything that can spike CPU (telemetry, OCR, exports, bulk migration) runs in a **different process**. The API only ever awaits I/O. |
| P2 | **Build generic, deploy for AD Ports** | Organization keys, N-level hierarchy and externalized rules are in the MVP. They cannot be retrofitted. AD Ports is the first deployment; the same project can be re-deployed for others. |
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
| Database | **PostgreSQL** (Azure Flexible Server) + **TimescaleDB** extension | One engine to operate in Phase 1. One database per organization keeps isolation simple. Timescale hypertables handle telemetry writes. |
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
| ORM | **Drizzle ORM** | **Not Prisma.** Row-Level Security requires `SET LOCAL app.organization_id` per transaction. Prisma fights this; Drizzle is SQL-shaped with raw escape hatches and still generates TS types. |
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

The booking module knows nothing about licences, grades or black points. **This discipline is what makes the platform re-deployable for another organization by editing decision tables instead of code.**

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

### 5.1 One deployment per organization — with a dormant seam for future multi-org (FR-ARC-01, ADR-008)

This is a **project that is reusable**, not a multi-tenant SaaS. Each organization gets its **own deployment** — its own database and hosting. AD Ports is one such deployment. That means:

- **No Row-Level Security, no active tenancy logic** — the whole database belongs to one organization, so isolation is absolute by construction and the schema stays simple.
- **Reusability comes from clean design, not infrastructure:** business rules live in the policy engine (§4), the hierarchy is configurable (FR-ARC-02), and organization-specific labels/branding are configuration. Re-deploying for another organization is: provision, configure, migrate data, go live — no code change.
- **Scope is enforced by hierarchy, not tenancy:** a fleet manager sees their pool/cluster via their role scope (RBAC), which the platform needs anyway.

**One cheap piece of future-proofing (ADR-008): a dormant `organization_id` column on core entity tables.**
The expensive, risky part of ever going multi-tenant is not writing RLS policies — it is adding a tenant column to dozens of tables that already hold production data, then backfilling and re-checking every query and index. We avoid that future pain for near-zero cost now:

- Core entity tables carry `organization_id UUID NOT NULL DEFAULT '<ad-ports-const>'` from the first migration.
- **It is dormant:** RLS is off, no session variable is set, and **no business logic ever reads or branches on it**. Developers treat it as if it isn't there.
- If a genuine shared-hosting need for a second organization ever arises, enabling multi-tenancy becomes a *routine* change (add RLS policies + a session-variable interceptor + tests) instead of a *risky data migration*. The schema is already shaped for it.

```sql
-- present from migration 0, but inert:
ALTER TABLE vehicles ADD COLUMN organization_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-0000000adp01';
-- NO row level security enabled. NO policy. NO app code references this column.
```

> **Discipline rule (non-negotiable):** `organization_id` is *reserved scaffolding*, not active tenancy. Nothing may write `WHERE organization_id = …` or `if (org === …)` in application code. If that discipline can't be held, drop the column — a half-used tenant column is worse than none. A CI check (dependency-cruiser / grep guard) flags any app-code reference.

### 5.2 Tamper-evident audit (FR-AUD-04)

Append-only table + Postgres trigger writing a hash chain: `row_hash = sha256(prev_hash || row_payload)`. Verifiable, no ledger product required. Internal Audit gets a read-only role and an export.

### 5.3 Telemetry

TimescaleDB hypertable, partitioned by time + vehicle. **Write via batched COPY / multi-row insert.** Retention and continuous aggregates configured from day one (route replay in Phase 2 reads Phase 1's raw data retroactively).

### 5.4 Consent store

Blob Storage **immutable container** + Postgres pointer row. Employee ID, timestamp, IP, device, policy version. Never updated, only appended.

---

## 6. Telematics Ingest — Getting It Right

### 6.0 Two pieces, split for two different reasons (read this first)

The most common mistake here is putting business logic in the ingest process. Don't. There are two distinct pieces:

| Piece | Nature | Split for | Owns | Never |
|---|---|---|---|---|
| **`telematics-ingest`** | Separate deployable **process** | **Runtime latency isolation** — a telemetry burst must never touch the booking event loop | The **pipe**: source adapter, Piscina normalization, canonical schema, batched Timescale writes, emitting domain events | contains business rules or reads booking tables |
| **`telematics` domain module** | NestJS module **inside `api`** | **Data locality** — its questions are joins with bookings/drivers/vehicles | The **meaning**: trip→booking attachment, unplug/tamper alerts, odometer-conflict resolution (FR-HAND-11), device registry & pairing, online-status | does high-volume stream processing or CPU-bound work |

> **Rule:** ingest is a dumb, fast pipe; the domain module is the smart part. Trip-to-booking attachment belongs in the **domain module** (it's a join with bookings), never in ingest. If you find yourself importing a repository for bookings inside `telematics-ingest`, stop — that logic is in the wrong place.

### 6.1 The swappable source adapter (`TelemetrySource`)

GPS is a **pluggable module, not a microservice** (see ADR-006 in §11). The telemetry *source* is a swappable adapter living in `telematics-ingest`:

```ts
interface TelemetrySource {
  start(onBatch: (points: CanonicalPoint[]) => void): void;
  stop(): void;
}
class SimulatorSource   implements TelemetrySource {} // Phase 1 — no hardware
class AggregatorSource  implements TelemetrySource {} // Phase 2 — flespi/equiv.
class DirectVendorSource implements TelemetrySource {} // Phase 2 — direct API
```

- **Phase 1 pilot uses `SimulatorSource`** — realistic canonical telemetry (positions, trips, ignition, odometer, injectable unplug events). It is a **permanent fixture**, not throwaway: it's your dev source, your load-test generator (§8.4) and your demo source.
- Swapping to real hardware later is a **config change**. The domain module never sees it — it only consumes canonical events off the bus. This is the entire "plug-and-play" promise, delivered by an interface, not by infrastructure.

### 6.2 The ingest pipeline, concretely

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
| 2 | **Postgres with RLS from the first migration**; `organization_id` on every table; Drizzle schema + migrations in CI | A query without `SET LOCAL app.organization_id` returns zero rows — proven by test |
| 3 | **PDP with two rule types** (booking buffer, driver eligibility gate) + decision log + Redis cache | `evaluate()` p95 < 200ms; unreachable PDP returns DENY (fail-safe test) |
| 4 | **`telematics-ingest` skeleton** with `SimulatorSource` (the `TelemetrySource` adapter), Piscina, batched Timescale writes | **The load test (§8.4) passes with simulator-generated data** |

> **Why the load test in week 4, with fake data?** It is cheap now and locks the architecture. It will also catch the day someone imports the normalizer into a controller — which is the failure this whole design guards against.

### 8.2 Phase 1 build order (Weeks 5–24, indicative)

Order is dictated by dependency, not by visibility.

| Block | Weeks | Modules | Notes |
|---|---|---|---|
| A. Platform | 5–7 | Hierarchy engine (N-level), workflow engine (chains, delegation, escalation timers), policy engine to full 12 rule types | Workflow engine may embed a lightweight library; PDP stays hand-rolled |
| B. Master data | 7–11 | Vehicle master (M2), document vault, **data migration + quality tooling (M3)** | M3 before go-live is the mitigation for Risk R5 (High/High) |
| C. Telematics | 9–13 | **M10**: `telematics-ingest` with `SimulatorSource`, `telematics` domain module (device registry & pairing, live map, auto-odometer, trip attach, unplug alerts) | **Simulator-first — no hardware in the pilot.** Real-device procurement (D22) is Phase 2 and swaps the source adapter only |
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

1. **Clean, self-contained module and schema boundaries** so the project re-deploys for another organization by configuration (FR-ARC-01) — one deployment per organization, plus a *dormant* `organization_id` on core tables (ADR-008) that keeps the multi-org door open at near-zero cost without building any tenancy machinery now.
2. **N-level hierarchy engine**, deployed as Cluster → Pool → Location (FR-ARC-02).
3. **All business rules in the policy engine, none in code** (FR-ARC-03) — plus the **substitution attribution model** (FR-SUB-01/02), so a fine recorded in month one is never pinned to the wrong driver for want of a data model.

Plus one architectural rule, which is the reason this document exists:

> **The booking path is sacred. Anything that can spike CPU runs in a different process, with a different scale rule. The API only ever awaits I/O.**

## 12. Architecture Decision Records (key calls)

| ADR | Decision | Rationale |
|---|---|---|
| ADR-001 | One project, three deployables (`api`, `pdp`, `telematics-ingest`) | Latency isolation without distributed-monolith cost |
| ADR-002 | Drizzle over Prisma | RLS needs `SET LOCAL app.organization_id` per transaction |
| ADR-003 | Build the PDP; don't buy a rules engine | Versioning + audit model is ours; libraries fight it |
| ADR-004 | One deployment per organization; no *active* multi-tenant/RLS machinery (see ADR-008 for the dormant seam) | Keeps the schema simple; reusability comes from the configurable core, not tenancy infrastructure |
| ADR-005 | Isolate CPU-bound work from the request path | The <500ms gate and <200ms PDP survive Node's single loop only this way |
| **ADR-006** | **Telematics is a pluggable module with a swappable `TelemetrySource` adapter — NOT a separate microservice** | Full swappability (simulator ↔ hardware ↔ 3rd-party) via an **interface**, avoiding the distributed-data trap of splitting trip↔booking joins across services. `telematics-ingest` is separated for runtime latency; the `telematics` domain module stays in `api` for data locality. Graduates to a microservice only if D23's trigger fires. |
| **ADR-007** | **Simulator-first: `SimulatorSource` is a permanent first-class source** | Phase 1 pilot needs no hardware; simulator de-risks go-live from procurement/installation and doubles as the load-test generator and demo source |
| **ADR-008** | **Dormant `organization_id` on core tables; RLS deferred** | Keeps the future SaaS/multi-org door open at near-zero cost. The risky part of multi-tenancy is the schema migration, not the RLS policy — so shape the schema now, build nothing else. Column stays inert (no RLS, no app-code references) until a real second organization triggers it. |

---


---

## 13. Azure Resource Request List (for the Azure Admin)

All resources in **UAE North** (Dubai) per the Data Hosting & Residency Policy. Three environments: `dev`, `test`, `prod` — same resource set, smaller SKUs in dev/test. Suggested naming: `fleet-{env}-{resource}` (e.g. `fleet-prod-psql`).

### 13.1 Core platform (required for Sprint 0)

| # | Resource | SKU (prod / dev-test) | Purpose |
|---|---|---|---|
| 1 | Resource Groups ×3 | — | `fleet-dev-rg`, `fleet-test-rg`, `fleet-prod-rg` |
| 2 | **Azure Container Apps Environment** | Consumption + Dedicated D4 (prod) / Consumption (dev) | Runs the three deployables: `api`, `pdp`, `telematics-ingest` with per-app scale rules (HTTP concurrency / Event Hub lag via KEDA) |
| 3 | **Azure Container Registry** | Standard | Images for the three apps |
| 4 | **Azure Database for PostgreSQL — Flexible Server** | GP D4ds_v5, 256GB, zone-redundant HA (prod) / B2ms (dev) | Transactional core. **Request `timescaledb` in `azure.extensions` allowlist** (telemetry hypertables) + `pgcrypto`. One database per organization |
| 5 | **Azure Cache for Redis** | Standard C1 (prod) / Basic C0 (dev) | PDP decision cache, eligibility cache, BullMQ, Socket.IO adapter |
| 6 | **Azure Blob Storage** ×2 accounts | Standard LRS (dev) / ZRS (prod) | (a) documents/photos/signatures; (b) **consent store with immutability (WORM) policy enabled** + Event Hubs checkpoint container |
| 7 | **Azure Service Bus** | Standard (prod: Premium if >1k msg/s) | Domain events: TripEnded, DeviceSilent, BookingConfirmed, FineRecorded… |
| 8 | **Azure Event Hubs** | Standard, 1 TU auto-inflate to 4, 4 partitions (pilot) | Telemetry ingress — the buffer between source and `telematics-ingest` |
| 9 | **Azure Key Vault** | Standard | Secrets, connection strings, signing keys; accessed via managed identity |
| 10 | **Microsoft Entra ID** | — (admin consent needed) | 2 app registrations (SPA + API) with scopes; security groups per role; **MFA conditional-access policy for elevated roles** |
| 11 | **Log Analytics Workspace + Application Insights** | PAYG, 30–90d retention | OpenTelemetry target for all three apps; event-loop-lag custom metric |
| 12 | **Azure Front Door + WAF** | Standard | TLS, WAF policy, routing to Container Apps (prod; skip in dev) |
| 13 | **Managed Identities** | — | One per container app; grants to Key Vault, Event Hubs, Service Bus, Blob, ACR — **no connection strings in config** |
| 14 | **Azure Maps Account** | Gen2 S1 | Map tiles for MapLibre (live fleet map) + **Route Directions API for the simulator** (see §14) |
| 14b | **Azure AI Document Intelligence** | S0 (PAYG) | **OCR service** (see §15): Phase 1 — auto-extract fields from compliance documents on upload (Mulkiya number/expiry, insurance policy/expiry) with human confirm; Phase 2 — consolidated fuel-invoice parsing into per-vehicle lines (W5, integration I10, decision D2) |

### 13.2 IoT / telematics simulation (required for M10 — see §14 for how they're used)

| # | Resource | SKU | Purpose |
|---|---|---|---|
| 15 | **Azure IoT Hub** | **S1 (1 unit)** prod-path; F1 free tier acceptable in dev | Device-realistic simulation: per-device identity, MQTT endpoint, device twins, C2D commands. Its **built-in Event Hubs-compatible endpoint** is what `telematics-ingest` consumes — same consumer code as #8 |
| 16 | **IoT Hub Device Provisioning Service (DPS)** | S1 | Zero-touch provisioning rehearsal: simulated devices enrol exactly as real TDRA-approved trackers will in Phase 2 |
| 17 | **Azure Container Instances** (or a Container Apps job) | Per-run | Runs the **device-simulator fleet** (§14.2) — 50+ simulated vehicles as MQTT clients |
| 18 | **Azure Load Testing** | PAYG | The §8.4 go-live load test as a repeatable, scheduled resource |
| 19 | *(optional, Phase 3)* Azure Digital Twins | S1 | Live digital twin of pool→vehicle→device graph for advanced simulation/what-if |

> **Note for the admin:** do **not** provision Azure IoT Central — Microsoft has announced its retirement; IoT Hub is the supported path. Also request quota confirmation for Container Apps (min 20 vCPU regional quota) and Event Hubs throughput units in UAE North.

### 13.3 DevOps

| # | Resource | Purpose |
|---|---|---|
| 20 | GitHub Actions (or Azure DevOps) + OIDC federated credentials to Azure | CI/CD without stored secrets |
| 21 | Bicep/Terraform state storage (Blob) | IaC state per environment |

---

## 14. IoT Simulation Strategy — Simulating Real Device Connections

The Phase 1 pilot connects **no physical hardware** (ADR-007). But there are two levels of simulation, and choosing the right one determines how "plug-and-play" the Phase 2 hardware swap really is.

### 14.1 Two simulation levels

**Level A — Data simulation (week 1, always on).**
`SimulatorSource` publishes canonical telemetry **directly to Event Hubs**. No device identity, no protocol layer. Cheapest, fastest, perfect for dev and the §8.4 load test.

**Level B — Device-realistic simulation (the pilot target).**
Simulated devices behave like real trackers:

```
Simulated device fleet (Node MQTT clients, one per pool vehicle)
   │  provision via DPS (enrolment group)  →  per-device identity in IoT Hub
   │  connect over MQTT · send telemetry · maintain device twin
   ▼
Azure IoT Hub  ── built-in Event Hubs-compatible endpoint ──▶ telematics-ingest
                                                              (same consumer code as Level A)
```

Why Level B matters: it rehearses **the exact path real hardware will take in Phase 2** — DPS enrolment, per-device credentials, MQTT connection, twin-reported GPS status, disconnect events. When TDRA-approved OBD-II trackers arrive, they enrol into the *same* DPS/IoT Hub, and `telematics-ingest` doesn't change at all, because it already consumes the Event Hubs-compatible endpoint. The "plug-and-play" claim gets proven in the pilot, not promised.

**Recommendation: build Level A in Sprint 0 (it unblocks the load test), stand up Level B for the pilot go-live.** Both are `TelemetrySource` implementations — `SimulatorSource` (direct) and the IoT Hub route (the simulated devices *are* the source; ingest just consumes the endpoint).

### 14.2 The simulated device fleet

A small Node app (reuses `contracts/`), run as a Container Apps job — one virtual device per pool vehicle:

- **Realistic movement:** trips generated along **real road routes** via Azure Maps Route Directions (Mina Zayed → Khalifa Port → Kezad corridors), interpolated at 1 point/10–30s with plausible speed profiles, ignition on/off bracketing each trip.
- **Booking-aware mode:** the simulator can subscribe to `BookingConfirmed` events and drive the assigned vehicle during its booking window — so trip auto-attachment (FR-GPS-P1-05) is exercised end-to-end with *correct* expected outcomes.
- **Fault injection (chaos):** on-demand unplug/silence events (proves FR-GPS-P1-06 alerts), GPS drift, out-of-order timestamps, duplicate messages, offline buffering + backfill bursts (proves FR-GPS-P1-10).
- **Device twin usage:** reported properties carry firmware/signal/battery → feeds the device health console (FR-GPS-P1-08) exactly as real devices will.
- **Scale mode:** the same fleet, multiplied, is the load generator for §8.4 (50 vehicles pilot-realistic; 5,000 for the stress run). Microsoft's container-based **Azure IoT Device Telemetry Simulator** is an alternative for pure protocol-level volume.

### 14.3 Live simulation opportunities this unlocks

| Opportunity | What it proves / enables |
|---|---|
| **Live demo without hardware** | Executives watch the fleet move on the real map, trips attach to real bookings, alerts fire — from day one of the pilot |
| **End-to-end alert rehearsal** | Unplug → alert → fleet-manager acknowledgement, tested weekly as a drill |
| **Trip-attribution regression suite** | Booking-aware simulation gives deterministic expected results: "this trip MUST attach to BK-1204" becomes an automated test |
| **Privacy-control rehearsal (D4)** | Access logging, role scoping and retention proven on simulated location data *before* real personal data ever flows — strong PDPL story |
| **Phase 2 onboarding dry-run** | New-device enrolment (DPS) rehearsed; when real trackers arrive, pairing is a practiced motion |
| **Capacity planning** | Replay 5,000-vehicle load anytime; validates the .NET-swap trigger (D23) with data, not opinion |
| *(Phase 3)* **Digital-twin what-ifs** | Azure Digital Twins graph over pool/vehicle/device enables right-sizing simulations against live state |

### 14.4 Cost note

The entire simulation stack is modest: IoT Hub S1 (~1 unit), DPS S1, one container job, Azure Maps S1 transactions. The pilot's simulated fleet of ~50 devices at 1 msg/30s ≈ 144k msgs/day — well inside IoT Hub S1's 400k/day. The stress runs are short-lived and fit auto-inflate Event Hubs TUs.

---

## 15. OCR Implementation Approach (Azure AI Document Intelligence)

**Service:** Azure AI Document Intelligence (S0). It is an **async cloud API**: you submit a document, receive an operation ID, and poll (or receive a callback) for the parsed result seconds later. That async shape dictates the architecture.

### 15.1 Where OCR is used

| Phase | Use | Flow |
|---|---|---|
| **Phase 1** (lightweight, high value) | **Compliance document auto-fill.** When a fleet manager uploads a Mulkiya or insurance scan to the document vault, OCR proposes the extracted fields — Mulkiya number + expiry, policy number + expiry — pre-filled into the form for **human confirmation** (never auto-committed). | Upload → Blob → queue → `ocr-worker` → Document Intelligence prebuilt/custom model → proposed fields → fleet manager confirms → compliance engine ladders armed |
| **Phase 2** (the big one — W5) | **Consolidated fuel-invoice parsing** (FR-FUEL-02 Path A): supplier PDF invoices parsed into per-vehicle line items, proposed for fleet-manager confirmation until accuracy ≥95% (KPI), then progressively automated. | AP invoice PDF → Blob → queue → `ocr-worker` → custom-trained invoice model → line items keyed by plate/fuel-card → confirm queue → cost ledger |

Phase 1 use is deliberately included: it exercises the entire OCR pipeline on low-risk documents, trains the team on Document Intelligence custom models, and directly serves the ≥98% inventory-completeness KPI — so Phase 2 invoice parsing starts on a proven pipeline rather than from zero.

### 15.2 Architecture — the same sacred-path rule applies

OCR is CPU/IO-heavy and slow (seconds per document). It therefore follows the exact pattern as telematics: **never in the API process, never awaited in a request handler.**

```
React upload → api: store to Blob, enqueue job (BullMQ), return 202 + jobId
                        │
                 ocr-worker (BullMQ sandboxed processor — rides in the ingest
                 deployable in Phase 1; its own container app in Phase 2 volume)
                        │  submit to Document Intelligence → poll operation
                        ▼
                 parsed fields → Service Bus event `DocumentParsed`
                        ▼
                 api domain module → proposal record → human confirm screen
```

Rules that keep it honest:
- The API returns **202 Accepted + job ID** immediately; the UI shows "reading document…" and updates via WebSocket/poll.
- OCR output is always a **proposal with a confidence score**, confirmed by a human until the accuracy KPI is met (Risk R2 mitigation). Low-confidence fields are highlighted, never silently accepted.
- Every proposal→confirmation (including corrections) is logged — corrections become the training set for improving the custom model.
- Document Intelligence processes data in-region (UAE North availability to be confirmed with the admin; if unavailable in-region, route via the closest compliant region per the residency tier model — flag to Cybersecurity, D4-adjacent).

### 15.3 What to request from the Azure admin

Azure AI Document Intelligence resource (S0), UAE North (or nearest compliant region — confirm residency), managed-identity access from the worker, and Blob container `ocr-inbox` with lifecycle policy (raw uploads purged after successful parse + retention window).

---

**END — Development Approach & Implementation Plan v2.0**
