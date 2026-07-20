# 01 — Page Roadmap by Actor

Every page for every actor, page by page, with route, purpose, child/sub-pages, the backend APIs it calls, phase and current status. Read the [README](README.md) first for the shell, conventions and legend. Endpoints reference `03_Backend_Design` modules M1–M10.

> Types: `landing` · `dedicated` · `child` · `modal` · `pattern`. Status: ✅ built · 🟡 stub/coming-soon · ⬜ planned. Phase: P1/P2/P3.

---

## A. Employee / Driver
**Responsibilities:** book pool vehicles, sign consent, collect & return vehicles, stay accountable for their bookings. **Landing:** `/{lang}/book`. Scope switcher hidden (home pool implicit).

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Book a Vehicle** | `/{lang}/book` | landing | Find & book an eligible pool vehicle in <2 min | 4-step wizard (below) | `GET /vehicles/available`, `GET /eligibility`, `POST /bookings` | P1 | 🟡 (`/booking` built, mock) | A1 |
| └ Step 1 — Window | (wizard) | modal | Date, time-window quick-picks, category, destination, purpose, passengers | — | — (client) | P1 | 🟡 | A1 |
| └ Step 2 — Vehicle | (wizard) | modal | Vehicle & Pool Finder (buffer-aware, recommended first) | filter chips, waitlist offer | `GET /vehicles/available` | P1 | 🟡 | A1 §7.2 |
| └ Step 3 — Consent | (wizard) | pattern | Full-attention, non-skippable consent (EN/AR), version-stamped | re-consent notice | `POST /bookings/:id/consent` | P1 | ⬜ | A3 |
| └ Step 4 — Confirmed | (wizard) | modal | Booking number, key instructions, calendar add | — | — | P1 | 🟡 | A1 |
| **Eligibility block banner** | `/{lang}/book` | pattern | If blocked (expired licence / black-points): cause + fix, no results | — | `GET /eligibility` (reasons[]) | P1 | ⬜ | A1 |
| **Waitlist join** | `/{lang}/book` | modal | Join waitlist when no vehicle matches; auto-allocate on cancellation | — | `POST` waitlist (M4) | P1 | ⬜ | Journey B |
| **My Bookings** | `/{lang}/bookings` | dedicated | Upcoming / Active / Past; act on upcoming | booking detail slide-in (below) | `GET /bookings?me`, `POST /bookings/:id/{cancel,modify,extend}` | P1 | ⬜ | A2 |
| └ Booking detail | (slide-in) | child | Full trip detail, consent record, status actions | consent record view | `GET /bookings/:id` | P1 | ⬜ | A2 |
| └ Extend active booking | (slide-in) | modal | Request extension; conflict check vs next booking + buffer | — | `POST /bookings/:id/extend` | P1 | ⬜ | A2 |
| └ Consent record viewer | (slide-in) | child | Immutable consent for any booking | — | `GET` consent (M4) | P1 | ⬜ | A3 |
| └ Handover receipt | (slide-in) | child | Download/print past-booking receipt | — | `GET /handovers/:id` | P1 | ⬜ | A2 |
| **My behaviour score** | `/{lang}/profile#behaviour` | child | Self-view of score + contributing events (transparency) | — | behaviour read model | P2 | ⬜ | G1 (mirror) |
| **Emergency (break-glass) booking** | `/{lang}/book?emergency` | modal | Immediate booking for defined categories; consent still required | — | `POST /bookings` (break-glass) | P2 | ⬜ | Journey H |
| **Recurring booking series** | `/{lang}/book?recurring` | modal | Series (e.g. weekly), approved once, per-occurrence checks | — | `POST /bookings` (series) | P2 | ⬜ | FR-BOOK-17 |

---

