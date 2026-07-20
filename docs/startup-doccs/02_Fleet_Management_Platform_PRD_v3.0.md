# Fleet Management Platform — Product Requirements Document

**Version 3.0 — Consolidated Single Source of Truth**

A group-wide, AI-enabled capability for fleet inventory, booking, entitlement, compliance, cost and accountability — designed to be reusable across organizations.

---

## Document Control

| Field | Detail |
|---|---|
| Document Title | Fleet Management Platform — PRD |
| Version | 3.0 (Consolidated — supersedes v2.0) |
| Prior Versions | v1.0 (Draft), v2.0 (Restructured Draft) |
| Status | Draft for Review |
| Business Sponsor | Group Services / Group HR |
| Platform Owner | D&T (GCDIO Office) |
| Classification | Internal |
| Distribution | D&T Leadership, Group Services, Group HR, Group Procurement, Group Finance, Group Cybersecurity, Cluster CEOs, Internal Audit, Group Legal, Group Sustainability |

### What changed in v3.0 (versus v2.0)

v3.0 consolidates the v2.0 PRD with a full gap analysis. Nothing from v2.0 has been removed; the following has been **added or corrected**:

1. **New capability domains**: Vendor & Lease Contract Management (C13), Toll Management (C14), Compliance Alerting Engine (elevated within C6), Workflow & Approval Engine (P4), Data Migration & Quality (P7), Key & Asset Custody Management (C15), Public API & Extensibility (P8), Fine/Toll Cost Recovery (within C7/C14).
2. **New/changed functional requirements** covering: consent-before-approval sequencing, mid-trip booking changes, recurring bookings, emergency break-glass bookings, non-employee/professional drivers, odometer conflict resolution, utilisation definition, fuel-card controls, BSD leave-calendar automation, platform-wide black-points access block, delegation rules.
3. **Actor model completed**: Procurement, Data Steward, Delegate Approver, Substitute Driver, Insurance Lead, HSE, Professional (chauffeur) Driver added as first-class actors.
4. **Rebalanced phasing**: manual fines register + black-points workflow, dedicated-vehicle entitlements, and compliance expiry alerting confirmed as Phase 1 MVP scope (aligned to sponsor priorities); substitution attribution *data model* pulled into Phase 1 even though its UI ships in Phase 2.
5. **NFRs expanded**: offline/degraded-connectivity operation, concurrency and load assumptions, public API, extensibility, observability, data-retention specifics.
6. **Open decisions register expanded** from 11 to 20 items, including consent sequencing, fine recovery mechanism, personal-use policy, and emergency booking policy.

---

## Contents

- **PART I — STRATEGIC FRAME**: 01 Executive Summary · 02 Problem & Opportunity · 03 Outcomes & North Star · 04 Scope
- **PART II — OPERATING MODEL**: 05 Hierarchy · 06 Actors & Personas · 07 Roles, Access & Segregation of Duties
- **PART III — CAPABILITY ARCHITECTURE (C1–C15)**: Fleet Master · Booking · Entitlements · Handover · Replacement & Substitutes · Eligibility & Compliance Alerting · Fines, Black Points, Accidents & Recovery · Telematics · Fuel & Fuel Cards · Behaviour Scoring · AI Optimisation · ESG · Vendor & Lease Management · Toll Management · Key & Custody Management
- **PART IV — PLATFORM FOUNDATIONS (P1–P8)**: Reusability across organizations · Identity & Access · Policy Engine · Workflow Engine · Data Model · Integrations · Notifications & Alerting · Data Migration & Quality · Audit & Exceptions · Reporting · Public API
- **PART V — NON-FUNCTIONAL & GOVERNANCE**: 25 NFRs · 26 Compliance, Privacy & Consent · 27 KPIs
- **PART VI — DELIVERY**: 28 Phasing · 29 Risks, Assumptions, Dependencies · 30 Open Decisions · 31 User Journeys · 32 Glossary

---

# PART I — STRATEGIC FRAME

## 01 Executive Summary

The organization operates a fleet of 300+ vehicles across multiple clusters, sites and geographies. Vehicle inventory is maintained manually with inconsistent quality; only one pool runs a partial legacy booking system. Fines, accidents, fuel costs, lease agreements and maintenance records sit in fragmented spreadsheets and email trails. There is no single source of truth, no real-time visibility, and no enforced accountability against the driver.

This PRD defines a group-wide Fleet Management Platform that replaces the fragmented setup with:

- a **self-service employee booking experience** (web, then mobile) with waitlists, smart recommendations and mandatory digital consent;
- a **structured dedicated-vehicle entitlement workflow** with automated eligibility validation and approval up to Cluster CEO;
- a **fleet manager operations console** for handover, return, inspection, replacement, maintenance, fines and accidents;
- a **risk & accountability layer** — fines, black points, accidents, tolls and damages auto-attributed to the responsible driver, with cost-recovery and disciplinary escalation paths;
- a **compliance engine** that blocks bookings on expired documents or ineligible drivers and alerts ahead of every expiry;
- an **intelligence layer** — AI copilot, OCR document/invoice intelligence, computer-vision damage detection, predictive maintenance, right-sizing, anomaly detection, behaviour scoring and ESG analytics;
- a **platform core** — multi-tenancy, configurable N-level org hierarchy, no-code policy engine, shared workflow/approval engine, and a public API — that makes the project reusable by **any organization**, not only the sponsoring group.

> **ONE-LINE SUMMARY** — A role-based, AI-enabled fleet platform that replaces manual inventory and partial booking, governs entitlements up to Cluster CEO, enforces driver accountability for fines, tolls and damages including cost recovery, captures ESG metrics, and gives management a real-time view of utilisation, cost and risk across every cluster — built on a configurable core reusable across organizations.

## 02 Problem Landscape & Opportunity

### 2.1 What today looks like

- Vehicle inventory is maintained manually across multiple owners; data quality, completeness and freshness are inconsistent.
- Only one pool runs a partial booking system; other sites rely on email, phone calls or walk-ins.
- Fuel costs arrive as consolidated supplier invoices; per-vehicle fuel cost is not calculated or reported.
- Traffic fines, tolls and accidents are tracked in disconnected logs with no automatic linkage to the booking or the driver operating the vehicle at the time.
- Compliance documents (registration/Mulkiya, insurance, lease agreements) are tracked manually with limited expiry visibility.
- Dedicated-vehicle entitlement decisions live in email chains; eligibility, justification and approval evidence are not consistently captured.
- Lease contracts, off-hire terms and vendor performance are not systematically managed or compared.
- There is no group-wide visibility of utilisation, cost-per-km or demand-vs-capacity mismatch — capital allocation is reactive.
- Fines and tolls attributed to employees are not systematically recovered.
- Physical key custody is informal and unaudited.

### 2.2 Where the cost sits

(a) avoidable lease and depreciation on under-used vehicles no one challenges; (b) fines, tolls and damages that cannot be attributed and therefore cannot be recovered; (c) compliance lapses discovered after the fact; (d) management time consumed reconciling spreadsheets; (e) the same fragmented pattern re-created each time a new entity is onboarded.

### 2.3 Why now

Fleet is a recurring source of operational, financial and reputational risk that scales with geographic expansion. Solving it once at group level prevents each new entity from re-creating the pattern, and creates the data foundation for AI-enabled decisioning, ESG reporting and predictive maintenance economics. Building it with a configurable, cleanly-bounded design additionally lets the same project be re-deployed for other organizations with configuration rather than a rewrite.

## 03 Outcomes & North Star

> **VISION** — A single, AI-enabled fleet platform where every vehicle, booking, entitlement, fine, toll, accident and fuel dirham is captured against one record, enforced by policy, governed by hierarchy, recoverable where owed, and visible in real time to the people accountable for it — on a core configurable enough to be re-deployed for other organizations.

### 3.2 Outcomes the platform must deliver

| # | Outcome | Why it matters |
|---|---|---|
| O1 | Single governed group-wide vehicle master across clusters and pools | Eliminates fragmented spreadsheets; enables every other capability |
| O2 | Driver accountability for fines, tolls, damages and policy compliance enforced via mandatory digital consent | Removes ambiguity in disciplinary action and cost recovery; reduces repeat offences |
| O3 | Real-time fleet visibility — location, status, utilisation — at pool, cluster and group level | Shifts decisions from reactive to proactive |
| O4 | Automated compliance alerting and hard blocking for registration, insurance, lease, maintenance and driver licence | Prevents driving on expired documents |
| O5 | Per-vehicle and per-driver cost transparency including fuel, tolls, maintenance, lease/depreciation | Enables cost-per-km analysis and right-sizing |
| O6 | Structured entitlement workflow for dedicated vehicles up to Cluster CEO approval | Brings policy discipline to an email-run process |
| O7 | AI-driven detection of under/over-utilisation, anomalous bookings and cost outliers, with concrete recommendations | Supports retain / transfer / divest decisions |
| O8 | Behaviour scoring against misuse patterns with HR escalation path | Tightens loop between operational data and disciplinary action |
| O9 | ESG metrics — fuel trends, CO₂ footprint, EV/hybrid penetration — at group and cluster level | Supports sustainability commitments and regulatory reporting |
| O10 | Scales globally across entities, vendors, currencies and languages; re-deployable for other organizations via configuration, not code | Future-proofs the investment |
| O11 | Systematic vendor and lease lifecycle management with comparative vendor performance | Reduces lease spend; strengthens negotiation position |
| O12 | Recoverable costs (fines, tolls, personal-use fuel, damages) identified, attributed and routed to recovery | Converts attribution into actual money recovered |

## 04 Scope: In, Out, Boundary

### 4.1 In scope

- Group-wide vehicle inventory master — owned, leased, transferred — with full lifecycle.
- Configurable N-level org hierarchy (reference model: Cluster → Pool → Location).
- Self-service booking with approval workflow, buffer enforcement, waitlists, smart recommendations, **recurring bookings, mid-trip modifications and emergency (break-glass) bookings**.
- Dedicated vehicle request workflow — long-term, temporary, with-driver, without-driver — with entitlement validation up to Cluster CEO and return-to-pool (BSD) during leave, driven by HR leave calendars.
- Handover, return, inspection and reconciliation flows; mobile damage capture with computer-vision assistance (Phase 2+).
- Replacement vehicle assignment and substitute driver authorisation, with full audit chains and time-boxed attribution.
- Driver eligibility validation (employment status, licence validity) prior to booking; support for **authorised non-employee/professional drivers** with their own eligibility records.
- GPS/telematics integration for live location, odometer and route replay, where vendor APIs are available; explicit handling of vehicles without trackers.
- Fines, black points and accidents register with auto-linkage to booking and driver; black-points transfer enforcement with platform-wide access block; **cost-recovery routing** for attributed fines/tolls/damages.
- **Toll management** — ingestion or manual entry of toll transactions, attribution to booking/driver, recharge policy application.
- Maintenance scheduling, downtime metrics and vendor turnaround tracking.
- Fuel cost capture via invoice OCR/NLP or AP integration with manual fallback; **fuel card master, assignment control and misuse detection**.
- **Vendor & lease contract lifecycle** — vendor master, lease contracts, off-hire terms and penalties, renewal alerts, vendor scorecards.
- Lease and ownership lifecycle (purchase, leasing, transfer, decommissioning, off-hire).
- Digital consent as a precondition to booking and entitlement confirmation, with defined sequencing and re-consent rules.
- Role-based access control, masked cost views, segregation of duties, delegation management.
- **Physical key/asset custody tracking** (manual log at minimum; smart locker integration optional).
- Operational, financial, compliance and executive dashboards; curated BI export feed.
- AI layer — copilot, document intelligence, damage vision, predictive maintenance, right-sizing, anomaly/fraud detection, behaviour scoring.
- ESG and sustainability reporting — fuel, CO₂, EV/hybrid utilisation.
- Audit log for overrides, bypasses, reassignments and compliance exceptions.
- **Data migration and data-quality tooling** — bulk import, validation, deduplication, reconciliation, steward workflows.
- **Public API and webhooks** for customer-side integration and extensibility.

### 4.2 Out of scope

- Heavy equipment (cranes, reach stackers, RTGs) — managed under Asset/EAM systems. May appear in inventory for cost reporting only.
- Shuttle buses on fixed routes — managed under transportation operations. Cost-reporting presence only.
- Driver licence issuance or renewal — the platform validates status only.
- Physical maintenance execution (workshop systems) — only schedules, costs and status are tracked.
- Replacement of ERP finance modules — the platform integrates with ERP, it does not replace it.
- Annual vehicle inspection as a separate field — covered under registration (Mulkiya) renewal in the reference deployment; configurable per jurisdiction.
- Payroll execution — the platform raises recovery instructions; payroll systems execute them.

### 4.3 Boundary conditions

- Heavy equipment and shuttle buses may appear in inventory for cost reporting but never in any bookable pool.
- Dedicated vehicles remain in inventory and analytics; excluded from the bookable pool by configuration, except during BSD return windows.
- Decommissioned and sold vehicles remain searchable for historical reporting; excluded from operational dashboards.
- Jurisdiction-specific concepts (Mulkiya, Salik, Darb, black points) are implemented as **configurable compliance/toll/penalty types** so other jurisdictions map their equivalents without code change.

---

# PART II — OPERATING MODEL

## 05 Organizational Hierarchy

### 5.1 Hierarchy model

The platform supports a configurable N-level operational hierarchy. Reference model (3 levels):

