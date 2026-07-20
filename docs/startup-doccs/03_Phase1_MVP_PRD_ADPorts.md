# AD Ports Group — Fleet Management Platform
# Phase 1 PRD — Foundation MVP

**Version 3.1-P1 (Lean) · Pilot: GS Pool, Mina Zayed · Replaces: Vehicle Allocation in Mehwar**

---

## 1. Phase 1 Goal

Deliver the smallest system that proves the complete loop at one pool:

> An employee books a car online → signs consent → manager approves → fleet manager hands over → vehicle returns → any fine is pinned to that driver → nothing runs on expired documents.

Success = GS Pool (Mina Zayed) fully off Mehwar, with the six KPIs in §10 met.

**Explicitly NOT in Phase 1** (see Phase 2/3 docs): mobile app, OCR fuel invoices, toll integration, replacement/substitute self-service workflows, behaviour scoring, AI features, vendor scorecards, payroll recovery integration, public API, recurring bookings, break-glass emergency bookings, per-organization branding and setup tooling (a convenience for future re-deployments — Phase 3). Note: reusability is achieved by clean boundaries and configuration (FR-ARC-01/02/03), which are in Phase 1; nothing multi-tenant is built. **GPS tracking is IN Phase 1** as a plug-and-play capability (M10); only advanced telematics (full route-replay player, geofence corridors, video) remains Phase 2.

---

## 2. Phase 1 Scope — 10 Modules

| # | Module | One-line scope |
|---|---|---|
| M1 | Platform base | SSO (Entra + MFA), roles & SoD, configurable org hierarchy (deployed as Cluster→Pool→Location), **no-code policy engine**, audit log — built generic, configured for AD Ports (§4.0) |
| M2 | Vehicle master | Full inventory data model, lifecycle states, document vault |
| M3 | Data migration | Bulk import, validation, dedup, steward sign-off (pre-go-live cleansing) |
| M4 | Booking | Web booking, approval, buffer, waitlist, digital consent |
| M5 | Dedicated vehicles | Entitlement request → eligibility check → approval up to Cluster CEO |
| M6 | Handover & return | Digital signature capture, odometer/fuel recording, reconciliation |
| M7 | Compliance engine | Expiry alerts, driver eligibility gate, hard blocks |
| M8 | Fines & black points | Manual register, auto-link to driver, black-points block |
| M9 | Dashboards | Operational dashboards + basic executive view |
| **M10** | **GPS tracking & telematics (pluggable module, simulator-first)** | **`telematics-ingest` pipe (swappable `TelemetrySource`; simulator in pilot) + `telematics` domain module in api (live map, auto odometer, trip auto-attach, unplug alerts). No hardware in the pilot (§8.5)** |

Integrations in Phase 1: **Oracle Fusion HCM** (employees, hierarchy, leave), **Microsoft Entra** (SSO), **Email/M365** (notifications), **Telematics Adapter Layer** (device/aggregator ingestion — one canonical schema, vendor-agnostic). Nothing else.

---

## 3. Actors (Phase 1)

Employee/Driver · Approver (Line Manager) · Delegate Approver · Fleet Manager · Cluster Fleet Lead · Group Fleet Lead · Cluster CEO (entitlement approver) · Finance (view) · HR (escalations view) · Internal Audit (read-only) · Executive (dashboard) · Data Steward · System Admin (D&T).

Deferred actors: Substitute Driver (data model only, §M8), Professional Driver, Procurement operational role (view + lease expiry alerts only in P1).

---

## 4. M1 — Platform Base

### 4.0 Architecture principle — build generic, deploy for AD Ports (IMPORTANT)

The platform core is what makes this reusable across organizations rather than a one-off build. Phase 1 delivers it **architecturally complete but configured for a single deployment**:

| Ref | Requirement |
|---|---|
| FR-ARC-01 | **Clean, self-contained data model:** the schema and modules shall be organized so the whole project can be re-deployed for another organization without code changes. Each organization is a **separate deployment** (own database, own hosting) — data isolation is absolute by construction. Reusability comes from FR-ARC-02 (configurable hierarchy) and FR-ARC-03 (rules in the policy engine), not from multi-tenant infrastructure. |
| FR-ARC-01a | **Dormant multi-org seam:** core entity tables shall carry an inert `organization_id` column (single default value, RLS off, never referenced by application code). This is reserved scaffolding that keeps a future multi-organization/hosted deployment a routine change rather than a risky schema migration. No tenancy behaviour is built in Phase 1. A CI guard flags any application-code reference to the column. |
| FR-ARC-02 | **Generic hierarchy engine:** the org hierarchy shall be an N-level configurable tree (levels, labels and depth per configuration). Phase 1 deploys it as 3 levels labelled Cluster → Pool → Location for AD Ports. |
| FR-ARC-03 | **Rules in configuration, not code:** all business rules listed in §4.6 shall live in the policy engine. No AD Ports-specific threshold, chain or buffer shall be hard-coded. |

### 4.1 Identity & access

| Ref | Requirement |
|---|---|
| FR-IAM-01 | SSO via Microsoft Entra; MFA required for Fleet Manager and above. |
| FR-IAM-02 | Role-based access scoped to hierarchy node (pool/cluster/group); a person may hold multiple roles. |
| FR-IAM-03 | Cost fields masked for all non-Finance roles; Executive sees aggregates only. |

### 4.2 Hierarchy (configurable engine — see FR-ARC-02)

| Ref | Requirement |
|---|---|
| FR-CLU-01 | Configurable N-level hierarchy engine (labels and depth per configuration); deployed for AD Ports as three levels: Cluster → Pool → Location. |
| FR-CLU-02 | Each vehicle assigned to exactly one cluster and one pool; optional location. |
| FR-CLU-03 | Inter-pool/cluster transfer recorded with from, to, date, approver, reason. |
| FR-CLU-04 | Reports roll up location → pool → cluster → group; drill-down in two clicks. |

### 4.3 Segregation of duties (structural, not optional)

| Ref | Rule |
|---|---|
| SoD-01 | No user approves a booking they raised. |
| SoD-02 | No user approves an entitlement they raised. |
| SoD-03 | The fleet manager who assigned a vehicle is not the sole investigator of a fine/accident on that booking. |
| SoD-04 | Finance role and Fleet Manager role never co-held on the same scope. |
| SoD-05 | System Admin cannot approve bookings or entitlements. |
| SoD-06 | Any SoD override = documented exception (reason + approver) in the audit log. |

### 4.4 Delegation (minimal)

| Ref | Requirement |
|---|---|
| FR-DEL-01 | An approver can delegate to a named user for a start/end window. |
| FR-DEL-02 | Decisions recorded as "by [delegate] on behalf of [delegator]"; one hop only. |

### 4.5 Audit log

| Ref | Requirement |
|---|---|
| FR-AUD-01 | Append-only, tamper-evident log of every booking, consent, entitlement, fine, override and record change: timestamp, actor, action, before/after, reason. |
| FR-AUD-02 | Internal Audit role: read-only access with search/export. |
| FR-AUD-03 | Standing exception report: SoD overrides and hard-block override *attempts* (all must be denials). |

### 4.6 Policy engine (the crown jewel — detailed specification)

A no-code rule builder where administrators set the business rules; every other module reads decisions from it at runtime. Phase 1 ships the full engine architecture with the rule types the MVP needs; later phases only **register new rule types** — the engine itself is never re-architected.

#### 4.6.1 How it works — the standard pattern

The engine follows the industry-standard **PAP / PDP / PEP** separation (the pattern behind XACML/ABAC authorization and DMN decision services):

| Component | Standard name | What it is here |
|---|---|---|
| **Policy Administration Point (PAP)** | Admin authoring UI | The no-code rule builder in the admin console: create/edit rules as decision tables, submit for approval, set effective dates |
| **Policy Decision Point (PDP)** | Central decision service | A stateless service exposing one call per rule type: `evaluate(ruleType, context) → {decision, reasons[], policyVersion}`. It is the ONLY component that interprets rules |
| **Policy Enforcement Points (PEP)** | The consuming modules | Booking (M4), Entitlements (M5), Compliance gate (M7), Fines (M8), Notifications — they call the PDP and enforce its answer; they never contain rule logic themselves |
| **Policy store** | Versioned repository | Immutable, versioned rule definitions with scope and effective dates |
| **Decision log** | Audit of every evaluation | Every PDP call recorded: inputs, decision, reasons, policy version, timestamp — joins the M1 audit log |