## B. Approver (Line Manager) & Delegate Approver
**Responsibilities:** approve/decline team bookings, endorse entitlements, approve substitute-driver authorisations, manage delegation. **Landing:** `/{lang}/approvals`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Approval Inbox** | `/{lang}/approvals` | landing | Decide pending bookings/endorsements with full evidence | queue + evidence card (below) | `GET` workflow queue (M1/M4/M5), `POST /bookings/:id/{approve,decline,modify}` | P1 | 🟡 coming-soon | C1 |
| └ Approval Evidence Card | (right panel) | pattern | Requester + track record → the ask → **system verdicts** → justification → decide | Policy Decision Trace | `GET /eligibility`, PDP verdicts | P1 | ⬜ | C1 §7.3 |
| └ Pending / Decided tabs | (queue) | child | Queue states incl. "Returned" sub-state after "request change" | — | workflow steps (M1) | P1 | ⬜ | C1 |
| **Delegation management** | `/{lang}/profile#delegation` | dedicated | Create/manage time-boxed delegation (one hop) | active delegations list | `POST /delegations`, `GET /delegations` | P1 | ⬜ | FR-DEL |
| **Delegation active banner** | `/{lang}/approvals` | pattern | "Items co-handled" indicator when delegating/acting as delegate | — | `GET /me` | P1 | ⬜ | C1 |
| **Team bookings / reports** | `/{lang}/reports?scope=team` | dedicated | Team's bookings & approval history | — | dashboards read model | P1 | ⬜ | P11 |
| **Substitute-driver authorisation** | `/{lang}/approvals` | modal | Approve substitute for a report (line-manager approval) | — | `POST /vehicles/:id/substitution-windows` | P2 (UI) | ⬜ | FR-REPL-05 |

---

## C. Fleet Manager
**Responsibilities:** operational owner of a pool — prepare vehicles, run handover/return, manage the fleet registry & documents, log fines/accidents, manage replacements, key custody. **Landing:** `/{lang}/operations`. Scope = their pool(s).

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Operations (Live Fleet)** | `/{lang}/operations` | landing | Where vehicles are now; act on the day's issues | Map · Radar · List lenses; attention queue; pool-load | live map (Socket.IO), `GET /operations/overview` | P1 | 🟡 (`/console` coming-soon; `overview` API exists) | B5 / E1 |
| └ Vehicle inspector (from map) | (panel) | child | Same inspector as Fleet Registry | — | `GET /vehicles/:id` | P1 | ⬜ | B5 |
| └ Attention queue item | (list) | child | Ranked open items → link to relevant action | — | compliance/fines read models | P1 | ⬜ | B5 |
| **Handover Queue** | `/{lang}/handover` | dedicated | The day's handovers to prepare/execute | — | `GET /bookings?status=approved&pool` | P1 | ✅ built (as consolidated Handover/Return page, mock) | B1 |
| **Vehicle Handover** | `/{lang}/handover/:bookingId` | child | Identity → walkaround → odometer/fuel → Damage Map → signature | Damage Map pattern | `POST /handovers`, `GET /eligibility`, `GET /vehicles/:id/keys` | P1 | ⬜ | B1 |
| **Vehicle Return** | `/{lang}/return/:bookingId` | child | Ending odo/fuel/condition; reconciliation; new-damage; key return | Damage Map, reconciliation card | `POST /handovers/:id/return`, `POST /handovers/:id/damage` | P1 | ⬜ | B2 |
| └ Report lost key | (return) | modal | Start key-custody workflow | — | key log (M6) | P1 | ⬜ | B2 |
| **Fleet (Vehicle Registry)** | `/{lang}/fleet` | dedicated | Manifest of vehicles in scope; find, inspect, manage | vitals strip, Finder, inspector | `GET /vehicles`, `GET /vehicles/:id` | P1 | ⬜ | B3 |
| └ Vehicle inspector | (right panel) | child | Identity, lifecycle pills, compliance runway, telemetry, actions | — | `GET /vehicles/:id`, `GET /vehicles/:id/history` | P1 | ⬜ | B3 |
| └ Onboard vehicle | (modal) | modal | Create a vehicle record (role-gated) | — | `POST /vehicles` | P1 | ⬜ | B3 |
| └ Document vault | (inspector tab) | child | Versioned Mulkiya/insurance/lease uploads | OCR proposal (P2) | `POST /vehicles/:id/documents` | P1 | ⬜ | B3 |
| └ Transfer pool | (modal) | modal | Inter-node transfer with reason/approver | — | `POST /vehicles/:id/transfer` | P1 | ⬜ | FR-CLU-03 |
| └ Schedule maintenance | (modal) | modal | Set Under Maintenance + due | — | `PATCH /vehicles/:id` | P1 | ⬜ | B3 |
| └ Start off-hire | (modal) | modal | Off-hire workflow initiation | — | vendor/off-hire (M-P2) | P2 | ⬜ | C13 |
| └ Lifecycle / transfer history | (inspector tab) | child | Full lifecycle + transfer trail | — | `GET /vehicles/:id/history` | P1 | ⬜ | B3 |
| **Fines & Accidents Register** | `/{lang}/fines` | dedicated | Record/track fines & accidents; attribution; recovery | Fines / Accidents / Recovery tabs | `GET /fines`, `POST /fines`, `POST /accidents` | P1 | 🟡 coming-soon | B4 |
| └ Record a fine | (modal) | modal | Plate/date lookup → auto-matched booking & driver to confirm | — | `POST /fines` | P1 | ⬜ | B4 |
| └ Recovery tab | (tab) | child | Identified→Notified→Recovered/Waived | waiver reason+approver | `POST /fines/:id/recovery` | P1 | ⬜ | FR-RECV |
| └ Substitution windows | (modal) | modal | Record time-boxed substitute-driver window (manual, P1) | — | `POST /vehicles/:id/substitution-windows` | P1 | ⬜ | FR-SUB |
| └ Black-point transfer state | (row) | child | Overdue → platform-wide block indicator | — | `GET /compliance/blocks` | P1 | ⬜ | FR-FINE-12 |
| **Compliance expiries/blocks** | `/{lang}/fleet?view=compliance` | child | Vehicles approaching expiry; current hard blocks | — | `GET /compliance/expiries`, `GET /compliance/blocks` | P1 | ⬜ | C6 |
| **Replacement vehicle assignment** | `/{lang}/fleet` | modal | Assign replacement preserving booking number | — | replacement (M8/M-P2) | P2 (UI) | ⬜ | C5 |

