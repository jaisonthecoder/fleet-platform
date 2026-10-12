# Azure DevOps Setup and Repository Structure

| | |
|---|---|
| **Project** | `Noatum-Customer-Platform` |
| **Repository** | `noatum_customer_portal` |
| **Aligned to** | v3 document set (ADR-004 simplifications): one deployable, PostgreSQL only, no Redis, no message broker, no auth code of our own |
| **Written** | 04.09.2026 |

A single Git repo, monorepo, **no Git submodules** — submodules make every clone and CI checkout painful and give nothing here, because all three apps ship together and share types. One repo, pnpm workspaces, path filters in the pipelines.

---

## 1. What to set up in Azure DevOps

**Project**
- One project: `Noatum-Customer-Platform`. Process template Agile (or Basic for a lighter board).
- Visibility private. Enable Repos, Boards, Pipelines, Wiki. Test Plans optional. Artifacts not needed yet.

**Repos**
- One repo: **`noatum_customer_portal`**. Default branch `main`.
- **Branch policies on `main`**: require a pull request; minimum 1 reviewer; build validation (CI pipeline must pass); require linked work items; resolve all comments; limit merge types to squash; automatically included reviewers by path (anyone touching `packages/design-system` or `infra/` gets a named reviewer).
- Branch naming: `feature/S1.05-address-book`, `fix/…` — matching the slice ids so commits, PRs and board items line up.

**Boards**
- One team, one backlog. Epic per phase, Feature per slice (S1.01, S1.02 …), tasks inside. The vertical-slice plan maps one-to-one.

**Pipelines**
- `azure-pipelines-ci.yml` — runs on PR: install, lint, typecheck, unit tests, tenant-isolation tests against a PostgreSQL service container, build all apps. Path filters so a design-system change does not run the whole integration suite.
- `azure-pipelines-cd-api.yml`, `azure-pipelines-cd-web.yml` — deploy on merge to `main`, using **Environments** (`dev`, `test`, `uat`, `prod`) with approval checks on `uat` and `prod`.
- **Service connections**: Azure Resource Manager per subscription, workload identity federation (no stored secrets).
- **Variable groups** linked to Azure Key Vault: database connection strings, Entra client ids and issuers, CargoWise endpoint and credentials. Nothing secret in YAML.
- Migrations run as a pipeline step before the app deploy, with an owner-role connection string — never at app startup.

**Artifacts**
- Only if `design-system` is ever published outside the repo. Inside a monorepo, workspace linking is enough — skip for now.

**Wiki**
- Publish `/docs` as a wiki from the repo ("Publish code as wiki") so the PRD, plans, LLDs and ADRs are readable without cloning.

---

## 2. Repository structure

```
noatum_customer_portal/
├─ pnpm-workspace.yaml
├─ package.json                  # scripts: dev, build, lint, test, e2e, migrate
├─ tsconfig.base.json
├─ .editorconfig  .prettierrc  .eslintrc.cjs
├─ .gitignore  .nvmrc
├─ README.md
├─ CLAUDE.md                     # agent instructions (copy to .github/copilot-instructions.md if Copilot is used)
│
├─ apps/
│  ├─ api/                       # NestJS: REST + in-process jobs (pg-boss). One deployable.
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/          # SQL: enums, RLS policies, functions, DB roles and grants
│  │  ├─ src/
│  │  │  ├─ main.ts  app.module.ts
│  │  │  ├─ common/              # guards, decorators, TenantContext, TenantRepository, filters, logging
│  │  │  ├─ modules/
│  │  │  │  ├─ identity/         # validate Entra token, load user, /me
│  │  │  │  ├─ tenancy/          # customer_group, customer_account, master_org search
│  │  │  │  ├─ authz/            # roles, permissions, PermissionGuard
│  │  │  │  ├─ users/            # users, invitations
│  │  │  │  ├─ quotes/           # + RateEngineAdapter (synchronous, 25 s timeout)
│  │  │  │  ├─ templates/  address-book/  news/  dashboard/
│  │  │  │  ├─ shipments/  documents/  finance/        # Phase 2
│  │  │  │  ├─ bookings/  claims/                      # Phase 3
│  │  │  │  ├─ notifications/  reports/
│  │  │  │  ├─ admin/  audit/  api-management/
│  │  │  │  └─ integration/
│  │  │  │     ├─ cw1/           # XML build and parse, Tms*Adapter implementations
│  │  │  │     ├─ tenant-resolver/
│  │  │  │     ├─ mapping/       # mapping tables
│  │  │  │     └─ jobs/          # pg-boss handlers + registry
│  │  │  └─ config/
│  │  └─ test/                   # e2e, tenant-isolation suite, fixtures
│  │
│  ├─ portal-web/                # React + Vite SPA
│  │  ├─ src/
│  │  │  ├─ main.tsx  App.tsx  router.tsx
│  │  │  ├─ auth/                # MSAL setup (Entra External ID / Entra ID)
│  │  │  ├─ api/                 # generated client and query hooks
│  │  │  ├─ features/
│  │  │  │  ├─ dashboard/  quotes/  templates/  address-book/
│  │  │  │  ├─ tracking/  documents/  invoices/  bookings/  claims/  reports/
│  │  │  │  ├─ admin-customer/   # the customer's own user management
│  │  │  │  └─ admin-noatum/     # customers, accounts, flags, news, impersonation
│  │  │  ├─ components/  hooks/  lib/
│  │  │  └─ i18n/                # en-US.json, es-ES.json
│  │  └─ e2e/                    # Playwright
│  │
│  └─ cw1-simulator/             # fake eAdapter + rate mock (dev and test only)
│     ├─ src/
│     └─ seed/                   # organisations.csv, shipment templates, lanes
│
├─ packages/
│  ├─ design-system/             # tokens.css, fonts, Button, SectionHeading, StatCounter, Input, Select, Tabs, NewsCard, Header, Footer
│  └─ shared-types/              # DTOs, zod schemas, permission constants, enums, chargeableWeight(), TIER_DEFAULT_FLAGS
│
├─ infra/
│  ├─ bicep/                     # or terraform: app service, PostgreSQL, storage, key vault, app insights
│  ├─ docker-compose.yml         # PostgreSQL + simulator only
│  └─ scripts/                   # seed, reset, migrate helpers
│
├─ docs/                         # PRD, design system, plans, LLDs, ADRs, gaps.md, glossary.md
│  └─ adr/
│
└─ .azuredevops/
   ├─ azure-pipelines-ci.yml
   ├─ azure-pipelines-cd-api.yml
   ├─ azure-pipelines-cd-web.yml
   └─ pull_request_template.md   # checklist: isolation test, permission guard, i18n, design tokens, docs
```

