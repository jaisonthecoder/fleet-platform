# Azure Resource Request — Fleet Management Platform

**For: Azure Administrator / Cloud Governance Team**
**Project:** Group Fleet Management Platform — Phase 1 (GS Pool, Mina Zayed pilot)
**Requested by:** Fleet Platform Development Team (D&T)
**Region: UAE North (Dubai) — mandatory, per AD Ports Data Hosting & Residency Policy**
**Environments:** `dev`, `test`, `prod` (same resource set; smaller SKUs in dev/test)
**Suggested naming convention:** `fleet-{env}-{resource}` (e.g. `fleet-prod-psql`, `fleet-dev-redis`)

---

## 1. Summary of the Request

| Category | Resources | Count |
|---|---|---|
| Governance | Resource groups, budgets/alerts | 3 RGs + budgets |
| Compute | Container Apps Environment, Container Registry, Container Apps Job | 1 + 1 + 1 per env |
| Data | PostgreSQL Flexible Server, Redis, Blob Storage ×2 | 4 per env |
| Messaging | Service Bus, Event Hubs | 2 per env |
| IoT / Simulation | IoT Hub, Device Provisioning Service | 2 per env (dev may share) |
| AI | Azure AI Document Intelligence | 1 per env (dev/test may share) |
| Identity & Security | Entra app registrations, security groups, conditional access, Key Vault, managed identities | see §5 |
| Networking / Edge | Front Door + WAF (prod), VNet + private endpoints (prod) | prod-focused |
| Observability | Log Analytics, Application Insights | 1 + 1 per env |
| Ops | Azure Maps, Azure Load Testing, IaC state storage | 3 |

Estimated Phase 1 monthly run cost (prod, indicative only): the dominant items are PostgreSQL HA (~40%), Container Apps dedicated workload profile, Redis Standard, and Front Door. Dev/test together typically run at 25–35% of prod. A detailed cost sheet can be produced once SKUs are confirmed.

---

## 2. Governance

| # | Item | Detail | Notes for admin |
|---|---|---|---|
| 1 | Resource groups ×3 | `fleet-dev-rg`, `fleet-test-rg`, `fleet-prod-rg`, all in UAE North | RBAC: dev team = Contributor on dev/test; **prod = pipeline-only** (deployment via OIDC service principal, humans Reader + PIM elevation) |
| 2 | Budgets & cost alerts | Budget per RG with alerts at 70/90/100% | Send to platform team DL |
| 3 | Azure Policy | Enforce: allowed region = UAE North; require tags (`project=fleet`, `env`, `owner`); deny public blob access | Aligns with group cloud governance |

## 3. Compute

| # | Resource | SKU / Config (prod) | SKU (dev/test) | Purpose & notes |
|---|---|---|---|---|
| 4 | **Azure Container Apps Environment** | 1 environment; Consumption profile + **Dedicated D4 workload profile**; zone redundancy ON; internal ingress to VNet | Consumption only | Hosts 4 apps: `api`, `pdp`, `telematics-ingest`, `ocr-worker`. Scale rules: api/pdp on HTTP concurrency; ingest on **Event Hubs consumer lag (KEDA)**. **Quota check: ≥20 vCPU regional quota for Container Apps in UAE North** |
| 5 | **Azure Container Registry** | Standard (Premium if geo-replication ever needed) | Basic | Private images for the 4 apps. Enable admin-user OFF; pull via managed identity (AcrPull) |
| 6 | **Container Apps Job** | Manual/scheduled trigger, 0.5–1 vCPU | same | Runs the **simulated device fleet** (50+ MQTT clients) on demand for demos/tests; also usable for migration batch jobs |

## 4. Data