---

## D. Cluster Fleet Lead / Group Fleet Lead
**Responsibilities:** fleet management scoped to a cluster/group; endorse cluster entitlements; manage inter-pool/group transfers; comparative oversight. **Landing:** `/{lang}/operations` (cluster/group scope via Scope Switcher).

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Fleet Operations Console** | `/{lang}/operations` | landing | Same Ops pattern at cluster/group scope + cross-pool comparison | cross-pool comparison table, map, queue | `GET /operations/overview?scope`, live map | P1 | 🟡 | E1 |
| **Fleet (cluster/group)** | `/{lang}/fleet` | dedicated | Registry scoped to cluster/group | inspector | `GET /vehicles?scope` | P1 | ⬜ | B3 |
| **Fines (cluster/group)** | `/{lang}/fines` | dedicated | Fines/accidents across the scope | — | `GET /fines?scope` | P1 | ⬜ | B4 |
| **Reports & dashboards** | `/{lang}/dashboards?scope=cluster` | dedicated | Utilisation, cost, compliance heat map, entitlement inventory | drill-down | dashboards read models | P1 | ⬜ | P11 |
| **Inter-pool transfers** | `/{lang}/fleet?view=transfers` | child | Approve/record transfers between pools | — | `POST /vehicles/:id/transfer` | P1 | ⬜ | FR-CLU-03 |
| **Entitlement endorsement** | `/{lang}/approvals` | dedicated | Cluster Fleet Lead step in the entitlement chain | evidence card | workflow (M5) | P1 | ⬜ | C1/D1 |

---

## E. Cluster CEO (Senior Approver)
**Responsibilities:** final approval authority for dedicated-vehicle entitlements above policy thresholds within their cluster. **Landing:** `/{lang}/approvals` (entitlement queue).

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Approvals (entitlements)** | `/{lang}/approvals` | landing | Queue of entitlement decisions awaiting CEO | — | workflow queue (M5) | P1 | 🟡 | C1 |
| **Entitlement Decision** | `/{lang}/entitlements/:id` | child | Final, policy-gated decision in <2 min of reading | chain stepper, Policy Decision Trace, cost of the ask | `GET /entitlements/:id`, PDP trace, `POST` approve/decline | P1 | 🟡 coming-soon | D1 |
| └ Policy Decision Trace | (panel) | pattern | Why this escalated (matched rule row + version + scope) | — | PDP decision_log | P1 | ⬜ | D1 §7.4 |
| └ Cost breakdown | (panel) | child | Lease/fuel/insurance/tolls vs pool alternative | — | cost read model | P1 | ⬜ | D1 |
| **Cluster reports** | `/{lang}/dashboards?scope=cluster` | dedicated | Cluster exec view; entitlement inventory + review status | drill-down | dashboards read models | P1 | ⬜ | P11 |