- **Cluster** — top-level operating unit (e.g. Ports, Logistics, Maritime & Shipping, Economic Cities & Free Zones, Digital, Corporate).
- **Pool** — a logical fleet grouping under a cluster (e.g. Khalifa Port Pool, Zayed Port Pool). A cluster may have many pools.
- **Location** — the physical site where a vehicle is designated or operated from. A pool may operate from many locations.

Other organizations may configure different depths and labels (e.g. Company → Region → Branch → Depot) on the same engine.

### 5.2 Functional requirements

| Ref | Requirement |
|---|---|
| FR-CLU-01 | System shall support a configurable hierarchy of at least three levels (reference: Cluster → Pool → Location); level count and labels shall be organization-configurable up to 5 levels. |
| FR-CLU-02 | Each vehicle shall be assigned to exactly one node at each mandatory level at any point in time, with an optional designated location. |
| FR-CLU-03 | Inter-node vehicle transfer shall be supported, recording from-entity, to-entity, date, approver and reason in lifecycle history. |
| FR-CLU-04 | Fleet manager roles shall be scoped to any hierarchy node; reporting and dashboards shall respect scope. |
| FR-CLU-05 | Cross-node booking shall be supported by configuration where business policy allows, with node-level approval routing. |
| FR-CLU-06 | Reports shall roll up bottom-to-top through the hierarchy; drill-down shall be supported in two clicks from the executive dashboard. |
| FR-CLU-07 | Hierarchy restructures (merge, split, rename of nodes) shall preserve historical reporting integrity — historical records remain attributed to the node as it existed at the time. |

## 06 Actors & Personas

### 6.1 Human actors (roles)

| Actor | Description & key responsibilities |
|---|---|
| Employee / Driver | Books pool vehicles, signs consent, collects and returns vehicles; accountable for fines, tolls and damage during their bookings. |
| Approver / Line Manager | Approves/declines team bookings; endorses entitlement requests; approves substitute-driver authorisations for their reports. |
| Delegate Approver | A user acting under a time-boxed delegation from an approver; all decisions logged as "decided by delegate on behalf of". |
| Fleet Manager | Operational owner of a pool: prepares vehicles, runs handover/return, logs fines/tolls/accidents, manages replacements, maintenance, key custody. |
| Cluster Fleet Lead | Fleet management scoped to a cluster; endorses cluster entitlements; manages inter-pool transfers. |
| Group Fleet Lead | Fleet management scoped to the group; group-level transfers and policy oversight. |
| Cluster CEO (Senior Approver) | Final approval authority for dedicated-vehicle entitlements above policy thresholds within their cluster. |
| Substitute Driver | An authorised driver operating a vehicle on behalf of the assigned driver for a defined window; temporarily attributed fines/tolls/trips. |
| Professional / Non-Employee Driver | Chauffeur or contractor driver authorised to operate group vehicles; carries own eligibility record (licence, contract validity, sponsor). |
| Procurement | Owns vendor onboarding, lease contracts, off-hire negotiation, fuel-card and tracker procurement; receives lease expiry alerts; populates commercial fields. |
| Finance | Full (unmasked) cost visibility; depreciation configuration; invoice reconciliation; recovery reporting. |
| HR | Receives fines-threshold and behaviour-score escalations; owns disciplinary workflow; validates employment status; owns leave calendar feed. |
| Insurance Lead | Receives insurance expiry and accident alerts; manages claims interface. |
| HSE | Receives accident notifications; safety trend oversight. |
| Internal Audit | Read-only access to tamper-evident audit log; reviews SoD exceptions and overrides. |
| Executive (GCEO/GCDIO/GCFO/GCHRO) | Group-wide dashboards for utilisation, cost, risk, ESG, entitlement inventory; aggregated cost view only. |
| Data Steward (per cluster) | Owns inventory data quality: migration validation, deduplication resolution, ongoing completeness monitoring. |
| System Admin (D&T) | Configures tenancy, hierarchy, policies, roles, integrations; structurally blocked from approving operational bookings or entitlements. |

### 6.2 Interested parties (non-daily users)

Group Cybersecurity (data classification, integration security), Group Legal (consent wording, recovery legality), Group Sustainability (emission factors), Government Relations (licence/authority liaison).

### 6.3 System actors (external, non-human)

| Actor | Role |
|---|---|
| HR/ERP system (e.g. Oracle Fusion HCM) | Employee master, reporting lines, employment status, leave calendars (drives BSD return). |
| Finance/AP system | Validated supplier invoice lines for fuel and maintenance cost allocation. |
| Payroll system | Executes approved cost-recovery instructions (fines, tolls, damages) where policy permits. |
| Identity provider (e.g. Microsoft Entra) | SSO, group claims, MFA. |
| Telematics/GPS vendor APIs | Live location, speed, ignition, odometer, trip reports, route replay. |
| Toll authorities (e.g. Salik, Darb) | Per-vehicle toll transactions. |
| Traffic/police authority feeds (e.g. RTA, ADP) | Fines ingestion (subject to API availability). |
| Smart key locker / cabinet systems (optional) | Key issue/return events. |
| Email/collaboration platform, mobile push, SMS gateway | Notification delivery. |
| OCR/Document AI service | Invoice and document parsing. |
| Group BI / data platform | Curated outbound analytics feed. |
| Platform AI services | Internal actor: auto-linking, anomaly flags, recommendations, copilot responses — all AI-initiated actions attributable and logged. |

### 6.4 Persona snapshots

- **Employee/Driver** — Goal: book a vehicle without friction; understand responsibility. Journey: search → book → consent → collect → return.
- **Fleet Manager** — Goal: serviceable vehicles, clean handovers, accurate logs, managed replacements. Journey: notification → prepare → handover → return inspection → reconcile → escalate.
- **Approver** — Goal: approve legitimate travel fast; avoid bottleneck. Journey: request → justification → approve/decline/modify.
- **Cluster CEO** — Goal: entitlements that match grade, role and policy; visible exceptions. Journey: request → eligibility evidence → approve/reject.
- **Procurement** — Goal: best lease terms, performing vendors, no silent renewals. Journey: contract onboarding → expiry pipeline → vendor scorecard → renegotiate/off-hire.
- **Data Steward** — Goal: complete, deduplicated, current inventory. Journey: import batch → validation report → resolve exceptions → sign off.
- **Group Services / Finance / HR** — Goal: cost per km, demand vs capacity, fines per user, recovery status, vendor performance. Journey: dashboard → drill-down → policy decision → disciplinary/recovery trigger.
- **Executive** — Goal: real-time KPI snapshot for capital, cost, risk, ESG. Journey: dashboard → drill-down → ad-hoc copilot query.

## 07 Roles, Access & Segregation of Duties

### 7.1 Roles & access matrix

| Role | Booking | Entitlement | Inventory | Fines/Acc./Tolls | Costs | Reports |
|---|---|---|---|---|---|---|
| Employee / Driver | Create own | Submit own | View pool only | View own | Hidden | Own only |
| Approver (Line Mgr) | Approve team | Endorse team | View entity | View team | Hidden | Team |
| Delegate Approver | As delegator (time-boxed) | As delegator | As delegator | As delegator | As delegator | As delegator |
| Fleet Manager | Manage (pool) | View/route | Edit (pool) | Create/edit | View ops | Pool ops |
| Cluster Fleet Lead | Manage (cluster) | Endorse cluster | Edit (cluster) | Create/edit | View ops | Cluster |
| Group Fleet Lead | Manage (group) | Endorse group | Edit (group) | Create/edit | View ops | Group |
| Cluster CEO | — | Final approve | View cluster | View cluster | Aggregated | Cluster exec |
| Procurement | View only | View only | Edit commercial fields | View only | View lease/vendor | Vendor/lease |
| Finance | View only | View only | View only | View only | Full | Financial |
| HR | View only | View only | View only | Discipline view | Hidden | HR/discipline |
| Insurance Lead / HSE | View only | — | View only | Accident/claim view | Claim costs | Safety |
| Internal Audit | View only | View only | View only | View only | View only | Audit log |
| Executive | View only | View only | View only | View only | Aggregated | Executive |
| Data Steward | — | — | Edit (data quality, scoped) | — | Hidden | Data quality |
| System Admin (D&T) | — | — | — | — | — | Full admin config |

Cost data is masked for non-finance roles; Executive sees aggregated only. Procurement sees lease/vendor costs but not per-driver recovery detail.

### 7.2 Segregation of duties

Structural controls, not optional settings:

| Ref | Rule |
|---|---|
| SoD-01 | A user shall not approve a booking they raised themselves. |
| SoD-02 | A user shall not approve an entitlement request they raised, regardless of role. |
| SoD-03 | The fleet manager who assigned a vehicle to a booking shall not be the sole investigator of a fine or accident on that booking; a second authorised reviewer is required. |
| SoD-04 | A user with Finance role shall not also hold operational Fleet Manager rights on the same scope. |
| SoD-05 | System Admin shall not approve operational bookings or entitlement requests. |
| SoD-06 | A delegate shall not approve requests raised by themselves or by the delegator. |
| SoD-07 | A data steward shall not approve transactions on records they edited within the same change window. |
| SoD-08 | Override of any SoD rule shall require a documented exception with reason, approver and audit-log entry (see P6 Audit). |

### 7.3 Delegation rules

| Ref | Requirement |
|---|---|
| FR-DEL-01 | Approvers shall be able to delegate their approval authority to a named user for a defined start/end window, scoped by request type. |
| FR-DEL-02 | Delegations shall be self-service with automatic notification to the delegate, the delegator's manager and affected queues. |
| FR-DEL-03 | Every decision made under delegation shall be recorded as "decided by [delegate] on behalf of [delegator]" and be reportable. |
| FR-DEL-04 | Delegation chains shall be limited to one hop (a delegate cannot re-delegate) unless policy configuration explicitly allows. |
| FR-DEL-05 | Expired delegations shall automatically return pending items to the delegator's queue. |

---

# PART III — CAPABILITY ARCHITECTURE

Each capability: outcome, business rules, functional requirements, notable edge cases.

## 08 C1 — Fleet Master & Lifecycle

**Outcome.** A single, governed group-wide vehicle master supporting every other capability and reflecting the configured hierarchy.

**Business rules**

- Every vehicle owned or leased by the group is recorded once, regardless of cluster.
- Equipment and shuttle buses are recorded for cost purposes but never appear in a bookable pool.
- Decommissioned vehicles remain in inventory for historical reporting but exit operational dashboards.
- Administrators may include/exclude a vehicle from the active booking pool without affecting historical records.

| Ref | Requirement |
|---|---|
| FR-INV-01 | Maintain a single group-wide vehicle master covering all owned and leased vehicles. |
| FR-INV-02 | Support lifecycle states: Active, In Use, Under Maintenance, Off-Hire Pending, Decommissioned, Sold, Transferred. |
| FR-INV-03 | Support operational statuses: Reserve, Standby, VIP Only, Quarantined, Temporary Hold. |
| FR-INV-04 | Include/exclude a vehicle from the active booking pool without affecting historical records. |
| FR-INV-05 | Capture every field defined in the Data Model (P5). |
| FR-INV-06 | Support inter-node vehicle transfer with full audit history (from-entity, to-entity, date, approver, reason). |
| FR-INV-07 | Enforce uniqueness of plate number, chassis/VIN and toll-tag identifiers at group level. |
| FR-INV-08 | Support attachment of compliance documents (registration, insurance, lease agreement, off-hire terms) with versioning. |
| FR-INV-09 | Equipment and shuttle buses shall not be exposed to the booking pool even if recorded for cost purposes. |
| FR-INV-10 | Support bulk import/update via the Data Migration module (P7) with full validation before commit. |
| FR-INV-11 | Every vehicle record change shall be event-published for downstream consumers (search index, dashboards, BI feed). |

## 09 C2 — Pool Vehicle Booking & Allocation

**Outcome.** Employees book a suitable vehicle from the appropriate pool in minutes, with eligibility, buffer and policy enforced automatically; waitlists handle peak demand; recurring, mid-trip and emergency scenarios are first-class.

**Business rules**

- Every booking carries a configurable buffer period (default 10–15 minutes) between consecutive bookings on the same vehicle for inspection, cleaning, refuelling and handover.
- Maximum booking duration is configurable by vehicle category; exceedance triggers escalation.
- Driver eligibility (employment status, licence validity, black-points block status) is validated before confirmation; ineligible drivers are blocked with a clear reason.
- Vehicles in any non-bookable status are excluded from search results.
- Where demand exceeds supply, employees may join a waitlist; cancellations auto-allocate to the next eligible waitlister.
- Utilisation is computed on a defined basis: **utilised hours = hours between actual handover and actual return; no-show bookings count as 0 utilised hours but are tracked as reserved-wasted; buffer time is excluded from the bookable-hours denominator** (configurable; see D14).

