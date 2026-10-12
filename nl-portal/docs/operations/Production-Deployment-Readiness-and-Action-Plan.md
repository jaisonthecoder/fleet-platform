# Production deployment readiness and action plan

Date: 14.09.2026. Status: assessment and proposed implementation plan, not authorization to provision or deploy.

Evidence: [Azure CLI inspection](Azure-and-DevOps-Inspection-2026-09-14.md), current package/configuration/pipeline files, [Azure prerequisites](04-Azure-Team-Request-Checklist.md), and [Phase 1 release gates](../plans/implementation-plans/phase%201%20-%20phases/12-Hardening-UAT-and-Pilot-Release.md). Cloud findings reuse the earlier 14.09.2026 inspection; they were not refreshed for this report. Local files were read again. No tests, lint, builds, cloud mutations or deployments were run.

## 1. Executive conclusion

**Source publication is complete. Production deployment readiness is not.** A running App Service and a populated repository do not establish a deployable release, usable production identity, database recovery, or accepted business functionality.

- The private Azure repository contains the initial monorepo import, commit `a3dab2dc1f9c559d4b6fc0dcaeb13b6dce815672`, with 537 files on main at publication. The current local branch is `dev`, tracking `origin/dev`; the earlier inspection report has local modifications. Those changes were preserved. Branch policies were absent at the earlier inspection; subsequent changes are not inferred.
- The existing portal App Service already references a staging image of unconfirmed provenance. Do not replace it just because its name matches this project.
- Your effective Azure permission on the portal resource group was `*/read`. Git push succeeded; infrastructure write permission, app registration creation permission, consent rights and DevOps administration rights are separate and must not be assumed.
- Local authentication points to shared Quality Radar registrations. Dedicated portal registrations are required before a production identity configuration is accepted.
- The current deployment YAML does not match the container host, actual configuration names or installed toolchain.
- No database, storage, Key Vault, monitoring or email resource was found inside the portal resource group. Shared resources elsewhere may be usable only after ownership, access and network connectivity are confirmed.

**Recommendation:** prepare one staging deployment package and infrastructure plan now; obtain the named owners' decisions/access in parallel; deploy staging only after explicit approval. Production follows user-scheduled verification and business/operations sign-off. Do not enable the existing four-environment CD chain unchanged.

## 2. What exists and what it proves

| Area | Observed state | Limitation |
| --- | --- | --- |
| Azure Repos | Private noatum-customer-portal monorepo published; initial local/remote SHA matched | Not a clean-checkout build or release |
| Local project | API, UI, PostgreSQL workflow, simulator and business source | Local fixtures/dev login are not production evidence |
| App Service | az-adapp-noatum-customer-portal, Linux, UAE North, Running | Endpoint health and application version not established |
| Plan | Standard S2, one instance, no zone redundancy | No measured capacity, availability or recovery evidence |
| Container | ACR new_noatum_api:staging, port 80, UserCredentials mode | Not traced to the published commit; credentials not inspected |
| HTTPS | HTTPS-only and TLS 1.2 configured | Domains, routing, full security configuration remain to be checked |
| Jobs hosting | Always On false; no health-check path | Must be corrected for dependable in-process workers |
| DevOps integration | sc-noatum-customar-stg registry service connection marked ready | No successful push/pull proof or ARM deployment connection |
| DevOps release controls | No pipelines, variable groups, environments or repo policies at inspection | YAML files alone do not configure approvals or branch validation |
| Azure identity | Corporate and second tenant app metadata readable | Second tenant is not confirmed to be the customer External ID tenant |

## 3. Pending work and responsibility

Priority: P0 blocks a controlled staging deployment; P1 blocks production acceptance; Conditional applies when the corresponding released feature or organizational policy requires it.

