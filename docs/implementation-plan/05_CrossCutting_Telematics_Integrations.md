# 05 — Cross-Cutting, Telematics & Integrations

**Companion to:** [`../startup-doccs/08_Development_Approach_and_Implementation_Plan.md`](../startup-doccs/08_Development_Approach_and_Implementation_Plan.md) §6/§14/§15, [`../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md`](../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md) §8.5.

---

## 1. Identity & access (Microsoft Entra)

- **SSO** via Entra (OIDC, MSAL on the client, `passport-azure-ad`/JWKS validation on `api`). API exchanges the Entra token for a session token carrying role + scope claims.
- **MFA** enforced by conditional-access policy for **Fleet Manager and above** (elevated roles).
- **Two app registrations:** SPA (PKCE) and API (scopes). Security groups map to platform roles; group claims seed `role_assignment` alongside the HCM sync.
- Server is the boundary: the client uses claims for nav/route hints only; `AccessService` re-checks every request against `role_assignment` (role + scope node).

## 2. RBAC + Segregation of Duties (structural — C5)

RBAC scopes every query/command to a hierarchy node via `role_assignment`. Cost fields are masked for non-Finance; Executive sees aggregates only. The **`SodGuard`** enforces all 8 rules in the authorization layer (not by hiding buttons); each has a dedicated integration test:

| Rule | Enforcement |
|------|-------------|
| SoD-01 | A user cannot approve a booking they raised. |
| SoD-02 | A user cannot approve an entitlement they raised. |
| SoD-03 | The fleet manager who assigned a vehicle is not the sole investigator of a fine/accident on that booking (second reviewer required). |
| SoD-04 | Finance and Fleet Manager roles never co-held on the same scope. |
| SoD-05 | System Admin cannot approve operational bookings/entitlements. |
| SoD-06 | A delegate cannot approve requests raised by themselves or the delegator. |
| SoD-07 | A data steward cannot approve transactions on records they edited in the same change window. |
| SoD-08 | Any SoD override = documented `sod_exception` (reason + approver) + audit entry; surfaced in the standing exception report. |

## 3. Tamper-evident audit interceptor (C6 / FR-AUD)

A Nest interceptor wraps every state-changing command: captures actor, action, entity, before/after, reason, correlation id, and writes an append-only `audit_log` row in the same transaction as state and outbox events. The DB trigger takes a transaction-scoped advisory lock per organization and computes the SHA-256 hash over a versioned canonical payload. `UPDATE`/`DELETE` are revoked at role level. Internal Audit gets a read-only role + export. A chain-verification job runs on schedule and as a go-live gate. Every PDP evaluation and every override/hard-block attempt is captured.

Sensitive reads are also audited. Every live-location, route-replay, fine/accident evidence, unmasked-cost, consent-evidence, and audit-export request records actor, role/scope, purpose code, subject/entity, requested time range, result count, correlation id, and timestamp. Purpose is mandatory for location replay/export. The audit event never copies raw coordinates or full evidence payloads.

## 4. Consent gate (C4)

Implemented in `bookings`/`entitlements` (see [03](03_Backend_Design.md) §8). No signed, versioned, immutable `consent_record` ⇒ no booking number / no allocation, at any role. Stored to a WORM Blob container + Postgres pointer; re-consent on material change (PDP `consent-re-consent-tolerance`, D12). Consent text EN + AR, Legal-approved, versioned (D7).

## 5. Observability (OpenTelemetry → Application Insights)

- One trace view across `api`/`pdp`/`telematics-ingest`; correlation id propagated from request → PDP → events → logs.
- **Event-loop-lag custom metric** exported from every deployable (`monitorEventLoopDelay`, p99 gauge every 10s):
  - `api` p99 lag **< 10ms at all times**, including during a telemetry storm — **alert on it** (rising lag = CPU leaked into the API process).
  - `ingest` lag may spike (expected); generous health-probe timeout.
- Structured logs via `nestjs-pino` (low overhead — the loop is a budgeted resource). PDP latency, eligibility-gate latency, ingest consumer lag are first-class dashboards.

## 6. Config, secrets & feature flags

- **No secrets in code/config.** Managed identity per Container App → Key Vault references, Event Hubs, Service Bus, Blob, ACR, Postgres. No connection strings in config.
- Config is layered (env + Key Vault); business thresholds are **not** config — they are policy-engine decision tables.
- **No feature flags on safety properties** — hard blocks, consent gates, and SoD are never flag-controlled.

