# Implementation Plan Remediation Tracker

| Field | Value |
|---|---|
| Document ID | PLAN-ADP-FLEET-REMEDIATION-001 |
| Version | 0.1 |
| Status | Active remediation tracker |
| Updated | 2026-07-16 |
| Source review | [Implementation Plan Review](../06-verification/implementation-plan-review.md) |
| Product naming | Undecided; use `Fleet Management Platform`, `<app-slug>`, and `fleet` only as neutral working descriptions/identifiers |
| Implementation authorization | **Blocked** until all Blocking governance gates and required technical evidence close |

## 1. Status Definitions

| Status | Meaning |
|---|---|
| **Corrected in plan** | The contradictory or missing design text is repaired; implementation/test/approval evidence may still be required. |
| **Partially corrected** | A gate or design direction is defined, but an owner decision, formal artifact or executable proof is still missing. |
| **Open** | No controlled closure exists; the accountable owner must act. |
| **Verified closed** | Reviewer has accepted linked approval/test/deployment evidence. No finding has this status yet. |

A document edit is not implementation evidence. Only the reviewer may mark a finding **Verified closed** after inspecting its closure evidence.

## 2. Immediate Fixes Applied

1. Removed all dependencies on the intentionally deleted wiki; no wiki file is treated as evidence or recreated.
2. Removed explicit candidate product names from documentation and intake artifacts; renamed the draft consolidated PRD and empty repository folders to neutral names.
3. Recast the implementation plan as a candidate under review rather than a plan of record.
4. Changed fixed app slugs to `<app-slug>-api` / `<app-slug>-ui` and the application schema to neutral `fleet`.
5. Replaced the invalid organization UUID with `00000000-0000-4000-8000-000000000001` plus an organization FK.
6. Marked the technology stack and ADR table as proposed; selected Bicep as the proposed IaC baseline.
7. Corrected Phase 1 SoD acceptance from SoD-01..06 to SoD-01..08.
8. Replaced hard-coded vehicle hierarchy levels with effective-dated `vehicle_hierarchy_assignment`.
9. Defined persisted booking reservation ranges, policy version, `btree_gist` exclusion constraint and 409 conflict behavior.
10. Replaced mutable consent voiding with append-only lifecycle events and superseding consent records.
11. Defined per-organization audit serialization and versioned canonical payload hashing.
12. Added transactional outbox/inbox and a Postgres critical-work ledger with BullMQ execution/reconciliation.
13. Added signed integration-contract entry gates, sensitive-read auditing, source conformance and stale-data behavior.
14. Expanded security, accessibility/RTL, UAT, sponsor go/no-go, continuity, hypercare and timed recovery gates.
15. Changed inspection tables from “fix applied” language to planned remediation plus evidence-based closure.

## 3. Blocking Finding Tracker