---

## F. Executive (GCEO / GCDIO / GCFO / GCHRO)
**Responsibilities:** group-wide KPI snapshot for capital, cost, risk, ESG; drill-down. **Landing:** `/{lang}/dashboards/executive`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Executive Dashboard** | `/{lang}/dashboards/executive` | landing | 2-minute read of utilisation, cost, risk, ESG | thesis header, stat strip, cost trend, composition, ESG, AI list | dashboards read models, BI feed | P1 (basic) | 🟡 disabled in nav | F1 |
| └ Drill-down | (click any number) | child | group → cluster → pool → vehicle (2 clicks) | lands in B3/B5 scoped | scoped read models | P1 | ⬜ | F1 |
| └ AI recommendations | (card list) | child | Right-sizing/lease-reduction with financial case; accept/reject (logged) | — | AI recommendation API | P3 | ⬜ | FR-AI-08 |
| └ ESG summary | (panel) | child | CO₂ vs prior year, EV/hybrid share | — | ESG read model | P3 | ⬜ | C12 |
| **AI Copilot** | `/{lang}/copilot` | dedicated | NL booking & analytics, role-permitted data only; propose→confirm | — | copilot API (RBAC-scoped) | P3 | ⬜ | FR-AI-11 |

---

## G. HR
**Responsibilities:** receive fines-threshold & behaviour-score escalations; own disciplinary workflow; validate employment status; own leave-calendar feed. **Landing:** `/{lang}/escalations`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Escalations & Disciplinary Queue** | `/{lang}/escalations` | landing | Review fines-threshold & behaviour escalations with evidence | case detail with signal data | `GET` escalations, `GET /fines?driver` | P1 | ⬜ | G1 |
| └ Case evidence | (panel) | child | Underlying fines list / behaviour events (as driver sees them) | disputed-fine flag | `GET /fines`, behaviour read model | P1 | ⬜ | G1 |
| **Behaviour scores** | `/{lang}/escalations?view=behaviour` | dedicated | Per-employee scores; HR gate before action | — | behaviour read model | P2 | ⬜ | C10 |
| **Black-point overdue** | `/{lang}/escalations?view=blackpoints` | child | Drivers with overdue transfers (platform-wide block) | — | `GET /compliance/blocks` | P1 | ⬜ | FR-FINE-12 |
| **Fines view (HR)** | `/{lang}/fines?role=hr` | dedicated | Read-only fines-per-user, threshold breaches | — | `GET /fines` | P1 | ⬜ | B4 |

---

## H. Finance
**Responsibilities:** full (unmasked) cost visibility; depreciation config; invoice reconciliation; recovery reporting. **Landing:** `/{lang}/dashboards/finance`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Financial Dashboards** | `/{lang}/dashboards/finance` | landing | Cost, cost-per-km, spend composition (unmasked) | drill-down | dashboards read models | P1 | ⬜ | P11 |
| **Recovery status** | `/{lang}/dashboards/finance?view=recovery` | dedicated | Identified vs recovered vs outstanding vs waived | — | `GET` recovery report (M8) | P1 | ⬜ | FR-RECV-04 |
| **Depreciation config** | `/{lang}/admin/finance` | dedicated | Depreciation rate(s) config (D6) | — | config (PDP/admin) | P1 | ⬜ | D6 |
| **Invoice reconciliation** | `/{lang}/dashboards/finance?view=invoices` | dedicated | Fuel/AP invoice reconciliation | — | fuel/AP (M-P2) | P2 | ⬜ | C9 |

---

