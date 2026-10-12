# Phase-by-phase delivery and acceptance plan

| Document control | Value |
| --- | --- |
| Document ID | NCP-PLAN |
| Version / date | 1.1 / 10.09.2026 |
| Status | Proposed execution baseline for approval; no delivery dates committed |
| Accountable owner | Delivery Lead and Product Owner; named owners to be assigned |
| Companion documents | [Index and decision register](README.md), [FR specification](01-Functional-Requirements.md), [NFR specification](02-Non-Functional-Requirements.md) |

## 1. Planning principles

1. Deliver the full agreed application in phases, not a quotation-only product. Track and trace, Documents, Invoices, Bookings and Claims have menu/access preparation in Phase 1 and functional releases later.
2. Build identity, tenant isolation, portal-owned roles, organisation linking, app shell and canonical integration once. Do not rebuild those foundations for each module.
3. Use the simplified runtime: Vite SPA, one NestJS backend with in-process pg-boss jobs, PostgreSQL, Blob storage, Entra, Key Vault and basic Azure monitoring. No Redis, Service Bus/RabbitMQ, CRM, Power BI or owned AI models. Re-confirmed 17.09.2026 with code evidence, reversal triggers and reversal cost recorded in [ADR-008](../adr/ADR-008-background-work-queue.md).
4. Retain real integration-team CW1 access and a compatible configurable simulator for development/test. A simulator demonstration is not production CW1 acceptance.
5. Implement vertical slices in the order database/migration, contracts, API/rules/tests, OpenAPI/client, UI/localisation, end-to-end evidence. Keep apps self-contained; there is no shared-types package or design-system workspace package.
6. Distinguish customer entitlement and permission from release readiness. Entitled users can see approved future-module menu entries without executing unimplemented functionality.
7. Carry unresolved decisions explicitly. Do not invent claims states, source API contracts, financial rules, security limits or recovery targets to finish a screen.
8. Do not assign calendar dates until team capacity, estimates and external dependency dates are known. Phase IDs represent dependency order, not guaranteed deadlines.

This plan adapts [the existing ten-stage Phase 1 sequence](../Project-Kickoff-and-Phase1-Plan.md) and [slice backlog](../01-Vertical-Slice-Implementation-Plan.md) to the new FR/NFR baseline. Conflicting old shared-package examples, invitation-only staff onboarding and missing future menus must be reconciled in affected implementation specifications before coding. This document does not change existing migrations or declare the scaffold complete.

## 2. Roadmap

| Phase | Delivered outcome | Principal requirement coverage | Release gate |
| --- | --- | --- | --- |
| Readiness | Signed scope, named owners, approved identity/integration prerequisites and test strategy | Decision register; NFR acceptance profiles | Critical Phase 1 decisions assigned; no unsupported production assumptions |
| P1 Foundation and quotation | Staff first-login registration, portal roles, customer onboarding, all five future-module menus/access, customer/internal quote workflow and admin quotation settings, templates/address book, quote PDF, dashboard shell, news, quote notifications | FR-IAM, FR-ORG, FR-CFG, FR-NAV, FR-QTE, FR-TOL, FR-SYS; initial FR-NTF/NEW/DSH/ECO; all applicable NFRs | Both configured publication paths demonstrated: direct without priced-offer CW1 submission and CW1-confirmed with real business acknowledgement; acceptance/PDF and security/quality/operations gates pass |
| P2 Visibility | Logged-in/public tracking, documents, invoices, standard alerts, subscriptions, available dashboard widgets and standard assigned reports | FR-TRK, FR-DOC, FR-FIN; FR-NTF-002/003; FR-DSH-002; FR-RPT-001/002/003 | Customer-safe live visibility, addressee privacy, document allow-list and public isolation proven |
| P3 Booking and claims | Both booking routes, quote-number linkage, scanned document transfer, milestone gates; claims under approved non-CRM process; advanced alerts/email rules; conditional sailing schedule | FR-BKG, FR-CLM; FR-NTF-004/005; FR-ECO-002 | Real CW1 booking round trip; approved claims handling demonstrated; provider-dependent items released only when ready |
| P4 Intelligence and analytics | External API predictive/assistant features, provenance/overrides, self-service reports, training and operational analytics | FR-INT; FR-RPT-004; remaining FR-DSH | Data-sharing and evaluation gates pass; core workflows survive AI failure; no models or Power BI deployed |
| P5 Ecosystem | PO visibility/deep links, governed customer API/feeds, another approved TMS and additional languages | FR-ECO-001/003/004 | First authorised external consumer and source/tenant contract suite pass |
| CO2 delivery, phase pending | Public calculator with mode comparison, conditional quotation estimate, booking prediction and shipment emissions detail/grid/filter | FR-CO2-001 through FR-CO2-004; NFR-CO2-001/002; FR-ECO-005 foundation | Explicit product requirements; PRD delivery deferral remains until OQ-20 and phase allocation are approved; UC-11 quotation enhancement does not delay P1 |
| Deferred optional enhancements | Other unapproved optional enhancements | PRD future alternatives | Separate scope approval |

