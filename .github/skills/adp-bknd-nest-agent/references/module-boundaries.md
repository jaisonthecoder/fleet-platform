# NestJS Module Boundaries

Use this reference whenever a NestJS skill creates, updates, reviews, or moves module source. It replaces the legacy placeholder and is intentionally duplicated into NestJS source-producing skills so the layout standard is available even when a project scaffolds only a subset of skills.

## Required Feature Module Layout

Feature modules live under `src/modules/<feature>/`.

```text
src/modules/<feature>/
  controllers/
    <feature>.controller.ts
  services/
    <feature>.service.ts
  dto/
    create-<feature>.request.dto.ts
    update-<feature>.request.dto.ts
    <feature>.response.dto.ts
  entities/
    <feature>.entity.ts
  repositories/
    <feature>.repository.ts
  guards/
  interceptors/
  pipes/
  decorators/
  interfaces/
  enums/
  constants/
  <feature>.module.ts
```

Subfolders are mandatory from the first file. A single controller still belongs in `controllers/`; a single service still belongs in `services/`; a single DTO still belongs in `dto/`. The only source file allowed at the feature-module root is `<feature>.module.ts`.

Do not pre-create empty folders. Add `controllers/`, `services/`, `dto/`, `entities/`, `repositories/`, `guards/`, `interceptors/`, `pipes/`, `decorators/`, `interfaces/`, `enums/`, or `constants/` only when the first real file of that kind exists.

Co-locate unit specs next to the file they test:

```text
src/modules/<feature>/services/<feature>.service.spec.ts
src/modules/<feature>/controllers/<feature>.controller.spec.ts
```

## What Goes Where

| Folder | Owns | Rule |
| --- | --- | --- |
| `controllers/` | HTTP routes, DTO binding, status codes, auth decorators, response mapping | No business rules and no repository access. |
| `services/` | Use cases, orchestration, invariants, transaction boundaries | Public method signatures should not expose HTTP or ORM types. |
| `dto/` | Request, response, and error DTOs | Never reuse ORM entities as DTOs. Use `.request.dto.ts` and `.response.dto.ts` naming. |
| `entities/` | ORM entities or persistence model wrappers | Do not return these from controllers. |
| `repositories/` | Data access and query methods | Hide ORM specifics and enforce tenant or ownership filters for user data. |
| `guards/` | Route-level authentication and coarse authorization | Row-level authorization belongs in services/repositories. |
| `interceptors/` | Response/request transforms, caching, telemetry | Not validation or authorization. |
| `pipes/` | Validation and inbound transformation | Prefer a global validation pipe unless custom parsing is needed. |
| `decorators/` | Parameter and method decorators | No hidden business logic. |
| `interfaces/` | Pure TypeScript contracts shared inside the module | No `@nestjs/*` or ORM imports. |
| `enums/`, `constants/` | Enum values, string constants, DI tokens | Keep flat and local to the module unless truly shared. |

## Multi-Surface Modules

When a feature exposes more than one consumer surface, keep controllers flat and split `services/` and `dto/` by surface.

```text
src/modules/<feature>/
  controllers/
    admin-<feature>.controller.ts
    public-<feature>.controller.ts
  services/
    admin/
    public/
    shared/
  dto/
    admin/
    public/
  entities/
  repositories/
  <feature>.module.ts
```

Controllers may use services from their own surface folder and `services/shared/`. A service in one surface folder must not import from another peer surface folder; move shared behavior into `services/shared/`.

## Cross-Module Dependency Rules

- A feature does not import another feature's `controllers/`, `services/`, or `repositories/` directly.
- If one feature needs behavior from another, depend on a published interface and have the producer module export the implementation.
- Shared platform capabilities such as logging, config, secret access, database clients, queues, and audit live in small shared modules.
- `@Global()` is reserved for genuinely cross-cutting modules, not feature modules.
- Do not add `forwardRef()` to hide a cycle. Fix the dependency direction or extract a shared interface/module.

## Config And Infrastructure Layout

Cross-cutting runtime config belongs under `src/common/config/`, split by concern.

```text
src/common/config/
  app.config.ts
  database.config.ts
  openapi.config.ts
  logging.config.ts
  config.schema.ts
  index.ts
```

Do not build large config objects inline in `main.ts`, feature modules, or helper files. Do not create `src/infrastructure/` as a parallel layer; infrastructure adapters belong in explicit shared modules such as `DatabaseModule`, `PrismaModule`, `TypeOrmModule`, `SecretStoreModule`, or `MessageBusModule`.

## Review Checklist

- [ ] Feature source is under `src/modules/<feature>/`.
- [ ] The feature-module root contains only `<feature>.module.ts` and optional notes required by project convention.
- [ ] Controllers, services, DTOs, entities, repositories, guards, interceptors, pipes, decorators, interfaces, enums, and constants are in their named subfolders from the first file.
- [ ] Empty folders were not pre-created.
- [ ] Specs are co-located next to the files they test.
- [ ] DTOs are not ORM entities and use `.request.dto.ts` / `.response.dto.ts` naming where applicable.
- [ ] No feature imports another feature's internal controller, service, or repository directly.
- [ ] Verify the code to compliance with SCA
- [ ] Verify the code to compliance with SAST
- [ ] Verify the code to compliance with SCS
- [ ] Shared infrastructure is exposed through small shared modules, not `src/infrastructure/`.
- [ ] Config is split by concern under `src/common/config/`.
- [ ] Any deviation is captured as an ADR or residual risk with owner and reason.