## I. Procurement
**Responsibilities:** vendor onboarding, lease contracts, off-hire, fuel-card/tracker procurement; lease-expiry alerts; commercial fields. **Landing:** `/{lang}/fleet` (commercial view) in P1; vendor dashboard in P2.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Fleet (commercial fields)** | `/{lang}/fleet?role=procurement` | landing | Edit commercial fields; receive lease-expiry alerts (P1 view) | inspector (commercial tab) | `GET/PATCH /vehicles` (commercial) | P1 | ⬜ | B3 |
| **Vendor & Lease dashboard** | `/{lang}/vendors` | dedicated | Vendor master, lease pipeline (90/60/30), scorecards | — | vendor/lease (M-P2) | P2 | ⬜ | C13 |
| **Lease contracts** | `/{lang}/vendors/leases` | child | Contract records, off-hire terms, penalties, renewals | — | lease (M-P2) | P2 | ⬜ | C13 |
| **Off-hire workflow** | `/{lang}/vendors/off-hire` | dedicated | Initiation → condition report → penalty → acknowledge | — | off-hire (M-P2) | P2 | ⬜ | FR-VEN-04 |
| **Vendor scorecards** | `/{lang}/vendors/scorecards` | child | Cost, off-road days, turnaround, repeat failures | — | vendor read model | P2 | ⬜ | FR-VEN-05 |

---

## J. Insurance Lead & HSE
**Responsibilities:** Insurance Lead — insurance expiry & accident/claims. HSE — accident notifications & safety trends. **Landing:** `/{lang}/fines` (accidents view).

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Accidents & Claims (Insurance)** | `/{lang}/fines?view=accidents` | landing | Accident register + insurance claim status | claim detail | `GET /accidents` | P1 | ⬜ | B4 |
| **Insurance compliance** | `/{lang}/fleet?view=insurance` | dedicated | Insurance expiry runway across fleet | — | `GET /compliance/expiries` | P1 | ⬜ | C6 |
| **Accident notifications (HSE)** | `/{lang}/fines?view=accidents&role=hse` | landing | Accident notifications + safety trend oversight | trend charts | `GET /accidents`, safety read model | P1 | ⬜ | B4 |

---

## K. Internal Audit
**Responsibilities:** read-only access to the tamper-evident audit log; review SoD exceptions & overrides. **Landing:** `/{lang}/audit`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Audit Log** | `/{lang}/audit` | landing | Read-only, searchable/exportable hash-chained log | entry detail | `GET /audit` | P1 | ⬜ | P10 |
| **Exception report** | `/{lang}/audit/exceptions` | dedicated | SoD overrides, break-glass, waivers, hard-block override attempts | — | `GET /reports/exceptions` | P1 | ⬜ | FR-AUD-03 |
| **Decision log** | `/{lang}/audit/decisions` | dedicated | Every PDP evaluation (why allowed/denied/routed) | Policy Decision Trace | decision_log read | P1 | ⬜ | FR-POL-05 |

---

## L. Data Steward
**Responsibilities:** owns inventory data quality — migration validation, dedup resolution, ongoing completeness. **Landing:** `/{lang}/data-quality`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Data Quality & Migration Console** | `/{lang}/data-quality` | landing | Resolve batch exceptions; monitor completeness | batch history, completeness dashboard | `GET /imports/:id`, `POST /imports/:id/resolve` | P1 | ⬜ | H1 |
| └ Import batch | (modal) | modal | Upload CSV/XLSX → 202 + jobId | — | `POST /imports` | P1 | ⬜ | H1 |
| └ Validation report | (child) | child | Row-level rejects with reasons; fix & re-validate | — | `GET /imports/:id` | P1 | ⬜ | H1 |
| └ Dedup compare-and-merge | (modal) | modal | Side-by-side record compare before merge (destructive) | — | dedup (M3) | P1 | ⬜ | H1 |
| └ Batch sign-off | (action) | modal | Steward sign-off before records go operational | — | `POST /imports/:id/sign-off` | P1 | ⬜ | H1 |
| **Fleet (data-quality scope)** | `/{lang}/fleet?role=steward` | dedicated | Edit records for data quality; completeness per field | — | `GET/PATCH /vehicles` | P1 | ⬜ | B3 |

