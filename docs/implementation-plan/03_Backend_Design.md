# 03 — Backend Application Design

**Stack:** NestJS + TypeScript (Fastify), Drizzle, Zod (`nestjs-zod`), BullMQ, Service Bus, Redis, `nestjs-pino`, OpenTelemetry. **Companion to:** [`../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md`](../startup-doccs/03_Phase1_MVP_PRD_ADPorts.md).

---

## 1. Conventions

- **Modular monolith**, three entrypoints (`main.ts`, `main.pdp.ts`, `main.ingest.ts`). Each feature is a Nest module that **exports only its service**; internals live in `internal/`. DI enforces the boundary; `dependency-cruiser` enforces it in CI.
- **API surface:** REST under `/api/v1` (Fastify), OpenAPI/Swagger at `/api-docs` in non-prod. Versioned; additive changes only within a version.
- **Validation:** every DTO is a Zod schema in `contracts/` wrapped by `nestjs-zod`. The same schema validates the request, types the service, and (for rule-type inputs) is the PDP input schema.
- **Every PEP asks the PDP; it never decides.** Business thresholds are never in code.
- **Every state change** writes its domain state, append-only audit row and any `outbox_event` in one Postgres transaction. Service Bus publication happens from the outbox dispatcher; consumers deduplicate through `inbox_message`.
- **Errors** are typed and mapped to RFC-7807-style problem responses (see §9); denials carry machine reason codes → localised (EN + AR) messages.

## 2. `contracts/` — the shared spine

One place for: Zod DTO schemas, the **canonical telemetry schema**, domain event payload schemas, and per-rule-type PDP input/output contracts. Imported directly by `api`/`pdp`/`ingest` (plain import, no package) and code-generated into TypeScript types consumed by the React app (kept in sync in CI). This is why Zod is the validation choice — one definition, four consumers.

## 3. The PDP (`pdp` deployable) — implementation

```ts
// policy/pdp.service.ts  (the ONLY interpreter of rules)
async evaluate(ruleType: string, context: unknown): Promise<Verdict> {
  const schema = this.registry.inputSchema(ruleType);      // Zod, from contracts/
  const ctx = schema.parse(context);                       // reject malformed input
  const rule = await this.cache.getActiveRule(ruleType, ctx.scope); // Redis; DB on miss
  if (!rule) return this.safeDefault(ruleType);            // FAIL SAFE → DENY + escalate
  const row = firstMatch(rule.decisionTable, ctx);         // top-down, first match wins
  const verdict = row ?? rule.defaultRow;                  // mandatory default
  return { decision: verdict.decision, reasons: verdict.reasons,
           policyVersion: rule.version, scopeThatAnswered: rule.scope,
           contextFingerprint: fingerprint(minimize(ctx)) };
}
```

- **Storage/eval:** versioned immutable JSONB decision tables; top-down first-match-wins; mandatory default row. Scope resolution: group → cluster → pool (most specific wins, reports which scope answered).
- **Cache:** compiled rules in Redis; bounded Postgres read-through on cache miss; invalidated on version activation. Cache-miss DB time is included in the <200ms latency SLO.
- **Fail-safe (C3, FR-POL-08):** unreachable PDP / no matching active rule → `DENY` + escalate to fleet manager. Latency budget **< 200 ms** (in the booking path).
- **Every evaluation logged:** command-path PEPs write the minimized decision evidence and outbox record in the same transaction as the affected state. Read-only evaluations call a dedicated append endpoint before returning the verdict. Raw request context is not duplicated; the log stores approved minimized fields plus a context fingerprint. Internal Audit can reconstruct any decision without retaining unnecessary personal data.
- **PAP (Phase 1 minimal):** author decision tables, submit → review → approve → effective-date; dry-run diff against active version (FR-POL-06) before activation; high-impact rule types need second-person approval (FR-POL-03).

**A PEP in practice:**

```ts
// bookings.service.ts — asks; never decides
const v = await this.pdp.evaluate('driver-eligibility',
  { driverId, vehicleId, window, clusterId });
if (v.decision === 'DENY') throw new PolicyDeniedException(v.reasons); // → 403 + reasons
```

## 4. Module catalogue (Phase 1: M1–M10)

Legend: **PEP** = calls the PDP and enforces; **Owns** = tables from [02](02_Database_Design.md).

### M1 — `platform`
Identity, hierarchy, RBAC + SoD guard, delegation, audit. **Owns:** organization, hierarchy_node, person, role, role_assignment, delegation, sod_exception, audit_log.
- **Services:** `HierarchyService` (N-level tree, roll-up/scope resolution), `AccessService` (RBAC scope checks), `SodGuard` (8 structural rules — §5 of [05](05_CrossCutting_Telematics_Integrations.md)), `DelegationService`, `AuditService` (hash-chained writes).
- **Endpoints:** `GET /hierarchy`, `GET /me` (roles+scopes), `POST /delegations`, `GET /audit` (Internal Audit, read-only, searchable/exportable), `GET /reports/exceptions` (SoD + hard-block attempts).

