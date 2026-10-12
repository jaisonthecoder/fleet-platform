# Noatum customer platform requirements baseline

| Document control | Value |
| --- | --- |
| Baseline ID | NCP-BASELINE-2026-09 |
| Version / date | 1.1 / 10.09.2026 |
| Status | Draft for review and formal approval |
| Prepared for | Noatum Logistics Customer Information Platform stakeholders |
| Business owner | Sponsor / Product Owner; named approvers to be assigned |
| Scope | Complete functional requirements, cross-cutting NFRs and phase-by-phase delivery plan |

## 1. Read this set

**Pilot identity update, 15.09.2026 (UC-13):** external customers and the controlled first local Portal Admin will use portal-managed authentication rather than Entra External ID/Keycloak. Staff SSO remains supported. See [ADR-006](../adr/ADR-006-pilot-portal-managed-authentication.md) and the [detailed phased plan](Implementation%20plans/Pilot-Portal-Authentication-Implementation-Plan.md). Implementation and security/release acceptance remain pending.

| Document | Purpose |
| --- | --- |
| [01-Functional-Requirements.md](01-Functional-Requirements.md) | Full product scope across FG-1 through FG-10; 115 uniquely identified requirements, including eight admin quotation-policy requirements and public, conditional quotation, booking and shipment CO2; Phase 1 module/role visibility matrix |
| [02-Non-Functional-Requirements.md](02-Non-Functional-Requirements.md) | 58 measurable quality requirements, including CO2 calculation accuracy, provenance and privacy controls; approved source targets distinguished from proposed measurement conventions |
| [03-Phased-Delivery-Plan.md](03-Phased-Delivery-Plan.md) | Five delivery phases, ten detailed Phase 1 stages, data/contract considerations, prerequisites, dependencies and acceptance gates |
| [04-Azure-Team-Request-Checklist.md](04-Azure-Team-Request-Checklist.md) | Simple Azure Prerequisites table covering services, identity and both API hosting alternatives |
| [06-Freight-Forwarding-and-Quotation-Research.md](06-Freight-Forwarding-and-Quotation-Research.md) | Sourced operations/quotation research, proposed mode-specific field counts, conditional data, commercial checks and recommendations; not an approved FR extension |
| [07-Internal-Quotation-Pricing-Workflow.md](07-Internal-Quotation-Pricing-Workflow.md) | Staff queue, full request, multiple options, approval, admin settings and configured direct/CW1-confirmed publication; UC-12 amendment |
| [11-CW1-Data-Contracts-and-Standards-Research.md](11-CW1-Data-Contracts-and-Standards-Research.md) | CW1 field inventory, public historical XML evidence, global freight-data standards, synthetic samples and integration-team acceptance checklist; research only, not an approved current CW1 contract |
| This index | Baseline authority, user-agreed changes, source register, unresolved decisions, glossary and approval/change procedure |

These are new working specifications in the user-requested folder. Despite the folder name, they are **not original business-intake records**. Existing source documents, meeting records and archived intake remain unchanged. No application code, infrastructure or database schema is implemented by this documentation set.

## 2. Standards and document quality

The set uses an **ISO/IEC/IEEE 29148:2018-style** requirements specification structure: purpose, scope, stakeholders, interfaces, constraints, identifiable requirements, verification criteria, traceability and change control. The NFR coverage follows the **ISO/IEC 25010:2023** product-quality model. **ISO/IEC 25023:2016** informs measurement practice. **WCAG 2.1 AA** is the inherited accessibility requirement. An approved **OWASP ASVS** profile can support application-security verification, and **ISO/IEC 27001:2022** can inform organisational control review.

This is standards-aligned project documentation, not a certificate, formal compliance assessment or reproduction of the standards. A global standard does not prescribe this project's workload, recovery time, retention periods, business roles or claims lifecycle. Those must be approved by the responsible owners rather than fabricated.

Requirements use normative **shall**, stable IDs and acceptance criteria. Unknowns are decision gates. Source-backed limits and proposed measurement details are distinguished. Delivery phase is separate from business priority and implementation status. Test evidence must reference requirements; a document row is never evidence that the software already works.

