# Fleet Management Platform — Project Summary

**One document to understand the whole project: what it is, who it's for, what it does, how it's built, and what's been produced so far.**

Reference organization: **AD Ports Group** · Pilot: **GS Pool, Mina Zayed** · Built to be reusable across organizations.

---

## 1. The Problem in One Paragraph

AD Ports Group runs 300+ vehicles across multiple clusters, sites and geographies. Vehicle inventory lives in scattered spreadsheets with inconsistent quality. Only one pool (Mina Zayed) has any booking system — everywhere else it's email, phone calls and walk-ins. When a traffic fine arrives, nobody can reliably prove who was driving, so it can't be recovered. Registration and insurance expire unnoticed. Executive "dedicated car" approvals live in email chains. Nobody at group level can see fleet cost, utilisation or risk in real time. Every new entity the group opens recreates the same mess.

## 2. The Solution in One Sentence

> A group-wide, role-based, AI-enabled fleet platform that replaces manual inventory and partial booking, governs entitlement for dedicated vehicles up to Cluster CEO, enforces driver accountability for fines, tolls and damages, captures ESG metrics, and gives management a real-time view of utilisation, cost and risk across every cluster — built on a configurable core reusable across organizations.

## 3. Business Outcomes (why it's funded)

| # | Outcome |
|---|---|
| O1 | Single governed group-wide vehicle master |
| O2 | Driver accountability for fines, tolls, damages — enforced via mandatory digital consent |
| O3 | Real-time fleet visibility at pool, cluster and group level |
| O4 | Automated compliance alerting + hard blocks (no trips on expired documents) |
| O5 | Per-vehicle and per-driver cost transparency (cost-per-km) |
| O6 | Structured entitlement workflow up to Cluster CEO |
| O7 | AI detection of under/over-utilisation, cost outliers, anomalies + concrete recommendations |
| O8 | Behaviour scoring with HR escalation path |
| O9 | ESG metrics — fuel, CO₂, EV/hybrid penetration |
| O10 | Scales globally; re-deployable for other organizations via configuration, not code |
| O11 | Systematic vendor and lease lifecycle management |
| O12 | Attributed costs actually recovered, not just recorded |

## 4. Scope Boundaries

**In:** vehicle master & lifecycle · org hierarchy · self-service booking (incl. recurring, mid-trip changes, emergency) · dedicated-vehicle entitlements · handover/return/damage · replacement vehicles & substitute drivers · driver eligibility · telematics · fines, black points, accidents, cost recovery · tolls · fuel & fuel cards · vendor & lease management · key custody · behaviour scoring · AI optimisation · ESG · audit & overrides · data migration · public API.

**Out:** heavy equipment (cranes, RTGs — EAM systems) · fixed-route shuttle buses · driver licence issuance (validated only) · physical workshop execution · replacing Oracle finance modules · payroll execution (platform raises recovery instructions; payroll executes).

**Boundary:** equipment/buses may appear in inventory for cost reporting but never in a bookable pool. Jurisdiction-specific concepts (Mulkiya, Salik, Darb, black points) are configurable types, not hard-coded.

---

## 5. Actors

**Human (13 roles):** Employee/Driver · Approver (Line Manager) · Delegate Approver · Fleet Manager · Cluster Fleet Lead · Group Fleet Lead · Cluster CEO (senior approver) · Substitute Driver · Professional/Non-Employee Driver · Procurement · Finance · HR · Insurance Lead · HSE · Internal Audit · Executive · Data Steward · System Admin.

**System (external):** HR/ERP (Oracle Fusion HCM) · Finance AP · Payroll · Identity provider (Microsoft Entra) · Telematics/GPS vendor APIs · Toll authorities (Salik/Darb) · Traffic/police feeds (RTA/ADP) · Email/M365 · Mobile push/SMS · Document AI (OCR) · Group BI platform · Smart key cabinets (optional) · The platform's own AI.

**Key design rule:** roles attach to a **person per scope**, not baked into the person — so a fleet manager can also be a driver, but can never approve their own booking.

---

## 6. Capability Architecture (15 domains)