| Ref | Requirement |
|---|---|
| FR-BOOK-01 | Employees shall initiate bookings via web (Phase 1) and mobile (Phase 2), capturing employee ID, pick-up date/time, return date/time, destination, purpose, passenger count. |
| FR-BOOK-02 | System shall match availability against window, vehicle status, seating capacity and pool scope, presenting only eligible vehicles. |
| FR-BOOK-03 | Bookings shall route to the appropriate approver (line manager or active delegate) per the HR hierarchy. |
| FR-BOOK-04 | Approvers shall approve, decline (with reason) or request modification. |
| FR-BOOK-05 | Upon approval, system shall calculate expected fuel consumption from vehicle efficiency, distance, route speed limits and live traffic where available. |
| FR-BOOK-06 | System shall generate a unique booking number, confirm to the employee and notify the fleet manager. |
| FR-BOOK-07 | System shall enforce digital consent as a precondition to booking confirmation, per the consent sequencing rules in Chapter 26. |
| FR-BOOK-08 | System shall prevent any vehicle in a non-bookable status from being assigned to a new booking. |
| FR-BOOK-09 | System shall send reminders 24 hours before pick-up and 1 hour before scheduled return. |
| FR-BOOK-10 | System shall enforce the configurable buffer period between consecutive bookings on the same vehicle. |
| FR-BOOK-11 | System shall enforce configurable maximum booking duration by vehicle category with escalation on exceedance. |
| FR-BOOK-12 | System shall validate driver eligibility (employment status, licence validity, black-points block, behaviour block) prior to confirmation; ineligible employees blocked with actionable reason. |
| FR-BOOK-13 | System shall support waitlists for fully booked pools with automatic allocation to the next eligible waitlister on cancellation, including consent re-capture before confirmation. |
| FR-BOOK-14 | System shall provide smart recommendations based on proximity, availability, fuel efficiency and operational suitability. |
| FR-BOOK-15 | System shall detect and flag no-shows, repeated late returns and misuse patterns; events feed behaviour scoring (C10). |
| FR-BOOK-16 | System shall log every booking action (create, approve, modify, cancel, no-show, late return) for audit. |
| FR-BOOK-17 | **Recurring bookings**: system shall support recurring booking series (e.g. every Sunday 08:00–14:00 for 12 weeks) approved once as a series, with per-occurrence availability checks, per-occurrence cancellation, and series-level cancellation. |
| FR-BOOK-18 | **Mid-trip extension**: an employee with an active booking shall be able to request an extension; system shall check downstream conflicts (next booking, buffer) and route for expedited approval; conflicting extensions shall trigger fleet-manager mediation. |
| FR-BOOK-19 | **Early return**: system shall support early handback, immediately releasing the vehicle to the pool/waitlist after buffer; early returns of pooled vehicles feed behaviour scoring where policy defines waste. |
| FR-BOOK-20 | **Post-collection cancellation/no-use**: cancellation after collection shall require fleet-manager confirmation of return and shall be distinctly logged. |
| FR-BOOK-21 | **Emergency (break-glass) booking**: designated roles shall be able to create an immediate booking outside approval flow for defined emergency categories; consent still required; the booking is flagged, notified to the line manager and fleet lead, and subject to mandatory post-hoc review within a configurable period (default 48h). All break-glass events appear in the audit exception report. |
| FR-BOOK-22 | Cross-node bookings, where enabled, shall route additional approval to the owning node per policy. |
| FR-BOOK-23 | Booking modifications that change driver, vehicle, or window beyond a configurable tolerance shall require re-consent (Chapter 26). |

## 10 C3 — Dedicated Vehicle Requests & Entitlements

**Outcome.** Every dedicated vehicle allocation — long-term or temporary, with-driver or without-driver — runs through a structured workflow with eligibility validation, formal justification, configurable approval up to Cluster CEO, and periodic utilisation review.

**Business rules**

- Eligibility is a function of employee grade, role, cluster and approved policy limits, evaluated automatically before submission.
- Every request carries a mandatory business justification (configurable category + free text).
- Approval hierarchy is configurable and culminates at Cluster CEO above policy thresholds.
- Dedicated vehicles return to the shared pool (BSD) during defined absences, driven by the HR leave calendar.
- All allocations require formal digital consent from the assigned driver (and, for with-driver allocations, an authorisation record for the professional driver).

| Ref | Requirement |
|---|---|
| FR-DVR-01 | Support structured workflow for dedicated vehicle requests: long-term, temporary, with-driver, without-driver. |
| FR-DVR-02 | Capture: duration, start/end dates, operational location, business unit, cost centre, detailed remarks. |
| FR-DVR-03 | Business justification selected from a configurable category list (operational requirement, executive assignment, project support, site visits, temporary replacement, emergency operations) plus free-text explanation. |
| FR-DVR-04 | Automatically identify eligible vehicle options based on grade, role and policy limits; validate eligibility prior to submission. |
| FR-DVR-05 | Approval hierarchy configurable per cluster; escalate to Cluster CEO where thresholds apply. |
| FR-DVR-06 | Require formal digital consent from the assigned driver before allocation is confirmed. |
| FR-DVR-07 | Dedicated vehicles shall be returned to the shared pool during defined absences; BSD windows shall be auto-proposed from the HR leave calendar (I1) and confirmed by the fleet manager; the vehicle becomes bookable for the window and reverts automatically at window end. |
| FR-DVR-08 | Support attachment uploads (supporting documents, project approvals, business cases, memos). |
| FR-DVR-09 | Automated notifications and reminders for return dates, expiring approvals, overdue extensions and pending actions. |
| FR-DVR-10 | Generate utilisation and justification reports per allocation supporting periodic management review; allocations below a configurable utilisation threshold shall be auto-flagged for review. |
| FR-DVR-11 | Maintain a complete audit trail per request — submission, eligibility evaluation, approvals, rejections, extensions, cancellations, reassignment. |
| FR-DVR-12 | For with-driver allocations, capture the professional driver's identity and eligibility record; fines/tolls during professional-driver operation attribute to the professional driver's record with the allocation as context (see C7, D16). |
| FR-DVR-13 | Personal-use policy for dedicated vehicles shall be configurable (permitted/not permitted/permitted-with-recharge); where recharge applies, personal-use fuel and tolls shall be identified and routed to recovery (D15). |

## 11 C4 — Handover, Return & Damage Capture

**Outcome.** Vehicle condition, fuel level and odometer are captured cleanly at handover and return; damages are recorded in-app with photographic evidence and signed acknowledgement.

| Ref | Requirement |
|---|---|
| FR-HAND-01 | Fleet manager shall verify booking number and employee ID at handover. |
| FR-HAND-02 | Record starting odometer, fuel level, GPS tracker status, key issue reference (C15), date/time of handover. |
| FR-HAND-03 | Employee shall confirm vehicle condition with a digital signature on tablet or mobile. |
| FR-HAND-04 | On return, record ending odometer, fuel level, condition, accidents/damage, key return reference and GPS trip report. |
| FR-HAND-05 | Calculate actual fuel consumption from odometer delta and fuel-level delta and compare against expected. Fuel-gauge readings are treated as approximate; deviation flags are advisory, not blocking. |
| FR-HAND-06 | Flag deviations beyond a configurable threshold (default ±20%) for fleet manager review; thresholds tunable per vehicle category to manage alert noise. |
| FR-HAND-07 | Returns outside the booked window shall be flagged and feed behaviour scoring (C10). |
| FR-HAND-08 | Phase 2 — mobile damage capture at handover and return: photos, annotations, timestamps, digital acknowledgment. |
| FR-HAND-09 | Phase 3 — computer-vision assistance: compare handover vs return photo sets, auto-highlight new damage candidates for fleet-manager confirmation; CV output is advisory, human-confirmed. |
| FR-HAND-10 | Handover and return flows shall function in offline/degraded-connectivity mode with local capture and automatic sync (see NFR 25.7); conflicts resolved by fleet-manager review. |
| FR-HAND-11 | Odometer conflict rule: where telematics odometer and manual odometer disagree beyond a configurable tolerance, telematics is the system of record, the manual value is retained, and a data-quality flag is raised to the fleet manager. |

## 12 C5 — Replacement Vehicles & Substitute Drivers

**Outcome.** Booking continuity is preserved when a vehicle goes off-road or a driver is temporarily replaced, with a complete audit chain connecting original record to substitute. **The attribution data model (time-boxed responsibility windows) is foundational and present from Phase 1**, even though the self-service workflows ship in Phase 2.

**Business rules**

- A replacement vehicle may be assigned to an existing booking during maintenance or off-hire; the booking reference remains stable.
- A substitute driver may be authorised for a defined window; fines, accidents, tolls and trip records attribute to the substitute for the duration.
- Outside any authorised substitution, all such records default to the assigned driver.

| Ref | Requirement |
|---|---|
| FR-REPL-01 | Support temporary replacement vehicle assignment during maintenance or off-hire while maintaining booking continuity. |
| FR-REPL-02 | Replacement workflows shall maintain a complete audit trail linking original vehicle, replacement vehicle, booking reference and assigned driver. |
| FR-REPL-03 | Fines, accidents, tolls and trip records default to the assigned driver, with temporary reassignment when a substitute is authorised. |
| FR-REPL-04 | Temporary driver reassignment shall support configurable effective start/end dates and automatic re-attribution of all related operational records within the window. |
| FR-REPL-05 | Substitute authorisation requires approval from the assigned driver's line manager (or delegate) and is logged with reason, start, end, approver. |
| FR-REPL-06 | On expiry of the substitution window, attribution reverts automatically to the assigned driver. |
| FR-REPL-07 | Substitute drivers shall pass the same eligibility validation (licence, status, block flags) as primary drivers before authorisation. |
| FR-REPL-08 | The attribution model (driver-responsibility windows per vehicle) shall be implemented in the Phase 1 data model so that fines recorded in Phase 1 can honour substitution windows entered manually. |

## 13 C6 — Driver Eligibility, Compliance & the Compliance Alerting Engine

**Outcome.** Only eligible drivers operate group vehicles, and only on documentation-current vehicles. Expiries surface ahead of time via a dedicated scheduled alerting engine; lapses block bookings automatically with no override for hard-block conditions.

**The Compliance Alerting Engine** is a scheduled evaluation service, distinct from notification delivery (P6): it continuously evaluates every tracked expiry against configurable alert ladders per document type, computes recipients per role mapping, raises hard blocks, and records every evaluation for audit.

| Ref | Requirement |
|---|---|
| FR-COMP-01 | Track expiry dates for: registration (Mulkiya), insurance policy, lease agreement, toll accounts (Salik/Darb or equivalents), fuel card, and any organization-configured compliance type. |
| FR-COMP-02 | Send escalating alerts on a configurable ladder (default 60/30/14/7/1 days) before expiry to the fleet manager, with copies to Procurement (lease) and Insurance Lead (policy). |
| FR-COMP-03 | Hard-block any new booking on a vehicle whose registration or insurance is expired — no override, structurally enforced. |
| FR-COMP-04 | Store version-controlled scanned copies of every compliance document. |
| FR-COMP-05 | Validate driver eligibility prior to booking confirmation: employment status active and driving licence valid; expired or missing data results in a clear, actionable block. |
| FR-COMP-06 | Alert HR and the line manager when an active driver's licence is within 30 days of expiry (ladder configurable). |
| FR-COMP-07 | Support authorised non-employee/professional driver records with their own eligibility fields (licence, contract validity, sponsoring entity, authorising manager) and the same validation gates. |
| FR-COMP-08 | Compliance types, alert ladders, recipients and block behaviours shall be organization-configurable (no code change per jurisdiction). |
| FR-COMP-09 | The engine shall log every evaluation cycle and every raised/cleared block for audit; missed-evaluation gaps (downtime) shall self-heal on restart by re-evaluating the full window. |
| FR-COMP-10 | An eligibility API shall expose a single "can this driver take this vehicle now?" decision (with reasons) consumed by booking, entitlement, substitution and handover flows — one gate, one truth. |

## 14 C7 — Fines, Black Points, Accidents & Cost Recovery

**Outcome.** Every fine, accident, black point and recoverable amount is traceable to a specific driver, vehicle and booking, with disciplinary triggers configured, the black-points transfer cycle enforced platform-wide, and attributed costs routed to recovery.

**Business rules**

- With an active booking, the fine attaches to that booking and therefore the driver.
- With no active booking (e.g. dedicated vehicle), the fine attaches to the assigned driver.
- Where a substitute was authorised at the time, attribution follows the substitution window.
- Drivers must transfer black points from the company vehicle to their personal traffic file within a defined timeframe; until complete, the driver is blocked platform-wide from using, booking or accessing any company vehicle services.
- Disputed fines remain attributed pending resolution.
- Attribution without recovery is incomplete: attributed fines/tolls/damages enter a recovery pipeline governed by HR/Legal policy (D13).

| Ref | Requirement |
|---|---|
| FR-FINE-01 | Maintain a fines register: reference number, issue date/time, location, amount, black points, status (paid/unpaid/disputed), issuing authority. |
| FR-FINE-02 | Auto-link each fine to the booking active at the fine's date/time and therefore to the driver. |
| FR-FINE-03 | Where no booking is active, link the fine to the assigned driver of the dedicated vehicle. |
| FR-FINE-04 | Provide a fines-per-user view sortable by entity, time period and severity. |
| FR-FINE-05 | Trigger automated notification to HR and line manager when a user accumulates ≥3 fines within a configurable rolling window (default 12 months). |
| FR-FINE-06 | Maintain an accidents register: date, driver, booking reference, location, description, third-party involvement, police report number, damage cost (estimated and actual), insurance claim status, repair vendor, days off-road. |
| FR-FINE-07 | Accident records shall support attachments — photos, police report, claim documents. |
| FR-FINE-08 | Provide a full lifetime view of fines and accidents per vehicle and per driver with drill-downs. |
| FR-FINE-09 | Reflect any authorised substitute-driver window when attributing fines and accidents. |
| FR-FINE-10 | Accidents feed vehicle downtime metrics and driver behaviour score. |
| FR-FINE-11 | Disputed fines remain attributed pending resolution; resolution events logged in the audit log. |
| FR-FINE-12 | Track black points and hold the assigned driver responsible for transfer to their personal traffic file within a defined timeframe; drivers with pending transfers are blocked from using, booking or accessing any company vehicle services until complete; support monitoring, escalation and automated notifications for overdue transfers. |
| FR-FINE-13 | The black-points block shall be implemented as a **platform-level driver status flag** consumed by the eligibility gate (FR-COMP-10) — enforced in booking, entitlement, substitution and handover, not only in the fines module. |
| FR-FINE-14 | Fines attributed to professional/non-employee drivers shall be recorded against their driver record with the contracting entity noted; recovery routing per contract terms (D16). |
| FR-RECV-01 | Maintain a recovery pipeline for attributed recoverable amounts (fines, tolls where policy applies, damage excess, personal-use recharges): identified → notified → acknowledged → recovered/waived/disputed. |
| FR-RECV-02 | Generate recovery instructions to payroll (or issue direct-payment requests) per configured policy; the platform records outcomes but does not execute payroll deductions. |
| FR-RECV-03 | Every waiver shall require documented reason and approver, and appear in the audit exception report. |
| FR-RECV-04 | Provide a recovery status report per driver, per entity and per period (identified vs recovered vs outstanding vs waived). |