## 3. Authority and approved direction

The [PRD v4.0](../PRD-Noatum-Customer-Platform.md) and [repository rules](../../CLAUDE.md) remain governing sources. This set consolidates them with the user's explicit changes below. Those changes are authorised direction for this draft. Newly proposed UX, operational targets and unresolved business rules still need formal stakeholder approval. Other documents are not silently superseded; reconcile their conflicting sections and record architectural decisions before implementing affected slices.

### 3.1 User clarifications of 10.09.2026 (source alias UC)

| ID | Confirmed direction | Effect on this baseline |
| --- | --- | --- |
| UC-01 | Simplify infrastructure; no Service Bus, Redis or related unnecessary components | PostgreSQL-backed jobs within one backend; no extra broker/cache/runtime as a kickoff dependency. Re-confirmed 17.09.2026 — [ADR-008](../adr/ADR-008-background-work-queue.md) records the evidence, the reversal triggers and the reversal cost |
| UC-02 | No CRM integration for now | Claims remain required; the non-CRM workflow/system of record must be agreed; no Dynamics/Dataverse implementation scheduled |
| UC-03 | Manage application roles/permissions in the portal database, not Azure groups | Entra authenticates; portal assignments authorise; cloud infrastructure RBAC is still required |
| UC-04 | Internal first login creates a portal user record; an administrator assigns roles afterward | Eligible staff register without business access; controlled first-admin bootstrap; customer invitation-only access remains unchanged |
| UC-05 | No Power BI dashboards for now | Native portal dashboards, standard reports and later self-service reporting remain required; no embedded Power BI dependency |
| UC-06 | This team does not build AI models; another team supplies API endpoints | External-service contracts, data controls, human confirmation and fallback remain; no model development/training/hosting or owned AI email service |
| UC-07 | Support a configurable real integration-team CW1 endpoint and simulator | Compatible canonical contracts and explicit environment selection; simulator only in development/test, never production fallback |
| UC-08 | Tracking, documents, invoices, claims and bookings are required modules, with implementation in different phases | Phase 1 includes all five menu definitions, access permissions, role assignment and authorised visibility; functionality follows the phased plan |
| UC-09 | Create complete FR, NFR and phase-by-phase plan in the attached folder using global-standard structure | Requirements/documentation set created; formal content baseline review still required |
| UC-10 | Keep App Service and Azure Container Apps as optional hosting alternatives and prepare an Azure team request | No runtime selected yet; assess both and provision only the approved option. ACR stores container images for either runtime; it does not run the API |
| UC-11 | Retain quotation CO2 estimation as an optional enhancement in conditional future scope | Show estimated kg CO2e in quote review/summary after route/mode/cargo completion, using the common emissions service after OQ-20 and phase approval; independent of pricing, never a Phase 1 or submission blocker |
| UC-12 | Make quotation business policies administrator-configurable through a settings page, including publication directly to the customer without priced-offer CW1 submission or after CW1 confirmation | P1 Administration > Settings > Quotation settings; independent initial-request sync and internal approval; ownership, commercial defaults, communication and feature settings with scoped permissions, inheritance, audit and recorded policy revisions. Mandatory protections remain fixed; exact configuration and later CW1 handover rules are gated by D-18 |

### 3.2 Source conflicts handled explicitly

**UC-13 - 15.09.2026:** user approved portal API/PostgreSQL customer authentication for pilot launch, plus the previously requested non-SSO bootstrap administrator. Maintained libraries provide credentials, MFA, recovery and opaque sessions. ADR-006 supersedes ADR-004 decision 4 and older no-portal-owned-credentials wording only for this scope. Portal authorization, invitation-only customer access, staff SSO, no custom cryptography and user-scheduled verification remain. PA-01 tracks reconciliation of remaining older document references; archived evidence is unchanged.