**The contract that makes it work:** every rule type declares (a) its **input schema** (e.g. for eligibility: employee grade, role, cluster, licence status, block flags), (b) its **output** (allow/deny/route-to/value + machine-readable reason codes), and (c) its **fallback** (what happens if no rule matches — always the safe default, e.g. deny/escalate). Modules code against the contract once; rules change forever after without code.

#### 4.6.2 Rule anatomy — decision tables

Rules are authored as **decision tables** (DMN-style): rows of conditions → outcome, evaluated top-down, first match wins, mandatory default row. Example (dedicated-vehicle eligibility, per D8):

| Grade | Request type | Cluster | → Outcome | → Approval chain |
|---|---|---|---|---|
| ≥ Director | Long-term | Any | Eligible | LM → CFL → Cluster CEO |
| ≥ Manager | Temporary ≤ 30 days | Any | Eligible | LM → CFL |
| Any | Any | Any | **Not eligible (default)** | — |

This format is business-readable (HR can review it), testable, and diffable between versions.

#### 4.6.3 Governance lifecycle

Every rule version moves through: **Draft → In Review → Approved → Active (from effective date) → Superseded**.

| Ref | Requirement |
|---|---|
| FR-POL-01 | Rules authored no-code as decision tables per registered rule type; each rule type has a declared input schema, output contract, reason codes and safe-default fallback. |
| FR-POL-02 | Policy store is versioned and immutable: activating a change creates a new version; prior versions remain queryable forever. Every transaction records the policy version in force at decision time (consent already requires this — FR-CON-01). |
| FR-POL-03 | Lifecycle enforcement: high-impact rule types (eligibility, SoD-adjacent, consent tolerance, black-point timeframe) require second-person approval before activation; all changes effective-dated; emergency deactivation reverts to prior version, logged as an exception. |
| FR-POL-04 | Scoping with inheritance: group default → cluster override → pool override, where the rule type permits; the PDP resolves the most specific applicable rule and reports which scope answered. |
| FR-POL-05 | Decision logging: every PDP evaluation logged (inputs, decision, reasons, version); Internal Audit can reconstruct why any transaction was allowed, denied or routed. |
| FR-POL-06 | Dry-run validation: before activation, an author must run the draft rule against a validation set (sample or recent real transactions) and see the outcome diff versus the active version. (Full historical simulation matures in Phase 3.) |
| FR-POL-07 | No business rule value shall exist hard-coded anywhere in the codebase (enforces FR-ARC-03); a build-time checklist maps every FR threshold in this document to its rule type. |
| FR-POL-08 | The PDP is in the critical booking path: decision latency < 200 ms; PDP unavailability fails safe (deny + escalate to fleet manager), never fails open. |

#### 4.6.4 Phase 1 rule-type catalog (registered at MVP)

| Rule type | Consumed by (PEP) | Governs |
|---|---|---|
| Booking buffer | M4 | Minutes between bookings, per vehicle category |
| Max booking duration | M4 | Cap + escalation, per category |
| Approval chain — booking | M4 via workflow | Route + 24h timeout escalation |
| Approval chain — entitlement | M5 via workflow | LM → CFL → Cluster CEO thresholds + 48h escalation |
| Dedicated-vehicle eligibility | M5 | Grade/role/cluster decision table (D8) |
| Driver eligibility gate | M7 | Licence, employment status, block flags composition |
| Compliance alert ladders | M7 | Days-before-expiry per document type, recipients |
| Hard-block conditions | M7 | Expired Mulkiya/insurance = deny, no override |
| Fines HR threshold | M8 | ≥N fines in rolling window (default 3/12mo) |
| Black-point transfer timeframe | M8 | Deadline + escalation cadence (D9) |
| Consent re-consent tolerance | M4/M5 | What modification requires re-consent (D12) |
| Fuel deviation threshold | M6 | ±% flag level per category (default ±20%) |

Phase 2 registers new rule types on the same engine (toll recharge, behaviour weights, break-glass categories); Phase 3 adds jurisdiction packs and full simulation — see those documents.

---

## 5. M2 — Vehicle Master & M3 — Data Migration

### 5.1 Lifecycle & status