| ID | Status | Current remediation | Remaining closure evidence | Accountable owner | Gate |
|---|---|---|---|---|---|
| B-01 | **Open** | Plan now states no controlled discovery/funding baseline exists. | Recreated and approved demand/discovery baseline; funding decision; approved BRD/PRD/NFR/HLD/ADRs; implementation authorization. | Sponsor, Business Analyst, Product, Governance | Build preparation |
| B-02 | **Corrected in plan** | Startup documents are explicitly candidate inputs; plan is not authoritative. | Approved artifact/source precedence register with versions, owners, approval dates and supersession. | Governance, Business Analyst, Product, Architect | Build preparation |
| B-03 | **Open** | Requirement-family assessment exists only at aggregate level. | Requirement-by-requirement FR/NFR/SoD/decision → phase → work item → component/API/table/screen → test/evidence matrix. | Product, Architect, Delivery, QA | Build preparation |
| B-04 | **Open** | Decision register and production-rule gate are described. | Named accountable people, dates and signed outcomes for D3/D4/D6/D7/D8/D9/D12/D13/D14 and affected tests. | Sponsor and named business/legal owners | Phase entry |
| B-05 | **Corrected in plan** | Valid seeded UUID and FK are specified. | Fresh PostgreSQL migration and FK/seed test. | Database Engineer | Phase 0 |
| B-06 | **Partially corrected** | Stack and ADR rows are marked Proposed; rationale contradiction removed. | Formal approved ADR files with options, consequences, approver and revisit trigger. | Solution Architect | Build preparation |
| B-07 | **Corrected in plan** | Effective-dated generic hierarchy assignment replaces fixed semantic columns. | Approved domain/data model; migration/query tests for 3/4/5 levels, transfer and restructure history. | Architect, Database Engineer | Phase 0/1 |
| B-08 | **Corrected in plan** | PDP read-through, minimized evidence and caller-transaction logging are defined. | Policy-engine spike, latency/failure benchmark, activation/invalidation/rollback tests and approved ADR/LLD. | Architect, Backend Engineer | Phase 0 |
| B-09 | **Corrected in plan** | Persisted reservation range/version plus `btree_gist` exclusion and 409 behavior are defined. | Fresh migration; parallel create/modify/extend and policy-change tests. | Database, Backend | Phase 1 |
| B-10 | **Corrected in plan** | Per-organization advisory locking, canonical payload and sensitive-read audit are defined. | Concurrent integrity/tampering/read-audit tests and Security/Privacy approval. | Security, Database, Backend | Phase 0/go-live |
| B-11 | **Corrected in plan** | Transactional outbox/inbox and durable critical-work ledger are specified. | Crash/replay/duplicate/DLQ/Redis-loss tests and operational runbook. | Backend, Integration, Platform | Phase 0/1 |
| B-12 | **Partially corrected** | Consent lifecycle is append-only; decision context is minimized. | Approved privacy/retention/legal-hold/DSAR matrix and lifecycle tests. | Legal/Privacy, Security, Database | Go-live |
| B-13 | **Partially corrected** | Mandatory Phase 1 integration-contract fields and outage behaviors are defined. | Signed Entra/HCM/M365/telematics LLDs, endpoint/connectivity proof, reconciliation and stale-data tests. | Integration and system owners | Phase entry |
| B-14 | **Partially corrected** | Bicep selected; extension list and regional decisions are explicit gates. | Azure deployment proof, quota/allowlist/WORM confirmation, OCR residency approval and reproducible pipeline. | Platform, Cybersecurity | Phase 0 |
| B-15 | **Corrected in plan** | Signed UAT, sponsor/multi-owner go/no-go and rollback authority are mandatory gates. | Executed UAT report, defect disposition, signed go/no-go and training/operations acceptance. | Sponsor, QA, Operations, Delivery | Go-live |
| B-16 | **Corrected in plan** | Timed restore/replay, writable continuity procedure and hypercare exit are mandatory. | RPO/RTO drill, reconciliation, continuity exercise and approved runbooks. | SRE, Platform, Database, Service Owner | Go-live |

## 4. Strong Finding Tracker

| ID | Status | Current remediation | Remaining closure evidence | Owner |
|---|---|---|---|---|
| S-01 | **Corrected in plan** | Arabic/RTL, dark theme, Radar and Phase 1 PWA/offline are explicit approval-gated proposals. | Product/UX/Sponsor decision and updated scope/cost/test baseline. | Product, UX, Sponsor |
| S-02 | **Corrected in plan** | Phase 1 acceptance requires SoD-01..08 and override evidence. | Eight executable integration tests and Internal Audit acceptance. | Security, Backend, QA |
| S-03 | **Open** | Dependency principles remain high-level. | Bounded-context matrix, table/write ownership and complete enforced dependency rules. | Architect, Backend, Database |
| S-04 | **Open** | Role handoffs are listed but no integrated WBS exists. | Resource-loaded cross-role WBS/RACI and critical-path dependency network. | Delivery Planner |
| S-05 | **Open** | Calendar remains indicative. | Team capacity, effort ranges, external lead times, funding and contingency-based estimate. | Delivery, Sponsor, Engineering Leads |
| S-06 | **Corrected in plan** | Security scans/SBOM/provenance, accessibility/RTL matrix and severity gates are specified. | Approved test/security strategy plus execution evidence. | QA, Security, Platform, Frontend |
| S-07 | **Open** | Test targets remain without a quantitative workload/storage/cost model. | Capacity model and load/soak/failover evidence. | SRE, Architect, Database, QA |
| S-08 | **Partially corrected** | Source/checkpoint boundary and contract/conformance gate are defined. | Protocol, volume and vendor-sample conformance results. | Integration, Telematics, Platform |
| S-09 | **Corrected in plan** | Inspection language now distinguishes planned remediation from evidence. | Phase gate records with owner, result, evidence URI and reviewer. | Delivery and artifact owners |
| S-10 | **Open** | Actor concepts remain in the draft PRD and database model. | Approved actor-role-engagement-scope/delegation matrix and authorization tests. | Product, HR, Security, Architect |
| S-11 | **Open** | KPI targets exist but benefits baseline/formulas do not. | KPI formula/source/baseline/target/observation/benefit-owner register. | Business Analyst, Product, BI, benefit owners |

## 5. Advisory Finding Tracker

