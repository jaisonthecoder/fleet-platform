# Anti-Patterns

> **PR-review citation source.** When a reviewer rejects code, they cite the entry below. The fix is the description, not a debate.

## Contents

- [Anti-Patterns](#anti-patterns)
  - [Contents](#contents)
  - [Related references](#related-references)
  - [Architecture and boundaries](#architecture-and-boundaries)
  - [Controllers](#controllers)
  - [DTOs and validation](#dtos-and-validation)
  - [Errors](#errors)
  - [Persistence](#persistence)
  - [Authorization](#authorization)
  - [Audit and observability](#audit-and-observability)
  - [Configuration and secrets](#configuration-and-secrets)
  - [Testing](#testing)
  - [Modules and DI](#modules-and-di)

## Related references

- [`nest-architecture.md`](nest-architecture.md) — what the right shape is when this catalog says "wrong."
- [`module-boundaries.md`](module-boundaries.md) — where code lives. Many architecture rejections cite it.
- [`api-conventions.md`](api-conventions.md) — DTO/error/route shape. Cited from Controllers, DTOs, Errors, Authorization sections.
- [`security-baseline.md`](security-baseline.md) — Rules 7/8/9. Cited from Authorization, Audit, Configuration sections.
- [`testing-patterns.md`](testing-patterns.md) — cited from the Testing section.

## Architecture and boundaries

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| Controller, service, repository, DTO, or entity file at the module root (e.g. `src/modules/<feature>/<feature>.controller.ts`) | Move into the matching subfolder (`controllers/`, `services/`, `repositories/`, `dto/`, `entities/`). The only file allowed at the module root is `<feature>.module.ts`. | Hard Rule 3 (SKILL.md), Rule 4, [`module-boundaries § Common drift patterns`](module-boundaries.md#common-drift-patterns) |
| `src/infrastructure/...` tree under the project or under a feature module | Move adapters into a shared module (`PrismaModule`, `TypeOrmModule`, `SecretStoreModule`). `src/infrastructure/` is not part of the standard layout. | Hard Rule 3, [`module-boundaries § Shared modules`](module-boundaries.md#shared-modules) |
| Empty `controllers/`, `services/`, `dto/` folders pre-created when scaffolding | Delete them. Subfolders are created **when the first file lands**, not upfront. | [`module-boundaries § Standard NestJS folder layout`](module-boundaries.md#standard-nestjs-folder-layout) |
| DTO file ending in `.response.ts` or `.request.ts` (no `.dto.ts` suffix) | Rename to `.response.dto.ts` / `.request.dto.ts`. The `.dto.ts` suffix is what lint, code search, and the layout enforcement rely on. | [`module-boundaries § Common drift patterns`](module-boundaries.md#common-drift-patterns) |
| Files in `interfaces/` import `@nestjs/*` or `@prisma/*` | `interfaces/` is pure TypeScript. Move framework imports to the layer that uses them. | Rule 3 |
| ORM entity types appear in request or response DTOs | Map entity ↔ DTO explicitly. Two types, one mapper. | Rule 3 |
| Service in `services/<surface-a>/` imports from `services/<surface-b>/` | Move shared logic to `services/shared/`. | Rule 4 |
| Feature module's `imports:` array contains another feature module to "borrow" a service | Depend on the producer's published interface and have the producer module export the service. | [`module-boundaries § Dependency rules between feature modules`](module-boundaries.md#dependency-rules-between-feature-modules) |
| `forwardRef(() => OtherModule)` to break a cycle | The dependency direction is wrong. Restructure. | [`nest-architecture § Smells to correct`](nest-architecture.md#smells-to-correct) |
| One god module that imports everything | Split by feature. | [`module-boundaries § Shared modules`](module-boundaries.md#shared-modules) |
| `SwaggerModule.setup(...)` mounted as the docs UI without a recorded ADR | Default docs UI is **Scalar** (`@scalar/nestjs-api-reference`). To use Swagger UI, write an ADR explaining why. | [`api-conventions § Docs UI`](api-conventions.md#docs-ui) |
| OpenAPI document not exposed at `/<prefix>/docs-json` (only the human UI is mounted) | The machine-readable feed is mandatory regardless of UI choice — frontend codegen, contract tests, and external consumers all need it. | [`api-conventions § Docs UI`](api-conventions.md#docs-ui) |

## Controllers

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| Business rules inside controller methods | Controllers map DTO → use case → response only. | Rule 2 |
| Controller calls a repository directly | Go through a service. | [`nest-architecture § Building blocks`](nest-architecture.md#building-blocks) |
| Controller throws `new HttpException` for a domain outcome | Service throws a typed exception; the filter maps it to ProblemDetails. | [`nest-architecture § Error handling`](nest-architecture.md#error-handling) |
| `if (user.isAdmin) ...` branching inside a controller | Express the rule as a guard or a use-case input. | [`security-baseline § Authorization at the data layer`](security-baseline.md#authorization-at-the-data-layer) |
| `@Body() body: any` or untyped request | Typed DTO + validation pipe. | [`api-conventions § DTO naming and shape`](api-conventions.md#dto-naming-and-shape) |

## DTOs and validation

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| Reusing an ORM model as a request or response DTO | Define `Request` / `Response` DTOs and map. | Rule 3 |
| Optional vs nullable conflated (`field?: T \| null`) | Pick one. Required → present. Optional → may be missing. Nullable → present but `null`. | [`api-conventions § DTO naming and shape`](api-conventions.md#dto-naming-and-shape) |
| Unknown fields silently dropped by the pipe | `forbidNonWhitelisted: true` (class-validator) or `.strict()` (Zod). | [`security-baseline § Input handling`](security-baseline.md#input-handling) |
| Cross-field rules duplicated in service and DTO | Validate shape in the DTO, invariants in the domain. Don't double-check the same thing. | [`nest-architecture § Cross-cutting concerns`](nest-architecture.md#cross-cutting-concerns) |
| Zero-padding or trimming applied silently | Validate as-is and reject. Don't fix it server-side and pretend it was correct. | [`api-conventions § Validation`](api-conventions.md#validation) |

## Errors

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| `throw new Error('not found')` for an expected outcome | Throw a typed app exception (e.g. `OrderNotFoundException`); the global filter maps it to a 404 ProblemDetails. | [`nest-architecture § Error handling`](nest-architecture.md#error-handling) |
| Controller `throw new HttpException` for a domain outcome | Throw the typed exception in the service; the filter shapes the HTTP response. | Rule 2 |
| `200 OK` body that contains an error | Use the right status code. | [`api-conventions § HTTP verbs and status codes`](api-conventions.md#http-verbs-and-status-codes) |
| Stack trace or SQL fragment in a production error response | Filter sanitizes. Production errors carry `code` + `correlationId`. | [`security-baseline § Output and error hygiene`](security-baseline.md#output-and-error-hygiene) |
| `try { ... } catch { return null; }` swallowing the cause | Either handle a specific known case, or let it propagate to the filter. | [`nest-architecture § Error handling`](nest-architecture.md#error-handling) |
| Catch-all that logs and rethrows the same error | Either handle or don't. Don't pretend. | [`nest-architecture § Error handling`](nest-architecture.md#error-handling) |
| Error messages that echo user input verbatim | Sanitize / structure the response. | [`security-baseline § Output and error hygiene`](security-baseline.md#output-and-error-hygiene) |

## Persistence

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| `migrationsRun: true` (TypeORM) or `prisma migrate deploy` in `bootstrap()` | Migrations run in a separate pipeline step or one-shot job. | [`workflows/update-persistence`](../workflows/update-persistence.md) |
| `prisma db push` against staging or production | Use generated migrations only. | [`workflows/update-persistence`](../workflows/update-persistence.md) |
| Drop a column in the same release as removing the code that reads it | Expand → migrate → contract. Two releases minimum. | [`workflows/update-persistence`](../workflows/update-persistence.md) |
| `UPDATE` an entire production table in one statement | Idempotent batched backfill, throttled, logged. | [`workflows/update-persistence`](../workflows/update-persistence.md) |
| Multi-step write without a transaction | Wrap in a transaction. Rollback on partial failure. | [`workflows/build-backend`](../workflows/build-backend.md) |
| Repository method without a `Principal` parameter | Mandatory-principal API. No overload that omits it. | Rule 7 |
| ORM entities exported from `entities/` and used in DTOs | Map. | Rule 3 |
| Seed scripts that mutate production records | Seed is for dev/test only. Use migrations for prod data shape. | [`workflows/update-persistence`](../workflows/update-persistence.md) |

## Authorization

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| Filtering rows in JavaScript after fetching | Filter at the SQL layer with the `Principal`. | Rule 7 |
| Repository exposes `findById` *and* `findByIdForPrincipal` | Only the principal version exists. | Rule 7 |
| Trusting a claim from `req.body` (e.g. `tenantId`) | Read from the verified token, not the body. | [`security-baseline § Authentication`](security-baseline.md#authentication) |
| Authorization check in an interceptor | Use a guard (or data-layer check). | [`nest-architecture § Cross-cutting concerns`](nest-architecture.md#cross-cutting-concerns) |
| Same 403 vs 404 in all cases | Prefer 404 for resources the principal cannot see; 403 for resources they can see but cannot act on. | [`api-conventions § Auth on operations`](api-conventions.md#auth-on-operations) |

## Audit and observability

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| State change committed; audit row written outside the transaction | Audit is in the same transaction. | Rule 9 |
| Audit row missing `correlation_id` | All audit rows carry the correlation ID from the request context. | Rule 9 |
| Per-feature ad-hoc audit shape | Use the shared `AuditLogService`. | [`security-baseline § Audit logging`](security-baseline.md#audit-logging) |
| Logs without correlation ID or principal ID | Inject from `RequestContext`. | [`nest-architecture § Observability hooks`](nest-architecture.md#observability-hooks) |
| Sensitive payload (PII, tokens) in logs | Redact at the logger level; reject in code review. | [`security-baseline § Output and error hygiene`](security-baseline.md#output-and-error-hygiene) |

## Configuration and secrets

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| `process.env.X` read outside the config layer | Inject `ConfigService` or typed config. | Rule 8 |
| Secret committed to `.env` (and not in `.gitignore`) | Managed secret store. `.env.example` ships no values. | Rule 8 |
| Plaintext secret in app/container settings | Reference the managed secret store via managed identity / IAM. | Rule 8 |
| Config schema validated lazily on first use | Validate at boot. Fail fast. | [`nest-architecture § Configuration and secrets`](nest-architecture.md#configuration-and-secrets) |
| `DocumentBuilder`, Swagger/Scalar setup options, pino options, database connection options, or app defaults built inline in `main.ts` | Move each concern to `src/common/config/<concern>.config.ts`; keep `main.ts` as wiring only. | Rule 10, [`module-boundaries § Common config layout`](module-boundaries.md#common-config-layout) |
| One catch-all config file owns app, database, OpenAPI/Swagger, logging, and validation settings | Split into `app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, and `config.schema.ts`. | Rule 10 |
| Feature module reads or defines cross-cutting runtime config directly | Add a typed config value under the right `src/common/config/` concern and inject it. | Rule 10 |

## Testing

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| Snapshot of a whole HTTP response with no intent expressed | Assert the fields that matter. | [`testing-patterns § HTTP integration tests with Supertest`](testing-patterns.md#http-integration-tests-with-supertest) |
| Mock for a method the code doesn't call | Delete the mock. | [`testing-patterns § Fakes vs mocks`](testing-patterns.md#fakes-vs-mocks) |
| Mock that asserts internal call ordering | Assert observable behavior instead. | [`testing-patterns § Unit tests for services`](testing-patterns.md#unit-tests-for-services) |
| Persistence test using SQLite as a stand-in for the real engine | Testcontainers with the real engine. | [`testing-patterns § Persistence tests with Testcontainers`](testing-patterns.md#persistence-tests-with-testcontainers) |
| `await sleep(...)` to wait for async work | Wait for the actual signal or use fake timers. | [`testing-patterns § Speed and isolation`](testing-patterns.md#speed-and-isolation) |
| `.skip` on a flaky test with no tracked fix | Quarantine with a ticket; remove or fix. | [`testing-patterns § Speed and isolation`](testing-patterns.md#speed-and-isolation) |

## Modules and DI

| ❌ Anti-pattern | ✅ Fix | Cite |
|---|---|---|
| Service injected by class, not by interface token | Define a `Symbol` token; bind interface → adapter in the module. | [`nest-architecture § Dependency injection`](nest-architecture.md#dependency-injection) |
| Two providers for the same token in different modules with different behavior | Single source of truth. Move to a shared module. | [`module-boundaries § Shared modules`](module-boundaries.md#shared-modules) |
| `@Global()` on a feature module to skip imports | Import explicitly. `@Global()` is for genuinely cross-cutting modules. | [`module-boundaries § Shared modules`](module-boundaries.md#shared-modules) |
| Provider with `useValue: someMutableObject` shared across requests | Make it request-scoped or pass an immutable snapshot. | [`nest-architecture § Dependency injection`](nest-architecture.md#dependency-injection) |
