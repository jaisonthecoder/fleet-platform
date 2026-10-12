# Noatum Customer Portal

`noatum-customer-portal` is the parent repository for the Noatum customer portal.
Each app lives in its own Git repository and is attached here as a **submodule**, so the
pnpm workspace still sees them at `apps/*`.

## Layout

| Workspace | Path | Repository | What it is |
| --- | --- | --- | --- |
| `noatum-customer-portal-api` | `apps/noatum-customer-portal-api` | `noatum-customer-portal-api` | NestJS REST API + in-process jobs (pg-boss) |
| `noatum-customer-portal-ui` | `apps/noatum-customer-portal-ui` | `noatum-customer-portal-ui` | React + Vite SPA, including its design system |
| — | `infra` | `noatum-customer-portal-infra` | Docker Compose, Bicep and local database scripts |
| — | `docs` | `noatum-customer-portal-wiki` | Product documentation, published from `dev` as the project code wiki `noatum-customer-portal-wiki` |

The parent holds the workspace definition, the lockfile and the pipeline definitions.
Each submodule tracks its own `dev` branch.

Package names match their app folder names. Build filters, pipeline artifacts and
active repository references use these names. Existing Azure resource names, service
connections, API routes and historical intake archives are unchanged.

**The two apps share no code.** They are independently runnable, independently deployable,
and each is self-contained — its own tsconfig, eslint and prettier config. Lift either
folder out of this repo and it still builds. They talk over HTTP: the SPA generates its
client from the OpenAPI document the API publishes.

The design system lives **inside** `apps/noatum-customer-portal-ui/src/design-system`, imported as
`@/design-system`. It is the only place a raw colour, font or radius may appear.

## Prerequisites