No later phase automatically reinstates CRM, Power BI, brokers or model development. The desired business outcomes are retained; excluded implementations require explicit new approval if ever reconsidered.

## 3. Navigation versus functional availability

| Module | Phase 1 deliverable | Functional release | Principal access rule |
| --- | --- | --- | --- |
| Track and trace | Navigation, view/export permission definitions and role eligibility | P2 | Customer visibility links; authorised internal tracking is not branch-scoped |
| Documents | Navigation, view/download and restricted-access permission definitions | P2 | Approved type allow-list, internal/restricted exclusions and financial addressee rule |
| Invoices | Navigation, finance view/export permission definitions | P2 | Explicit finance permission plus transaction addressee and optional office restriction |
| Bookings | Navigation, view/create/change/cancel permission definitions | P3 | Quoting/Booking grants plus customer scope and server-enforced milestone gates |
| Claims | Navigation, customer claim view/create/comment permission definitions; internal handling grants pending approval | P3, D-05 | Claims grants and customer scope; approved handlers/process required |

F1.03 seeds the approved permission catalogue and presets; F1.04 uses those grants in the shell. F1.06 provides routine administrator assignment. A future permission does not create a functioning endpoint. Unreleased navigation follows D-02: disabled entry or a controlled unavailable page, without mock business data, working forms or unavailable-API calls. The role matrix in the FR specification is the source of menu eligibility; missing functionality must not cause all entitled future menus to disappear.

## 4. Readiness and external prerequisites

### 4.1 Business decisions

| Needed decision / deliverable | Accountable team | Needed by | Evidence |
| --- | --- | --- | --- |
| Pilot customer, region, branch and rollout owner | Sponsor / Operations | F1.06 configuration and P1 UAT | Named pilot and branch, acceptance participants, support contact |
| Eligible staff/guest policy and first-admin bootstrap | Identity / Security / Product | F1.02 | Written eligibility and bootstrap procedure; staff sign-in is not universal business access |
| Internal role-to-module grants and branch/cross-branch/cost authority | Product / Operations / Finance | F1.03 | Approved permission/preset matrix including later modules |
| Tenant party policy, org/address resolution and source-instance namespace | CW1 / Operations | F1.05 real integration | OQ-3/3a/3b answers and representative messages/master data |
| Organisation-link confirmation versus second-person approval | Sponsor | F1.06 | OQ-13 decision; no new approval subsystem without approval |
| Pricing operating approval, cost capture, threshold and currency treatment | Sponsor / Head of Pricing / Finance | F1.08 | OQ-11/12 sign-off and testable threshold examples |
| Admin quotation policies, scope precedence and direct-publication handover | Product / Pricing / Finance / Security / Integration | F1.03 grants; F1.08 settings; later booking linkage before P3 | UC-12 and D-18: scope matrix, initial values/ranges, policy versioning and direct-offer reconciliation agreed; governing-source/ADR reconciliation before implementation |
| Brand assets and EN/ES business terminology | Brand / Product | F1.04 and each customer output | Approved tokens/assets, catalogue reviewers and terminology |
| Workload, security/availability profile, retention and recovery objectives | Engineering / Security / Legal / Cloud | F1.10 production gate | D-06 through D-10 decisions and signed NFR test profiles |
| Categorised events and customer-safe document allow-list | Operations / Digital Products | P2 mapping | OQ-21/22 approved lists and prohibited-document examples |
| Non-CRM claims handling, ownership and lifecycle | Product / Claims Operations | P3 claims design | OQ-23/D-05 signed process; no assumed case-system replacement |

### 4.2 Minimum Azure and IT prerequisites

These are requests to the cloud/IT team, not instructions to provision new services immediately. Local development can proceed against PostgreSQL and simulator contracts while shared-environment access is arranged. Corporate controls may require additional approved network protection; simplicity does not waive security policy.

App Service and Azure Container Apps remain alternative API hosting options pending D-17. Assess both; provision only the selected runtime after approval. ACR is the image registry for container deployment to either option, not a third hosting option. See the ready-to-send [Azure team request checklist](04-Azure-Team-Request-Checklist.md).