## 7. Notifications & alerting (P9)

Multi-channel dispatcher (Email/M365 in Phase 1; push/SMS in Phase 2) driven by Service Bus events and the compliance engine. Compliance alerts are **unmutable** (cannot be turned off by preference). Ladders: documents 60/30/14/7/1 days (lease 90/60/30) to fleet manager (+ Procurement for lease, Insurance Lead for policy); licence 60/30/14/7 to driver/line manager/HR. Booking reminders 24h before pick-up / 1h before return.

## 8. Telematics ingest pipeline (M10 — the pipe)

`telematics-ingest` is a **dumb, fast pipe** (no business logic, never reads booking tables). Pipeline:

```
EventProcessorClient (Blob checkpoint store)
  → pull batch (~500 raw events)
  → piscina.run(batch)                 // parallel normalize → canonical schema, off the main loop
  → Timescale: ONE batched COPY        // never 500 inserts
  → Service Bus: domain events (TripStarted/Ended, DeviceSilent)
  → checkpoint
```

**The three failure modes to design out:** (1) per-row inserts — batch or die; (2) `await` inside a `for` over messages — process the batch as a unit; (3) no backpressure — bound the Piscina queue; when full, stop pulling from Event Hubs (**consumer lag is a metric, not an outage**). Rule of thumb: any function >10ms CPU with no `await` goes to a worker thread.

### The swappable source (ADR-006/007)

```ts
interface TelemetrySource { start(onBatch): void; stop(): void; }
class SimulatorSource implements TelemetrySource {}   // Phase 1 — permanent, first-class
class AggregatorSource implements TelemetrySource {}  // Phase 2 — flespi/equiv.
class DirectVendorSource implements TelemetrySource {}// Phase 2 — direct vendor API
```

The adapter is a **source-side producer** of the canonical envelope. Event Hubs checkpoint ownership belongs only to `telematics-ingest`; adapters never manage downstream checkpoints. Swap = configuration plus conformance approval; the `telematics/domain` module (in `api`) never notices because it consumes versioned canonical events. Trip→booking attach, unplug alerts, and odometer-conflict resolution live in the **domain module** (joins with bookings), never in ingest.

## 9. IoT simulation strategy (Phase 1 — no hardware, ADR-007)

Two levels, both `TelemetrySource` implementations:

- **Level A — data simulation (Sprint 0, always on):** `SimulatorSource` publishes canonical telemetry **directly to Event Hubs**. Cheapest; unblocks the load test.
- **Level B — device-realistic (pilot target):** a simulated device fleet (Node MQTT clients, one per pool vehicle) provisions via **DPS** → per-device identity in **IoT Hub** → MQTT telemetry + device twin → IoT Hub's **Event-Hubs-compatible endpoint** → same ingest consumer. Rehearses the **exact path real hardware takes in Phase 2** (DPS enrolment, per-device credentials, disconnect events), so the swap is proven, not promised.

**The simulated device fleet** (Container Apps job, reuses `contracts/`): realistic movement along **real routes** via Azure Maps Route Directions (Mina Zayed → Khalifa Port → KEZAD corridors); **booking-aware mode** (subscribe to `BookingConfirmed`, drive the assigned vehicle so trip auto-attach has deterministic expected outcomes → regression suite "this trip MUST attach to BK-1204"); **fault injection** (unplug/silence, GPS drift, out-of-order/duplicate messages, offline buffer + backfill bursts) to exercise alerts and resilience; **device-twin** firmware/signal/battery feeding the health console; **scale mode** (50 pilot-realistic; 5,000 for the load test).

## 10. OCR worker (Phase 2, designed-for now)

Azure AI Document Intelligence is an **async submit-and-poll** API → same sacred-path rule as telematics: **never in `api`, never awaited in a request handler**.

```
React upload → api: store to Blob, enqueue BullMQ job, return 202 + jobId
  → ocr-worker (sandboxed processor; rides in ingest deployable in P1, own Container App at P2 volume)
  → submit to Document Intelligence → poll → parsed fields
  → Service Bus 'DocumentParsed' → api domain → proposal record → human-confirm screen
```

Phase 1 use (low-risk, high value): compliance-document auto-fill (Mulkiya/insurance number + expiry) proposed for human confirmation — exercises the whole pipeline before Phase 2 fuel-invoice parsing. OCR output is always a proposal with a confidence score, confirmed by a human until the ≥95% accuracy KPI is met; corrections become training data; every proposal→confirmation logged.