| Older assumption | Current treatment | Source to reconcile before implementation |
| --- | --- | --- |
| All staff require an invitation; unknown staff always denied | Eligible first-login staff get an unprivileged DB identity, then portal-admin assignment; external customers still invited | PRD 4a.1/2; identity/onboarding designs and LLD |
| Phase 1 excludes later modules entirely and has no later-module screens | P1 navigation/access catalogue required; no working future-module business screens yet; unavailable-state UX D-02 | Existing kickoff scope section and slice plans |
| One feature flag both hides a menu and controls whether code is released | Customer entitlement and role permission determine eligibility; release readiness separately prevents unfinished actions | PRD 4a.4/FG-1.7 plus new shell design |
| Claims and assistant escalation depend on Dynamics 365 | CRM excluded; required service outcomes retained behind an explicit process decision | PRD FG-5/FG-4.6, integration assumptions and P3/P4 roadmap |
| Analytics means embedded Power BI | Portal dashboard/reporting continues; Power BI excluded until explicitly reinstated | PRD FG-7.3 and P4 stack/roadmap |
| This team develops predictive/assistant models | Approved other-team APIs only; rules-based ETA variance still developed in portal | PRD AI stack and P4 implementation detail |
| Shared-types/design-system packages; frontend imports server calculation helper | API-local contracts, generated SPA client, app-local design system; server calculation endpoint | Older kickoff/simplification/LLD examples; ROOT wins |
| Real eAdapter is guaranteed and endpoint substitution alone always suffices | Actual team API/ack/auth contract must be confirmed and adapted; then explicit mode selection | PRD integration transport assumption; simulator LLD |
| Rate source available as branch readiness | No configured rate source; people price quotations; instant interface is retained/stub-tested only | Older onboarding examples; PRD v4 override wins |
| Every portal price must reach CW1 before customer publication | UC-12 introduces administrator-configured direct publication alongside the existing CW1-confirmed path. Direct offers retain portal commercial snapshots and are not falsely labelled CW1-confirmed | PRD FG-3.3/integration/model; CLAUDE.md and mirrored copilot rules; internal pricing design and slice plans; reconcile and record ADR before implementation |
| Approval always uses one fixed threshold policy | Approval enablement and approved threshold/currency rules are configured independently of publication; different-person approval remains mandatory when required | PRD FG-3.3; internal pricing design; D-12/D-18 |

The source-reconciliation work is scoped to implementation prerequisites, not a blanket rewrite of historical documents. Preserve meeting evidence and archived intake unchanged. ADRs are required for architectural changes; this draft is not a substitute for that approval.

## 4. Scope and delivery vocabulary

| Term | Meaning |
| --- | --- |
| Required module | Remains part of the application even when its business workflows are delivered later |
| Phase 1 shell/access | Menu catalogue, effective permissions, role assignment, entitlement and controlled availability behaviour |
| Functional release | Real screens/actions, server validation, data access, external integration and verified acceptance criteria |
| Entitlement | Whether a customer is allowed a capability; distinct from a user's permission and code readiness |
| Permission | A server-enforced allowed action from portal-database assignments; no role-name or Azure-group shortcut |
| Release readiness | Whether the capability has been implemented, accepted and enabled for use; not a business permission |
| Conditional | Required capability whose delivery depends on a named approval or external service; not silently dropped |
| Deferred | Outside committed delivery until formally reinstated; CO2 behaviour is explicitly catalogued, but its delivery phase remains pending OQ-20 and approval |
| Excluded implementation | Technology/integration explicitly not included, such as CRM or Power BI; does not necessarily exclude the underlying business outcome |
| P1-P5 | Delivery phases in this set; not the PRD's P0/P1/P2/P3 priority labels |

All non-deferred/non-conditional requirements are required at their allocated release. For conditional items, no affected feature can claim acceptance while its gate remains unresolved. A phase can release an accepted subset, but its unfulfilled agreed scope remains recorded as partial or formally rephased.

## 5. Decision and dependency register