| Capability | Minimum request | Owner / gate |
| --- | --- | --- |
| Subscription and environment governance | Approved region/resource groups, names/tags, budget, quotas, service owners and Dev/Test/UAT/Prod separation | Cloud; before provisioning |
| API and jobs | Option A: Linux App Service with an appropriate Always On plan. Option B: Azure Container Apps with at least one running replica and CPU/billing settings suitable for background work. Both require managed identity, health checks, safe restart/shutdown and in-process pg-boss execution; compare cost/network/security before choosing one | Cloud; D-17 before provisioning / F1.10 production |
| Container images | Existing or new approved ACR for container deployments; pipeline push and runtime pull permissions through least-privilege identities, image retention and vulnerability scanning | Cloud / Security; before first container deployment |
| SPA hosting | Approved HTTPS static hosting with SPA route fallback, environment-specific configuration, DNS and certificate renewal | Cloud; F1.04 shared shell |
| Database | Azure PostgreSQL Flexible Server, required extension/version compatibility, connectivity, separate migration/runtime identities, backups and restore access | Database / Cloud; F1.01 onward |
| Files | Private Blob containers for documents/PDFs, least-privilege access, lifecycle policy; scan service before first upload | Cloud / Security; quote PDF and first upload gates |
| Secrets | Key Vault, managed-identity grants, pipeline service connection and rotation responsibility | Cloud / Security; shared environments |
| Identity | Corporate Entra and External ID app registrations per environment, API scopes/audience, approved issuers, redirect/logout URLs, MFA/conditional access, invitation-only customer flow and test users | Identity; F1.02 |
| Network | Approved TLS, DB/storage routes, CW1 and AI egress, webhook ingress/authentication, DNS and pipeline-agent connectivity; WAF by public-tool release or earlier if policy requires | Network / Security; relevant environment gate |
| Email | Approved sending provider and verified domain with SPF/DKIM/DMARC policy, quotas, failure handling and responsible owner | IT; F1.06 invitations |
| Monitoring | Application Insights/log destination, access/retention, dependency and failed-job alerts, response contacts | Cloud / Operations; F1.05 onward |
| Deployment | Azure DevOps permissions/service connections, environment approvals, build artifacts, migration procedure and rollback/runbook access | Engineering / Cloud; F1.01 onward |
| Production readiness | RPO/RTO approval, restore exercise, security review, incident escalation and pilot support plan | Service owner / Security; F1.10 |

Not kickoff prerequisites: Redis, Service Bus, RabbitMQ, Kubernetes/AKS, a separate integration-worker deployment, API Management, Power BI capacity/workspaces, CRM licences/Dataverse, AI training/serving resources or an additional local monitoring stack. Introduce any additional service only for a demonstrated need and approved architecture change.

### 4.3 Integration-team contract checklist

Before treating real and simulated access as interchangeable, obtain:

- Versioned endpoint/message contract, authentication/authorisation method, environment URLs and network permissions.
- Organisation master data, address-to-organisation relationships if applicable, branch/source-instance identification and approved visibility-party examples.
- Quote request, priced quote, acceptance/rejection, CW1-originated quote and conflict samples; booking/event/document/finance samples before their phases.
- Definition of transport acknowledgement versus persisted CW1 business confirmation, reference propagation and reconciliation queries/events.
- Idempotency support, source message identifiers, duplicate/out-of-order behaviour, error categories, retry limits, throttling and expected response sizes.
- Push triggers, fallback polling availability, source emission timestamps, latency expectations and incident ownership.
- Safe test identities/data, representative fixtures and permission to exercise failure/replay scenarios.

The simulator implements the same portal-facing canonical contract and relevant failure behaviour, not every CW1 function. If the integration team's API differs from the original eAdapter/XML assumption, implement that difference within the integration adapter and update contract tests. Configuration-only mode selection is valid after compatibility is established, not before.

## 5. Phase 1 detailed sequence

### F1.01 Repository, local environment and pipeline

**Outcome:** a reproducible runnable foundation, not just placeholder folders.

**Work:** establish actual deployed migration history before repairing the schema chain; complete API and SPA entry points, simulator package/configuration, local PostgreSQL setup and pnpm lockfile/toolchain. Establish transaction-bound job enqueue/consume, API health/OpenAPI and CI lint/typecheck/test/build. Align environment names and deployed health paths with code. Use the existing two app boundaries; simulator remains isolated development/test infrastructure.