### M2 — `vehicles`
Vehicle master + document vault. **PEP:** none (config only). **Owns:** vehicle, vehicle_document, vehicle_lifecycle_history, vehicle_transfer.
- **Services:** `VehicleService` (CRUD, lifecycle/status transitions, pool include/exclude, uniqueness), `DocumentVaultService` (versioned attachments; OCR proposal confirm in P2), `TransferService`.
- **Endpoints:** `GET/POST/PATCH /vehicles`, `GET /vehicles/:id`, `POST /vehicles/:id/documents`, `POST /vehicles/:id/transfer`, `GET /vehicles/:id/history`. Every change event-published (FR-INV-11) for search index/dashboards/BI.

### M3 — `migration`
Bulk import, validation, dedup, steward sign-off. **Owns:** import_batch, import_row, dedup_candidate.
- **Services:** `ImportService` (CSV/XLSX templates), `ValidationService` (mandatory/format/uniqueness/ref checks — pre-commit), `DedupService`, `ReconciliationService` (row-level report + completeness score). Heavy parsing runs as a **BullMQ sandboxed job**, not in the request thread.
- **Endpoints:** `POST /imports` (upload → 202 + jobId), `GET /imports/:id` (report), `POST /imports/:id/resolve`, `POST /imports/:id/sign-off`.

### M4 — `bookings` (PEP)
Web booking, buffer, waitlist, consent sequencing, eligibility gate. **Owns:** booking, waitlist_entry, booking_event, consent_record.
- **PDP calls:** `driver-eligibility` (gate), `booking-buffer`, `max-booking-duration`, `booking-approval-chain`, `consent-re-consent-tolerance`.
- **Services:** `BookingService` (search→select→consent→submit; buffer/duration/eligibility enforced via PDP; persists `reservation_start/end` + policy version; unique number issued **only after** consent; maps exclusion conflicts to 409), `WaitlistService` (auto-allocate next eligible, re-capture consent), `ConsentService` (write immutable pointer + append lifecycle event; re-consent creates a superseding record), `BookingEventService` (no-show/late-return capture).
- **Endpoints:** `GET /vehicles/available`, `POST /bookings` (creates Draft), `POST /bookings/:id/consent`, `POST /bookings/:id/submit`, `POST /bookings/:id/{approve|decline|modify|cancel}`, `POST /bookings/:id/extend` (FR-BOOK-15 mid-trip). Routes approvals via `workflow`.

### M5 — `entitlements` (PEP)
Dedicated-vehicle requests → eligibility → approval to Cluster CEO; BSD leave return. **Owns:** entitlement_request, bsd_return_window.
- **PDP calls:** `dedicated-vehicle-eligibility` (decision table on grade/role/cluster — D8), `entitlement-approval-chain` (LM→CFL→Cluster CEO thresholds).
- **Services:** `EntitlementService` (capture, eligibility pre-check, driver consent before allocation, utilisation/justification report), `BsdReturnService` (propose windows from HCM leave calendar, auto-revert).
- **Endpoints:** `POST /entitlements`, `POST /entitlements/:id/submit`, approval actions via `workflow`, `GET /entitlements/:id`, `POST /entitlements/:id/bsd-windows`.

### M6 — `handover`
Handover/return, signature, odometer/fuel, damage capture, key log. **Owns:** handover, damage_pin, key_log.
- **Services:** `HandoverService` (verify booking+employee, capture odometer/fuel/GPS status/signature; return reconciliation; fuel-deviation flag via PDP `fuel-deviation-threshold` — advisory), `DamageService` (tap-to-pin + photo), `KeyLogService`. **Offline capture** (Phase 2 mobile) with sync + conflict queue; odometer-conflict rule FR-HAND-11 defers to telematics.
- **Endpoints:** `POST /handovers` (handover), `POST /handovers/:id/return`, `POST /handovers/:id/damage`, `GET /vehicles/:id/keys`.

### M7 — `compliance` (PEP + scheduled engine)
Compliance alerting engine, single eligibility gate, hard blocks. **Owns:** compliance_item, eligibility_evaluation, access_block.
- **PDP calls:** `compliance-alert-ladders`, `hard-block-conditions`, `driver-eligibility-gate`.
- **Services:** `EligibilityService` — the **one** "can this driver take this vehicle now?" decision (with reasons) consumed by bookings, entitlements, substitution, handover (FR-COMP-10). `ComplianceEngine` claims due items from the Postgres `scheduled_work` ledger and dispatches execution through BullMQ; a reconciler re-enqueues due or expired-lease work after restart (FR-COMP-09). **Hard block (FR-COMP-03): no booking on expired Mulkiya/insurance — no override**, structurally enforced (attempts logged as denials).
- **Endpoints:** `GET /eligibility?driver=&vehicle=&window=`, `GET /compliance/expiries`, `GET /compliance/blocks`.