- Node `22.11.0` (see `.nvmrc`)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.3 --activate`)
- Docker Desktop (Postgres for local development)

## Getting started

Clone the parent **with its submodules**. A plain `git clone` leaves `apps/*` empty and
nothing will install:

```bash
git clone --recurse-submodules <parent repo url>

# already cloned without the flag?
git submodule update --init --recursive
```

```bash
pnpm install
pnpm db:setup         # Docker Postgres, migrations, runtime login, Prisma, pg-boss
pnpm dev              # api :43000, web :45173
```

### Working with the submodules

Each `apps/*` directory is a full checkout of its own repository on branch `dev`. Commit
and push inside it as normal. The parent records **which commit** of each app it expects,
so after pushing a child you must also commit the moved pointer in the parent:

```bash
cd apps/noatum-customer-portal-ui
git add -A && git commit -m "..." && git push

cd ../..
git add apps/noatum-customer-portal-ui
git commit -m "chore: bump ui submodule"
git push
```

To pull everyone else's app changes, `git submodule update --remote --merge` follows the
branch recorded in `.gitmodules` rather than the pinned commit.

**A submodule checkout can be left on a detached HEAD.** If `git status` inside an app
shows `HEAD detached`, run `git checkout dev` before committing, or the commit belongs to
no branch and the push will be refused.

For API-only development, run `pnpm dev:api`. It builds first, then watches TypeScript
and restarts Node when compiled files change. `pnpm db:status` checks Docker health;
`pnpm db:down` stops the database without deleting its named volume.

The current local database is bound only to `127.0.0.1:55432` because other projects
use ports 5432 and 5433. Connection settings come from the API's ignored `.env.local`.
The setup command requires loopback URLs for `portal_owner` and `portal_app` on the
same database. It does not reset data or run against UAT/production.

- API health: `http://127.0.0.1:43000/api/me/health`
- OpenAPI UI: `http://127.0.0.1:43000/api/docs`
- OpenAPI JSON: `http://127.0.0.1:43000/api/docs-json`

Local boot, unauthenticated route rejection, migration replay, RLS enablement and
queue registration were verified. This is a runnable scaffold, not completed
identity or quotation functionality. Full test/lint tooling compatibility after the
dependency upgrade remains separate work.

## Environment files

Each app has separate `.env.local`, `.env.uat` and `.env.prod` files. All are
Git-ignored and must be supplied on each checkout or by deployment automation; there
are no example files. Never force-add filled environment files to source control.
Deployment values and secrets come from the environment / Key Vault. Existing process
environment variables take precedence over file values.

| App | Local | UAT | Production |
| --- | --- | --- | --- |
| API | `pnpm --filter noatum-customer-portal-api dev` | `pnpm --filter noatum-customer-portal-api start:uat` | `pnpm --filter noatum-customer-portal-api start:prod` |
| UI | `pnpm --filter noatum-customer-portal-ui dev` | `pnpm --filter noatum-customer-portal-ui build:uat` | `pnpm --filter noatum-customer-portal-ui build:prod` |
| Simulator | Reserved configuration only | Reserved test configuration only | Not supported; file contains a notice only |

- Build the API with `pnpm --filter noatum-customer-portal-api build` before either deployment start
  command. Plain `start` uses only injected process settings, without loading a file.
  UAT and production start commands allow absent files for Key Vault-backed deployments;
  required settings must still pass startup validation. Local settings never fall back
  into UAT or production. The old `.env` file is not loaded by the API or UI.
- API local credentials are development-only. Entra IDs are placeholders and must be
  replaced to authenticate. UAT/production connection strings, identity, CW1 and CORS
  values are deliberately blank; these files are not ready-to-deploy configurations.
  The existing API validator still requires `CW1_RATE_URL` even though no live rate
  source is configured. Do not fill that gap with a production simulator or fake source.
- Prisma configuration selects `DATABASE_MIGRATION_URL`, falling back to `DATABASE_URL`.
  `pnpm db:setup` loads local values explicitly. In pipelines, inject the owner-role
  migration URL; the running API uses the limited application role. pg-boss database
  initialization is a setup step, not an API startup migration.
- UI settings are public build-time `VITE_*` values, never secrets. `VITE_API_BASE_URL`
  is reserved for the upcoming client integration; the current UI workspace does not
  call the API. Default `build` uses production settings; `preview` serves the most
  recent build and does not switch its environment. Vite's automatic env-file loading
  is disabled to prevent `.env.local` leaking into UAT or production builds.
- The simulator has no runnable package or loader yet. Its files reserve only the
  settings documented in [the simulator LLD](docs/lld/CW1-Simulator.md). Never deploy it
  to production. Its local API endpoint placeholders still need alignment when the
  simulator is implemented.

## Everyday commands

```bash
pnpm lint             # eslint, zero warnings tolerated
pnpm typecheck        # tsc --noEmit across all workspaces
pnpm test             # unit tests
pnpm test:isolation   # tenant-isolation suite (needs Postgres)
pnpm verify           # lint + typecheck + test, what CI runs
pnpm build            # build every workspace
```

## Decisions worth knowing up front

- **No shared packages.** `apps/noatum-customer-portal-api/src/contracts` holds the API DTOs, zod schemas,
  permission codes and enums. The SPA does not import them — it generates its client from
  the OpenAPI document. Anything the browser must compute identically to the server comes
  from an endpoint, not a copied function.
- **Migrations run from the pipeline**, as a step before the app deploy, with an
  owner-role connection string. The running app connects as a limited role. Never at
  application startup (ADR-001).
- **Tenant isolation is enforced in Postgres (RLS)**, not only in application code. All
  reads go through `TenantRepository`.
- **The simulator ships in the repo but never to production**, and is reached over HTTP
  through configuration rather than imported.
- **Nothing secret in YAML.** Variable groups are linked to Azure Key Vault.

See [`CLAUDE.md`](./CLAUDE.md) for the rules every change follows, and [`docs/`](./docs)
for the PRD, the slice plan, LLDs and ADRs.

## Branch and work-item conventions

Branches carry the slice id so commits, PRs and board items line up:

```
feature/S1.05-address-book
fix/S2.11-invoice-pdf-timeout
```

`main` is protected: PR required, 1 reviewer, CI must pass, linked work item, all comments
resolved, squash merge only.