## 15 C8 — Telematics, Live Tracking & Route Replay *(elevated to Phase 1 core capability in v3.1)*

**Outcome.** GPS tracking is a first-class, plug-and-play part of vehicle management from Phase 1: any vehicle can be made live in minutes, telemetry flows through one vendor-agnostic adapter, and the absence of a tracker is recorded explicitly, never assumed.

### Plug-and-play architecture (research-based)

**Hardware tiers — mixed fleet strategy:**

| Tier | Device | Fits | Install |
|---|---|---|---|
| T1 (default) | OBD-II plug-in tracker (4G, TDRA type-approved) | Sedans, SUVs, light vans — the majority, especially **leased** vehicles | Fleet manager self-install, < 2 minutes, no downtime; **transferable between vehicles** on off-hire (the platform owns the tracker, not the lessor — retires old Risk R1) |
| T2 | Hardwired TCU (concealed, IP-rated, extra I/O) | Buses, high-value, long-life owned vehicles; tamper-sensitive cases | Professional install at next service window |
| T3 | OEM embedded telematics API | New vehicles with factory connectivity | None — API credentials only |

**Software: the Telematics Adapter Layer (TAL).** All telemetry — regardless of device brand, protocol or tier — is normalized into **one canonical schema** (position, speed, ignition, odometer, fuel level, DTC fault codes, device health, timestamp). Ingestion is via a telematics aggregator gateway (unified JSON from 1,000+ device types, MQTT/REST/webhooks) or direct vendor APIs behind the same adapter contract. Adding a device model or vendor is a **configuration profile, never a code change** — FR-ARC-03 extended to hardware.

**UAE regulatory path (reference deployment):** tracking devices require **TDRA type approval (Scheme 2)**; Abu Dhabi commercial-vehicle tracking aligns with **ITC (Integrated Transport Centre)** regulations; **SIRA SecurePath** applies to rental/leased vehicles registered in Dubai. Procurement selects from the certified-device catalog. Other jurisdictions map their equivalents via jurisdiction packs (FR-POL-05).

### Software architecture — pluggable module, not a microservice *(v3.1)*