---

## M. System Admin (D&T)
**Responsibilities:** configure tenancy/hierarchy, policies, roles, integrations; structurally blocked from approving operational transactions. **Landing:** `/{lang}/admin`.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **Admin home** | `/{lang}/admin` | landing | Admin overview + integration/connection status | — | `GET /me`, integration status | P1 | ⬜ | I2 |
| **Policy Engine — Decision Table Studio (PAP)** | `/{lang}/admin/policy` | dedicated | Author/review/activate decision tables (genuinely no-code) | rule-type list, table editor, test panel, versions/diff | policy CRUD, PDP dry-run | P1 | 🟡 coming-soon | I1 |
| └ Decision table editor | (child) | child | Editable condition→outcome table; mandatory default row | — | policy version write | P1 | ⬜ | I1 |
| └ Test this rule | (panel) | modal | Enter sample inputs → matched row (Trace in reverse) | — | PDP dry-run | P1 | ⬜ | I1 |
| └ Version history / diff | (child) | child | Prior versions, diffable; second-approver step | — | policy_version | P1 | ⬜ | I1 |
| **Org & Hierarchy Configuration** | `/{lang}/admin/organization` | dedicated | Tree editor (add/rename/move nodes, history-safe), labels, branding | integration status rows | `GET/POST hierarchy` (M1) | P1 | ⬜ | I2 |
| └ Terminology overrides | (child) | child | Relabel level words (e.g. "Cluster"→"Region") | — | config | P1 | ⬜ | I2 |
| └ Branding | (child) | child | Logo, accent within token system | — | config | P2 | ⬜ | FR-REU-04 |
| **Access management** | `/{lang}/admin/access` | dedicated | "Who has what, where" review + role assignment | recertification export | role_assignment (M1) | P1 | ⬜ | FR-IAM-05 |
| **Integrations** | `/{lang}/admin/integrations` | dedicated | IdP/HCM/M365/telematics connection status & config | — | integration health | P1 | ⬜ | P6 |
| **Notification config** | `/{lang}/admin/notifications` | dedicated | Triggers, channels, policy floors (unmutable compliance) | — | notifications (P9) | P2 | ⬜ | P9 |

---

## N. Professional / Non-Employee Driver & Substitute Driver
**Responsibilities:** operate group vehicles under authorisation; carry own eligibility record; temporarily attributed trips/fines. **Landing:** `/{lang}/book` (limited) — mostly data model in P1, minimal UI.

| Page | Route | Type | Purpose | Child / sub-views | Backend APIs | Phase | Status | Spec |
|---|---|---|---|---|---|---|---|---|
| **My assigned trips** | `/{lang}/bookings?role=driver` | landing | Trips assigned to the professional/substitute driver | — | `GET /bookings?driver` | P1 (data) / P2 (UI) | ⬜ | C5 |
| **Eligibility record** | `/{lang}/profile#eligibility` | child | Licence, contract validity, sponsor, authorising manager | — | `GET /eligibility` | P1 | ⬜ | FR-COMP-07 |
| **Consent (as driver)** | inline | pattern | Consent for allocations they drive | — | `POST` consent (M5) | P1 | ⬜ | A3 |

---

## Notes on relationships (how pages connect)

- **One vehicle inspector, reused:** the Operations map, Fleet Registry, and dashboard drill-downs all open the *same* inspector panel (`GET /vehicles/:id`) — "where is it" and "what is it" are one component.
- **One approval evidence + trace, reused:** Line-Manager approvals (C1) and Cluster-CEO entitlement decisions (D1) share the Approval Evidence Card + Policy Decision Trace patterns.
- **Consent is a reused pattern**, not a page — it appears inline in the booking wizard (A1 step 3) and in the entitlement allocation flow.
- **Scope drives everything:** the same routes (`/fleet`, `/fines`, `/operations`, `/dashboards`) render at pool / cluster / group scope depending on the actor's `role_assignment` + Scope Switcher selection — not separate pages per level.
- **Dashboards are role-masked:** cost fields are masked for non-Finance; Executive sees aggregates only — same components, different data authorization.

**Next:** [02 — Route & API matrix](02_route-and-api-matrix.md).