**Data/contracts:** migration baseline and runtime grants; job/adapter contracts; no speculative business tables solely to fill the roadmap.

**Trace:** FR-SYS-001/002; NFR-REL-003/004; NFR-ARC-001/002/004/006/007; NFR-OPS-003/005.

**Exit evidence:** clean install and migration; API/web/simulator local startup; committed job consumed and rolled-back job absent; CI produces usable artifacts. Scaffold inventory is not proof of this gate.

### F1.02 Identity, staff registration and tenant isolation

**Work:** validate both issuer paths; create eligible staff identity records without roles; controlled first-admin bootstrap; customer identity remains invitation-bound. Implement request-lifetime tenant context, issuer/subject identity, customer hierarchy, user status and internal branch representation. Deliver own-identity endpoint and minimal authenticated/access-pending shell.

**Data/contracts:** CustomerGroup/CustomerAccount/User, identity pointer, audit/analytics foundations, tenant context and RLS; documented minimal own-profile access for unassigned staff, not a broad business exception.

**Trace:** FR-IAM-001/002/004/008/010; FR-ORG-001/004/009; NFR-SEC-001/002/003/005/007.

**Exit evidence:** simultaneous first logins create one unprivileged staff record; ineligible identities denied; customer A cannot access B through API or runtime SQL; parent sees children, child does not see parent/sibling; pooled requests do not inherit prior context.

### F1.03 Portal roles, full module permission catalogue and branch scoping

**Work:** seed approved customer/internal permission sets and assignments; include later-module view/action definitions now. Enforce permissions on protected routes, customer entitlements, restricted/cost access and pricing branch scope. Build the minimum internal staff role/branch assignment path; no role-designer UI and no Azure-group synchronisation.

Include scoped quotation-settings read/change grants and approved claim-release grants in the existing permission framework. These do not grant administrators unrestricted quotation/cost visibility. Exact codes and presets require D-04 approval.

**Data/contracts:** role, permission and assignment relations; permission catalogue and server-provided effective access; branch/cross-branch grants.

**Trace:** FR-IAM-003/009/011; FR-NAV-002/003/005; FR-CFG-001/005 permission foundation; all five future modules' view permissions; NFR-SEC-004/005/006.

**Exit evidence:** route-policy test passes; removed role fails on next request with the same token; staff without branch cannot price; cross-branch access requires permission; future-menu eligibility matrix is approved and seeded.

### F1.04 Design system and complete navigation shell

**Work:** complete app-local Noatum primitives and responsive shell, locale switch, account state and notification entry. Add Track and trace, Documents, Invoices, Bookings and Claims menus controlled by permission and entitlement. Separate availability from permission; implement the approved D-02 unavailable behaviour for direct links as well as menu use.

**Data/contracts:** shell uses effective permissions/release configuration from the existing access model; no future-module business tables or fake dataset required.

**Trace:** FR-NAV-001 through FR-NAV-006; NFR-UX-001 through NFR-UX-006.

**Exit evidence:** every approved role tested in EN/ES and responsive keyboard navigation; entitled users see appropriate future menus; unassigned users see no business menu; no unreleased API calls, sample counts or functioning future workflows. Brand and accessibility checks pass.

### F1.05 CW1 connection, mappings and tenant resolution

**Work:** implement canonical adapter interfaces and Phase 1 quote transport, master-organisation import, message archive, retries, failed-job replay and mapping configuration. Choose real or simulator mode explicitly. Resolve customer ownership from approved organisation links and global party policy; preserve lookup handling for address codes. Add full correlation and failure/latency monitoring.

**Data/contracts:** IntegrationMessage, approved mapping data, MasterOrg and minimal future visibility contracts; shipment visibility is populated when tracking releases. Match concrete tables to the simplification register rather than copying every conceptual entity into a table.

**Trace:** FR-ORG-002/003/005/007; FR-SYS-001 through FR-SYS-006; NFR-PER-006; NFR-REL-002/003/004; NFR-OPS-001/002.

**Exit evidence:** duplicate delivery has one logical result; wrong-owner reply quarantined; unlinked records customer-invisible; authorised replay retains lineage; configured simulator is impossible in production. Real contract verification is gated by D-03, not replaced by stub success.

### F1.06 Customer onboarding and user administration

**Work:** organisation search/linking with justification and agreed approval policy, two-level hierarchy, domains/tier/entitlements, customer activation/suspension, first-admin invitation, colleague invitations, roles, optional office restriction and own audit. Deliver staff role-assignment UI, read-only impersonation and branded invitation/welcome emails. Protect last-admin invariants.