| Ref | Requirement |
|---|---|
| FR-INV-01 | Single group-wide vehicle master, all owned and leased vehicles. |
| FR-INV-02 | Lifecycle: Active, In Use, Under Maintenance, Off-Hire Pending, Decommissioned, Sold, Transferred. |
| FR-INV-03 | Operational statuses: Reserve, Standby, VIP Only, Quarantined, Temporary Hold. |
| FR-INV-04 | Include/exclude from booking pool without affecting history. |
| FR-INV-05 | Uniqueness enforced at group level: plate, chassis/VIN, Salik tag, Darb tag. |
| FR-INV-06 | Versioned attachments: Mulkiya, insurance, lease agreement, off-hire terms. |
| FR-INV-07 | Equipment and shuttle buses recordable for cost, never bookable. |

### 5.2 Data model (mandatory at onboarding unless marked optional)

**Identity:** Vehicle ID (auto) · Plate · Chassis/VIN · Make · Model · Year · Colour · Body type · Use category (Executive/Operations/Pool/VIP/Dedicated) · Seating capacity · Fuel type · Fuel efficiency.

**Commercial:** Ownership (Owned/Leased) · Purchase/lease start date · Lease end date · Purchase cost / monthly rental · Currency (AED default) · Vendor/lessor · Lease contract ref · Early off-hire penalty terms · Depreciation rate.

**Compliance:** Mulkiya number + expiry · Insurance provider, policy number, expiry, coverage type · Salik tag · Darb tag · Fuel card number · Document attachments.

**Operational:** Lifecycle status · Operational status · Booking-pool flag · Cluster · Pool · Location · Last confirmed odometer · Next maintenance due · Assignment model (Pool/Dedicated) · Assigned driver (if dedicated) · Substitute driver window (data field — see §8.4).

*System/reserved:* every core table also carries an inert `organization_id` (FR-ARC-01a) — reserved scaffolding, not used by any Phase 1 logic.

**Telematics (all optional in P1):** tracker vendor, serial, SIM, warranty, GPS status (Installed / Not Installed / Online / Offline / Faulty / Under Replacement).

**Computed:** lifetime fines (count/value), black points + transfer status, lifetime accidents, days off-road, created/modified audit, lifecycle history.

### 5.3 Migration & quality (this is what de-risks go-live — Risk R5 High/High)

| Ref | Requirement |
|---|---|
| FR-MIG-01 | Bulk import (CSV/XLSX templates) of vehicles, drivers, contracts, documents, open fines. |
| FR-MIG-02 | Pre-commit validation: mandatory fields, formats, uniqueness, valid hierarchy/vendor references. |
| FR-MIG-03 | Duplicate detection with steward-resolved merge. |
| FR-MIG-04 | Batch reconciliation report (loaded/rejected/pending with row-level reasons); steward sign-off before records become operational. |
| FR-MIG-05 | Per-vehicle completeness score feeding the ≥98% inventory KPI. |

---

## 6. M4 — Booking

**Business rules:** buffer between bookings on the same vehicle (default 10–15 min, configurable) · max duration per vehicle category with escalation · eligibility validated before confirmation · non-bookable statuses excluded from search · waitlist with auto-allocation on cancellation.

| Ref | Requirement |
|---|---|
| FR-BOOK-01 | Web booking: employee ID, pick-up/return date-time, destination, purpose, passenger count. |
| FR-BOOK-02 | Availability matching by window, status, seating capacity, pool scope; only eligible vehicles shown. |
| FR-BOOK-03 | Routing to line manager (or active delegate) per Oracle HCM hierarchy. |
| FR-BOOK-04 | Approve / decline with reason / request modification. |
| FR-BOOK-05 | Unique booking number issued on confirmation; employee confirmed, fleet manager notified. |
| FR-BOOK-06 | Digital consent is a precondition to submission — no consent, no booking number (§9). |
| FR-BOOK-07 | Buffer enforcement between consecutive bookings on the same vehicle. |
| FR-BOOK-08 | Max-duration enforcement by category, escalation on exceedance. |
| FR-BOOK-09 | Eligibility gate before confirmation: employment active + licence valid + no black-points block; blocked users get a clear, actionable reason. |
| FR-BOOK-10 | Waitlist for full pools; cancellation auto-allocates to next eligible waitlister; consent captured before their booking number is issued. |
| FR-BOOK-11 | Reminders: 24h before pick-up, 1h before return. |
| FR-BOOK-12 | No-show and late-return detection, flagged and logged (feeds Phase 2 behaviour scoring — capture the events now). |
| FR-BOOK-13 | Expected fuel computed from vehicle efficiency and distance (simple estimate; traffic-aware in Phase 2). |
| FR-BOOK-14 | Every booking action logged: create, approve, modify, cancel, no-show, late return. |
| FR-BOOK-15 | Mid-trip extension request (simple): employee requests extension; system checks conflict with next booking + buffer; no conflict → expedited approval; conflict → fleet manager decides. |

