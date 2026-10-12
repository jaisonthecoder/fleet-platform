# Azure and Azure DevOps inspection

Date: 14.09.2026. Evidence: signed-in Azure CLI reads and current workspace inspection. This is a deployment-readiness assessment, not deployment approval or production certification. No application tests, lint, typechecks or builds were run for this assessment.

## Executive decision

Publish the existing monorepo to the existing private Azure Repos repository, preserving its app boundaries. Do not split the API, UI and simulator into new repositories or enable the existing CD definitions unchanged. The cloud service already has a container configured; its provenance is not established by its name.

Before deployment, establish dedicated portal authentication registrations, an approved hosting topology, backing services and an authorized deployment identity. Do not repurpose the Quality Radar registrations or infer portal privileges from their groups/app roles.

## Account and access

| Item | Observed |
| --- | --- |
| Signed-in user | jaison.joseph@adports.ae (Jaison Joseph) |
| Corporate tenant | 3b618463-9352-4fa4-a67c-112da2837c29 |
| Current subscription | subs-adports-prod, 0a249c66-024e-4317-987f-edb5c27bd6dc |
| Portal resource group | az-adapp-noatum-customer-portal-np-rg |
| Effective resource-group actions | `*/read`; no effective data actions returned |
| Additional visible tenant | 7f0d429b-5a0c-4226-b3b0-19d343a9ae00; identity-only account context, not proof of Entra External ID configuration |

Subscription metadata was read for six accessible subscriptions. Matching Noatum resources were found in `subs-adports-prod`; the resource group name indicates nonproduction, despite the subscription name. Resource names alone do not establish approved environment classification.

`az webapp show` attempted a publishing-profile action and was denied; ordinary ARM resource reads succeeded. App-setting enumeration was also denied (`Microsoft.Web/sites/config/list/action`). Settings, secret presence, deployed connection strings, and actual database connectivity therefore remain unverified. No credential grants or account elevation were attempted. The original subscription context was restored after inspecting the second tenant.

## Azure DevOps

Organization: https://dev.azure.com/abudhabiports

Project and repository: `noatum-customer-portal` (private).

Repository URL: https://dev.azure.com/abudhabiports/noatum-customer-portal/_git/noatum-customer-portal

| Object | State before publication |
| --- | --- |
| Project ID | 796af44a-999d-489c-a35f-9d1caa190641 |
| Repository ID | 906e345b-e8c3-4914-b98a-64c6cfb69a25 |
| Repository | Existing, enabled, size 0, no refs or default branch |
| Pipelines | None |
| Repository policies | None |
| Variable groups | None |
| Deployment environments | None |
| Service connection | `sc-noatum-customar-stg`, dockerregistry, ServicePrincipal scheme, marked ready |

The registry connection is not an Azure Resource Manager deployment connection. Its readiness flag does not prove successful registry access. Its backing registration is `abudhabiports-noatum-customer-portal-a12a7ee9-60d5-4012-9679-28ed23efabb6`, app ID `be5f365b-cad8-40d8-a6f5-a59e75b0f332`. It has no SPA redirect or exposed API scope and is not the portal's browser authentication registration.

Local publishing preserves `apps/noatum-customer-portal-api`, `apps/noatum-customer-portal-ui`, `apps/cw1-simulator`, `docs`, `infra`, and `.azuredevops` in one repository. The existing ignore rules exclude environment files, credentials, dependencies, build/test output, `REFERENCE`, and the SPA generated API directory. Those files stay local; a clone needs environment setup and API client generation. Do not force-add ignored configuration to make a clone run.

## Hosting inventory

| Item | Observed |
| --- | --- |
| App Service | az-adapp-noatum-customer-portal |
| Location | UAE North |
| State | Running; application health not tested |
| Host | az-adapp-noatum-customer-portal-hmeghdevaea7ggau.uaenorth-01.azurewebsites.net |
| Plan | ASP-noatum-customer-portal, Linux Standard S2, capacity 1, one site, no zone redundancy |
| Runtime | sitecontainers |
| Main container | adpgappnpuaencr.azurecr.io/new_noatum_api:staging |
| Container port | 80 |
| Image authentication mode | UserCredentials; credentials were not read |
| HTTPS only / minimum TLS | true / 1.2 |
| Public network | Enabled |
| Managed identity | None |
| Always On | false |
| Health-check path | Not configured |

The resource group contains only the App Service and its plan. No PostgreSQL, storage, Key Vault, Application Insights or Communication Services resource is present there. Other shared services exist in the subscription, but no approved assignment, connectivity or access to them was established. Do not claim backing services are globally absent or assume another project's resources are available to this portal.

For the in-process pg-boss worker, enable Always On through an approved deployment change. Align the container listener port, configure `/api/health/ready`, and explicitly initialize the queue schema. Local API defaults to port 3000; the current cloud port 80 requires matching packaging/configuration, not an assumption. Preserve the existing image until ownership and replacement approval are clear.

## Authentication: important mismatch

Local environment values were read only for public identity IDs, authorities, scope names and development flags. Passwords, tokens and connection values were not printed.

| Local use | Actual registration in Azure |
| --- | --- |
| API `272ad497-0dd0-43a7-bc71-b92e94da1e47` | `quality-radar-api`, corporate single-tenant, access token v2, `api://272ad497-0dd0-43a7-bc71-b92e94da1e47/user_impersonation` scope |
| Staff SPA `54c18b22-8eb3-4d08-9805-e0cdd896c7f7` | `quality-radar-ui`, corporate single-tenant, localhost:5173 plus Quality Radar/Atlas redirect URIs; SecurityGroup claims and unrelated Graph permissions/app roles |
| Customer SPA configuration | Missing locally |
| Development API authentication | `DEV_AUTH_ENABLED=true` locally; production configuration rejects this mode |