**Data/contracts:** invitations with token hashes, appropriate impersonation record, link metadata and minimal administration DTOs; customer state changes and emails use audited transactional workflows.

**Trace:** remaining FR-IAM and FR-ORG requirements; FR-NAV-002/003; NFR-SEC catalogue; NFR-DAT-001/003; NFR-UX catalogue.

**Exit evidence:** customer onboarded without code change; expired/reused/wrong-email invitation denied; Customer Admin cannot grant internal roles; last-admin concurrency test passes; suspension blocks next request; impersonation cannot write; staff assignment grants only approved access.

### F1.07 Customer quote request and reusable tooling

**Work:** Air/FCL/LCL wizard, autosave, mode validation, dangerous goods, addresses, cargo calculations via API, customer reference selection, saved list views, address/template CRUD and import/export. Submission enters manual pricing; configured CW1 request creation is queued. Implement/stub-test the disabled-by-default instant-rate interface.

**Data/contracts:** canonical quote/version/cargo/branch/origin and lifecycle; address/template data; server calculation endpoints and generated SPA contracts. Preserve quote/booking/shipment distinction without building booking workflows.

Resolve and retain the request's effective quotation-policy revision using the approved D-18 rules; complete the shared settings contract with F1.08. No hard-coded temporary publication/approval default is a substitute for that contract.

**Trace:** FR-QTE-001 through FR-QTE-009; FR-TOL-001/002; FR-BKG-005 foundation; NFR-PER-001/002/003/005; NFR-REL-005.

**Exit evidence:** all modes submit valid requests; draft survives reload; tampered organisation fails; invalid dangerous goods fail; import reports invalid rows; UI calculation matches API; manual path works with no rate engine.

### F1.08 Quotation settings, internal pricing and configured publication

**Entry gate:** OQ-11/12 pricing/cost/approval rules and D-18 configuration scope, precedence, initial values, revision behaviour and direct-offer reconciliation signed. Reconcile UC-12 with governing source rules and record the architecture decision before implementation. The approval decision is configured, not skipped to demonstrate a screen.

**Work:** branch-scoped queue/claim, exclusive editing, full-request popover, multiple pricing options, expiry/force-release, independent approval and immutable history. Deliver Administration > Settings > Quotation settings for publication, initial-request sync, approval, ownership, approved commercial defaults, communication and available customer features. Show scoped effective/inherited values, validation, change confirmation/reason and history. Implement direct customer publication and the retained CW1-confirmed path with idempotent writes/reconciliation; no outage fallback between them. External-team email drafting follows enablement, remains editable and requires human send with template fallback. Implement customer-safe mapping even if cost capture is not enabled.

**Data/contracts:** minimal versioned policy configuration and effective-scope resolution, quote policy references, publication evidence, option/claim/pricing/approval/sync attributes, snapshots and internal flags; generated settings API client and external drafting contract. Reuse suitable configuration/audit storage; do not presume a general-purpose rule engine or new table before design. Distinguish direct publication, CW1 business confirmation and email delivery. Migration/initial-policy assignment for existing requests requires an explicit approved design.

**Trace:** FR-CFG-001 through FR-CFG-008; FR-QTE-010 through FR-QTE-017; NFR-SEC-004/006; NFR-REL-003/004/005; NFR-ARC-005; NFR-UX and NFR-SAF catalogues.

**Exit evidence:** two users cannot hold the same claim; submitter cannot self-approve where approval applies. Both publication modes pass with initial-request sync on/off and applicable approval policies. Direct mode publishes without a priced-offer CW1 job; CW1 mode waits for business confirmation and retries without duplication. Configuration changes cannot auto-publish pending work, remove its approval gate or reinterpret queued jobs. Tests cover scoped permissions/inheritance, concurrent settings saves, recorded revisions, audit, no cost leakage, preserved accepted snapshots and direct-offer collision handling. Disabled/unavailable AI drafting uses a template and never auto-sends. Unreleased CO2/rate-source features cannot be enabled through settings.

### F1.09 Acceptance, PDF and initial product experience

**Work:** accept/reject/version/copy/cancel behaviour, branded quote PDF, customer-safe notifications, persistent dashboard layout with released widgets and news/banner authoring. Future-module navigation stays visible to entitled users, independent of missing widget data.

**Data/contracts:** accepted snapshot/PDF reference, notification/preferences, news validity/scope and user layout. Prefer existing columns/audit history over redundant tables.

**Trace:** FR-QTE-018/019/020; FR-NTF-001; FR-NEW-001; FR-DSH-001; FR-RPT-005; NFR-PER-004; NFR-UX catalogue.