## 11. Integrations map

| # | Integration | Phase | Direction | Notes |
|---|-------------|-------|-----------|-------|
| I1 | **Oracle Fusion HCM** | 1 | inbound | Employee master, reporting lines, employment status, **leave calendars** (drives BSD return). Scheduled sync + change feed → `person`, `hierarchy_node` seed. |
| I2 | **Microsoft Entra** | 1 | bidirectional | SSO, group claims, MFA. |
| I3 | **Email / M365** | 1 | outbound | Notification delivery. |
| I4 | **Telematics Adapter Layer** | 1 | inbound | One canonical schema, vendor-agnostic; `SimulatorSource` in the pilot; IoT Hub endpoint for Level B. |
| I5 | Oracle Finance AP | 2 | inbound | Validated supplier invoice lines (fuel/maintenance cost). |
| I6 | Salik / Darb toll authorities | 2 | inbound | Per-vehicle toll transactions (statement import fallback). |
| I7 | Payroll | 2 | outbound | Executes approved recovery instructions (platform never executes payroll). |
| I8 | HR disciplinary workflow | 2 | outbound | Fines-threshold / behaviour escalations. |
| I9 | Push + SMS gateway | 2 | outbound | Critical alerts, mobile. |
| I10 | Azure AI Document Intelligence (OCR) | 1 (docs) / 2 (invoices) | service | Async worker pattern. |
| I11 | Traffic/police feeds (RTA/ADP) | 3 | inbound | Direct fines feed where APIs open. |
| I12 | Group BI / data platform | 2/3 | outbound | Curated analytics feed. |
| I13 | Smart key cabinets | optional | bidirectional | Manual key log in Phase 1. |

**Integration principles:** each external system behind an adapter with its own canonical mapping; retries + idempotency + DLQ on consumers; a vendor outage never blocks booking/handover/return (telematics resilience FR-GPS-P1-10); contract tests on the canonical telemetry schema (the asset that outlives any vendor).

### 11.1 Phase 1 integration contract gate

No Phase 1 adapter starts implementation until its owner signs a contract containing all fields below. Unknown values are blockers, not inferred defaults.

| Contract field | Oracle HCM | Entra | Email/M365 | Telematics |
|---|---|---|---|---|
| Business/system owner | Group HR + Integration | Cybersecurity + Platform | Service Owner + Platform | Fleet Ops + Integration |
| Source and transport | Approved endpoint/change source | OIDC/JWKS + group source | Approved mail API/relay | Event Hubs canonical envelope; IoT endpoint for device-realistic path |
| Identity/auth | Managed identity or approved OAuth client | OIDC PKCE/JWT; MFA policy | Managed identity or approved app identity | Per-source identity; DPS/device identity for IoT path |
| Watermark/idempotency | Source update/version + immutable employee id | Object id + group version/change marker | Notification id | Device id + source sequence + event timestamp |
| Freshness/SLA | Decision required before Block A | Token/JWKS/group propagation SLA required before auth gate | Delivery/retry SLA required before notifications | Ingest lag/backfill SLA required before telematics gate |
| Reconciliation | Counts + changed/deleted/transferred employees | Group-to-role assignment reconciliation | Sent/failed/bounced reconciliation | Per-device sequence gaps, duplicates, late/backfill reconciliation |
| Outage behavior | Eligibility blocks when approved freshness limit is exceeded; show data-as-of and escalate | Authentication denies; existing session policy follows Security decision | Persist notification obligation and retry; business command remains committed | Booking/handover remain available; live status marked stale; backfill on recovery |
| Test evidence | Create/update/transfer/termination/leave/outage/replay | Login, token expiry, group change, MFA, key rotation | Retry, duplicate, bounce, provider outage | Canonical contract, duplicate/order/gap/backfill, DPS/MQTT and vendor sample conformance |
| Support ownership | Named before Block A entry | Named before Phase 0 auth exit | Named before Block D entry | Named before Block C entry |

The approved contract must also record endpoint/environment availability, maintenance windows, timeout/retry policy, DLQ owner, credential rotation, monitoring signal and escalation route. These details belong in the controlled integration LLD; this plan only defines the entry gate.

Next: [06 — Phase-by-Phase Delivery Plan](06_Phase_Plan_and_Delivery.md).
