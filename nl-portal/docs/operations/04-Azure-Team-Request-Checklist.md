# Azure Prerequisites

| Area | Request to Azure / IT team |
| --- | --- |
| Azure environment | Subscription, resource groups, approved region and access for Dev, Test, UAT and Production, provisioned as needed. |
| API hosting | Keep Linux App Service and Azure Container Apps as alternative options; select one later. Support background jobs even when no users are online. |
| Container registry | Azure Container Registry (ACR) to store container images, with deployment push/pull access. |
| Frontend hosting | Approved HTTPS hosting for the React portal, with support for opening and refreshing page links directly. |
| Database | Azure Database for PostgreSQL Flexible Server, with secure application access and backups. |
| File storage | Private Azure Blob Storage for documents and generated PDFs. |
| Secrets | Azure Key Vault and managed identities for secure access to services. |
| Customer identity | Entra External ID setup, approved invitation/account creation flow, app registrations, sign-in/MFA configuration and test accounts. |
| Staff identity | Corporate Entra sign-in, app registrations and test accounts. Business roles will be assigned in the portal, not through Azure groups. |
| Network and domains | Required network/firewall access, portal/API domain names and HTTPS certificates. |
| Integration access | Connectivity to the integration team's CW1 endpoint and approved external AI APIs when needed. |
| Email | Approved email service and verified sending domain for invitations and notifications. |
| Monitoring | Application Insights or approved monitoring, logs and failure alerts. |
| Deployment | Azure DevOps service connections and permissions to build and deploy the application. |
| Recovery and support | Backup/restore arrangements, recovery targets and support contacts before production. |
| Upload security | Malware scanning for customer-uploaded documents before the upload feature goes live. |
| Public-page security | WAF, rate limiting and bot protection before public tools go live, or earlier if required by policy. |
| Cost and readiness | Estimated monthly costs, responsible owners and expected setup dates. |

Not requested now: Redis, Service Bus/RabbitMQ, CRM, Power BI or AI model hosting.

**The background job queue requires no Azure resource.** It is a library inside the API that
keeps its tables in a `pgboss` schema within the PostgreSQL server already requested above.
The only operational obligation is a one-time schema initialisation per environment, run
alongside the database migrations — the application is configured not to create or alter it at
runtime. Decision, triggers for revisiting and reversal cost: [ADR-008](../adr/ADR-008-background-work-queue.md).