**Exit evidence:** in both publication paths, expired acceptance and ineligible cancellation are denied; accepted option/version/PDF is immutable; rejection retains old versions. Direct-only acceptance/rejection is local without fabricated CW1 references or implicit quote submission; mapped notifications follow D-18. News respects scope/validity; only authorised released widgets load data; normal notification templates remain distinct from human-approved drafted correspondence.

### F1.10 Hardening, operational rehearsal and pilot acceptance

**Work:** complete missing tenant/denial/concurrency evidence, approved load tests, EN/ES and accessibility assessment, security review, backup/restore rehearsal, incident runbooks, real CW1 round trip and second-region configuration rehearsal. Establish production alerts, support owners and pilot metrics baseline.

**Trace:** all P1 FR acceptance criteria and applicable NFRs, especially NFR-SEC-013, NFR-PER, NFR-REL-006, NFR-OPS and NFR-ARC-005/007.

**Exit evidence:** pilot quotes exercise both publication policies: staff price/approve as configured, publish directly without priced-offer CW1 submission or wait for real CW1 confirmation, and the customer accepts/downloads the correct version. Another region/branch resolves approved policy inheritance without code changes; settings scope/history and the full five-module menu/role matrix pass. Product, Operations, Security and Engineering sign off; Cloud confirms restore/monitoring readiness including policy revisions and direct-offer snapshots. Missing real CW1 access leaves that path **simulation/UAT only**; direct publication does not prove full integration or complete Phase 1 acceptance. Any direct-only pilot release requires an explicitly approved bounded release and all its other quality/data prerequisites.

## 6. Phase 2: visibility release

**Entry:** P1 accepted; source messages/master data available; OQ-3/3a/3b visibility policy confirmed; OQ-21/22 event exclusions/document allow-list approved; upload scanning ready before any upload; public security design approved; report definitions and alert thresholds approved.

| Work package | Work and data/contracts | Verification / release gate |
| --- | --- | --- |
| P2.01 Shipment projection and tracking | Shipment family/visibility, source-event mapping, Air/Sea critical paths, search indexes and saved views | Shared-shipment and hierarchy isolation; Grid/Detail/Card/search/export; push/fallback and 3-hour Air compliance metrics |
| P2.02 Documents | Document metadata/private file references, approved types, exclusions, restriction flags and per-shipment ZIP | Unknown/internal/rated types hidden; every ZIP member independently authorised; scan failures block uploads |
| P2.03 Finance | Financial transactions/charge descriptions, addressee resolver and office restriction | Two payers on one shipment cannot see each other's invoices; cross-trade payer and restricted staff tests |
| P2.04 Public tracking | Dedicated minimal public projection, non-disclosing ambiguous-reference handling and abuse controls | No customer/party/document/financial/predictive leakage; bot/rate/WAF tests before exposure |
| P2.05 Standard alerts and dashboard | ETA variance, customs holds, crises/congestion/missing-information triggers, subscriptions and released visibility widgets | Threshold/opt-out/permission tests, source timing recorded, provenance and override behaviour demonstrated |
| P2.06 Standard reports | Approved report definitions, assignment, filters, export and same-customer schedules | Assignment plus finance/tenant checks at query and delivery; revocation before scheduled run blocks output |

**Exit:** authorised pilot customers track, download approved documents and view only their invoices; public data leak tests pass; latency dashboards and runbooks are operational; assigned reports and alerts pass UAT. No predictive model, external carrier enrichment or Power BI is required. The corresponding P1 menus become functional through approved release configuration, not role redesign.

## 7. Phase 3: booking and claims release

**Entry:** P2 tracking/document foundations; booking contract and operational validation rules approved; milestone mappings confirmed; non-CRM claims process signed before claims work; schedule provider agreed before schedule work.

| Work package | Work and data/contracts | Verification / release gate |
| --- | --- | --- |
| P3.01 Quote-linked booking | Separate Booking entity, quote number and commercial snapshot; branch/mode execution validation | Multiple bookings per quote; no conversion call; no one-to-one shipment assumption |
| P3.02 Direct booking and reconciliation | No-quote entry, manual quote/incomplete path, source booking adoption and later shipment links | Both customer journeys work; no rate-source dependency; CW1-originated booking not duplicated |
| P3.03 Documents and execution gates | Scanned document transfer, confirmation state, updates/cancellation using pickup/off-site/Shipped boundaries; booking output | Real CW1 acknowledgement required; change denied at gates even under concurrent milestone update; correct output references |
| P3.04 Non-CRM claims | Only the signed claims data/status/ownership model, submission, comments/history and resolution notifications | Customer-to-approved-handler-to-resolution journey; tenant tests; no Dynamics/Dataverse calls; no unapproved workflow fields |
| P3.05 Advanced communication | Advanced alerts and self-service email rule builder with approved recipient/frequency blocks | Opt-in, recipient-domain and revocation-at-send tests; no internal data leakage |
| P3.06 Sailing schedules, conditional | Approved provider adapter and public/embedded selection with authenticated handover | Real provider fields/rankings validated; public privacy controls; unavailable provider cannot fabricate sailings |