| ID | Priority | Pending work | What I can do | Required owner/input |
| --- | --- | --- | --- | --- |
| DEP-01 | P0 | Confirm API/SPA hosting and existing image ownership | Prepare topology and packaging changes after choice | Cloud owner approves target, replacement and environment classification |
| DEP-02 | P0 | Align Node/pnpm/toolchain | Pin a supported common runtime and pnpm version across manifests, image and YAML | Engineering approves runtime; checks scheduled by user |
| DEP-03 | P0 | Build complete API container and migration artifact | Add multi-stage Dockerfile, dockerignore, exact dependencies/Prisma artifacts, startup and non-root execution where supported | ACR repository naming and agent push rights |
| DEP-04 | P0 | Build and host SPA with deep-link fallback | Generate contracts, build environment-specific assets, configure /portal/* and login fallback without masking API 404s | Approved frontend host, URLs and cache policy |
| DEP-05 | P0 | Replace placeholder pipeline wiring | Implement real targets, artifact flow, conditions, generation and migration steps | Connection/group/environment names and authorized agent pool |
| DEP-06 | P0 | Deployment identities and registry access | Prepare federated service-connection and RBAC instructions/templates | Azure/DevOps admins authorize principals and scoped assignments |
| DEP-07 | P0 | PostgreSQL deployment and access | Prepare configuration/IaC, migration/queue initialization scripts and runbook | DB owner selects server allocation, network, sizing, backup and access |
| DEP-08 | P0 | Dedicated staff SPA/API registrations | Prepare exact redirect/scope/issuer manifest and app changes; create only after approval and confirmed Graph rights | Identity team controls registrations, consent and designated staff test identities |
| DEP-09 | P0 | Production bootstrap administrator design | Implement approved identity binding and audited provisioning path | Approve non-corporate-SSO provider/local-account policy, MFA and recovery owner |
| DEP-10 | P0 | Safe production settings and secrets | Align settings contract, template names and fail-closed production checks | Cloud/Integration supply values through Key Vault or secure pipeline settings |
| DEP-11 | P0 | Runtime health, workers and port alignment | Prepare Always On, probe, port, graceful shutdown and queue configuration | Cloud owner authorizes App Service changes |
| DEP-12 | P1 | Customer identity and invitations | Complete provider/API/UI integration for approved customer sign-in and acceptance | Customer identity tenant/flows, email service and account policies |
| DEP-13 | P1 | Private document/PDF storage | Implement storage interface/configuration and scoped access using existing architecture | Cloud owner provisions storage and permissions; retention owner approves lifecycle |
| DEP-14 | P1 | Email delivery | Complete invitation/notification integration and safe retries; remove placeholder-only behavior | Verified sending domain, DNS records, quotas and email-service access |
| DEP-15 | P1 | Real CW1 integration and data contracts | Align adapters/jobs/import behavior to approved contracts; retain manual quote baseline | Integration team supplies endpoints, credentials, network route, samples and acknowledgements |
| DEP-16 | P1 | Monitoring and operational support | Instrument requests/jobs and define dashboards, alerts and runbooks | Operations owns alert recipients, thresholds, support hours and incident escalation |
| DEP-17 | P1 | Promotion and rollback | Implement immutable versioned artifacts, migrations, deployment approvals and rollback steps | Release owners approve promotion policy and recovery criteria |
| DEP-18 | P1 | Production workload/cost/recovery targets | Prepare parameterized sizing and cost inputs | Product/Cloud approve traffic, storage, RPO/RTO, retention and budget |
| DEP-19 | P1 | Release evidence | Prepare focused tests and traceability; execute only when instructed | User schedules checks; Product/Security/Operations accept evidence |
| DEP-20 | Conditional | Upload malware checks and public endpoint protections | Integrate approved scanning/WAF/rate/bot controls for applicable surfaces | Security defines policy and approved service; public tools remain unavailable until ready |

No additional Redis, Service Bus, CRM, Power BI or model hosting is proposed. The simulator remains development/test-only. Optional future features must not inflate staging scope.

## 4. Recommended Azure arrangement

Recommended, not yet approved: retain Linux App Service for the API and its in-process pg-boss workers; host the Vite SPA separately on approved static hosting supporting HTTPS and deep links. Use ACR for immutable API images, PostgreSQL Flexible Server for application/queue data, private Blob storage for files, Key Vault for secrets, and Application Insights/Log Analytics for telemetry.

Choose the frontend service before writing service-specific deployment code. Azure Static Web Apps or the organization's approved static hosting can be evaluated. Blob static hosting alone needs additional routing/custom-domain HTTPS arrangements; the existing upload-to-$web YAML is not sufficient evidence. Combined API/UI hosting is an alternative, but needs explicit reverse-proxy/static-serving and cache/fallback design. Do not provision both alternatives by default.

UAT and production need separate credentials, databases, private files, identity configuration and approvals. They must not reuse a developer's Docker database, demo accounts, localhost redirects or development authorization flags. Decide whether separate App Service plans/resources are needed for the approved isolation and availability targets. Do not automatically create four full environments because old YAML lists four.

The existing resource group includes `np` while its subscription is named `subs-adports-prod`; the Cloud owner must classify it explicitly before production placement. Choose App Service versus Container Apps once; there is no demonstrated need to add a second hosting platform now.

## 5. Identity and first-administrator decisions

Authentication and application authorization remain separate:

1. Staff authenticate through dedicated corporate portal registrations; groups and identity-provider app roles do not grant portal business permissions.
2. The portal database owns role presets, user assignments, customer visibility and branch restrictions. Each protected request reloads/enforces effective access.
3. The first administrator is designated and provisioned through an audited operator process, not whoever logs in first. The role must not silently return after an administrator revokes it because a bootstrap setting runs on every login.
4. Your production non-corporate-SSO admin request remains explicit. Approve a provider-managed local identity/MFA/recovery design independent of corporate federation, or formally approve a different architecture. Keycloak was proposed earlier but not approved or provisioned; it is not an existing dependency. Provider outage and corporate-tenant outage requirements must be distinguished.
5. Dedicated customer identity configuration and invitation acceptance are separate from staff registration. The currently single-tenant verifier must not accept arbitrary issuers to make customers work.

I can prepare registrations and implement the approved contracts, but cannot assert Graph write/consent permissions from Azure resource-group read access. No passwords, client secrets, access tokens or PATs should be sent through chat. Operators enter them only through approved secure channels. The local development bypass must fail closed in every deployed environment, including UAT.

## 6. Concrete repository work I can prepare now

These are code/configuration deliverables, not cloud deployment permission. This report does not start their implementation.

| Package | Files/area | Implementation approach | Completion evidence, when authorized |
| --- | --- | --- | --- |
| A: reproducible tooling | package manifests, .nvmrc, .azuredevops/templates/setup-node-pnpm.yml | Use one supported Node line/patch and matching pnpm 12.3.4; retain a frozen lockfile | Fresh checkout installs and generates outputs |
| B: build artifacts | API Dockerfile/dockerignore, build YAML, SPA generation pipeline | Include runtime deps, compiled API, Prisma 7 client/config/migrations; exclude env files and simulator from production images; generate UI OpenAPI/types/form from the same contract | Container starts; UI assets and routes load with no local files |
| C: configuration | API validation, deployment templates, safe variable-name examples | Match current ENTRA_API_* and audience-specific VITE_* keys; production requires explicit URLs/origins; absent rate source remains unconfigured | Invalid production config rejected; correct environment boots |
| D: deployment scripts | .azuredevops API/web deployment templates | Use digest-tagged images and exact commit/artifacts, initialize queue schema with migration privileges, deploy with runtime privileges, gates before promotion | Staging promotion and rollback rehearsal |
| E: infrastructure plan | infra/bicep and environment parameter templates | Parameterize approved topology and shared resource IDs; no hard-coded secrets or automatic production creation | Owner-reviewed resource diff and access/network plan |
| F: operational handoff | docs/process runbooks and release checklist | Bootstrap/recovery, backup restore, failed-job handling, rotations, logs/alerts and evidence ledger | Named owners execute and accept a rehearsal |

Generated SPA source is Git-ignored today. The solution is a reliable generation step, not committing ignored secrets or making CI depend on this workstation. The old CI accepts a missing dist/openapi.json; change that to a required actual output. Existing migration history must be retained: do not edit applied migrations, reset production data or replay development seed scripts.

I can also configure DevOps definitions/environments/policies after explicit approval if the account has the specific administration permission. Proven Git push access is not proof of pipeline, policy or service-connection administration. Queueing a pipeline that runs tests is verification execution and remains user-scheduled.

## 7. Azure/IT handoff: exact information required

| Team | Required response |
| --- | --- |
| Cloud | Confirm staging/production subscription and RG, region/data residency, existing App Service image owner, permission to replace image, API/SPA host choice, desired public/private access and budget owner |
| Azure/DevOps admins | Provision federated ARM connection with target-scoped deployment rights; approve ACR push for pipeline and pull for app identity; authorize pipeline resources and agent pool |
| Database | Allocate PostgreSQL; provide private hostname/route, runtime versus migration access, TLS requirements, connection limits, backups/PITR/HA choice and recovery targets |
| Network/DNS | Portal/API names, certificate responsibility, frontend-to-API access, outbound CW1/identity/email routes, private DNS and migration-agent connectivity |
| Identity | Dedicated staff SPA/API IDs and scope consent, exact redirect URIs, customer tenant/flows, named bootstrap identity, decision on non-SSO admin authentication and recovery |
| Integration | Real CW1 endpoints, source-instance identity, supported organisation export/message contracts, expected volume/frequency and staging credentials delivered securely |
| Email/storage | Approved private file account/container, retention rules, verified email sender/domain and delivery limits |
| Product/Operations/Security | Released Phase 1 boundary, pilot users, expected workload, RPO/RTO/retention, approvers, support contacts and verification window |

Use least privilege at the appropriate scopes. A resource-management role alone does not grant Key Vault secret access, Blob data access, registry repository access or the ability to create role assignments. Have the authorized access administrator grant those separately. Registry permissions depend on its RBAC/ABAC mode; select the correct repository-scoped role rather than assuming a universal role name. Private databases require a reachable runner; Git-hosted agents do not automatically reach a private VNet.

## 8. Remaining application release blockers

Azure deployment work cannot substitute for unfinished business behavior. The recent project checkpoint records customer onboarding/import progress, but full Phase 1 pricing/publication/customer-response acceptance is not established.

- Customer invitation acceptance/revocation and usable first-admin/customer login must work end to end; previously recorded links returning 404 cannot be accepted as an email-only configuration problem. Reinspect current code before implementing because other sessions may have advanced it.
- Organisation import still has recorded concerns: external fetch inline from HTTP rather than a job, absent scheduled enqueue, reconciliation of missing child addresses/registrations and multiple counter writers. Resolve only current confirmed defects in the released scope.
- Manual quotations, branch-scoped pricing/claims, independent approval, both publication modes, immutable acceptance/PDF and customer notifications need complete business evidence for a full Phase 1 release.
- Direct publication policy versus older governing documents needs the approved reconciliation. No configured rate source must not be replaced with fabricated prices or a production simulator.
- Production startup must validate exact issuer/audience, deny dev auth and control staff eligibility/bootstrap; public customer lists and selectable privileged demo sessions cannot ship.

These are blockers or unverified checkpoints, not a claim that every named feature is wholly absent today. A limited staging demo may intentionally exclude unfinished functionality through server-enforced release controls. A bounded pilot requires explicit scope approval and is not full Phase 1 completion.

## 9. Delivery sequence and stopping conditions

| Wave | Deliverable | Can proceed now? | Stop before |
| --- | --- | --- | --- |
| 1 | Agree staging topology; prepare tooling, artifacts, configuration and infrastructure templates | Repository preparation can begin on approval; no cloud write needed | Claiming successful builds or deployment without execution |
| 2 | Establish scoped deployment identity, networking, backing resources and dedicated login registrations | Azure/IT/Identity action required; repository work can proceed in parallel | Reusing Quality Radar, existing unknown image or another project's data without approval |
| 3 | Deploy exact published artifacts to staging; migrate/init queues; configure domains and identity | Only with target ownership, credentials/access and deployment authorization | Production traffic or a development auth bypass |
| 4 | Run scheduled technical checks and business UAT; exercise failures, restore, roles and tenant isolation | Only in the user-approved verification window | Reporting passed checks that did not run |
| 5 | Promote approved release to production with named approval, rollback criteria and support | Only after production environment and acceptance gates | Auto-deploying main through the stale current CD chain |

For parallel work: one agent can own API packaging/configuration, another SPA deployment/generation, a third cloud templates/runbooks, and an independent reviewer can inspect their outputs against requirements. I coordinate shared manifests, pipeline orchestration and promotion. No simultaneous edits to the same file and no autonomous resource creation or check execution by delegates.

## 10. Verification and release acceptance

At your scheduled verification time, evidence must cover reproducible build/generation; migration upgrade and rollback compatibility; actual container startup/readiness; authenticated API/UI paths; tenant isolation and permission removal; invitation/bootstrap safety; browser accessibility/EN-ES; real CW1 acknowledgements for full Phase 1; queue retry/recovery; restricted document/cost output; security assessment; load under approved workload; backup restore; and alert delivery.

Production promotion requires named Product, Engineering, Cloud, Identity/Security and Operations acceptance for their areas. A green CI pipeline alone is insufficient. Conversely, preparing tests/runbooks is not a reason to pause approved business implementation while the user has deferred checks. Track implemented, configured, verified and accepted separately.

No fixed completion date or monthly price can be responsibly given before topology, workload, region/service allocation, availability and access turnaround are agreed. Cost inputs include App Service instances/slots, PostgreSQL compute/storage/HA/backups, static hosting/egress, ACR, private networking/DNS, secrets operations, log ingestion/retention and email volume. I can produce a costed estimate after those inputs; the existing S2 plan is not a verified whole-solution budget.

## 11. Changes made for this report

Created this report only. Preserved the locally modified earlier inspection and the current dev branch. No cloud resources, app registrations, role assignments, pipelines, secrets, application source or database data changed. No commit or push performed for this report. No tests, lint, typecheck, formatter, build, browser checks or live cloud rescan were executed.