## 7. M5 — Dedicated Vehicle Requests & Entitlements

**Business rules:** eligibility = f(grade, role, cluster, policy limits), evaluated before submission · mandatory justification (category + free text) · approval chain configurable, ends at Cluster CEO above thresholds · dedicated vehicles return to shared pool (BSD) during leave · driver consent mandatory.

| Ref | Requirement |
|---|---|
| FR-DVR-01 | Request types: long-term, temporary, with-driver, without-driver. |
| FR-DVR-02 | Capture: duration, start/end dates, location, business unit, cost centre, remarks, attachments. |
| FR-DVR-03 | Justification category list (operational requirement, executive assignment, project support, site visits, temporary replacement, emergency operations) + free text. |
| FR-DVR-04 | Automatic eligibility evaluation against grade/role/policy before submission; eligible vehicle options presented. |
| FR-DVR-05 | Configurable chain per cluster: Line Manager → Cluster Fleet Lead → Cluster CEO (thresholds per policy); 48h timeout escalation. |
| FR-DVR-06 | Assigned driver's digital consent required before allocation confirmation. |
| FR-DVR-07 | BSD return during leave: windows proposed from Oracle HCM leave calendar, confirmed by fleet manager; vehicle bookable for the window, auto-reverts at end. |
| FR-DVR-08 | Utilisation & justification report per allocation for periodic review. |
| FR-DVR-09 | Full audit trail: submission, eligibility result, every approval/rejection, extensions, cancellation, reassignment. |

## 8. M6 — Handover & Return · M7 — Compliance · M8 — Fines & Black Points

### 8.1 Handover & return

| Ref | Requirement |
|---|---|
| FR-HAND-01 | Verify booking number + employee ID at handover. |
| FR-HAND-02 | Record at handover: starting odometer, fuel level, key issued, GPS status, date/time. |
| FR-HAND-03 | Employee confirms condition with digital signature (tablet/desktop). |
| FR-HAND-04 | Record at return: ending odometer, fuel level, condition, damage/accident note, key returned. |
| FR-HAND-05 | Fuel reconciliation: actual vs expected; deviation beyond ±20% (configurable) flagged for review — advisory, not blocking. |
| FR-HAND-06 | Late/early returns flagged and logged. |
| FR-HAND-07 | Simple key log: key custody state per vehicle (cabinet / fleet manager / driver-booking ref / lost). No smart lockers in P1. |

### 8.2 Compliance engine

| Ref | Requirement |
|---|---|
| FR-COMP-01 | Track expiries: Mulkiya, insurance, lease, Salik account, Darb account, fuel card, driver licence. |
| FR-COMP-02 | Alert ladders: documents 60/30/14/7/1 days (lease 90/60/30) to fleet manager, copy Procurement (lease) and Insurance Lead (policy); licence 60/30/14/7 to driver, line manager, HR. |
| FR-COMP-03 | **Hard block, no override:** no new booking on a vehicle with expired Mulkiya or insurance. |
| FR-COMP-04 | Single eligibility decision service ("can this driver take this vehicle now?" with reasons) used by booking, entitlement and handover — one gate, one truth. |
| FR-COMP-05 | Every evaluation and block raise/clear logged. |

### 8.3 Fines, black points, accidents (manual register in P1)

| Ref | Requirement |
|---|---|
| FR-FINE-01 | Fines register: reference, date/time, location, amount (AED), black points, status (paid/unpaid/disputed), authority. |
| FR-FINE-02 | Auto-link each fine to the booking active at its date/time → driver; no active booking → assigned driver of the dedicated vehicle. |
| FR-FINE-03 | Fines-per-user view by entity, period, severity; ≥3 fines in rolling 12 months → HR + line manager alert. |
| FR-FINE-04 | Accidents register: date, driver, booking ref, location, description, third party, police report no., damage cost (est/actual), claim status, repair vendor, days off-road; attachments supported. |
| FR-FINE-05 | **Black points:** driver responsible for transfer to personal traffic file within the defined timeframe (D9); overdue transfer = platform-wide block on booking/using/accessing any vehicle service, enforced through the eligibility gate; monitoring, escalation and notifications included. |
| FR-FINE-06 | Disputed fines stay attributed pending resolution; resolutions logged. |
| FR-FINE-07 | Recovery (minimal P1): each attributed fine/damage generates a recovery record (identified → notified → recovered/waived, manual update by Finance/HR); waivers need reason + approver. Payroll automation is Phase 2. |