| # | Resource | SKU / Config (prod) | SKU (dev/test) | Purpose & notes |
|---|---|---|---|---|
| 7 | **Azure Database for PostgreSQL — Flexible Server** | General Purpose **D4ds_v5**, 256 GB, **zone-redundant HA**, PITR backups 14–35 days, PgBouncer enabled | Burstable B2ms, 64 GB, no HA | The transactional core + telemetry. **CRITICAL admin actions:** add **`timescaledb`** and **`pgcrypto`** to the `azure.extensions` server parameter allowlist; enable `pg_stat_statements`. Private endpoint in prod. One database per organization (reusable project, not multi-tenant — no row-level tenancy). A dormant `organization_id` column exists in the schema but RLS stays OFF; do not enable it. |
| 8 | **Azure Cache for Redis** | **Standard C1** (1 GB, replicated) | Basic C0 | PDP/eligibility decision cache, BullMQ job queues, Socket.IO scale-out adapter. Non-persistent use — cache tier is sufficient |
| 9 | **Storage Account A — documents** | StorageV2, **ZRS**, private endpoint, soft delete 30d | LRS | Containers: `vehicle-docs`, `photos`, `signatures`, `ocr-inbox` (lifecycle rule: purge raw OCR uploads after parse + 30d) |
| 10 | **Storage Account B — compliance** | StorageV2, ZRS, **version-level immutability (WORM) enabled** | LRS, WORM enabled | Containers: `consent-records` (**time-based retention lock — legal to confirm duration, ref decision D7/D4**), `eventhub-checkpoints`, `tfstate` (see §9). WORM is the technical guarantee behind "consent records are immutable" |

## 5. Identity & Security

| # | Item | Detail | Notes for admin |
|---|---|---|---|
| 11 | **Entra app registration — SPA** | Single-page app, redirect URIs per env, PKCE | Scope access to API app below |
| 12 | **Entra app registration — API** | Expose scopes (`Fleet.User`, `Fleet.Admin`), accept v2 tokens | **Admin consent required** for the organization |
| 13 | **Entra security groups** | One per platform role: FleetManager, ClusterFleetLead, GroupFleetLead, Approver, ClusterCEO, Finance, HR, InsuranceLead, HSE, InternalAudit, Executive, DataSteward, SystemAdmin | Group claims emitted in tokens; app maps groups→roles internally (SoD is enforced in-app, not in Entra) |
| 14 | **Conditional Access policy** | **MFA required** for elevated-role groups (FleetManager and above, SystemAdmin, Finance, HR) | NFR-SEC-01 |
| 15 | **Azure Key Vault** | Standard, RBAC mode, purge protection ON, private endpoint (prod) | Secrets: Postgres conn, Maps key, Doc Intelligence key, webhook signing keys. Access ONLY via managed identities |
| 16 | **Managed identities** | System-assigned per container app (4) + job (1) | Grants: AcrPull (ACR), Key Vault Secrets User, Event Hubs Data Receiver/Sender, Service Bus Data Owner (scoped), Blob Data Contributor (scoped per container). **No connection strings in app config** |

## 6. Messaging

| # | Resource | SKU / Config (prod) | SKU (dev/test) | Purpose & notes |
|---|---|---|---|---|
| 17 | **Azure Service Bus** | **Standard** (review Premium if sustained >1k msg/s later) | Standard | Namespace with topics: `domain-events` (subscriptions per consumer: telematics-domain, notifications, audit). Dead-lettering ON. Carries: TripEnded, DeviceSilent, BookingConfirmed, FineRecorded, DocumentParsed |
| 18 | **Azure Event Hubs** | **Standard**, 1 TU with **auto-inflate to 4**, hub `telemetry` with **4 partitions**, 3–7 day retention, consumer group `ingest` | Standard 1 TU, 2 partitions | Telemetry ingress buffer between source (simulator / IoT Hub) and `telematics-ingest`. **Quota check: TU availability in UAE North.** Checkpoints in Storage Account B |

## 7. IoT & Simulation (Phase 1 uses a simulator — no physical devices; this rehearses the real device path)

| # | Resource | SKU / Config | Purpose & notes |
|---|---|---|---|
| 19 | **Azure IoT Hub** | **S1, 1 unit** (prod-path); **F1 free tier acceptable for dev** | Per-device identity, MQTT endpoint, device twins. `telematics-ingest` consumes its **built-in Event Hubs-compatible endpoint** — identical consumer code to #18. Sized: 50 simulated devices @ 1 msg/30s ≈ 144k msg/day, within S1's 400k/day |
| 20 | **IoT Hub Device Provisioning Service (DPS)** | S1, linked to IoT Hub, one **enrolment group** (symmetric key for simulation; X.509 when real TDRA-approved trackers arrive in Phase 2) | Zero-touch enrolment rehearsal so Phase-2 hardware onboarding is a practiced motion |
| 21 | ~~Azure IoT Central~~ | **Do NOT provision** | Microsoft has announced IoT Central's retirement; IoT Hub is the supported path |