### M8 — `fines`
Fines/black points/accidents register, auto-attribution, recovery, substitution model. **Owns:** fine, black_point, accident, recovery_record, substitution_window.
- **PDP calls:** `fines-hr-threshold` (≥N in rolling window → HR alert), `black-point-transfer-timeframe` (deadline + escalation → platform-wide block via `access_block`).
- **Services:** `FineService` (auto-link fine to the booking active at its datetime → driver; else assigned driver; honour substitution window), `AccidentService`, `RecoveryService` (Identified→Notified→Recovered/Waived; waiver reason+approver), `SubstitutionService` (record time-boxed windows — **data model live in Phase 1**, self-service UI Phase 2).
- **Endpoints:** `POST /fines`, `POST /accidents`, `GET /fines?scope=&period=`, `POST /fines/:id/recovery`, `POST /vehicles/:id/substitution-windows`.

### M9 — `dashboards` (read models)
Operational + basic executive dashboards. Read-optimised query services + materialized views over the modules above; respects role + scope masking (cost masked for non-Finance; Executive aggregate-only). Feeds: utilisation, fines-per-user, compliance heat map, entitlement inventory, telematics coverage %, KPI tiles (§10 of Phase 1 PRD).

### M10 — `telematics/domain` (in `api`) + `telematics/ingest` (separate)
See [05 — Cross-Cutting, Telematics & Integrations](05_CrossCutting_Telematics_Integrations.md) for the full pipeline. Domain module **owns** device, device_pairing, trip, telematics_alert and does trip→booking attach, unplug alerts, odometer-conflict resolution, live-status; **PDP** for privacy/access policy. Ingest is a dumb, fast pipe with the `TelemetrySource` adapter (SimulatorSource in Phase 1).

## 5. Eventing (transactional outbox → Azure Service Bus)

Reliable business events (distinct from Event Hubs telemetry): `BookingConfirmed`, `BookingCancelled`, `EntitlementApproved`, `HandoverCompleted`, `FineRecorded`, `ComplianceBlockRaised/Cleared`, `TripEnded`, `DeviceSilent`, `ConsentSigned`. The command transaction writes `outbox_event`; a lease-based dispatcher publishes to Service Bus and marks `published_at`. Consumers first insert `(consumer_name, message_id)` into `inbox_message`; a duplicate is acknowledged without reapplying effects. Dashboards, notifications, telematics-domain trip attach and search indexing consume versioned payload schemas from `contracts/`. DLQ replay preserves the original message id and correlation id.

## 6. Background work (Postgres ledger + BullMQ execution)

Business-critical obligations (compliance ladders, approval SLA deadlines, delegation expiry, notification obligations) are rows in `scheduled_work`; workers lease due rows, execute through BullMQ, and record completion/retry/dead-letter state in Postgres. A reconciliation sweep re-enqueues due or lease-expired rows so Redis loss cannot erase obligations. Migration parsing and OCR processing may use BullMQ job payloads because their source record/object remains durable and replayable. Heavy processors are **sandboxed** (own thread), never on the `api` main thread.

## 7. Realtime

Nest WebSocket gateway + Redis adapter (Socket.IO), scaled across `api` replicas: live fleet map positions, booking status changes, alert pushes. Feeds off Service Bus domain events + telemetry-derived positions.

## 8. Consent sequencing (the legal gate — implemented in `bookings`/`entitlements`)

1. Employee selects window + vehicle. 2. Eligibility gate runs (PDP). 3. **Consent captured after selection, before submission** — bound to driver, vehicle category, window, policy version, written immutably. 4. Submission routes to approval. **No consent record ⇒ no booking number / no allocation.** Declined ⇒ append a `Voided` lifecycle event; the consent row/object is unchanged. Material modification beyond tolerance (PDP `consent-re-consent-tolerance`, D12) ⇒ a new consent record that supersedes the prior record plus a `Superseded` lifecycle event.

## 9. Error & response model

- Success: typed DTO; 201 for creates, **202 + jobId** for async (imports, OCR).
- Denials: `403` + `{ type, title, reasons[] }` where `reasons` are machine codes resolved to EN/AR text on the client. "Blocks explain themselves" (cause + next action).
- Validation: `400` from Zod pipe with field-level detail.
- PDP unavailable: treated as `DENY` + escalation event — never a 500 that fails open.
- Correlation id on every request; propagated to `decision_log`, audit, logs, traces.

## 10. Definition of Done (every backend module)

- [ ] FRs cited in the PR description; behaviour matches the governing PRD.
- [ ] Business rules via the PDP, not hard-coded (CI grep guard passes).
- [ ] Relevant SoD rules have explicit passing tests.
- [ ] Every state-changing action emits an audit entry; policy version recorded on the transaction.
- [ ] `dependency-cruiser` passes (no forbidden imports).
- [ ] No new synchronous CPU work in `api` (event-loop-lag considered).
- [ ] Unit tests on logic; integration tests on PDP, SoD guard, consent sequencing, fine attribution.
- [ ] Reason codes translated EN + AR. No secrets in code/config (managed identity / Key Vault only).

Next: [04 — Frontend Application Design](04_Frontend_Design.md).