### 8.4 Substitution attribution — data model only (critical P1 design decision)

| Ref | Requirement |
|---|---|
| FR-SUB-01 | The data model supports time-boxed driver-responsibility windows per vehicle from day one; a fleet manager can manually record an authorised substitution window (driver, start, end, approver, reason). |
| FR-SUB-02 | Fine/accident attribution honours any recorded substitution window. Self-service substitution workflow ships in Phase 2 — but Phase 1 fines must never be mis-attributed for lack of the model. |

### 8.5 M10 — GPS Tracking & Telematics (plug-and-play) — IMPORTANT

GPS is a Phase 1 capability. Two clarifications define how it's built:

1. **No hardware in the pilot.** The GS Pool pilot connects **no physical trackers**. Telemetry is produced by a **simulator** that generates realistic GPS signals (positions, trips, ignition, odometer, unplug events). This de-risks go-live entirely from procurement and installation, and lets the full software capability be built, load-tested and demoed before any device is bought.
2. **GPS is a pluggable software module, not a microservice.** The capability is a self-contained module with a **swappable telemetry source adapter** — the simulator today, and real hardware later, plug into the *same* contract with no change to the rest of the platform.

**The two pieces (do not confuse them):**

| Piece | What it is | Responsibility |
|---|---|---|
| `telematics-ingest` | A **separate deployable process** (own container, own scaling) | The dumb, fast **pipe**: source -> normalize to canonical schema -> batched Timescale write -> emit domain events. No business logic. **The source adapter plugs in here.** |
| `telematics` domain module | A **NestJS module inside `api`** | The **meaning**: trip->booking attachment, unplug/tamper alerts, odometer-conflict resolution, device registry & pairing, "is this vehicle online?". Consumes canonical events; calls the PDP for policy. |

Split for two different reasons: ingest is separate for **runtime latency isolation** (a telemetry burst must never block the eligibility gate); the domain module stays in `api` for **data locality** (its questions are all joins with booking/driver/vehicle data — keep them in one database).

**The swappable source contract:**

```ts
interface TelemetrySource {              // the plug — in telematics-ingest
  start(onBatch: (points: CanonicalPoint[]) => void): void;
  stop(): void;
}
class SimulatorSource implements TelemetrySource {}   // Phase 1 pilot source
class AggregatorSource implements TelemetrySource {}  // Phase 2+ (flespi/equiv.)
class DirectVendorSource implements TelemetrySource {}// Phase 2+
```

Swapping simulator -> real hardware is a config change. The domain module never notices, because it only ever consumes canonical events.

**Why real hardware is plug-and-play when it does arrive (retained for Phase 2 context):** OBD-II trackers self-install in < 2 minutes into the standardized port, are **transferable between vehicles** (the platform owns them, not the lessor — retires old Risk R1), and the UAE regulatory path is a known certified catalog (**TDRA Scheme 2**, Abu Dhabi **ITC**, **SIRA SecurePath**). Device tiers when procured: T1 OBD-II plug-in (default, most of the fleet), T2 hardwired TCU (buses, high-value), T3 OEM embedded API (new vehicles).

**Functional requirements:**