Owner titles below are accountable roles to be assigned to named people. Existing OQ IDs are retained, not renumbered. A decision must record the chosen rule/target, evidence, approver and date, then update affected FR/NFR acceptance criteria before implementation. An unresolved decision is not an approved default unless an interim rule is explicitly stated.

| ID | Decision / required evidence | Owner | Gate / interim rule |
| --- | --- | --- | --- |
| D-01 | Staff eligibility, handling of corporate guests, trusted issuer/subject binding and controlled first-admin bootstrap | Identity + Security + Product | F1.02; register eligible staff without roles; do not treat every corporate-tenant identity as eligible |
| D-02 | Unreleased-module UX: disabled navigation versus controlled unavailable page; exact EN/ES wording and keyboard behaviour | Product + UX | F1.04; authorised future menus required, no fake data or functional actions |
| D-03 | Real CW1 endpoint/message/auth contract, transport versus business acknowledgement, source-instance namespace, party-role policy and org/address lookup | Integration + CW1 + Operations | F1.05 real connection; OQ-2/2a/3/3a/3b; unresolved ownership fails closed; simulator evidence not production acceptance |
| D-04 | Exact internal module-view/action grants, finance/restricted/cost grants and cross-branch permissions; preset permission-code reconciliation | Product + Operations + Finance + Security | F1.03; no automatic all-module entitlement for staff or Platform Admin; full permission catalogue required now |
| D-05 | Non-CRM claims system of record, handler ownership, mode/station assignment, lifecycle, comments, attachments, resolution expectations and assistant escalation | Product + Claims Operations | Before P3 claims implementation; OQ-23; P1 menu/access proceeds; no invented local case-management engine |
| D-06 | Data residency, legal basis/notices, retention by class, legal hold/erasure process, backup retention and RPO/RTO | Legal + Security + Business + Cloud | Before real personal data/pilot as applicable; OQ-16; raw-message 13-month baseline retained subject to approved legal policy |
| D-07 | Performance percentile, users/concurrency/RPS, dataset distribution, event rate/burst, duration, client/network, service sizing and backlog recovery objective | Engineering + QA + Product + Cloud | F1.10 and each module load gate; p95 proposed, not inherited; numeric PRD budgets retained |
| D-08 | Security test/control profile, TLS minimum, network/WAF, rate limits, upload-related security integration, vulnerability release policy, monitoring thresholds/support hours and availability measurement/exclusions | Security + Cloud + Service owner | Before relevant exposure and F1.10; 99.5% initial availability, 99.9% later target retained; no unapproved numerical limits |
| D-09 | File type/size limits, malware scanner, scan-failure handling, retention/access for uploads and large import/export resource limits | Operations + Security + Engineering | Before first upload/import release; malware/unknown scan result fails closed |
| D-10 | Supported browser/device/output matrix, timezone/rounding policy, EN/ES catalogue ownership and final brand assets/status extension | Product + Finance + QA + Brand | F1.04 onwards; OQ-17/18/19; DD.MM.YYYY and currency code are fixed; no invented multi-currency conversion rule |
| D-11 | External AI endpoint contract, permitted data, service owner/availability, privacy terms, evaluation dataset/accuracy/safety thresholds and non-CRM escalation integration | External AI team + Product + Security | OQ-25 for drafting; template fallback in P1; before each P4 API-dependent feature; no owned model substitute |
| D-12 | Pricing adoption/non-goal sign-off, whether costs/margins are captured, approval policies, thresholds and currency interpretation | Sponsor + Head of Pricing + Finance | F1.08; OQ-11/12 and UC-12; no self-approval when approval is required, publication outside recorded policy or cost leakage; direct mode does not require CW1 confirmation |
| D-13 | Organisation-link second-person approval, invitation domain exceptions, tier defaults and carrier disclosure | Sponsor + Commercial + Product | F1.06/F1.07; OQ-9/10/13/14; audited link confirmation and internal-only domain exceptions are interim baseline, not an invented approval inbox |
| D-14 | Event critical-path mappings/exclusions, document allow-list, alert thresholds/missing-ETA handling and approved report calculations/fields | Operations + Digital Products + Finance | P2; OQ-7/21/22; events exclude-list, documents allow-list, invoices addressee-only are fixed |
| D-15 | Schedule provider, OM interface, future language/source priorities and CO2 methodology/provider/disclaimer and delivery-phase approval | Commercial + IT + OM + Product + Sustainability/Legal | OQ-8/15/17/20; P3 schedule conditional, P5 OM/source gated; public, conditional quotation, booking and shipment CO2 requirements retained explicitly under FR-CO2-001 through FR-CO2-004, delivery phase pending |
| D-16 | Pilot customer/region/branch, new-versus-existing CW1 rollout sequence and future MDM hierarchy source | Sponsor + Operations + MDM | OQ-24/26; before pilot configuration; manual portal hierarchy and multi-region capability remain baseline |
| D-17 | Select App Service or Azure Container Apps, container deployment/ACR configuration and SPA hosting after comparing background execution, networking, security, operational support and cost | Cloud + Engineering + Security + Sponsor | Before runtime provisioning; both API options remain open, not both required. Record the architecture decision before deployment changes; do not scale the current in-process worker to zero |
| D-18 | Quotation setting-to-scope matrix, inheritance/override precedence, valid ranges/initial values, multi-branch customer resolution, in-flight re-evaluation, option/version publication and later CW1 handover/collisions | Product + Pricing + Finance + Security + Integration/CW1 | F1.03 permissions; F1.08 settings/publication; UC-12 authorises both modes and the admin page, not arbitrary defaults. Record effective policies; no automatic bypass, queued-job reinterpretation or retroactive publication. Confirm direct-only acceptance/rejection and later booking linkage; reconcile governing sources/ADR before coding |