## 8. AI, Maps, Observability, Edge

| # | Resource | SKU / Config (prod) | Purpose & notes |
|---|---|---|---|
| 22 | **Azure AI Document Intelligence** | **S0** (pay-as-you-go); dev/test may share one instance | OCR: Phase 1 = compliance-document field extraction (Mulkiya/insurance numbers + expiries, human-confirmed); Phase 2 = fuel-invoice parsing. **Admin: confirm UAE North availability; if unavailable in-region, flag to Cybersecurity for residency-tier decision before provisioning elsewhere** |
| 23 | **Azure Maps** | Gen2, S1 pricing tier | Map tiles for the live fleet map (MapLibre client) + **Route Directions API** used by the simulator to drive vehicles along real roads |
| 24 | **Log Analytics Workspace** | PAYG, 30d retention (dev) / 90d (prod) | Central logs for all apps + platform diagnostics |
| 25 | **Application Insights** | Workspace-based, linked to #24 | OpenTelemetry target; custom metric: **event-loop lag p99** per app, with alert rule on `api` > 10ms |
| 26 | **Azure Front Door + WAF** | Standard tier, WAF policy (OWASP managed rules, prevention mode), custom domain + managed TLS | Prod only (skip dev/test). Routes to Container Apps ingress |
| 27 | **VNet + Private Endpoints** (prod) | 1 VNet; private endpoints for Postgres, Redis, both Storage accounts, Key Vault, ACR; Container Apps env VNet-integrated | Removes public data-plane exposure in prod. Dev/test may use public endpoints + firewall rules to reduce cost |
| 28 | **Azure Load Testing** | PAYG | Runs the formal go-live load test (telemetry burst + booking concurrency with hard pass/fail thresholds) as a repeatable, scheduled resource |

## 9. DevOps

| # | Item | Detail | Notes |
|---|---|---|---|
| 29 | **OIDC federated credentials** | Entra app registration for GitHub Actions (or Azure DevOps) with federated credential per environment; role assignments scoped per RG | **No stored cloud secrets in CI.** Prod deploy credential grants only what the pipeline needs |
| 30 | **IaC state** | `tfstate` container in Storage Account B (or Bicep — no state needed) | State locked & versioned |

---

## 10. Admin Checklist (the things most often missed)

1. ☐ **`timescaledb` + `pgcrypto` added to Postgres `azure.extensions` allowlist** (the platform's telemetry storage does not work without this)
2. ☐ **WORM/immutability policy enabled** on the consent container (retention duration from Legal)
3. ☐ **Container Apps regional vCPU quota ≥ 20** confirmed in UAE North
4. ☐ **Event Hubs TU quota** confirmed in UAE North
5. ☐ **Document Intelligence UAE North availability** confirmed (else escalate to Cybersecurity for residency decision)
6. ☐ **Admin consent granted** on the API app registration
7. ☐ **Conditional Access MFA policy** applied to elevated-role groups
8. ☐ **No IoT Central** — IoT Hub + DPS only
9. ☐ Managed-identity role assignments completed (no connection strings issued to the team)
10. ☐ Budgets + cost alerts active on all three RGs

## 11. Access the Development Team Needs Back

- Resource IDs / endpoints for: Postgres, Redis, both Storage accounts, Service Bus, Event Hubs, IoT Hub, DPS ID scope, Key Vault URI, ACR login server, Maps client ID, Document Intelligence endpoint, App Insights connection string
- Contributor on `fleet-dev-rg` and `fleet-test-rg` for the dev team
- Reader + PIM-eligible elevation on `fleet-prod-rg`
- Confirmation of the OIDC federated credential (client ID + organization ID) for CI/CD

---

*Questions on any line item: Fleet Platform Development Team (D&T). Architecture context: see `08_Development_Approach_and_Implementation_Plan.md` §13–§15 and the `fleet_platform_architecture.drawio` diagram.*