| Ref | Requirement |
|---|---|
| FR-GPS-P1-00 | **SimulatorSource** is a first-class, permanent implementation of `TelemetrySource`: realistic canonical telemetry for dev, load test, demo, and the Phase 1 pilot. Real sources are additional implementations of the same contract — no rebuild. |
| FR-GPS-P1-01 | **Telematics Adapter Layer** (in `telematics-ingest`): all telemetry ingested into one canonical schema (position, speed, ignition, odometer, fuel level where available, DTC codes, device health, timestamp). New source/device onboards by adapter + config profile, never a code change to the domain. |
| FR-GPS-P1-02 | **Device registry & pairing** (in `telematics` domain module): every tracker is an asset (serial, model, SIM, TDRA approval ref, firmware). Pairing assigns a source stream to a vehicle; in the simulator, a simulated device pairs to each pool vehicle. Unpair/re-pair fully audited; device history survives vehicle transfers. |
| FR-GPS-P1-03 | **Live fleet map:** real-time positions for operational roles (Fleet Manager and above), scoped to hierarchy node; per-vehicle drill to current trip, speed, ignition. Driven by simulator in the pilot. |
| FR-GPS-P1-04 | **Automatic odometer:** telematics odometer feeds the vehicle master live (field 42); handover pre-fills from telematics; conflict rule FR-HAND-11 applies. |
| FR-GPS-P1-05 | **Trip auto-attachment** (in `telematics` domain module): trips (ignition-on -> ignition-off, with polyline) attach to the booking active in that window; out-of-booking trips flag as unassigned for review. |
| FR-GPS-P1-06 | **Unplug/tamper alerts:** device disconnection/silence raises an immediate alert and sets GPS status (Offline/Faulty); the simulator can inject unplug events to exercise this path; repeated events during bookings feed the misuse log (C10 consumes it in Phase 2). |
| FR-GPS-P1-07 | **Untracked vehicles are explicit:** GPS status enum (Installed / Not Installed / Online / Offline / Faulty / Under Replacement) mandatory on every vehicle; dashboards show tracked-coverage %; absence recorded, never assumed. |
| FR-GPS-P1-08 | **Device health console:** last-report time, signal, battery/voltage, firmware per device; silent devices in a daily digest. |
| FR-GPS-P1-09 | **Privacy guardrails from day one:** live location visible only to operational roles with purpose; every view logged; retention per D4; employee notice in consent (D7); off-shift masking configurable. Applied to simulated data too, so the controls are proven before real location data flows. |
| FR-GPS-P1-10 | **Source-outage resilience:** gap detection, backfill on recovery, explicit data-gap markers; source outage never blocks booking, handover or return. |
| FR-GPS-P1-11 | Deferred to Phase 2: full route-replay player with scrubber, geofence corridors + deviation alerts (D21), video telematics, harsh-driving signals. Phase 1 stores raw trip data so Phase 2 replay works retroactively. |

**Pilot rollout (GS Pool):** deploy `telematics-ingest` with `SimulatorSource` configured to one simulated device per pool vehicle -> live map, auto-odometer and trip auto-attachment active from week one, with **zero hardware**. Real-device procurement (D22) and the swap to `AggregatorSource`/`DirectVendorSource` is a Phase 2 activity requiring no change to the domain module.

---

## 9. Digital Consent (hard requirement)

> No consent → no booking number. No consent → no allocation. Ever. No override.

| Ref | Requirement |
|---|---|
| FR-CON-01 | Consent captured after vehicle selection, **before submission for approval**; binds to driver, vehicle category, window and policy version. |
| FR-CON-02 | Declined request → consent retained for audit but void. |
| FR-CON-03 | Modification beyond tolerance (different driver, different vehicle category, window shift beyond configured hours — D12) → re-consent. |
| FR-CON-04 | Consent covers: responsibility for fines during the booking, responsibility for damages, compliance with vehicle usage policy and UAE traffic law. |
| FR-CON-05 | Stored immutably: employee ID, timestamp, IP, device, policy version; linked to booking/entitlement. Meets UAE Electronic Transactions and Trust Services Law (wording per D7). |
| FR-CON-06 | English + Arabic consent text, Legal-approved, versioned. |

## 10. Phase 1 KPIs

| KPI | Target |
|---|---|
| Inventory completeness (mandatory fields) | ≥ 98% |
| Booking adoption at pilot pool (vs legacy paths) | ≥ 90% |
| Entitlements processed end-to-end in platform | ≥ 95% |
| Median booking approval cycle | ≤ 4 working hours |
| Median entitlement approval cycle | ≤ 5 working days |
| Trips on expired Mulkiya/insurance | 0 |
| Fines attribution rate | ≥ 95% |
| Black-point transfers within timeframe | ≥ 95% |
| **Telematics coverage at pilot pool (simulated devices online)** | **≥ 90% of pool vehicles** |
| **Trips auto-attached to bookings** | **≥ 90%** |

## 11. Phase 1 NFRs (only what the MVP needs)