## 6. Source register

| Source | Use and precedence |
| --- | --- |
| [PRD-Noatum-Customer-Platform.md](../PRD-Noatum-Customer-Platform.md) | PRD v4.0, governing feature groups, NFR budgets and OQ register; user overrides identified above |
| [CLAUDE.md](../../CLAUDE.md) | Repository-specific architecture/implementation rules, including no shared packages and server-owned calculations |
| [Project-Kickoff-and-Phase1-Plan.md](../Project-Kickoff-and-Phase1-Plan.md) | Ten-stage sequence and original later-phase dependencies, adapted here for UC |
| [01-Vertical-Slice-Implementation-Plan.md](../01-Vertical-Slice-Implementation-Plan.md) | Existing slice detail; reconcile v4/user changes before using older examples |
| [Implementation-Plan-Noatum-Customer-Platform.md](../Implementation-Plan-Noatum-Customer-Platform.md) | Architecture/phase context, subordinate to PRD and ROOT overrides |
| [Simplification-Register.md](../Simplification-Register.md) | Avoid unnecessary runtimes/tables/admin machinery; stale shared-package examples do not override ROOT |
| [Identity-and-Access-Design.md](../design/Identity-and-Access-Design.md) | Entra boundary and customer access design; staff provisioning revised by UC |
| [Customer-Onboarding-and-User-Management.md](../design/Customer-Onboarding-and-User-Management.md) | Onboarding actors and organisation linking |
| [Organisation-Management-and-Customer-Onboarding.md](../lld/Organisation-Management-and-Customer-Onboarding.md) | Detailed tenancy/invitation/schema/test design; reconcile with new baseline before migration work |
| [Internal-Quote-Pricing-in-Portal.md](../design/Internal-Quote-Pricing-in-Portal.md) | Claim/approval/CW1 authority and pricing history |
| [KB-CW1-Integration-Multi-Tenant.md](../KB-CW1-Integration-Multi-Tenant.md) | Inbound tenant resolution and visibility protection |
| [CW1-Simulator.md](../lld/CW1-Simulator.md) | Development/test transport fixture baseline, subject to actual integration-team API |
| [ADR-001-database-migrations.md](../adr/ADR-001-database-migrations.md) | Controlled SQL migrations/recovery |
| [ADR-002-frontend-framework.md](../adr/ADR-002-frontend-framework.md) | Vite SPA decision |
| [ADR-003-tenancy-controls.md](../adr/ADR-003-tenancy-controls.md) | Tenant isolation and linking controls |
| [ADR-004-phase1-simplifications.md](../adr/ADR-004-phase1-simplifications.md) | PostgreSQL jobs, no Redis/broker, one backend |
| [noatum-designsystem.md](../noatum-designsystem.md) | Existing brand/design-system authority, not a redesign |
| [KT minutes](../meetings/2026-09-09-MoM-KT-CargoWise-Process-Flow.md) and [KT Q&A](../meetings/2026-09-09-QA-KT-CargoWise-Process-Flow.md) | Evidence for PRD v4 business rules; do not rewrite historical records |
| [gaps.md](../gaps.md) | Proposals and omissions; not automatic scope approval |
| UC-01 through UC-12 above | User's simplification, phased-module, alternative-hosting, conditional quotation-emissions and administrator-configured quotation-policy requirements from the working discussion on 10.09.2026 |