| Ref | Capability | Core purpose |
|---|---|---|
| C1 | Fleet Master & Lifecycle | Single governed vehicle master, 7 lifecycle + 5 operational statuses |
| C2 | Pool Vehicle Booking & Allocation | Self-service booking, buffers, waitlists, recurring, mid-trip, emergency |
| C3 | Dedicated Vehicle Requests & Entitlements | Eligibility engine + approval chain to Cluster CEO + BSD leave return |
| C4 | Handover, Return & Damage Capture | Odometer, fuel, condition, signature, photo evidence |
| C5 | Replacement Vehicles & Substitute Drivers | Booking continuity + time-boxed liability windows |
| C6 | Driver Eligibility & Compliance Alerting | Expiry ladders, single eligibility gate, hard blocks (no override) |
| C7 | Fines, Black Points, Accidents & Recovery | Auto-attribution to driver, platform-wide block, recovery pipeline |
| C8 | Telematics, Live Tracking & Route Replay | **Phase 1, pluggable module (not a microservice), simulator-first**: `telematics-ingest` pipe with swappable `TelemetrySource` (simulator in pilot, hardware later) + `telematics` domain module for trip-attach/alerts. Replay & geofencing Phase 2 |
| C9 | Fuel, Fuel Cards & Cost Capture | OCR invoices, AP integration, reconciliation, card misuse flags |
| C10 | Behaviour Scoring & Misuse Detection | No-shows, late returns, transparent score, HR gate |
| C11 | AI Optimisation & Right-Sizing | Predictive maintenance, cost outliers, anomalies, copilot |
| C12 | ESG & Sustainability | Fuel trends, CO₂, EV/hybrid share, scenario modelling |
| C13 | Vendor & Lease Contract Management | Contracts, off-hire, penalties, vendor scorecards |
| C14 | Toll Management | Toll ingestion, auto-attribution, recharge policy |
| C15 | Key & Asset Custody | Key sets, lost-key workflow, on-vehicle asset checklist |

## 7. Platform Foundations (11)

| Ref | Foundation | Note |
|---|---|---|
| P1 | Reusability by configuration | Organization-scoped data model from day one; features hardened later |
| P2 | Identity, SSO & Access Control | Entra SSO, MFA, RBAC scoped by hierarchy node, 8 SoD rules |
| P3 | **Policy & Configuration Engine** | **The crown jewel — see §8** |
| P4 | Workflow & Approval Engine | One engine for all chains, delegation, timeouts, escalation |
| P5 | Vehicle Inventory Data Model | 61+ fields across 6 groups; related entity models |
| P6 | Integrations Map | 15 integrations (I1–I15) |
| P7 | Data Migration & Quality | Bulk import, validation, dedup, steward sign-off |
| P8 | Public API & Extensibility | Versioned REST + signed webhooks |
| P9 | Notifications & Alerting Delivery | 20 triggers, multi-channel, unmutable compliance alerts |
| P10 | Audit, Overrides & Exceptions | Append-only, tamper-evident, Internal Audit read-only |
| P11 | Reporting & Analytics | Operational, executive, AI outputs, BI export |

## 8. The Policy Engine (what makes it reusable rather than a one-off build)

Follows the industry-standard **PAP / PDP / PEP** separation (the pattern behind XACML/ABAC authorization and DMN decision services):

- **PAP** — admin authors rules as **decision tables** (business-readable, testable, diffable)
- **PDP** — one stateless decision service: `evaluate(ruleType, context) → {decision, reasons[], policyVersion}`
- **PEP** — booking, entitlements, compliance gate, fines: they *enforce* answers, never contain rule logic

Every rule type declares an input schema, output contract with reason codes, and a **safe-default fallback**. Rules are versioned and immutable; every transaction records the policy version in force. Governance lifecycle: Draft → In Review → Approved → Active (effective-dated) → Superseded.