| Area | Requirement |
|---|---|
| Performance | Booking search < 2s (95th pct); dashboard first paint < 4s; eligibility decision < 500ms |
| Availability | 99.5% business hours; RPO ≤ 1h, RTO ≤ 4h |
| Security | Entra SSO + MFA (elevated roles); TLS 1.2+; AES-256 at rest; field-level cost masking; audit of every change; UAE IA Regulation V2 + PDPL; data residency UAE |
| Usability | Desktop-first responsive web; WCAG 2.1 AA; English UI (Arabic consent text); AD Ports brand |
| Scale | 300+ vehicles, GS Pool concurrency (~100 concurrent users), designed not to preclude 5,000+ vehicles |
| Auditability | Every booking/consent/entitlement/fine/override immutably logged; Internal Audit read-only |

Deferred NFRs: offline field capture (with mobile, Phase 2), multi-language UI/RTL (Phase 3), per-organization branding/setup tooling (Phase 3).

## 12. Blocking Decisions (must close before/at build start)

| # | Decision | Owner |
|---|---|---|
| D3 | Disciplinary steps after fines threshold | Group HR |
| D6 | Depreciation rate(s) | Group Finance |
| D7 | Consent wording (EN + AR) | Legal |
| D8 | Dedicated-vehicle eligibility policy (grades, thresholds, exceptions) | Group HR / Cluster CEOs |
| D9 | Black-point transfer timeframe + escalation cadence | Group HR / Legal |
| D12 | Consent re-consent tolerance | Legal / Group Services |
| D13 | Fine/damage recovery mechanism + waiver authority | HR / Legal / Finance |
| D14 | Utilisation definition (no-show, buffer treatment) | Group Services / Finance |
| **D22** | **Telematics device selection (TDRA-approved OBD-II + hardwired) and aggregator-vs-direct ingestion — needed for Phase 2 hardware, not the simulator-based Phase 1 pilot** | **Procurement / D&T / Cybersecurity** |
| **D23** | **Telematics extraction trigger — conditions under which the `telematics` module graduates to a standalone microservice (e.g. a second organization's own telematics, or Phase 3 replay load beyond a defined msg/s). Stays a module until a trigger fires.** | **D&T Architecture (review each phase)** |
| **D4** | **Location-data residency, retention and access purposes (PDPL) — pulled forward from Phase 2 because GPS now ships in Phase 1** | **Cybersecurity / Legal** |

## 13. Phase 1 Risks

| Risk | Mitigation |
|---|---|
| Inventory data quality (High/High) | M3 tooling + cleansing sprint + steward sign-off before go-live |
| Open decisions block build (High/High) | §12 on programme critical path from kickoff; sponsor escalation |
| Cluster CEO pushback on entitlement rigidity | Configurable thresholds + delegation; pilot the chain with two clusters |
| Pilot-user resistance to consent/eligibility friction | Keep booking under 2 minutes; change management at GS Pool |
| OBD-II device unplugging by drivers (Phase 2, when hardware arrives) | Unplug alerts (FR-GPS-P1-06) + misuse log; locking OBD brackets for repeat cases; T2 hardwired for buses. In Phase 1 the simulator injects unplug events so the detection path is proven before hardware. |
| Location tracking perceived as surveillance | PDPL privacy-by-design before go-live (D4); purpose-bound access, all views logged; transparent employee notice in consent |
| SIM/coverage dead zones in yards | Device health console surfaces silent units; store-and-forward devices buffer offline and backfill |

## 14. Go-Live Definition (GS Pool, Mina Zayed)

1. Inventory migrated, ≥98% complete, steward signed off.
2. All GS Pool employees SSO-enabled; roles assigned; SoD verified.
3. Consent wording (D7) approved and loaded, EN + AR — **including location-tracking notice**.
4. Compliance ladders live; zero vehicles bookable with expired documents.
5. **Simulator drives ≥90% of pool vehicles (one simulated device each); live map, auto-odometer and trip auto-attachment verified; unplug alert exercised via injected simulator events; `TelemetrySource` adapter swap-tested (simulator → stub aggregator) with no domain change.**
6. **PDPL privacy review (D4) signed off for location data.**
7. Mehwar Vehicle Allocation switched to read-only; all new bookings in the platform.
8. Two weeks hypercare; KPI dashboard live from day one.