---

## 3. Choices worth making explicitly

- **One repo, four workspaces.** `pnpm-workspace.yaml` lists `apps/*` and `packages/*`. No Nx for now; add it only if the build graph gets slow.
- **Modules are folders, not packages.** NestJS modules stay inside `apps/api`. Only what is shared between apps becomes a package — today exactly two.
- **One service, not two.** Job consumers run inside `apps/api`; `WORKER_MODE=split` starts them separately when volume requires it. No message broker, no Redis (ADR-004).
- **Migrations live with the API** and run from the pipeline with an owner-role connection string, while the app connects as a limited role.
- **The simulator ships in the repo but never to production.** Its pipeline stage deploys only to `dev` and `test`, or it runs locally only.
- **`.azuredevops/` holds pipeline YAML**, keeping CI config out of the app folders and making path filters obvious.

---

## 4. Commands

```bash
# once
az extension add --name azure-devops
az login
az devops configure --defaults organization=https://dev.azure.com/<your-org>

# project and repo
az devops project create --name Noatum-Customer-Platform --process Agile --visibility private
az devops configure --defaults project=Noatum-Customer-Platform
az repos create --name noatum_customer_portal

# first push
git init -b main
git remote add origin https://dev.azure.com/<your-org>/Noatum-Customer-Platform/_git/noatum_customer_portal
git add . && git commit -m "S1.01: monorepo scaffolding"
git push -u origin main

# branch policies (after the first push, so main exists)
REPO=$(az repos show --repository noatum_customer_portal --query id -o tsv)
az repos policy approver-count create --repository-id $REPO --branch main \
  --blocking true --enabled true --minimum-approver-count 1 --creator-vote-counts false --reset-on-source-push true
az repos policy work-item-linking create --repository-id $REPO --branch main --blocking true --enabled true
az repos policy comment-required create --repository-id $REPO --branch main --blocking true --enabled true
az repos policy merge-strategy create --repository-id $REPO --branch main \
  --blocking true --enabled true --allow-squash true --allow-no-fast-forward false --allow-rebase false

# build validation policy — after the CI pipeline exists
PIPELINE=$(az pipelines create --name ci --yaml-path /.azuredevops/azure-pipelines-ci.yml \
  --repository noatum_customer_portal --repository-type tfsgit --branch main --skip-first-run true --query id -o tsv)
az repos policy build create --repository-id $REPO --branch main \
  --blocking true --enabled true --build-definition-id $PIPELINE --queue-on-source-update-only true \
  --display-name "CI must pass" --valid-duration 720
```

Two things the CLI does not handle well, and which are quicker in the web interface: the **service connection** (Project settings → Service connections → Azure Resource Manager with workload identity federation) and **approval checks on environments** (Pipelines → Environments → `uat` / `prod` → Approvals and checks).