Booking and claims can be separately released within P3. An unresolved claims process must not force a fabricated claims workflow or block an otherwise accepted booking release. Mark P3 as partially delivered until all agreed P3 scope is accepted or explicitly rephased. Apply the same rule to the provider-dependent sailing schedule.

**Exit:** both booking routes complete against CW1, shipment references reconcile when they arrive, and cancellation gates hold. Claims have an approved complete non-CRM operational path. Advanced communication and any approved schedule integration have evidence; otherwise retain explicit open delivery items.

## 8. Phase 4: intelligence and analytics release

**Entry:** reliable P2 data and suitable history; approved external-team API contracts, security/data-sharing terms, service ownership and quality evaluation profiles; non-CRM assistant escalation agreed before use.

| Work package | Scope | Gate |
| --- | --- | --- |
| P4.01 Data augmentation | Deduplication/conflict/gap reconciliation, original/source history and reasoned overrides | Traceable provenance; no discarded original value or tenant boundary bypass |
| P4.02 External intelligence | Predictive ETA/ETD, congestion/disruption and benchmarking through approved APIs | D-11 quality metrics and thresholds approved and met; confidence/delta shown; unavailable AI leaves CW1 data usable |
| P4.03 Self-service reports | Permitted fields/filters/aggregation, personal/shared definitions, export/scheduling | RLS and financial field protection across reports/aggregates/delivery; no Power BI |
| P4.04 External assistant | Tenant-scoped permitted context, guidance and user-confirmed quote/booking initiation, approved support handoff | Isolation/prompt-injection evaluation, least data sharing, explicit action confirmation, approved transcript policy |
| P4.05 Training and platform analytics | Completion tracking, customer/user/feature adoption, queue age/time-to-price/approval and onboarding metrics | Privacy-controlled event-derived metrics reconcile to source; access limited to approved staff |

**Exit:** accepted report/training capabilities and each approved API-dependent feature meet their own evidence gates. No model training, hosting, vector platform or in-house AI email service is included. A missing external API rephases that capability explicitly; it does not justify implementing an owned model.

## 9. Phase 5: ecosystem release

**Entry:** stable canonical/permission foundations, approved OM target and interface, external API consumer/security agreement, additional-source and localisation priorities.

| Work package | Scope | Gate |
| --- | --- | --- |
| P5.01 PO visibility | Customer-gated PO panel/lines/search, OM report links and SSO context handover | Only own PO data visible; no PO lifecycle actions; tenant-safe deep link |
| P5.02 Customer API and feeds | Scoped consumer issuance, quotas, permission management and governed data feeds | Authorised first consumer succeeds; revoked/out-of-scope consumer fails; operational monitoring/support defined |
| P5.03 Additional source | Canonical adapter and mappings for approved TMS/ERP source | Contract/isolation/reconciliation suite passes; source identifiers cannot collide with CW1 |
| P5.04 More languages | Approved business catalogue and locale expansion | Full UI/output localisation and compatibility/AA regression pass |

**Exit:** first approved external consumer/feed and any committed OM/source/locale capabilities accepted. CO2 has its own delivery work package below; it is not implicitly committed to Phase 5.

### 9.1 CO2 calculation: explicit delivery work package

**Placement:** public calculator under standalone applications (FG-9.1), predicted emissions in booking (FG-3.2), and shipment emissions in track and trace (FG-1.4), plus an optional quotation-summary estimate as user-approved conditional future scope (UC-11). These are retained product requirements, not merely an empty model extension. Delivery remains deferred in the governing PRD; Product must assign a phase after OQ-20 is resolved. The older CO2 KB's Phase 4 label is not a current commitment. Phase 1 quotation creation, pricing and acceptance gates remain independent of emissions calculation.

**Entry gate:** Sustainability and Legal approve methodology, calculation/provider approach, factor/distance sources, permitted use and disclaimer. Product approves supported inputs, emission bands and final-result criteria. Engineering/QA agree reference results, numeric tolerances and response-time targets. No specific provider, factor table, local engine or additional Azure service is selected by this plan.