| ID | Status | Required action | Evidence | Owner |
|---|---|---|---|---|
| A-01 | **Open** | Add canonical RFC 7807 schema, stable reason codes, localization and examples. | Shared schema + contract tests. | Backend, Frontend |
| A-02 | **Open** | Approve field-level cost disclosure, aggregation and masking matrix. | Role/scope authorization tests. | Product, Security |
| A-03 | **Corrected in plan** | Hypercare roles, severity/escalation and exit criteria are now defined. | Approved roster/runbook and exit sign-off. | Service Owner, SRE |
| A-04 | **Open** | Complete dependency-cruiser rules for every bounded context/deployable. | Positive/negative CI tests. | Backend Architect |
| A-05 | **Open** | Classify sample screens/roadmap/mind maps as exploratory, superseded or approved. | Controlled UX/artifact register. | UX, Governance |
| A-06 | **Open** | Choose Phase 2 offline merge/conflict strategy. | Approved offline LLD and conflict tests. | Product, Mobile, Backend |
| A-07 | **Open** | Produce separate jurisdiction/residency/deployment ADR before Phase 3. | Approved ADR. | Solution Architect |

## 6. Execution Order

### Gate 0 — Recreate governance baseline

1. Sponsor names funding/approval authority and target decision forum.
2. Business Analyst recreates demand/discovery evidence outside the wiki first, under `docs/01-discovery/`.
3. Product reconciles draft source documents into controlled PRD/FR/NFR artifacts under `docs/02-product/`.
4. Governance publishes artifact status/precedence and product-naming decision process.

**Exit:** B-01, B-02 and the governance portion of B-03 have approved evidence. No implementation starts before this exit.

### Gate 1 — Approve architecture and technical spikes

1. Architect publishes domain/HLD/foundation LLD/module LLDs and formal ADRs.
2. Database/Backend run fresh-migration, policy-engine, concurrency, outbox/recovery and audit-integrity spikes.
3. Security approves privacy, retention, audit and data-residency controls.
4. Integration owners sign contracts and prove connectivity.
5. Platform deploys the Bicep baseline and captures quota/extension/WORM evidence.

**Exit:** B-05 through B-14 have approved design plus executable evidence; S-03, S-07, S-08 and A-01/A-02/A-04 are closed or accepted with dated risk.

### Gate 2 — Rebaseline delivery

1. Product closes scope uplifts and actor/KPI decisions.
2. Delivery builds the integrated, resource-loaded WBS/RACI.
3. QA baselines requirement-linked tests and evidence locations.
4. The reviewer rechecks the revised implementation plan.

**Exit:** B-03/B-04 and S-01/S-04/S-05/S-10/S-11 close; implementation receives explicit authorization.

### Gate 3 — Prove release readiness

1. Execute full functional, security, accessibility, performance, integration and recovery suites.
2. Complete migration/steward sign-off, GS Pool UAT and training.
3. Run continuity and timed RPO/RTO drills.
4. Obtain multi-owner go/no-go and activate hypercare.

**Exit:** B-15/B-16 and all go-live evidence close; reviewer changes the verdict only after evidence inspection.

## 7. Required Human Decisions

| Decision | Accountable human function | Deadline rule | Build behavior before closure |
|---|---|---|---|
| Funding and implementation authorization | Sponsor/portfolio authority | Before Gate 0 exit | Discovery/design/spikes only; no production implementation. |
| Final product name and technical slug | Sponsor/Product/Brand/Governance | Before public UX, app registration and production resource naming | Use neutral descriptions/placeholders; do not introduce a candidate name. |
| D3/D6/D7/D8/D9/D12/D13/D14 | Owners named in draft source pack | Before dependent feature enters production-config build | Engine/schema may use test fixtures; production values remain blocked. |
| Location residency/retention and OCR region | Cybersecurity/Legal/Privacy | Before telematics/OCR live-data flow | Simulated/anonymized data only. |
| Frontend scope uplifts | Sponsor/Product/UX | Before Phase 1 backlog approval | Responsive English baseline + EN/AR consent only. |
| Yard connectivity/offline scope | Fleet Operations/Product/Platform | Before handover implementation baseline | Perform coverage survey; no silent Phase 1 offline promise. |
| UAT/go-no-go/rollback authority | Sponsor/Service Owner/Operations/Security/Delivery | Before release rehearsal | Production gate remains closed. |

## 8. Reviewer Update Rule

For each finding, append to this tracker:

- accountable person, not only role;
- due date;
- status;
- evidence URI;
- reviewer decision;
- residual risk and expiry for any exception.

Do not delete findings. Mark them **Verified closed** or **Accepted risk** so the review trail remains auditable.
