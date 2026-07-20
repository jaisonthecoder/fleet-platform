# Module Boundaries

## Contents

- [Module Boundaries](#module-boundaries)
  - [Contents](#contents)
  - [Related references](#related-references)
  - [Focus](#focus)
  - [Standard NestJS folder layout](#standard-nestjs-folder-layout)
  - [What goes where](#what-goes-where)
  - [Multi-surface modules (sub-folder split)](#multi-surface-modules-sub-folder-split)
  - [Dependency rules between feature modules](#dependency-rules-between-feature-modules)
  - [Shared modules](#shared-modules)
  - [Common config layout](#common-config-layout)
  - [Adding a new feature](#adding-a-new-feature)
  - [Smells](#smells)
  - [Common drift patterns](#common-drift-patterns)
  - [Enforcement (CI lint)](#enforcement-ci-lint)
    - [Option A — `dependency-cruiser` (recommended)](#option-a--dependency-cruiser-recommended)
    - [Option B — `eslint-plugin-boundaries`](#option-b--eslint-plugin-boundaries)

## Related references

- [`nest-architecture.md`](nest-architecture.md) — what each block (controller, service, repository, guard, etc.) is for. This file says **where** they live; that one says **what** they do.
- [`api-conventions.md`](api-conventions.md) — DTO naming and shape, used in the [What goes where](#what-goes-where) `dto/` row.
- [`anti-patterns.md`](anti-patterns.md) § Architecture and boundaries / § Modules and DI — every smell here has a row there with a fix and citation.

## Focus

Use this reference whenever you create a new NestJS module, split an existing one, or move code between modules.

The folder split mandated by **Rule 4** (see SKILL.md § Project rules) applies on top of the standard NestJS layout below. If your project records this as an ADR, link yours from the project's governance file. CI enforces boundaries via ESLint `eslint-plugin-boundaries` or `dependency-cruiser`.

## Standard NestJS folder layout

Feature modules live under `src/modules/<feature>/`. Do not place feature modules directly under `src/<feature>/`, and do not introduce a DDD-style `src/infrastructure/` tree for adapters.

A single-controller feature module:

```script
src/modules/<feature>/
  controllers/
    <feature>.controller.ts
  services/
    <feature>.service.ts
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
    <feature>-response.dto.ts
  entities/                  ← TypeORM entities or Prisma model wrappers
    <feature>.entity.ts
  repositories/              ← optional — extract when service has many DB calls
    <feature>.repository.ts
  guards/
    <feature>.guard.ts
  interceptors/              ← only if the feature has its own
  pipes/                     ← only if the feature has its own
  decorators/                ← only if the feature has its own (e.g. @CurrentUser)
  interfaces/                ← TS-only contracts shared across this module
    <feature>.interface.ts
  enums/
  constants/
  <feature>.module.ts
```

**Subfolders are mandatory from the first file.** The moment a feature has a controller, it lives at `controllers/<feature>.controller.ts` — not at the module root. Same for services, repositories, DTOs, entities, guards, interceptors, pipes, decorators, interfaces, enums, and constants. Files like `<feature>.controller.ts`, `<feature>.service.ts`, or `<feature>.repository.ts` sitting at the module root are a layout violation, even when there is only one of each.

Folders that have **no files yet** are not created — `interceptors/`, `pipes/`, `decorators/`, `enums/`, `constants/` are added only when their first file is added. The rule is "no empty folders," not "no folders until many files."

The only files allowed at the module root are:

- `<feature>.module.ts` — wiring (the **only** place that wires controllers, services, repositories, guards, and providers).
- A README/notes file if the project conventions require one.

Co-locate unit-test specs (`*.spec.ts`) next to the file they test, inside the same subfolder (e.g. `services/<feature>.service.spec.ts`).

## What goes where

| Folder | Owns | Notes |
|---|---|---|
| `controllers/` | HTTP shape — routes, DTO binding, status codes, auth scopes (`@UseGuards`), response mapping | Map DTO → service → response. **No business rules** (Rule 2). Never `throw new HttpException` for domain outcomes — let the filter map service results. |
| `services/` | Business logic — use cases, validation of invariants, orchestration, transactions | The bulk of the feature. Services don't import `@nestjs/common` decorators except `@Injectable()`. They don't import HTTP types or ORM types in their public method signatures. |
| `dto/` | Request and response data shapes | `class-validator` decorators or Zod schemas. **Never** reuse entities as DTOs (Rule 3). |
| `entities/` | ORM models (TypeORM `@Entity` classes or Prisma model wrappers) | Stay in this layer. Don't expose them through controllers. |
| `repositories/` | Data access — query methods that hide ORM specifics | Optional. Extract when the service has many DB calls or when you want to swap implementations. Repository methods always take a `Principal` for any user-content read (Rule 7). |
| `guards/` | Coarse authorization, route-level checks | Use guards for "is this caller authenticated?" and "do they have the scope?". Row-level authz lives in repositories. |
| `interceptors/` | Cross-cutting response/request transforms | Caching, response shaping, telemetry. Not validation, not auth. |
| `pipes/` | Validation + transformation of inbound data | Usually one global `ValidationPipe` is enough. Add custom pipes for parsing IDs, dates, etc. |
| `decorators/` | Param decorators (`@CurrentUser`, `@CorrelationId`) and method decorators | Small. Don't hide business logic in a decorator. |
| `interfaces/` | TypeScript types/interfaces shared inside this module | Pure TypeScript. No imports from `@nestjs/*` or ORM packages. |
| `enums/`, `constants/` | Enumerations, string constants, DI tokens (`Symbol(...)`) | Keep flat. |

## Multi-surface modules (sub-folder split)

When a feature exposes **more than one consumer surface** (e.g. an admin controller and a public-facing controller), split `services/` and `dto/` into sub-folders that match each surface, plus a `services/shared/` folder for code consumed by multiple sub-folders.

```
src/modules/<feature>/
  controllers/
    <surface-a>.controller.ts
    <surface-b>.controller.ts
  services/
    <surface-a>/
      ...
    <surface-b>/
      ...
    shared/
      ...
  dto/
    <surface-a>/
    <surface-b>/
  entities/
  repositories/
  guards/
  interceptors/
  enums/
  <feature>.module.ts
```

**Dependency rules inside a multi-surface module:**

1. A controller consumes services **only** from its own sub-folder and from `services/shared/`.
2. A service in one sub-folder may **not** import from another peer sub-folder. If you reach for a peer, move the shared bit to `services/shared/`.
3. `entities/`, `repositories/`, `guards/`, `interceptors/`, `enums/` stay flat — they're shared by all surfaces.
4. The module file is the **only** place that wires across surfaces.

A single-controller module starts flat. Sub-folders appear when (and only when) a second consumer surface is introduced.

## Dependency rules between feature modules

- A feature module **does not import from another feature module's `services/`, `controllers/`, or `repositories/`**.
- If two features need to talk, the consumer depends on an **interface** the producer publishes (in `interfaces/`), and the producer's module exports the service that implements it.
- Cross-cutting capability (auth, audit, configuration, logging) lives in a **shared module** (see below).
- Entity types (TypeORM/Prisma) **never** flow through a controller of another feature. Map to a DTO at the boundary.

## Shared modules

Three legitimate kinds of shared module:

| Kind | Owns | Example |
|---|---|---|
| **Common** | Cross-cutting providers and base classes | `LoggerModule`, `AuditModule`, `ConfigModule`, `RequestContextModule` |
| **Platform** | Infrastructure adapters used by many features | `PrismaModule` (or `TypeOrmModule.forRoot(...)`), `SecretStoreModule`, `MessageBusModule` |
| **Shared types** | Pure-TypeScript primitives | Branded ID types, common interfaces, error codes, base app exceptions |

Keep each shared module **small**. If you find yourself importing 80% of a shared module to use 20% of it, split it.

## Common config layout

Rule 10 standardizes cross-cutting runtime config under `src/common/config/`. Keep one concern per file; do not create a single `configuration.ts` or grow `main.ts` into a config module.

```script
src/common/
  config/
    app.config.ts
    database.config.ts
    openapi.config.ts
    logging.config.ts
    config.schema.ts
    index.ts              ← optional re-exports only
```

Use this mapping:

| File | Owns |
|---|---|
| `app.config.ts` | API prefix, port, environment name, service metadata |
| `database.config.ts` | Prisma/TypeORM connection options, pool sizing, migration/runtime flags |
| `openapi.config.ts` | `DocumentBuilder`, docs paths, Scalar/Swagger UI options |
| `logging.config.ts` | pino options, redaction rules, correlation/principal fields |
| `config.schema.ts` | Zod/Joi/class-validator schema used at boot |

Rules:

1. `main.ts` imports config builders and wires them; it does not define large config objects inline.
2. Feature modules do not own cross-cutting config. If a feature needs a feature flag or local threshold, keep the typed key under the relevant config concern and inject it.
3. `index.ts` may re-export config functions only. No logic, no environment reads, no side effects.
4. Do not pre-create empty config files. Add each concern file when it first has real settings.

## Adding a new feature

1. Create `src/modules/<feature>/<feature>.module.ts` with empty `controllers`, `providers`, `imports`, `exports`.
2. Add `controllers/`, `services/`, `dto/`, `entities/` as you need them — don't pre-create empty folders.
3. Define **request/response DTOs** before writing the service. Validate at the boundary.
4. Add the module to the parent module's `imports` array. Never auto-discover.
5. If the feature needs to be reachable by another module, **export** only the services that other modules need. Never re-export raw repositories or ORM entities.

## Smells

- A controller, service, repository, DTO, or entity file at the module root instead of in `controllers/`, `services/`, `repositories/`, `dto/`, or `entities/`. The single allowed root file is `<feature>.module.ts`.
- A controller imports a repository directly (skip the service layer).
- A service in `services/<surface-a>/` imports from `services/<surface-b>/` (cross-surface peer dependency).
- A feature module's `imports:` array contains another feature module to "borrow" a service.
- ORM entities re-exported and used as request or response DTOs.
- A "common" module that drags in 30 dependencies because everyone imports from it.
- Runtime config scattered across `main.ts`, feature modules, and helper files instead of `src/common/config/<concern>.config.ts`.
- A module file with `forwardRef(() => OtherModule)` to break a cycle — that's a sign the dependency direction is wrong.
- `@nestjs/common` imports inside files in `interfaces/` (that folder is pure TypeScript).

## Common drift patterns

These are the layout mistakes the skill sees most often. Each one is a violation of Hard Rule 3 (SKILL.md § Hard rules) and is rejected at code review.

| Drift pattern | Why it happens | Fix |
|---|---|---|
| `src/modules/<feature>/<feature>.controller.ts` at the module root | The module was scaffolded when there was only one controller. Author thought "subfolders are for when there are many files." | Move to `controllers/<feature>.controller.ts`. The rule is "subfolders from the first file," not "subfolders once there are several." |
| `src/modules/<feature>/<feature>.service.ts` and `<feature>.service.spec.ts` at the root | Same root cause. Co-located spec was moved with its service. | Move both to `services/`. Spec stays next to the service. |
| `src/modules/<feature>/users.repository.ts` at the root (or any `*.repository.ts` at root) | Repository was extracted from the service later and dropped beside it. | Move to `repositories/<name>.repository.ts`. |
| `src/infrastructure/database/...` (or any `src/infrastructure/` tree) under a feature module or as a sibling of `modules/` | Author imported a DDD-style "infrastructure layer" pattern from another project. | Move infrastructure adapters into a shared module (`PrismaModule`, `TypeOrmModule`, `SecretStoreModule`) under `src/shared/` or `src/common/`. See § Shared modules. |
| `DocumentBuilder`, pino options, database options, or app config built inline in `main.ts` | Author started with a quick bootstrap and never extracted config. | Move each concern to `src/common/config/<concern>.config.ts`. See § Common config layout. |
| One catch-all `src/common/config/configuration.ts` that owns app, database, OpenAPI, and logging settings | Author treated config as one bucket. It becomes unreviewable as the service grows. | Split into `app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, and `config.schema.ts`. |
| `dto/<name>.response.ts` (no `.dto` segment) | Author shortened the filename. | Rename to `<name>.response.dto.ts`. The `.dto.ts` suffix is what lint rules and code search rely on. |
| `dto/` exists but mixes request and response DTOs with no naming distinction | Author treated DTO as one bucket. | Use `<name>.request.dto.ts` and `<name>.response.dto.ts`, or split into `dto/requests/` and `dto/responses/` for large modules. See [`api-conventions.md`](api-conventions.md) § DTO naming and shape. |
| `interfaces/` folder created with files that import `@nestjs/common` or ORM types | Author treated `interfaces/` as a generic types folder. | Move framework-aware types to the layer that uses them. `interfaces/` is pure TypeScript only — Rule 3. |
| Empty `controllers/`, `services/`, `dto/`, etc. folders pre-created when scaffolding the module | Author confused "subfolders mandatory from first file" with "create all subfolders upfront." | Delete the empty folders. Create each subfolder when its first file lands. |
| Two feature modules under one folder (e.g. `src/modules/identity/` containing both auth and users) | Cohesion judgment call that grew. | Split into two modules. Each is still feature-named at its own path. |

## Enforcement (CI lint)

Layout drift is invisible until someone reads the skill — unless CI fails the PR. Wire one of the two options below.

### Option A — `dependency-cruiser` (recommended)

Add to `.dependency-cruiser.cjs`:

```js
module.exports = {
  forbidden: [
    {
      name: 'no-root-files-in-feature-module',
      severity: 'error',
      comment:
        'Feature modules under src/modules/<feature>/ may only contain <feature>.module.ts ' +
        'at their root. Controllers go in controllers/, services in services/, repositories ' +
        'in repositories/, DTOs in dto/, entities in entities/. See ' +
        'references/module-boundaries.md § Standard NestJS folder layout.',
      from: { path: '^src/modules/[^/]+/[^/]+\\.(controller|service|repository|dto|entity)\\.ts$' },
      to: {},
    },
    {
      name: 'no-infrastructure-tree',
      severity: 'error',
      comment:
        'src/infrastructure/ is not part of the standard layout. Infrastructure adapters ' +
        'live in a shared module. See references/module-boundaries.md § Shared modules.',
      from: { path: '^src/infrastructure/' },
      to: {},
    },
  ],
  options: { tsConfig: { fileName: 'tsconfig.json' } },
};
```

Run in CI:

```bash
npx depcruise --config .dependency-cruiser.cjs src
```

### Option B — `eslint-plugin-boundaries`

Configure element types `feature-root`, `feature-controllers`, `feature-services`, etc. and forbid any file whose path is `src/modules/*/*.{controller,service,repository,dto,entity}.ts`.

Both options pair with the **DoD checklist** in [`../workflows/build-backend.md`](../workflows/build-backend.md) — that's the human gate; lint is the automated gate.