## 7. Glossary

| Term | Definition in this baseline |
| --- | --- |
| CW1 | CargoWise One, the primary transport/operational system of record |
| Canonical model | Portal-owned data shape independent of a specific source transport or CW1 message layout |
| Adapter | Integration implementation translating an external contract to/from canonical shapes |
| CustomerGroup | Portal tenant and manual parent/child grouping boundary |
| CustomerAccount | Deliberate link from a customer group to a CW1 organisation, not an individual address |
| ShipmentVisibility | Link granting shared shipment visibility to authorised customer groups |
| RLS | PostgreSQL row-level security, an independent data-layer tenant control |
| Entra / MSAL / PKCE | Microsoft-managed identity and SPA sign-in components; the portal does not own passwords/MFA/session logic |
| Quote / booking / shipment | Distinct commercial request, booking and execution entities; quote-number linkage is not conversion |
| Business confirmation | Evidence CW1 has accepted/persisted the business operation, not merely an HTTP/message receipt |
| pg-boss / failed jobs | PostgreSQL-backed jobs with retry and failed-job inspection/replay; no separate message broker |
| RPO / RTO | Maximum approved recoverable data-loss interval / time to restore required service |
| Provenance | Source, version and applicable confidence plus preserved original and reasoned override history |
| FR / NFR / UAT | Functional requirement / non-functional requirement / user acceptance testing |

See the wider [project glossary](../glossary.md) for freight terminology.

## 8. Approval and change control

| Approval area | Required reviewer | Approval status |
| --- | --- | --- |
| Business scope, phase allocation and permission matrix | Sponsor / Product Owner / Operations / Finance | Pending |
| Staff identity and portal access boundary | Identity / Security | Pending |
| Architecture, contracts, migration and test strategy | Engineering / Integration / Database | Pending |
| NFR targets, load profile, availability, recovery and support | Engineering / Cloud / Service owner / QA | Pending |
| Privacy, retention, external data sharing | Legal / Security | Pending |
| Brand, EN/ES, navigation availability and accessibility | Product / Brand / UX / QA | Pending |

Approval process: resolve blockers for the next slice, record approver/date/version, update the relevant requirement and its test criteria, then baseline that version. Track implementation and acceptance separately. When changing scope, record the request, reason, affected IDs, dependencies, data/privacy/security impact, migration/UI/test impact and approval. Retire IDs with a replacement reference instead of reusing them. No source requirement may disappear solely because its integration is excluded.

Before coding an affected slice, update conflicting working specifications/ADRs through their own approved change. Keep historical intake and minutes unchanged. The creation of these documents does not authorise cloud provisioning, production changes or the implementation of every phase.

## 9. Change history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 10.09.2026 | Initial standards-aligned requirements set and phased plan, consolidating PRD v4.0 and the user's simplification/module-access decisions |
| 1.1 | 10.09.2026 | UC-12 quotation settings/direct-publication amendment, eight FR-CFG requirements, workflow index and D-18/source-reconciliation gates |