**Hard constraint:** PDP latency < 200ms (it's in the booking path) and it **fails safe** — deny + escalate, never fail open, or compliance hard-blocks would silently disable.

**Phase 1 registers 12 rule types:** booking buffer · max duration · booking approval chain · entitlement approval chain · dedicated-vehicle eligibility · driver eligibility gate · compliance alert ladders · hard-block conditions · fines HR threshold · black-point timeframe · consent re-consent tolerance · fuel deviation threshold.

## 9. Three Architectural Rules That Cannot Be Retrofitted

These cost almost nothing in Phase 1 and are impossible to bolt on later:

1. **FR-ARC-01 — Clean, self-contained boundaries.** The project re-deploys for another organization with configuration, not a rewrite. Each organization is its own deployment (own database) — no multi-tenant machinery, isolation by construction. A single *dormant* `organization_id` column (RLS off, unused by app code) is the only future-proofing: it keeps a possible SaaS/multi-org pivot a routine change instead of a risky migration, at near-zero cost today.
2. **FR-ARC-02 — Generic hierarchy engine.** N-level configurable tree, deployed as Cluster → Pool → Location for AD Ports. Another org configures Company → Region → Branch.
3. **FR-ARC-03 — Rules in configuration, not code.** No AD Ports threshold, chain or buffer is ever hard-coded.

Plus one data rule: **FR-SUB-01/02 — the substitution attribution model ships in Phase 1** (even though its self-service UI is Phase 2), because a fine recorded in month one must never be pinned to the wrong driver for lack of the model.

---

## 10. Non-Negotiables

**Digital consent.** No consent → no booking number. No consent → no allocation. Ever. Consent is captured after vehicle selection and **before submission for approval**; it binds to driver, vehicle category, window and policy version. Declined requests void the consent; modification beyond tolerance requires re-consent. Stored immutably with employee ID, timestamp, IP, device, policy version.

**Hard blocks.** No booking on a vehicle with expired registration or insurance — no override, structurally enforced. Drivers with overdue black-point transfers are blocked platform-wide (booking, using, accessing any vehicle service).

**Segregation of duties.** 8 structural rules (e.g. never approve your own booking; Finance and Fleet Manager never co-held on the same scope; System Admin cannot approve anything operational). Overrides require documented exception + approver + audit entry.

**AI guardrails.** AI flags, humans decide. No AI output autonomously executes a blocking or disciplinary action. Every recommendation carries its explanation and a feedback control.

---

## 11. Delivery Phases

### Phase 0 — Foundation (nothing user-facing)
Reusability by configuration scaffold · identity/SSO · RBAC + SoD · hierarchy engine · policy engine · workflow engine · audit log · HR/HCM integration live · data migration tooling.

### Phase 1 — MVP: prove the loop at GS Pool (10 modules)
Vehicle master · data migration · booking (web) · dedicated-vehicle entitlements with Cluster CEO approval · handover/return with signature · compliance engine with hard blocks · **manual fines register + black-points workflow** · **GPS tracking & telematics — a pluggable module (not a microservice), simulator-first with no hardware in the pilot: `telematics-ingest` pipe + swappable `TelemetrySource`, `telematics` domain module for live map, auto-odometer, trip auto-attach, unplug alerts** · operational dashboards.

*Integrations: Oracle HCM, Entra, Email, Telematics Adapter Layer (simulator source in pilot). Pilot replaces Mehwar Vehicle Allocation; ≥90% simulated-device coverage at the pilot pool is a go-live gate.*

**Why GPS is Phase 1, and why simulator-first (v3.1 change):** research showed telematics is genuinely plug-and-play at both layers — but the Phase 1 pilot connects **no hardware**, using a simulator behind a swappable `TelemetrySource` adapter. This de-risks go-live from procurement/installation entirely, while proving the full software capability. GPS is built as a **pluggable module with a source adapter, not a separate microservice** — full swappability (simulator ↔ hardware ↔ third-party) via an interface, avoiding the distributed-data trap of splitting trip↔booking joins. It graduates to a standalone service only if D23's trigger fires.

### Phase 2 — Scale & Automate (10 workstreams)
Group-wide rollout · **advanced telematics (route-replay player, geofence corridors, harsh-driving signals, hardwired-TCU completion)** · mobile app + offline field capture · CV-ready damage photos · OCR fuel invoices + fuel cards · toll management · replacement/substitute self-service · vendor & lease management · behaviour scoring · payroll recovery + break-glass + recurring bookings · public API v1.

### Phase 3 — Intelligence & International (8 workstreams)
AI optimisation & right-sizing · predictive maintenance · anomaly/fraud detection · driver risk scoring · AI copilot · computer-vision damage comparison · ESG reporting · international rollout, jurisdiction packs, policy simulation, per-organization deployment configuration.

**Principle:** each phase ships independently and is valuable alone. Phase 1 = a working booking + accountability platform. Phase 2 automates it. Phase 3 makes it intelligent.

---

## 12. Key KPIs (Year 1)

| KPI | Target |
|---|---|
| Inventory completeness | ≥ 98% |
| Booking adoption | ≥ 90% |
| Entitlements processed in-platform | ≥ 95% |
| Booking approval cycle (median) | ≤ 4 working hours |
| Entitlement approval cycle (median) | ≤ 5 working days |
| **Trips on expired Mulkiya/insurance** | **0** |
| Fines attribution rate | ≥ 95% |
| Black-point transfers within timeframe | ≥ 95% |
| Recovery rate (recovered or waived, 90d) | ≥ 80% |
| Cost-per-km transparency | ≥ 90% of fleet |
| ESG reporting coverage | ≥ 95% |
| Lease expiries actioned before expiry | 100% |

## 13. Non-Functional Requirements (headline)

- **Performance:** booking search < 2s (P95) · dashboard first paint < 4s · eligibility gate < 500ms · PDP decision < 200ms · telematics latency < 30s
- **Scale:** 300+ vehicles → 5,000+; 50,000+ drivers; ~500 concurrent users; 2,000 bookings/day at full rollout
- **Availability:** 99.5% business hours · RPO ≤ 1h · RTO ≤ 4h · booking path protected first under degradation
- **Security:** Entra SSO + MFA · TLS 1.2+ · AES-256 at rest · field-level cost masking · SoD enforced at authorization layer, not UI · annual pen test
- **Compliance:** UAE IA Regulation V2 · PDPL (location data = sensitive personal data) · UAE Electronic Transactions & Trust Services Law (consent) · data residency UAE
- **Offline:** handover/return must work in ports and yards with poor coverage — local capture, auto-sync, conflict queue
- **Accessibility:** WCAG 2.1 AA · Arabic RTL support

---

## 14. Top Risks

| # | Risk | L/I | Mitigation |
|---|---|---|---|
| R5 | Inventory data quality on migration | H/H | P7 tooling, cleansing sprint pre-go-live, steward sign-off |
| R12 | Open policy decisions block Phase 1 build | H/H | Decisions register on critical path with named owners |
| R1 | Telematics APIs unavailable on leased vehicles | H/M | Negotiate into lease renewals; manual odometer fallback |
| R3 | Resistance from entity-level fleet teams | M/H | Change management, entity champions, phased rollout |
| R11 | Payroll recovery legally challenged | M/H | Legal sign-off before enabling; consent text covers it |
| R10 | Behaviour scoring perceived as surveillance | M/M | Transparent rubric, employee self-visibility, HR gate |
| R6 | PDPL constraints on telematics/route replay | M/M | Privacy-by-design review before Phase 2 go-live |
| R14 | Break-glass misuse erodes approval discipline | M/M | 100% post-hoc review KPI, exception report to Audit |

## 15. Blocking Decisions for Phase 1

| # | Decision | Owner |
|---|---|---|
| D3 | Disciplinary steps after fines threshold | Group HR |
| D6 | Depreciation rate(s) — group vs per-category | Group Finance |
| D7 | Consent wording (EN + AR) | Legal |
| D8 | Dedicated-vehicle eligibility policy (grades, thresholds) | Group HR / Cluster CEOs |
| D9 | Black-point transfer timeframe + escalation cadence | Group HR / Legal |
| D12 | Consent re-consent tolerance | Legal / Group Services |
| D13 | Fine/damage recovery mechanism + waiver authority | HR / Legal / Finance |
| D14 | Utilisation definition (no-show, buffer treatment) | Group Services / Finance |

*(Full register runs to D22 in the main PRD.)*

---

## 16. UX & Design System — "Wayfinding"

**Philosophy:** operational software for people in motion — a driver at 6 a.m., a fleet manager standing in a yard.

**Five principles:** (1) the 2-minute booking · (2) status is never colour alone · (3) blocks explain themselves (cause + next action) · (4) the interface speaks the user's job · (5) calm by default, loud on exception.

**Aesthetic anchor:** maritime wayfinding — signal bars like painted berth markings, an availability strip rendered like harbor berth occupancy, monospace for data humans verify character-by-character.

**Theming contract:** three token layers — brand input → semantic tokens (derived via `color-mix`) → components. Components never touch raw values. Re-theming changes one hue; light/dark is a token swap, not a second stylesheet. Status colours (ok/warn/danger) stay fixed because "expired insurance" must look like danger under every brand.

**Performance budget:** FCP < 1.5s on mid-range Android · INP < 200ms · CSS < 30KB · JS < 50KB on the booking page · one variable font · inline SVG only · no framework needed for Phase 1 pages.

**Three registers, deliberately:** the booking page is calm (drivers need speed); the fleet command console is theatrical (a control room earns it); the executive view is cinematic (boardroom screens).

---

## 17. Deliverables Produced

| File | What it is |
|---|---|
| `02_Fleet_Management_Platform_PRD_v3.0.md` | Full consolidated PRD — ~200 FRs, all 15 capabilities, 11 foundations, NFRs, risks, 20 open decisions, journeys, glossary. Single source of truth. |
| `03_Phase1_MVP_PRD_ADPorts.md` | Lean, build-ready Phase 1 PRD — 9 modules, AD Ports-first, blocking decisions, go-live definition |
| `04_Phase2_Scale_Automate_ADPorts.md` | Phase 2 scope — 10 workstreams, new integrations, KPIs, risks |
| `05_Phase3_Intelligence_International_ADPorts.md` | Phase 3 scope — 8 workstreams, AI guardrails, international |
| `06_UX_Design_System_v2.md` | "Wayfinding" — philosophy, tokens, typography, components, a11y, performance budget |
| `fleet_booking_sample.html` | Employee booking home — 4 brand themes × light/dark from one CSS file |
| `fleet_command_console.html` | Fleet lead live operations — radar plot, ticker, KPI wall, attention queue |
| `executive_dashboard.html` | Executive view — cost trend, spend composition, ESG rings, AI recommendations |
| `screen_fleet_manager_handover.html` | Handover: checklist, fuel gauge, tap-to-pin damage map, working signature pad |
| `screen_line_manager_approvals.html` | Approval inbox: queue + decision panel with system verdicts |
| `screen_cluster_ceo_entitlement.html` | Entitlement decision: policy verdicts, approval chain, cost of the ask |
| `screen_vehicle_registry.html` | Vehicle management: fleet vitals, filterable manifest, docked inspector |

## 18. Actor → Screen Coverage

| Actor | Screen | Status |
|---|---|---|
| Employee / Driver | Booking home | ✅ built |
| Fleet Manager | Handover & return | ✅ built |
| Fleet Manager | Vehicle registry | ✅ built |
| Line Manager | Approval inbox | ✅ built |
| Cluster CEO | Entitlement decision | ✅ built |
| Cluster/Group Fleet Lead | Command console | ✅ built |
| Executive | Executive dashboard | ✅ built |
| Employee | Consent sheet | ⬜ not yet |
| Fleet Manager | Fines & accidents register | ⬜ not yet |
| HR | Behaviour/discipline escalation | ⬜ not yet |
| Data Steward | Migration & data quality console | ⬜ not yet |
| System Admin | Policy engine (decision-table authoring) | ⬜ not yet |

---

## 19. How to Read This Project

1. Start here (this summary) for the whole picture.
2. Read **`03_Phase1_MVP_PRD_ADPorts.md`** if you are building — it's the scoped, buildable document.
3. Read **`02_Fleet_Management_Platform_PRD_v3.0.md`** for any requirement detail across all phases.
4. Read **`06_UX_Design_System_v2.md`** before writing any front-end code.
5. Open the HTML screens to see the intended experience — they are interactive, not images.

**The single most important thing to get right:** the policy engine (§8) and the three non-retrofittable rules (§9). Everything else is a feature. Those four decisions determine whether this is cleanly reusable or a one-off build.