These registrations belong to another application. Their existing API scope and localhost redirect explain the local configuration, but do not make them appropriate production portal identities. Do not alter them to remove group claims or add portal callbacks: doing so could affect Quality Radar. Create dedicated registrations after approval, with minimal delegated API scope and exact portal redirects. Portal roles remain database-owned.

Project-name searches in both accessible tenants found older Powerview registrations, but they have no usable SPA redirect/API-scope pair for this SPA. They are not proof of a configured customer External ID tenant. The current API verifier accepts one configured tenant/audience; multi-issuer customer authentication requires aligned code/configuration.

The separately requested production non-corporate-SSO administrator remains a design requirement. No new provider, production password endpoint, admin credentials or bypass was configured in this inspection. A development act-as login is not a production bootstrap solution.

## Local deployment gaps

1. **Hosting mismatch:** the current API CD performs file/ZIP-style App Service deployment; UI CD uploads to Blob static hosting. Neither builds this workspace into the configured sitecontainers image. There is no implemented Dockerfile/Bicep deployment for that target.
2. **Toolchain mismatch:** root uses pnpm 12.3.4; pipeline pins retain pnpm 9.12.3 and Node 22.11.0. Installed manifest/lockfile requirements need newer Node 22.x patch versions (including 22.12+ for Prisma/Vite and 22.13+ for ESLint). Choose one supported Node release and matching pnpm before CI.
3. **API packaging/migrations:** current staging copies dist/prisma/package.json but not all required runtime dependency/generated-client/config artifacts. Deployment invokes Prisma 5 against a Prisma 7 codebase whose datasource URL comes from prisma.config.ts. Do not run this migration step on Azure.
4. **Generated SPA client:** ignored generated types and runtime form modules are required by source imports. CI does not generate them before compilation. Required order is Prisma generation, API OpenAPI generation, then SPA client/form generation.
5. **Environment names:** current deploy YAML does not match API `ENTRA_API_CLIENT_ID`/`ENTRA_API_AUDIENCE` or SPA audience-specific client/authority/scope variables. Configure `NODE_ENV=production`, disable dev auth, explicit CORS/portal URL, database runtime/owner credentials, CW1 source and optional email settings through approved configuration.
6. **Rate source:** configuration still requires a rate URL although no rate source is approved. Production must not point it at the simulator or claim automatic pricing. Resolve the configuration boundary before enabling quotes.
7. **Routing and health:** SPA fallback for `/portal/*` and login callbacks is not provided by the current deployment definitions. Actual API probes are `/api/health` and `/api/health/ready`, not the stale pipeline probe.
8. **CI/CD wiring:** pipeline names/resource targets/service connections and variable groups are placeholders. CI references a Postgres service without a matching container resource and skips missing OpenAPI output rather than enforcing it. CD is not established as a gated successor of CI. No Azure Repos build-validation branch policy exists.

Source references: [CI](../../.azuredevops/azure-pipelines-ci.yml), [API CD](../../.azuredevops/azure-pipelines-cd-api.yml), [API deploy template](../../.azuredevops/templates/deploy-api-stage.yml), [web deploy template](../../.azuredevops/templates/deploy-web-stage.yml), [API config](../../apps/noatum-customer-portal-api/src/config/env.validation.ts), [SPA sign-in](../../apps/noatum-customer-portal-ui/src/auth/sign-in.ts), [Prisma config](../../apps/noatum-customer-portal-api/prisma.config.ts), [root manifest](../../package.json).

## Ordered next steps

1. Finish source publication to the existing private repository. Do not enable deployment on the initial push.
2. Confirm staging hosting: use the existing container App Service for the API, and approved static hosting for the SPA, or explicitly approve combined hosting with routing/reverse-proxy packaging. Confirm whether the existing staging image may be replaced.
3. Have the Azure owner provide appropriately scoped deployment permissions and an ARM workload-identity service connection. Keep the registry connection separate; no shared long-lived credentials in source.
4. Provision or formally allocate PostgreSQL, Blob storage, Key Vault, monitoring and required networking; prepare queue initialization and controlled migrations.
5. Establish dedicated staff SPA/API registrations and customer identity configuration. Resolve production non-SSO admin authentication with the identity owner; seed only the explicitly designated bootstrap identity. No Entra group role mapping.
6. Align pipeline tooling, generated contracts, artifacts, configuration and health checks. Add deployment environments and protected-main policies with named reviewers.
7. Run the user-scheduled validation and a staging business walkthrough before approving production deployment. Existing local demonstrations are not Azure release evidence.

## Evidence limits and publication hygiene

A narrow pre-publication credential check ran against 524 inventoried first-party text files. It flagged two credential-like database URLs: the ignored local API environment file and an isolated localhost CI PostgreSQL fixture. The environment file was confirmed ignored by Git; the CI fixture is not a cloud credential. Four other candidates were suppressed by the scanner. No Git history existed before this task; binary files and excluded files are outside the text scanner's coverage. This does not prove all files secret-free or constitute a full application security audit.

Only inventory and the secrets engine were used for publication hygiene. SAST, SCA/CVE analysis, IaC security scanning, DAST, container-image scanning and compliance scoring were not run. The script is not Checkmarx software or a certified Checkmarx scan and does not replace a security review. No live vulnerability testing was performed.

No cloud resources, app registrations, permissions, service connections or deployments were changed. App settings and actual deployment/runtime health could not be verified with the available read access. The report deliberately separates confirmed configuration, implementation gaps and proposed changes.