| Sequence | Delivery | Acceptance evidence |
| --- | --- | --- |
| 1. Common calculation capability | Canonical emissions contract behind EmissionsAdapter, versioned provenance and source inputs; external calls follow integration/job rules | NFR-CO2-001 reference cases, unit conversions and multi-leg aggregation pass; no duplicated calculation logic in React |
| 2. Public CO2 calculator | Enter route/mode/weight, display estimated kg CO2e and compare supported transport modes | FR-CO2-001, approved disclaimer, public privacy and abuse-protection checks |
| 3. Booking prediction | Show estimate for current route/cargo without changing the booking's commercial or confirmation rules | FR-CO2-002; input changes refresh/invalidate results; failure does not block booking |
| 4. Shipment emissions | Predicted/final detail, grid column, band filter and recalculation from updated legs | FR-CO2-003; permitted shipment scope, final criteria, provenance and reasoned override tests |
| 5. Conditional quotation estimate | Estimated kg CO2e in quote review/summary after route/mode/cargo completion, with methodology and disclaimer; reuse the common calculation capability | FR-CO2-004; changed inputs invalidate/refresh the estimate; unavailable results do not block submission/pricing or change freight charges; NFR-CO2-001/002 apply |

**Exit:** all four surfaces, when allocated for delivery, use the approved calculation capability, with reproducible reference results, privacy controls, honest labels and human override history. NFR-CO2-001/002 pass. Unreleased conditional quotation estimation remains an explicit future item, not a Phase 1 blocker. The calculator does not claim suitability for audited carbon reporting beyond the approved methodology and legal position.

## 10. Common release control

Each slice must include requirement IDs, acceptance criteria, dependencies/decisions, changed schema/contracts/endpoints/screens and named reviewer before implementation approval. Use existing [agent task/review guidance](../03-Agent-Metaprompt.md), but reconcile stale source assumptions against this approved baseline first.

| Gate | Required evidence |
| --- | --- |
| Scope | Requirements and open decisions agreed; no invented fields/statuses/integrations; absent functionality not described as delivered |
| Data | Reviewed migration/recovery, correct tenant pattern/RLS/indexes and actual applied-history compatibility |
| Contracts | DTO/zod/OpenAPI updated; SPA regenerated; source contract fixtures for integrated capabilities |
| Behaviour | Business-rule tests, state/concurrency checks, positive journeys and each requirement's negative cases |
| Security | Per-endpoint denial, per-entity tenant isolation, public/financial/internal-output checks, dependency/secret checks |
| UX | Design tokens, loading/empty/error/unavailable states, EN/ES, date/currency, keyboard/manual accessibility and responsive review |
| Performance | Applicable signed workload profile and NFR results; source delays and errors not hidden |
| Operations | Audit/analytics, correlation, retries/replay, alerts, restore/runbook updates and named support owners |
| Acceptance | End-to-end demonstration with build/environment/test evidence and Product/Operations sign-off |

Maintain a release evidence register with: release/build, requirement ID, test ID, evidence link, actual result, owner, approval date and any bounded waiver. CI success alone is not business acceptance. Changes to thresholds, permissions, scope or phase assignment require impact analysis and approval; IDs are never reused for different meanings.

### 10.1 Business outcome monitoring

Capture analytics from Phase 1 even where analysis screens arrive later. Establish the email/spreadsheet baseline and a measurement period before attributing improvement to the portal.

| Outcome | PRD target / measurement |
| --- | --- |
| Portal quote adoption | >= 60% of pilot requests submitted through portal; median request-to-priced-quote time and portal/CW1 pricing split tracked |
| User engagement | Weekly active / registered users >= 50%; wizard completion >= 80%; alert opt-in retention >= 80% when alerts release |
| Visibility reliability | Air critical milestone latency compliance >= 95%; linked CW1 quote/booking visibility goal 100%, excluding no records silently |
| Service improvement | Quarterly comparison: tracking inquiries per shipment -40%, document-request tickets -60%, internal handling minutes per quote/booking -50% |
| Customer outcome | NPS >= +30; quote-to-booking conversion and quotation cycle-time tracked against baseline |

These are programme success metrics from PRD section 10, not fabricated performance-test pass criteria. Define denominator, reporting period and accountable owner before reporting results.

## 11. Change history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 10.09.2026 | Proposed five-phase plan retaining full module scope, adding P1 navigation/access and applying simplified infrastructure, portal staff registration and external-service ownership |