GPS is a **pluggable module with a swappable source adapter**, deliberately **not** a separate networked microservice. This gives full swappability (simulator today, real hardware later, or a client's own telematics) without the distributed-data cost of splitting trip/booking/driver joins across services.

Two distinct pieces, split for two different reasons:

| Piece | Nature | Reason for the boundary | Responsibility |
|---|---|---|---|
| `telematics-ingest` | Separate deployable **process** | **Runtime** — throughput & latency isolation (the booking path is sacred) | Dumb, fast pipe: consume source → normalize to canonical schema → batched Timescale write → emit domain events. Contains no business logic. **The `TelemetrySource` adapter plugs in here.** |
| `telematics` domain module | NestJS module **inside `api`** | **Data locality** — its questions are joins with bookings/drivers/vehicles | The meaning: trip→booking attachment, unplug/tamper alerting, odometer-conflict resolution (FR-HAND-11), device registry & pairing, "is this vehicle online?". Consumes canonical events, calls the PDP for policy decisions. |

**The swappable source contract:**

```ts
interface TelemetrySource {            // the plug — lives in telematics-ingest
  start(onBatch: (points: CanonicalPoint[]) => void): void;
  stop(): void;
}
class SimulatorSource implements TelemetrySource {}    // Phase 1 (no hardware)
class AggregatorSource implements TelemetrySource {}   // Phase 2+ (flespi/equiv.)
class DirectVendorSource implements TelemetrySource {} // Phase 2+
```

Swapping the source is a configuration change. The domain module never sees it — it only ever consumes canonical events on the bus, so simulator-to-hardware is invisible above the ingest boundary. The module may graduate to a standalone microservice later only if a real trigger fires (see D23); the clean interface makes that a contained change.

### Business rules
- Live location is visible only to operational roles, purpose-bound, with every access logged (PDPL: location = sensitive personal data).
- Telematics outage never blocks booking, handover or return.
- Trackers are platform-owned assets with their own registry and lifecycle, surviving vehicle transfers and off-hires.

### Functional requirements

| Ref | Requirement | Phase |
|---|---|---|
| FR-GPS-01 | Telematics Adapter Layer: canonical telemetry schema; device/vendor onboarding by configuration profile only; aggregator or direct-API ingestion behind one contract. Ingestion source is a swappable `TelemetrySource` adapter. | 1 |
| FR-GPS-01a | A **SimulatorSource** implementation of `TelemetrySource` is a first-class, permanent fixture (not throwaway scaffolding): it generates realistic canonical telemetry (positions, trips, ignition, odometer, unplug events) for development, load testing and demos, and is the Phase 1 pilot source since no hardware is connected. Real sources (aggregator, direct vendor) are additional implementations of the same contract. | 1 |
| FR-GPS-02 | Device registry & pairing: tracker as asset (serial, model, SIM, TDRA approval ref, firmware); pair/unpair workflow with full audit; device history independent of vehicle. Tracker fields optional on untracked vehicles. | 1 |
| FR-GPS-03 | GPS status enum mandatory per vehicle: Installed, Not Installed, Online, Offline, Faulty, Under Replacement; tracked-coverage % on dashboards. | 1 |
| FR-GPS-04 | Live fleet map for Fleet Manager and above, scoped to hierarchy node, subject to data-privacy approvals; per-vehicle drill to trip, speed, ignition. | 1 |
| FR-GPS-05 | Automatic odometer feed to the vehicle master; handover pre-fills from telematics; odometer conflict rule applies (telematics = system of record, mismatch flagged). | 1 |
| FR-GPS-06 | Trip auto-attachment: ignition-to-ignition trips with route polyline attach to the active booking; out-of-booking trips flagged unassigned for review. | 1 |
| FR-GPS-07 | Unplug/tamper/power-loss/silence alerts to fleet manager; repeated unplug during bookings feeds the misuse log (consumed by C10 in Phase 2). Locking OBD brackets as escalation for repeat cases. | 1 |
| FR-GPS-08 | Device health console: last report, signal, voltage, firmware; silent-device daily digest. | 1 |
| FR-GPS-09 | Ingestion resilience: gap detection, backfill on recovery, explicit data-gap markers; raw trip data retained so Phase 2 replay works retroactively. | 1 |
| FR-GPS-10 | Privacy guardrails: purpose-bound access, all location views logged, retention per D4, employee notice in consent text, configurable off-shift masking. | 1 |
| FR-GPS-11 | Historical route replay with timeline scrubber for trip validation, fines investigation and operational reviews; every replay access logged with purpose. | 2 |
| FR-GPS-12 | Geofence corridor authoring and route-deviation flags (definition, tolerance and ownership per D21). | 2 |
| FR-GPS-13 | Harsh-driving signals (braking, acceleration, cornering) from capable devices, feeding behaviour and driver-risk scoring (C10/C11). | 2/3 |

## 16 C9 — Fuel, Fuel Cards & Cost Capture

**Outcome.** Per-vehicle fuel spend is calculated and reconciled against actual consumption; fuel cards are controlled assets; variance is surfaced for review.

| Ref | Requirement |
|---|---|
| FR-FUEL-01 | Maintain cumulative fuel cost per vehicle. |
| FR-FUEL-02 | Ingest fuel costs via Path A (supplier consolidated invoice parsed by OCR/NLP, proposed for fleet-manager confirmation) or Path B (direct AP integration where supplier provides per-vehicle breakdown). |
| FR-FUEL-03 | Where neither path is available, allow manual periodic entry of per-vehicle fuel spend. |
| FR-FUEL-04 | Reconcile fuel volume implied by odometer × efficiency against fuel volume invoiced; flag variances. |
| FR-FUEL-05 | Fuel data shall feed ESG (C12) for fuel-trend and CO₂ reporting. |
| FR-FUEL-06 | Maintain a fuel card master: card number, issuer, assigned vehicle, status (active/blocked/lost), limits. |
| FR-FUEL-07 | Flag fuel transactions where the card's assigned vehicle does not match the transaction vehicle (where transaction-level data exists), or where volume exceeds tank capacity — feed anomaly detection (C11). |
| FR-FUEL-08 | Support fuel-card lifecycle events (issue, reassign, block, replace) with audit history. |

## 17 C10 — Behaviour Scoring & Misuse Detection

**Outcome.** Booking misuse — repeated no-shows, late returns, early returns that waste pool capacity, overbooking and underutilisation — is detected systematically, scored transparently and escalated to HR when patterns persist.

**Business rules**

- Behaviour signals: no-show, late return, early return of pooled vehicles that wastes capacity, overbooking patterns, chronic underutilisation.
- A configurable scoring mechanism aggregates signals across a rolling window.
- Threshold breaches are flagged and escalated to HR for potential disciplinary action; HR review is mandatory before any formal action.
- Employees can see their own score and its drivers (transparency mitigates the surveillance perception — Risk R10).

| Ref | Requirement |
|---|---|
| FR-BEH-01 | Track booking behaviour: no-shows, late returns, early returns of pooled vehicles, overbooking patterns, underutilisation. |
| FR-BEH-02 | Maintain a behaviour score per employee, configurable in weighting and time window. |
| FR-BEH-03 | Flag recurring misuse and escalate to HR with underlying signal data attached. |
| FR-BEH-04 | Behaviour data visible to HR and the employee's line manager; aggregated statistics to fleet leads; **each employee shall see their own score and contributing events**. |
| FR-BEH-05 | Thresholds and escalation policy configurable per cluster, subject to group HR approval. |
| FR-BEH-06 | A behaviour-based booking block, where policy enables it, shall be a platform-level driver flag consumed by the eligibility gate (FR-COMP-10), applied only after HR confirmation. |

## 18 C11 — AI Optimisation, Anomaly Detection & Right-Sizing

**Outcome.** The platform surfaces concrete optimisation actions — vehicles to transfer, off-hire, consolidate — predicts maintenance risk before it becomes downtime, and detects anomalous or fraudulent activity.

| Ref | Requirement |
|---|---|
| FR-AI-01 | Underutilisation detection — flag vehicles below a configurable threshold for retain/transfer/divest review. |
| FR-AI-02 | Overutilisation detection — flag vehicles whose utilisation indicates an undersized pool. |
| FR-AI-03 | Anomalous booking detection — unusual timings, abnormal trip patterns, repeat off-hours bookings. |
| FR-AI-04 | High-cost vehicle detection — cost-per-km statistically out of line with peers. |
| FR-AI-05 | Fleet sizing recommendation — model demand to recommend right-sized fleet per node. |
| FR-AI-06 | Predictive maintenance — flag vehicles at elevated breakdown risk from mileage, age, accident history. |
| FR-AI-07 | Driver risk scoring (Phase 3) — combine fines, accidents and telematics signals into a risk score feeding C10. |
| FR-AI-08 | Produce automated recommendations for transfers, consolidation, lease reduction and right-sizing, presented in the executive dashboard with supporting data and estimated financial impact. |
| FR-AI-09 | Track downtime metrics — days off-road, maintenance frequency, repeat failures, vendor turnaround — and surface vendor outliers. |
| FR-AI-10 | Fuel/toll fraud signals — fuel volume vs distance mismatch, toll crossings inconsistent with booking destination — flagged for review. |
| FR-AI-11 | **AI copilot**: natural-language interface for booking initiation ("book me a 7-seater tomorrow 9–3") and analytics queries ("top 5 most expensive vehicles per km this quarter"), answering strictly from organization data with role-based access enforced on every response; copilot actions are proposals confirmed by the user, and all copilot-initiated transactions are attributed and logged. |
| FR-AI-12 | Every AI recommendation shall carry an explanation (features/drivers behind it) and a feedback control (accept/reject/comment) to improve future output. |
| FR-AI-13 | No AI output shall autonomously execute a blocking or disciplinary action; AI flags, humans decide. |

## 19 C12 — ESG & Sustainability

**Outcome.** Fleet contribution to the sustainability picture is measured and reported: fuel trends, estimated CO₂ emissions, EV/hybrid utilisation share.

| Ref | Requirement |
|---|---|
| FR-ESG-01 | Report estimated fuel consumption trends per vehicle, pool, cluster and group. |
| FR-ESG-02 | Calculate estimated CO₂ emissions per vehicle, pool, cluster and group using configurable emission factors per fuel type. |
| FR-ESG-03 | Report EV and hybrid utilisation as a share of total fleet utilisation. |
| FR-ESG-04 | ESG data shall feed the executive dashboard and an exportable ESG report aligned with group sustainability reporting. |
| FR-ESG-05 | ESG configuration (emission factors, fuel-type assumptions) maintained by D&T with the Group Sustainability function. |
| FR-ESG-06 | Model EV-transition scenarios: projected CO₂ and cost impact of replacing flagged high-emission vehicles with EV/hybrid equivalents (Phase 3). |

## 20 C13 — Vendor & Lease Contract Management *(new in v3.0)*

**Outcome.** Every leasing vendor, lease contract and off-hire term is systematically managed; renewals never happen silently; vendors are compared on evidence.

**Business rules**

- Every leased vehicle references exactly one active lease contract; every contract references exactly one vendor.
- Off-hire terms and early-termination penalties are captured at onboarding so the AI lease-reduction recommendations can compute the true financial case.
- Vendor performance is computed from platform data (off-road days, repair turnaround, repeat failures, cost), not self-reported.

| Ref | Requirement |
|---|---|
| FR-VEN-01 | Maintain a vendor master (lessors, repair vendors, telematics vendors, fuel suppliers) linked to the procurement system where available (I3). |
| FR-VEN-02 | Maintain lease contract records: reference, vendor, vehicles covered, start/end, monthly cost, currency, off-hire terms, early-termination penalties, renewal options. |
| FR-VEN-03 | Alert Procurement and the fleet manager on lease expiry per configurable ladder (default 90/60/30 days). |
| FR-VEN-04 | Support the off-hire workflow: initiation, condition report, penalty computation, vendor acknowledgement, vehicle lifecycle transition to Off-Hire Pending → returned. |
| FR-VEN-05 | Compute vendor scorecards from operational data: cost, off-road days, repair turnaround, repeat failures, SLA breaches. |
| FR-VEN-06 | Surface contract-vs-invoice discrepancies (billed amount ≠ contracted amount) to Finance and Procurement. |
| FR-VEN-07 | Lease-reduction recommendations (FR-AI-08) shall use contract terms, penalties and remaining term to present net financial impact. |

## 21 C14 — Toll Management *(new in v3.0)*

**Outcome.** Every toll transaction is captured, attributed to the booking/driver active at crossing time, and routed to recharge where policy applies.

| Ref | Requirement |
|---|---|
| FR-TOLL-01 | Maintain toll account/tag records per vehicle (e.g. Salik, Darb, or organization-jurisdiction equivalents), with balance/expiry tracking feeding the compliance engine. |
| FR-TOLL-02 | Ingest toll transactions via authority APIs where available; support bulk statement import and manual entry as fallback. |
| FR-TOLL-03 | Auto-attribute each toll transaction to the booking active at the crossing date/time (and therefore the driver), honouring substitute-driver windows; unmatched transactions queue for fleet-manager resolution. |
| FR-TOLL-04 | Apply configurable recharge policy: business-use absorbed / personal-use recharged / always recharged — feeding the recovery pipeline (FR-RECV-01). |
| FR-TOLL-05 | Toll spend shall feed the per-vehicle cost ledger and cost-per-km computation. |
| FR-TOLL-06 | Flag toll patterns inconsistent with booking destinations for anomaly review (FR-AI-10). |

## 22 C15 — Key & Asset Custody Management *(new in v3.0)*

**Outcome.** Physical custody of keys (and on-vehicle assets like fuel cards and toll tags) is tracked and auditable; a lost key is an event, not a mystery.

| Ref | Requirement |
|---|---|
| FR-KEY-01 | Track key sets per vehicle (primary/spare) with current custody state: cabinet, fleet manager, driver (booking ref), vendor, lost. |
| FR-KEY-02 | Key issue and return shall be recorded as part of handover/return (FR-HAND-02/04). |
| FR-KEY-03 | Support optional integration with smart key cabinets/lockers for automated issue/return events; manual logging is the baseline. |
| FR-KEY-04 | Lost-key events shall trigger a configurable workflow (report, cost attribution, replacement, optional recovery). |
| FR-KEY-05 | On-vehicle asset checklist (fuel card, toll tag, first-aid kit, spare tyre — configurable) verifiable at handover/return with discrepancies logged. |

---

# PART IV — PLATFORM FOUNDATIONS

## P1 — Reusability Across Organizations *(design principle, not SaaS)*

**Outcome.** This is one project, built with clean boundaries and configuration-driven behaviour so it can be **re-deployed for another organization by changing configuration, not rewriting code**. It is **not** a multi-tenant SaaS: each organization gets its own deployment (its own database, its own hosting), which keeps the design simple and data isolation absolute by construction.

| Ref | Requirement |
|---|---|
| FR-REU-01 | A separate deployment (own database, own hosting) is provisioned per organization. There is no shared multi-tenant runtime and no cross-organization data path — isolation is by deployment, not by row-level partitioning. |
| FR-REU-02 | All organization-specific behaviour is configuration, not code: hierarchy labels/depth, policies, compliance types, workflows, alert ladders, currency, language, branding. |
| FR-REU-03 | Standing up a new organization is a repeatable setup: provision deployment → configure hierarchy → load policies → connect integrations → migrate data (P7) → pilot go-live. |
| FR-REU-04 | Branding is configurable: logo, colour theme, terminology overrides (e.g. "cluster" → "region"). |
| FR-REU-05 | Data residency follows each organization's own deployment region. |
| FR-REU-06 | **Dormant multi-org seam:** core entity tables carry an inert `organization_id` column (single default value, RLS off, never referenced by application code). This near-zero-cost scaffolding keeps a possible future hosted/multi-organization deployment a routine change (enable RLS + session variable) rather than a risky retrofit of a tenant column onto live tables. Nothing multi-tenant is built now; a CI guard prevents application code from referencing the column. |

> **Note.** Because each organization is a separate deployment, the AD Ports build runs as a single, ordinary deployment. The reusability requirement costs almost nothing now — it is met by keeping business rules in the policy engine (P3) and the hierarchy configurable (FR-ARC-02), both of which are already in scope. No multi-tenant isolation machinery is built.

## P2 — Identity, SSO & Access Control

| Ref | Requirement |
|---|---|
| FR-IAM-01 | SSO via the organization's identity provider (reference: Microsoft Entra) with MFA required for elevated roles. |
| FR-IAM-02 | Role-based access control with hierarchy-scoped role assignment (role + node scope), supporting multiple roles per person. |
| FR-IAM-03 | Field-level masking for cost data per the access matrix (7.1). |
| FR-IAM-04 | The SoD rules (7.2) shall be structurally enforced at the authorisation layer, not by UI hiding alone. |
| FR-IAM-05 | Access reviews: exportable "who has what, where" report for periodic recertification. |
| FR-IAM-06 | Session and token policies per organization security baseline; privileged actions require step-up authentication where configured. |

## P3 — Policy & Configuration Engine

**Outcome.** Business rules live in configuration, not code. This is the reusability engine — the component that keeps the project configurable rather than a one-off build.

### P3.1 Architecture — the standard pattern

The engine follows the industry-standard **PAP / PDP / PEP** separation (the pattern behind XACML/ABAC authorization and DMN decision services):

- **PAP (Policy Administration Point)** — the no-code rule builder in the admin studio: author rules as decision tables, submit for approval, set effective dates and scope.
- **PDP (Policy Decision Point)** — a stateless central decision service, the only component that interprets rules: `evaluate(ruleType, context) → {decision, reasons[], policyVersion}`.
- **PEP (Policy Enforcement Points)** — the consuming modules (booking, entitlements, compliance gate, fines, workflow, notifications, recovery): they call the PDP and enforce its answer; they never embed rule logic.
- **Policy store** — immutable versioned repository with scope inheritance.
- **Decision log** — every evaluation recorded (inputs, decision, reasons, version) into the audit layer (P10).

Every rule type declares an **input schema**, an **output contract** (allow/deny/route/value + machine-readable reason codes) and a **safe-default fallback** (deny/escalate when no rule matches). Modules integrate against the contract once; rules change indefinitely without code.

Rules are authored as **decision tables** (DMN-style): condition rows evaluated top-down, first match wins, mandatory default row — business-readable, testable, and diffable between versions.

### P3.2 Functional requirements

| Ref | Requirement |
|---|---|
| FR-POL-01 | No-code authoring of all rule types as decision tables, including at minimum: approval chains and thresholds, booking buffers and duration limits, eligibility rules (grade/role/policy limits), compliance alert ladders, hard-block conditions, scoring weights, recharge/recovery policies, consent tolerance, black-point timeframes, emergency-booking categories. |
| FR-POL-02 | Policies shall be versioned and immutable; every transaction records the policy version in force at decision time; prior versions remain queryable indefinitely. |
| FR-POL-03 | Governance lifecycle Draft → In Review → Approved → Active (effective-dated) → Superseded; high-impact categories (eligibility, SoD-adjacent, recovery, consent tolerance) require second-person approval; emergency deactivation reverts to the prior version and is logged as an exception. |
| FR-POL-04 | Policy simulation: administrators can test a draft policy against historical transactions and see the outcome diff versus the active version before activation (dry-run validation in Phase 1; full historical simulation Phase 3). |
| FR-POL-05 | Jurisdiction packs: compliance types, penalty models (e.g. black points) and toll models packaged as configurable rule-type templates per country — deploying to a new jurisdiction is configuration, not code. |
| FR-POL-06 | Scoping with inheritance: organization default → cluster → pool overrides where the rule type permits; the PDP resolves the most specific applicable rule and reports which scope answered. |
| FR-POL-07 | Decision logging: every PDP evaluation logged so Internal Audit can reconstruct why any transaction was allowed, denied or routed (feeds P10). |
| FR-POL-08 | The PDP sits in the critical booking path: decision latency < 200 ms; PDP unavailability fails safe (deny + escalate), never fails open. |
| FR-POL-09 | Rule-type registry: new capabilities register new rule types on the same engine (Phase 2: toll recharge, behaviour weights, break-glass categories; Phase 3: jurisdiction packs) — the engine is never re-architected. |
| FR-POL-10 | Build governance: no business rule value shall be hard-coded; a build-time checklist maps every threshold in this PRD to its registered rule type. |

## P4 — Workflow & Approval Engine *(new in v3.0)*

**Outcome.** One shared engine executes every multi-step approval in the platform — bookings, entitlements, substitutions, overrides, recoveries — so chains, delegation, timeouts and escalations behave identically everywhere.

| Ref | Requirement |
|---|---|
| FR-WFL-01 | Support configurable multi-step approval chains (sequential and parallel steps) resolved from the org hierarchy and policy engine. |
| FR-WFL-02 | Support delegation (7.3), timeout-based escalation (e.g. escalate after 24h for bookings, 48h for entitlements — configurable), and reminder cadences. |
| FR-WFL-03 | Every workflow instance shall expose full state history: who, what, when, decision, comment. |
| FR-WFL-04 | Support "request modification" as a decision outcome, returning the request to the initiator with comments while preserving history. |
| FR-WFL-05 | Approver-unavailable handling: auto-reroute to delegate if active, else escalate per policy; no request may sit unowned. |
| FR-WFL-06 | Workflow definitions shall be organization-configurable without code change and versioned like policies. |

## P5 — Vehicle Inventory Data Model

Every field is required at onboarding unless marked optional. Jurisdiction-specific names shown for the reference deployment; each is a configurable type.

### P5.1 Identity & classification

| # | Field | Type | Source | Notes |
|---|---|---|---|---|
| 1 | Vehicle ID (system) | Auto | System | Unique group-wide primary key |
| 2 | Plate number | Text | Manual/Procurement | Unique at group level |
| 3 | Chassis / VIN | Text | Manual/Procurement | Required for insurance and customs |
| 4 | Make | Lookup | Manual/Procurement | |
| 5 | Model | Lookup | Manual/Procurement | |
| 6 | Year of manufacture | Integer | Manual/Procurement | Used in depreciation |
| 7 | Colour | Text | Manual/Procurement | |
| 8 | Body type | Lookup | Manual | Sedan, SUV, Van, Pickup, Bus, Other |
| 9 | Use category | Lookup | Manual | Executive, Operations, Pool, VIP, Dedicated |
| 10 | Seating capacity | Integer | Manual/Procurement | Booking matching |
| 11 | Fuel type | Lookup | Manual/Procurement | Petrol, Diesel, Hybrid, EV |
| 12 | Fuel efficiency | Decimal | Manual/OEM | km/l or kWh/100km; drives expected fuel |

### P5.2 Ownership & commercial

| # | Field | Type | Source | Notes |
|---|---|---|---|---|
| 13 | Ownership | Enum | Manual | Owned / Leased |
| 14 | Date of purchase / lease start | Date | Manual/ERP | |
| 15 | Agreement end date (leased) | Date | Manual/Procurement | Drives expiry alert |
| 16 | Purchase cost (owned) | Currency | Manual/ERP | |
| 17 | Rental cost — monthly (leased) | Currency | Manual/Procurement | |
| 18 | Currency | Enum | Manual | Organization default; configurable |
| 19 | Vendor / lessor | Lookup | Vendor master (C13) | |
| 20 | Lease contract reference | Lookup | Lease contracts (C13) | |
| 21 | Early off-hire penalty terms | Text + Currency | Manual/Procurement | Feeds lease-reduction case |
| 22 | Depreciation rate | Decimal | Finance | % p.a. for owned vehicles |
| 23 | Lifetime maintenance spend | Currency | Computed | Sum of maintenance records |
| 24 | Lifetime fuel spend | Currency | Computed | From OCR/AP/manual |
| 24a | Lifetime toll spend | Currency | Computed | From toll module (C14) |

### P5.3 Compliance & documents

| # | Field | Type | Source | Notes |
|---|---|---|---|---|
| 25 | Registration (Mulkiya) number | Text | Manual | Includes annual inspection (reference deployment) |
| 26 | Registration expiry date | Date | Manual | Compliance alert + hard block |
| 27 | Insurance provider | Lookup | Manual | |
| 28 | Insurance policy number | Text | Manual | |
| 29 | Insurance expiry date | Date | Manual | Compliance alert + hard block |
| 30 | Insurance coverage type | Enum | Manual | Comprehensive / TPL / Other |
| 31 | Toll tag 1 (e.g. Salik) | Text | Manual | Unique |
| 32 | Toll tag 2 (e.g. Darb) | Text | Manual | Unique |
| 33 | Fuel card number | Lookup | Fuel card master (C9) | |
| 34 | Compliance documents | Attachments | Manual upload | Versioned scans |

### P5.4 Operational state & hierarchy

| # | Field | Type | Source | Notes |
|---|---|---|---|---|
| 35 | Lifecycle status | Enum | System | Active / In Use / Under Maintenance / Off-Hire Pending / Decommissioned / Sold / Transferred |
| 36 | Operational status | Enum | Manual/System | Reserve, Standby, VIP Only, Quarantined, Temporary Hold |
| 37 | Booking pool membership | Boolean | Admin | Include/exclude without affecting history |
| 38 | Hierarchy node (cluster) | Lookup | Org master | |
| 39 | Hierarchy node (pool) | Lookup | Org master | |
| 40 | Designated location | Lookup | Manual | |
| 41 | Country | Lookup | Manual | Global expansion |
| 42 | Live odometer | Decimal | Telematics | Where integration exists |
| 43 | Last confirmed odometer | Decimal | Handover/Return | Validated against telematics per FR-HAND-11 |
| 44 | Next maintenance due | Computed | System | km / date threshold |
| 45 | Driver assignment model | Enum | Manual | Pool / Dedicated |
| 46 | Assigned driver (if dedicated) | Lookup | HR | Required if Dedicated |
| 47 | Replacement vehicle linkage | Lookup | System | Active replacement, if any |
| 48 | Substitute driver (active window) | Lookup | System | If substitution in effect |
| 48a | Key set custody state | Lookup | Key module (C15) | Primary/spare custody |

### P5.5 Telematics

| # | Field | Type | Source | Notes |
|---|---|---|---|---|
| 49 | GPS tracker vendor | Lookup | Procurement | Optional |
| 50 | GPS tracker serial | Text | Procurement | Optional |
| 51 | GPS SIM number | Text | Procurement | Optional |
| 52 | GPS warranty end date | Date | Procurement | Optional |
| 53 | GPS status | Enum | Telematics/Manual | Installed, Not Installed, Online, Offline, Faulty, Under Replacement |

### P5.6 Risk counters & audit

| # | Field | Type | Source | Notes |
|---|---|---|---|---|
| 54 | Lifetime accidents (count) | Computed | Accidents register | |
| 55 | Open insurance claims | Computed | Accidents register | |
| 56 | Lifetime fines (count, value) | Computed | Fines register | |
| 57 | Lifetime black points | Computed | Fines register | Includes transfer status |
| 58 | Days off-road (lifetime) | Computed | Maintenance/Accidents | Downtime metric |
| 58a | Recovery outstanding (value) | Computed | Recovery pipeline | Attributed-not-yet-recovered |
| 59 | Created by / date | System | System | |
| 60 | Last modified by / date | System | System | |
| 61 | Lifecycle history | Sub-record | System | Onboarding, transfers, replacements, decommissioning |

### P5.7 Related entity models (summary)

Beyond the vehicle, the platform maintains structured models for: **Booking** (window, driver, vehicle, status, consent ref, approvals, series ref for recurring); **Entitlement/Allocation**; **Driver profile** (employee or professional; licence, status, block flags, behaviour score); **Consent record** (immutable: person, timestamp, IP, device, policy version, linked transaction); **Fine / Accident / Toll transaction**; **Lease contract / Vendor**; **Fuel card / Key set**; **Substitution window / Replacement link**; **Recovery case**; **Audit entry**; **Workflow instance**; **Policy version**. Detailed schemas are design-phase artifacts derived from the FRs in Part III.

## P6 — Integrations Map

| # | System | Direction | Purpose |
|---|---|---|---|
| I1 | HR/ERP HCM (ref: Oracle Fusion HCM) | Inbound | Employee master, hierarchy, employment status, leave calendars (BSD return) |
| I2 | Finance AP (ref: Oracle Fusion) | Inbound | Validated supplier invoice lines for fuel/maintenance allocation |
| I3 | Procurement (ref: Oracle Fusion) | In/Out | Vendor master, lease contracts, POs, off-hire records |
| I4 | GPS/telematics vendor APIs | Inbound | Live location, speed, ignition, odometer, trips, replay |
| I5 | Identity provider (ref: Microsoft Entra) | Inbound | SSO, group claims, MFA |
| I6 | Toll authorities (ref: Salik/Darb) | Inbound | Toll transactions per vehicle |
| I7 | Traffic/police authority feeds (ref: RTA/ADP) | Inbound | Fines ingestion (Phase 2/3, subject to API access) |
| I8 | Email / collaboration (ref: Microsoft 365) | Outbound | Notifications, approvals, alerts |
| I9 | Mobile push (Phase 2) + SMS gateway | Outbound | App notifications, critical alerts |
| I10 | Document AI / OCR (ref: Azure AI Document Intelligence) | Internal | Fuel invoice + document parsing |
| I11 | Group BI / data platform | Outbound | Curated analytics feed for executive and ESG reporting |
| I12 | HR disciplinary workflow (Phase 2) | Outbound | Behaviour-score and black-point overdue escalations |
| I13 | **Payroll system** *(new)* | Outbound | Recovery instructions (fines/tolls/damages/personal-use recharge) per policy; outcomes returned |
| I14 | **Smart key cabinets/lockers** *(new, optional)* | Inbound | Key issue/return events |
| I15 | **Public API & webhooks** *(new)* | In/Out | Customer-side integration and extensibility (P8) |

Integration principles: all integrations via the integration hub with retry, dead-letter queues, monitoring and per-organization credentials; inbound authority data (fines, tolls) treated as untrusted until validated; every integration failure alertable to System Admin.

## P7 — Data Migration & Data Quality *(new in v3.0)*

**Outcome.** Migration from fragmented manual sources is a managed, repeatable capability — not a one-off script — because it recurs with every new organization, entity and pool onboarded. Directly mitigates Risk R5 (High/High).

| Ref | Requirement |
|---|---|
| FR-MIG-01 | Bulk import of vehicles, drivers, contracts, documents and open fines from spreadsheets/CSV with template validation. |
| FR-MIG-02 | Pre-commit validation: mandatory-field completeness, format checks, uniqueness (plate/VIN/tags), referential integrity (vendor, contract, hierarchy node). |
| FR-MIG-03 | Deduplication detection with steward-resolved merge workflow. |
| FR-MIG-04 | Reconciliation report per batch: loaded vs rejected vs pending, with row-level reasons; steward sign-off required before records become operational. |
| FR-MIG-05 | Ongoing data-quality monitoring: completeness score per vehicle (drives the ≥98% inventory-completeness KPI), stale-field detection, steward work queues. |
| FR-MIG-06 | Migration actions are fully audited and reversible per batch prior to sign-off. |

## P8 — Public API & Extensibility *(new in v3.0)*

**Outcome.** The platform exposes a documented API so an organization can integrate its own systems without vendor involvement.

| Ref | Requirement |
|---|---|
| FR-API-01 | Documented, versioned REST API covering core resources (vehicles, bookings, drivers, fines, tolls, contracts, reports) with the same RBAC/SoD enforcement as the UI. |
| FR-API-02 | Webhooks for key events (booking confirmed/cancelled, fine recorded, compliance block raised/cleared, vehicle status change) with signed payloads and retry. |
| FR-API-03 | API credentials per organization with scoped permissions, rate limits and full request audit. |
| FR-API-04 | OpenAPI specification published and kept current with each release. |

## P9 — Notifications & Alerting Delivery

The Compliance Alerting Engine (C6) and other modules *decide* what to alert; this service *delivers* — multi-channel, preference-aware, de-duplicated.

| Trigger | Channel | Recipient | Lead times |
|---|---|---|---|
| Registration expiry | Email + in-app | Fleet Manager, Procurement | 60/30/14/7/1 days |
| Insurance expiry | Email + in-app | Fleet Manager, Insurance Lead | 60/30/14/7/1 days |
| Lease expiry | Email + in-app | Fleet Manager, Procurement | 90/60/30 days |
| Driver licence expiry | Email + in-app | Driver, Line Manager, HR | 60/30/14/7 days |
| Maintenance due | Email + in-app | Fleet Manager | By km or date threshold |
| Booking confirmed | Email + in-app | Employee, Fleet Manager | Immediate |
| Approval pending | Email + in-app | Approver / active delegate | Immediate; escalate after 24h |
| Dedicated vehicle approval pending | Email + in-app | Cluster CEO / delegate | Immediate; escalate after 48h |
| Vehicle return reminder | Email + in-app | Employee | 1 hour before return |
| Fines threshold per user (≥3) | Email + in-app | HR, Line Manager | Immediate |
| Black-points transfer overdue | Email + in-app + access block | Driver, Line Manager, HR | Configurable interval |
| Accident reported | Email + in-app | Fleet Manager, HSE, Insurance Lead | Immediate |
| Fuel deviation > threshold | Email + in-app | Fleet Manager, Finance | On return |
| Behaviour score breach | Email + in-app | HR, Line Manager | On threshold |
| Waitlist allocation | Email + in-app | Employee | Immediate on cancellation |
| **Emergency (break-glass) booking created** | Email + in-app | Line Manager, Fleet Lead | Immediate |
| **Recovery case raised / overdue** | Email + in-app | Driver, HR, Finance | On raise; configurable cadence |
| **Toll unmatched transaction** | In-app queue | Fleet Manager | Daily digest |
| **Integration failure** | Email + in-app | System Admin | Immediate |
| **Data-quality batch ready for sign-off** | Email + in-app | Data Steward | Immediate |

Delivery requirements: per-user channel preferences within policy floors (compliance-critical alerts cannot be muted); notification de-duplication and digest options; Phase 2 adds mobile push and SMS for critical alerts; all notifications logged.

## P10 — Audit, Overrides & Exception Management

**Outcome.** Every override, reassignment and exception is captured, attributed and reviewable. Internal Audit can reconstruct any operational decision after the fact.

| Ref | Requirement |
|---|---|
| FR-AUD-01 | Maintain a complete audit log for all manual overrides, booking bypasses (including break-glass), reassignments and compliance exceptions. |
| FR-AUD-02 | Each entry captures: timestamp, actor (human or AI service), action, before/after values, reason, and approving user where applicable. |
| FR-AUD-03 | Override of any SoD rule requires a documented exception with approver and reason, surfaced for periodic Internal Audit review. |
| FR-AUD-04 | Audit log shall be tamper-evident (append-only, integrity-verifiable) and read-only via the Internal Audit role. |
| FR-AUD-05 | Audit retention aligns with records-retention policy and applicable regulation, configurable per organization. |
| FR-AUD-06 | A standing exception report aggregates: SoD overrides, break-glass bookings, recovery waivers, consent-sequence exceptions, hard-block override attempts (which must all be denials). |

## P11 — Reporting & Analytics

### Operational reports

- Vehicle utilisation rate (per the defined utilisation basis) — by vehicle, location, pool, cluster, period.
- Cost per km — fuel, tolls, maintenance, lease/depreciation, total — by vehicle, category, pool, cluster.
- Demand vs capacity — peak windows vs available fleet; over/under-provisioning per pool.
- Accident trend — by vehicle, driver, pool, month — severity and cost.
- Fines per user / per vehicle — top offenders, threshold breaches, pending black-point transfers.
- **Recovery status — identified vs recovered vs outstanding vs waived, per entity/period.**
- Fuel consumption — expected vs actual deviation per booking and vehicle.
- **Toll spend and unmatched-transaction queue.**
- Compliance status — vehicles approaching registration, insurance, lease expiry; current hard blocks.
- **Vendor performance — lessors and repair vendors compared on cost, service, off-road days, turnaround; contract-vs-invoice discrepancies.**
- Dedicated vehicle utilisation and justification — per allocation, per cluster; below-threshold flags.
- Behaviour score and misuse pattern report — per cluster, with HR escalation triggers.
- **Data-quality/completeness report — per steward scope.**
- **Delegation activity report — decisions made under delegation.**

### Executive dashboard

- Group utilisation %, cost per km, accident rate, demand vs capacity, ESG snapshot — by cluster.
- Top 5 under- and over-utilised vehicles; compliance heat map across clusters.
- Dedicated-vehicle entitlement inventory with periodic review status.
- **Recovery and exposure summary (fines/tolls/damages outstanding).**
- Drill-down group → cluster → pool → location → vehicle in two clicks.

### AI intelligence outputs

- Right-sizing recommendations with financial case (net of lease penalties).
- Lease-reduction opportunities; predictive maintenance flags; vendor outliers; anomaly/fraud queue.
- Copilot ad-hoc natural-language queries over any data the requesting role may see.

### BI export

- Curated, documented outbound feed (I11) covering all reportable entities, refreshed per agreed cadence, respecting cost-masking rules at the consumer level defined by Finance.

---

# PART V — NON-FUNCTIONAL & GOVERNANCE

## 25 Non-Functional Requirements

### 25.1 Performance

| Ref | Requirement |
|---|---|
| NFR-PER-01 | Booking search response < 2 seconds for 95% of queries at peak load. |
| NFR-PER-02 | Dashboard first paint < 4 seconds. |
| NFR-PER-03 | Telematics ingestion latency < 30 seconds end-to-end. |
| NFR-PER-04 | Route replay rendering < 5 seconds for a 4-hour trip. |
| NFR-PER-05 | Eligibility gate decision (FR-COMP-10) < 500 ms — it sits in the critical booking path. |
| NFR-PER-06 | Copilot analytics responses < 10 seconds for standard queries. |

### 25.2 Scalability & load assumptions *(expanded in v3.0)*

| Ref | Requirement |
|---|---|
| NFR-SCA-01 | Designed for 300+ vehicles initially, scaling to 5,000+ vehicles and 50,000+ eligible drivers across global entities. |
| NFR-SCA-02 | Multi-organization, multi-cluster, multi-pool logical separation. |
| NFR-SCA-03 | Sizing baseline (to be validated at design): up to 500 concurrent active users, 2,000 bookings/day at full rollout, peak booking bursts of 10/second (shift starts), telematics ingestion up to 5,000 vehicles × 1 position/30s. |
| NFR-SCA-04 | Multi-currency, multi-time-zone, multi-language (English primary, Arabic RTL at minimum; additional languages by configuration). |
| NFR-SCA-05 | Horizontal scaling for stateless services; ingestion pipelines scale independently of transactional workloads. |

### 25.3 Availability & resilience

| Ref | Requirement |
|---|---|
| NFR-AVL-01 | 99.5% availability during business hours; 99.0% overall (excluding planned maintenance). |
| NFR-AVL-02 | RPO ≤ 1 hour; RTO ≤ 4 hours. |
| NFR-AVL-03 | Degradation order under partial failure: booking and eligibility gate are protected first; analytics and AI degrade first. |
| NFR-AVL-04 | Integration outages (telematics, authority feeds) shall not block core booking/handover operations; queued backfill on recovery. |

### 25.4 Security

| Ref | Requirement |
|---|---|
| NFR-SEC-01 | SSO vian organization IdP; MFA required for elevated roles; step-up auth for privileged configuration where configured. |
| NFR-SEC-02 | RBAC with field-level masking for cost data; SoD structurally enforced (FR-IAM-04). |
| NFR-SEC-03 | TLS 1.2+ in transit; AES-256 at rest; secrets in a managed vault; per-organization encryption contexts. |
| NFR-SEC-04 | Full audit trail of every record change; tamper-evident audit store (FR-AUD-04). |
| NFR-SEC-05 | Data classification per organization hosting and residency policy; driver location data classified sensitive. |
| NFR-SEC-06 | Independent penetration testing before Phase 1 go-live and annually; vulnerability management SLAs per severity. |
| NFR-SEC-07 | API security: scoped credentials, rate limiting, signed webhooks, full request audit (FR-API-03). |

### 25.5 Usability & accessibility

| Ref | Requirement |
|---|---|
| NFR-USE-01 | Desktop-first responsive web in Phase 1; native mobile app (iOS + Android) in Phase 2. |
| NFR-USE-02 | WCAG 2.1 AA compliance. |
| NFR-USE-03 | Organization brand-compliant UI (FR-TEN-04). |
| NFR-USE-04 | Core employee journey (search → book → consent) completable in under 2 minutes for a returning user; handover completable in under 3 minutes. |
| NFR-USE-05 | Full RTL layout support for Arabic and other RTL languages. |

### 25.6 Auditability

| Ref | Requirement |
|---|---|
| NFR-AUD-01 | Every booking, consent, entitlement, fine, toll, accident, transfer, replacement, recovery and decommissioning event immutably logged. |
| NFR-AUD-02 | Internal Audit read-only access to the complete audit log with search and export. |

### 25.7 Offline & degraded connectivity *(new in v3.0)*

| Ref | Requirement |
|---|---|
| NFR-OFF-01 | Handover, return and damage-capture flows shall operate offline on mobile/tablet: local capture (odometer, fuel, photos, signatures) with automatic sync and conflict flags on reconnection. |
| NFR-OFF-02 | Offline-captured records are clearly marked until synced; sync conflicts route to fleet-manager review. |
| NFR-OFF-03 | Ports, yards and remote sites with poor coverage are the design norm for field flows, not an exception. |

### 25.8 Observability & operations *(new in v3.0)*

| Ref | Requirement |
|---|---|
| NFR-OBS-01 | Centralised logging, metrics and tracing across services; per-organization usage metrics. |
| NFR-OBS-02 | Health dashboards and alerting for integration pipelines (I1–I15) with per-feed freshness indicators. |
| NFR-OBS-03 | AI model performance monitoring: recommendation acceptance rates, false-positive rates on anomaly/behaviour flags, OCR accuracy tracking against the ≥95% target. |

### 25.9 Data management & retention *(new in v3.0)*

| Ref | Requirement |
|---|---|
| NFR-DAT-01 | Retention configurable per record class per organization, aligned to records-retention policy and regulation; location/telematics data retention separately configurable and defaulting shorter (per privacy review, D4). |
| NFR-DAT-02 | Right-of-access and deletion-request handling for personal data consistent with PDPL or organization-jurisdiction equivalent, with legal-hold override. |
| NFR-DAT-03 | Backups encrypted, tested by scheduled restore drills. |

## 26 Compliance, Privacy & Consent

- UAE Information Assurance Regulation V2 (reference deployment) — data classification and security controls; equivalent frameworks configurable per organization jurisdiction.
- UAE Personal Data Protection Law (PDPL) — employee personal data and driver/location data; equivalents per jurisdiction.
- Organization data hosting and residency policy — primary residency per organization configuration; cross-border transfers governed by tier model.
- Driver location data is sensitive personal data; access is logged and limited to operational roles with explicit purpose; route-replay access is purpose-bound (FR-GPS-07).
- Digital signatures on consent shall meet UAE Electronic Transactions and Trust Services Law standards (reference deployment) or jurisdiction equivalent.
- Insurance and police data retained per records-retention policy.
- Behaviour scoring and telematics monitoring shall be covered by transparent employee notice; scoring rubrics visible to employees (FR-BEH-04); privacy-by-design review before Phase 2 telematics go-live (Risk R6/R10).

### Digital consent — hard requirement

> **DIGITAL CONSENT IS NON-NEGOTIABLE.** Every booking and every dedicated vehicle allocation is subject to mandatory digital consent. The booking or allocation is not confirmed, and no booking number is issued, until consent is captured. Consent covers acceptance of responsibility for traffic fines and tolls incurred during the booking, acceptance of responsibility for damages, and commitment to comply with company vehicle usage policy and applicable traffic law. Consent records are stored immutably with person ID, timestamp, IP, device and policy version, and are linked to the booking or entitlement record.

### Consent sequencing rules *(new in v3.0 — closes the v2.0 gap)*

| Ref | Requirement |
|---|---|
| FR-CON-01 | Consent is captured **after vehicle selection and before submission for approval**; the consent binds to the request parameters (driver, vehicle category, window, policy version). |
| FR-CON-02 | If the request is **declined**, the consent record is retained (audit) but marked void — it authorises nothing. |
| FR-CON-03 | If the request is **modified** beyond configurable tolerance (different driver, different vehicle category, window shift beyond X hours), re-consent is required before confirmation; within tolerance, the original consent carries with the change logged. |
| FR-CON-04 | If the **policy version changes** between consent and confirmation, re-consent against the new version is required. |
| FR-CON-05 | Waitlist allocations require consent capture (or re-validation) before the booking number is issued (FR-BOOK-13). |
| FR-CON-06 | Break-glass bookings still require consent at creation (FR-BOOK-21); consent is never waivable. |
| FR-CON-07 | Consent text per transaction type and language is Legal-approved, versioned in the policy engine, and rendered in the user's language. |

## 27 Success Metrics & KPIs

| KPI | Definition | Target (Year 1) |
|---|---|---|
| Inventory completeness | % of group vehicles with all mandatory fields populated | ≥ 98% |
| Booking adoption | % of pool-vehicle trips booked through the platform vs legacy paths | ≥ 90% |
| Dedicated vehicle workflow adoption | % of entitlements processed end-to-end through the platform | ≥ 95% |
| Approval cycle time (booking) | Median submission → approval | ≤ 4 working hours |
| Approval cycle time (entitlement) | Median submission → final approval | ≤ 5 working days |
| Compliance breach incidents | Trips taken on expired registration/insurance | 0 |
| Driver eligibility blocks | Bookings blocked for invalid licence/status | Tracked & trended |
| Fines attribution rate | % of fines linked to a specific driver via booking record | ≥ 95% |
| **Toll attribution rate** | % of toll transactions auto-matched to a booking/driver | ≥ 90% |
| Black-point transfer compliance | % transferred within defined timeframe | ≥ 95% |
| **Recovery rate** | % of recoverable attributed amounts recovered or formally waived within 90 days | ≥ 80% |
| Utilisation visibility | % of vehicles with utilisation calculated weekly | 100% |
| Fleet right-sizing actions | Vehicles transferred/off-hired/replaced on AI recommendation | Baseline + quarterly trend |
| Cost-per-km transparency | % of vehicles with full cost-per-km computed (incl. tolls) | ≥ 90% |
| ESG reporting coverage | % of fleet captured in ESG metrics | ≥ 95% |
| **Lease renewal discipline** | % of lease expiries actioned (renewed/off-hired) before expiry date | 100% |
| **Data-quality steward SLA** | Median time to resolve data-quality exceptions | ≤ 5 working days |
| **Break-glass usage** | Emergency bookings as % of total (with 100% post-hoc review completion) | Tracked; review 100% |
| **OCR accuracy** | Fuel-invoice line extraction accuracy | ≥ 95% before removing manual confirm |

---

# PART VI — DELIVERY

## 28 Phasing & Roadmap *(rebalanced in v3.0)*

### Phase 0 — Platform foundation (no user-facing release)

- Configuration-driven foundation, identity/SSO, RBAC + SoD enforcement, configurable org hierarchy.
- Policy & configuration engine; shared workflow/approval engine (P4).
- Audit log service (append-only, tamper-evident) wired from day one.
- Integration hub with HR/HCM (I1) live — real employees, hierarchy and leave data for build and test.
- Data migration & quality tooling (P7) — needed *before* Phase 1 go-live for the inventory cleansing sprint (Risk R5).

### Phase 1 — Foundation MVP (pilot pool go-live)

- Vehicle inventory master (full P5 data model) including hierarchy and operational statuses; document vault.
- Web booking with approval workflow, buffer enforcement, waitlist, smart recommendations, digital consent with sequencing rules (FR-CON-01..07).
- **Dedicated vehicle request workflow with eligibility validation and Cluster CEO approval** (sponsor priority — in MVP). 
- Handover/return flows with digital signature; key custody manual log (C15 baseline); offline-capable field capture (NFR-OFF-01).
- **Compliance engine live**: document expiry alert ladders, driver eligibility gate (FR-COMP-10), hard blocks on expired registration/insurance.
- **Manual fines & accidents register with booking/driver auto-linkage; black-points workflow with platform-wide access block (FR-FINE-12/13)** — in MVP per sponsor priority.
- **Substitution/attribution data model present (FR-REPL-08)** so Phase 1 fines honour manually entered substitution windows; self-service substitution UI deferred to Phase 2.
- **GPS tracking & telematics (plug-and-play, C8 Phase-1 scope)**: telematics adapter layer, device registry & pairing (TDRA-approved OBD-II default tier), live fleet map, automatic odometer, trip auto-attachment, unplug/tamper alerts, device health console — deployed at the pilot pool with ≥90% device coverage before go-live.
- Recovery pipeline v1 (manual instruction generation; payroll integration deferred).
- Operational dashboards: utilisation, fines per user, compliance heat map, entitlement inventory.
- Employee web app + fleet manager console; basic executive dashboard slice.
- Pilot at one pool, replacing the legacy allocation module; steward-led data migration with reconciliation sign-off.

### Phase 2 — Scale & automate

- Group-wide rollout across entities and clusters.
- Advanced telematics (core GPS shipped in Phase 1): full route-replay player, geofence corridors and deviation alerts (D21), harsh-driving signals, hardwired-TCU rollout for buses/high-value vehicles.
- Mobile app (iOS + Android) for booking and handover; push + SMS for critical alerts.
- Mobile damage capture with photo evidence; OCR/NLP fuel invoice ingestion; fuel card master and misuse flags.
- Toll integration (Salik/Darb where APIs available) with auto-attribution and recharge policy (C14).
- Replacement vehicle and substitute driver self-service workflows (C5 UI).
- Vendor & lease contract management full module with scorecards and off-hire workflow (C13).
- Maintenance scheduling automation and downtime metrics.
- Behaviour scoring engine with HR escalation (C10); HR disciplinary workflow integration (I12).
- Payroll integration for recovery execution (I13); recurring bookings; emergency break-glass flow hardened with review reporting.
- Public API v1 + webhooks (P8).

### Phase 3 — Intelligence & international

- AI optimisation layer: utilisation, anomaly, cost outliers, predictive maintenance, driver risk scoring (C11).
- AI copilot for natural-language booking and analytics (FR-AI-11).
- Computer-vision damage comparison (FR-HAND-09).
- Right-sizing and lease-reduction recommendations with net financial cases in the executive dashboard.
- ESG reporting at group and cluster level, incl. EV-transition scenario modelling.
- International rollout: multi-currency, multi-language, multi-region, jurisdiction packs (FR-POL-05).
- Direct fines feed integration with traffic authorities (subject to API access).
- BI/data-platform feed matured (I11); admin configuration studio matured (policy simulation, FR-POL-04).

**Phasing principle:** each phase is independently shippable and valuable. Phase 1 alone delivers the working booking + entitlement + accountability loop; Phase 2 automates and scales it; Phase 3 multiplies its value with intelligence.

## 29 Risks, Assumptions, Dependencies

### 29.1 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Telematics vendor APIs unavailable for all leased vehicles | High | Medium | Negotiate API access in lease renewals; manual odometer fallback |
| R2 | OCR/NLP accuracy on fuel invoices below threshold | Medium | Medium | Hybrid OCR + manual confirm until accuracy ≥95% (KPI) |
| R3 | Resistance from entity-level fleet teams | Medium | High | Change management plan; entity champions; phased rollout |
| R4 | Traffic-authority fines API not made available | High | Low | Manual fines entry path stays; revisit annually |
| R5 | Data quality on inventory migration from manual sources | High | High | P7 tooling; cleansing sprint pre-go-live; reconciliation sign-off; stewards per cluster |
| R6 | Privacy constraints on telematics data (location, replay) | Medium | Medium | Privacy-by-design review; access logging; retention policy; explicit consent notice |
| R7 | Disciplinary trigger friction on false positives | Medium | Medium | Mandatory HR review before action; configurable thresholds; employee score visibility |
| R8 | ERP AP integration delays for fuel invoices | Medium | Low | OCR path delivers value independently |
| R9 | Entitlement workflow rejected by some Cluster CEOs as too rigid | Medium | Medium | Configurable thresholds and delegations; pilot with two clusters |
| R10 | Behaviour scoring perceived as surveillance | Medium | Medium | Transparent rubric; employee self-visibility; HR gate before action |
| R11 | *(new)* Recovery via payroll challenged legally or by employees | Medium | High | Legal sign-off on recovery policy (D13) before enabling; consent text covers responsibility; waiver path with audit |
| R12 | *(new)* Open policy decisions (D3, D6–D9, D12–D16) block Phase 1 build | High | High | Decisions register on programme critical path with named owners and dates; escalation to sponsor at kickoff |
| R13 | *(new)* Offline sync conflicts corrupt handover records | Low | Medium | Conflict-flag design (NFR-OFF-02); fleet-manager resolution queue; field pilot before rollout |
| R14 | *(new)* Break-glass misuse erodes approval discipline | Medium | Medium | 100% post-hoc review KPI; exception report to Internal Audit; category restrictions |
| R15 | *(new)* Multi-organization ambition inflates Phase 0 cost/time | Medium | Medium | Tenancy scaffold designed in but single-organization deployment allowed initially; no cross-organization shortcuts in data layer |

### 29.2 Assumptions

- The organization HR/ERP system is the authoritative employee master and is integration-ready, including leave calendars.
- The organization IdP is the authoritative identity provider for SSO.
- Group has authority to mandate the platform across clusters and entities.
- Clusters will each provide a named data steward for migration and ongoing quality.
- Annual vehicle inspection is bundled with registration renewal in the reference jurisdiction — configurable elsewhere.
- Cluster CEOs accept the entitlement approval chain for policy-defined thresholds.
- Payroll can consume recovery instructions (file or API) — to be confirmed (D13).

### 29.3 Dependencies

- Procurement: GPS/telematics vendor terms confirmed before Phase 2; fuel-card and toll-tag data availability.
- Group Cybersecurity: data classification and integration pattern approval; pen-test scheduling.
- Group Finance: depreciation configuration; AP integration scope; recovery accounting treatment.
- Group HR: disciplinary workflow definition; leave-calendar feed; behaviour-score rubric approval; recovery policy.
- Group Legal: consent wording per e-transactions law; recovery legality; personal-use policy; privacy notices.
- Group Sustainability: CO₂ emission factors per fuel type.
- Traffic/toll authorities: API access requests initiated early (long lead times).

## 30 Open Decisions

| # | Decision | Owner | Needed by |
|---|---|---|---|
| D1 | Telematics tracker fields populated by lessor or by D&T | Procurement / D&T | Phase 1 design |
| D2 | OCR/NLP service of choice | D&T Architecture | Phase 2 design |
| D3 | Disciplinary workflow steps after fines threshold and behaviour breach | Group HR | Phase 1 build |
| D4 | Data residency tier for telematics location data and route replay; retention period | Cybersecurity / Legal | Phase 1 design |
| D5 | Currencies and clusters in scope per phase | GCDIO / Group Services | Programme kickoff |
| D6 | Depreciation rate(s) — single group rate vs per-category | Group Finance | Phase 1 build |
| D7 | Consent policy wording (per language) for legal compliance | Legal | Phase 1 build |
| D8 | Eligibility policy for dedicated vehicles — grade thresholds, role exceptions, cluster variations | Group HR / Cluster CEOs | Phase 1 build |
| D9 | Black-point transfer timeframe and escalation cadence | Group HR / Legal | Phase 1 build |
| D10 | CO₂ emission factors per fuel type | Group Sustainability | Phase 3 design |
| D11 | Behaviour score rubric — weights, thresholds, employee transparency | Group HR / D&T | Phase 2 design |
| D12 | *(new)* Consent modification tolerance (what changes require re-consent) | Legal / Group Services | Phase 1 build |
| D13 | *(new)* Fine/toll/damage recovery mechanism — payroll deduction vs direct payment; waiver authority | Group HR / Legal / Finance | Phase 1 build |
| D14 | *(new)* Utilisation definition sign-off (no-show, buffer, dedicated-vehicle treatment) | Group Services / Finance | Phase 1 build |
| D15 | *(new)* Personal-use policy for dedicated vehicles (permitted? recharged? tax treatment) | Group HR / Finance / Legal | Phase 1 build |
| D16 | *(new)* Professional/non-employee driver liability and recovery routing (contract terms) | Legal / Procurement | Phase 2 design |
| D17 | *(new)* Emergency (break-glass) booking categories, authorised roles, review SLA | Group Services / HR | Phase 1 build |
| D18 | *(new)* Key custody baseline — manual log only vs smart cabinets at which sites | Group Services / Procurement | Phase 1 design |
| D19 | *(new)* Toll recharge policy (business absorbed vs personal recharged; how identified) | Finance / Group Services | Phase 2 design |
| D21 | *(new)* Geofence corridor definition — who authors corridors, tolerance bands, ownership | Group Services / D&T | Phase 2 design |
| D22 | *(new)* Telematics device selection (TDRA-approved OBD-II + hardwired models) and aggregator-vs-direct ingestion architecture | Procurement / D&T / Cybersecurity | **Phase 1 build** |
| D23 | *(new)* Telematics extraction trigger — the conditions under which the `telematics` module graduates from pluggable-module to standalone microservice (e.g. a second organization brings its own telematics; Phase 3 replay load exceeds a defined msg/s threshold). Until a trigger fires, it stays a module. | D&T Architecture | Phase 3 design (review each phase) |

Note (v3.1): D1 (tracker fields populated by lessor or D&T) is superseded for T1 devices — the platform owns plug-in trackers and populates its own registry; D1 remains only for lessor-installed hardwired units. D4 (location-data residency/retention) moves to **Phase 1 design**, since GPS now ships in the MVP.

## 31 User Journeys

### Journey A — Employee books a pool car

1. Employee logs into the portal via SSO.
2. Selects "New booking": pick-up/return date-time, destination, purpose, passengers.
3. System filters vehicles by window, capacity, status, pool scope and buffer; runs the eligibility gate (licence, status, block flags).
4. Employee selects a recommended vehicle; system computes expected fuel and shows summary.
5. Employee signs digital consent (FR-CON-01); without consent the request cannot be submitted.
6. Request routes to the line manager (or active delegate).
7. Approval → booking number issued and confirmed; decline → consent voided (FR-CON-02); modification beyond tolerance → re-consent (FR-CON-03).
8. Reminders at T-24h (pick-up) and T-1h (return).
9. Handover: fleet manager verifies, records odometer/fuel/key issue; employee signs.
10. Return: ending odometer, condition, key return; system reconciles fuel and time.

### Journey B — Demand spike, waitlist

1. No vehicle available for the requested window; employee joins the waitlist.
2. Overnight cancellation → system allocates to the next eligible waitlister.
3. Employee notified; consent captured/re-validated; booking number issued only after consent (FR-CON-05).

### Journey C — Director requests a dedicated vehicle

1. Director opens "Dedicated vehicle request"; system evaluates eligibility (grade, role, cluster, policy) and presents eligible options.
2. Director selects category (e.g. long-term, with-driver), enters duration, dates, location, business unit, cost centre, remarks; selects justification category; attaches project memo.
3. Route: Line Manager → Cluster Fleet Lead → Cluster CEO (per configured chain, with timeout escalation).
4. On final approval, assigned driver's digital consent required; with-driver allocations also record the professional driver's authorisation (FR-DVR-12).
5. Fleet manager notified to prepare vehicle; BSD return windows auto-proposed from the leave calendar (FR-DVR-07).

### Journey D — Fine arrives 10 days after a trip

1. Authority issues fine (plate, date, time, location); fleet manager records it (or API ingests, Phase 2/3).
2. System auto-matches the booking active at that timestamp; honours any substitution window (FR-FINE-09).
3. Fine logged against vehicle and driver; third fine in rolling window → HR + line manager alert.
4. Driver notified of black points and transfer deadline; recovery case raised per policy (FR-RECV-01).
5. Until transfer confirmed, driver is blocked platform-wide (FR-FINE-13).

### Journey E — Vehicle off-road, replacement issued

1. Fleet manager sets vehicle Under Maintenance after failed inspection.
2. System surfaces affected bookings and recommends an eligible replacement from the same pool.
3. Replacement assigned; audit chain links original vehicle, replacement, booking, driver; booking number unchanged.
4. Employee notified with replacement details. Downtime logged against original vehicle; feeds vendor turnaround metrics.

### Journey F — Executive opens the dashboard

1. Executive opens dashboard: utilisation, cost/km, fleet status, top under/over-utilised vehicles, accident trend, compliance heat map, ESG snapshot, entitlement inventory, recovery exposure.
2. Drills group → cluster → pool → vehicle in two clicks.
3. AI panel surfaces three significantly under-utilised vehicles with transfer/off-hire recommendation and net financial case (lease penalties included).
4. Executive asks the copilot: "Which pool had the worst demand-to-capacity ratio last month?" — answer with drill-down link.

### Journey G — Mid-trip extension *(new)*

1. Employee on an active booking requests +3 hours from mobile/web.
2. System checks the next booking and buffer on that vehicle: no conflict → expedited approval to line manager; conflict → fleet manager mediates (offer alternative vehicle to the next booker or decline extension).
3. Approved extension updates the return reminder; original consent carries (within tolerance) with the change logged.

### Journey H — Emergency booking at 02:00 *(new)*

1. Duty engineer needs a vehicle immediately for an operational incident; opens "Emergency booking", selects the emergency category.
2. System validates eligibility and consent, issues the booking immediately without prior approval, flags it break-glass.
3. Line manager and fleet lead notified immediately; post-hoc review completed within 48h; event appears in the audit exception report.

### Journey I — New entity onboarding *(new)*

1. Admin creates the entity nodes in the hierarchy; steward receives migration templates.
2. Steward loads vehicles/drivers/contracts; validation report highlights 37 rejects and 4 suspected duplicates; steward resolves and signs off.
3. Policies inherited from group defaults with entity overrides; pilot pool goes live; completeness KPI tracked from day one.

## 32 Glossary

| Term | Definition |
|---|---|
| BSD | Booking & Shared Distribution — the shared pool a dedicated vehicle returns to during the assigned driver's leave or extended absence |
| Break-glass booking | An immediate, pre-approval-exempt emergency booking, flagged and subject to mandatory post-hoc review |
| Cluster | Top-level operating unit in the reference hierarchy |
| Darb | Abu Dhabi's electronic toll collection system (reference deployment) |
| Delegate | A user exercising another user's approval authority for a defined window |
| Eligibility gate | The single platform decision service answering "can this driver take this vehicle now?" (FR-COMP-10) |
| GS Pool | Group Services vehicle pool (reference pilot) |
| Jurisdiction pack | Configurable template of compliance types, penalty and toll models for a country |
| Mehwar | Internal legacy platform hosting the Vehicle Allocation module being replaced |
| Mulkiya | UAE vehicle registration certificate, renewed annually, includes vehicle inspection |
| OCR / NLP | Optical Character Recognition / Natural Language Processing — invoice and document extraction |
| Off-hire | Termination of a leased vehicle's contract and return to the lessor |
| PDPL | UAE Personal Data Protection Law |
| Pool | An operational fleet grouping within a cluster |
| Professional driver | Non-employee driver (e.g. chauffeur) authorised with own eligibility record |
| RBAC | Role-Based Access Control |
| Recovery case | A tracked instance of an attributed recoverable amount (fine, toll, damage, recharge) |
| RTA / ADP | Roads and Transport Authority (Dubai) / Abu Dhabi Police |
| Salik | Dubai's electronic toll collection system |
| SoD | Segregation of Duties — structural controls preventing conflicting permissions |
| Substitution window | Time-boxed reassignment of driver responsibility on a vehicle |
| Telematics | Combined GPS, vehicle data and connectivity feed from in-vehicle hardware |
| Organization | An organization deployed on the platform with isolated data and configuration |

---

**END OF DOCUMENT — PRD v3.0 (Consolidated Single Source of Truth)**
