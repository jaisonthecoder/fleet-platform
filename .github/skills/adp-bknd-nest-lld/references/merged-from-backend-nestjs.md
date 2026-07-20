# Merged Legacy Guidance: backend-nestjs

## Table of Contents

- Original references/anti-patterns.md
- Contents
- Related references
- Architecture and boundaries
- Controllers
- DTOs and validation
- Errors
- Persistence
- Authorization
- Audit and observability
- Configuration and secrets
- Testing


This reference preserves the canonical guidance merged from the removed non-ADP source skill `backend-nestjs`.
The active ADP task skill is `adp-bknd-nest-lld`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.

## Original references/anti-patterns.md

~~~markdown
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
~~~

## Original references/api-conventions.md

~~~markdown
# API Conventions

## Contents

- [API Conventions](#api-conventions)
  - [Contents](#contents)
  - [Related references](#related-references)
  - [Focus](#focus)
  - [URL shape and versioning](#url-shape-and-versioning)
  - [HTTP verbs and status codes](#http-verbs-and-status-codes)
  - [DTO naming and shape](#dto-naming-and-shape)
  - [Validation](#validation)
  - [Pagination, filtering, sorting](#pagination-filtering-sorting)
  - [Error shape — ProblemDetails](#error-shape--problemdetails)
  - [Auth on operations](#auth-on-operations)
  - [OpenAPI as API dictionary](#openapi-as-api-dictionary)
  - [Docs UI](#docs-ui)
    - [Wiring (Scalar — the default)](#wiring-scalar--the-default)
    - [Wiring (Swagger UI — only with an ADR)](#wiring-swagger-ui--only-with-an-adr)
  - [Examples policy](#examples-policy)
  - [Smells](#smells)

## Related references

- [`nest-architecture.md`](nest-architecture.md) — controller/filter/pipe building blocks behind the rules here. See § Building blocks and § Error handling.
- [`security-baseline.md`](security-baseline.md) — auth on operations, output hygiene, rate limits. Cited from [Auth on operations](#auth-on-operations).
- [`module-boundaries.md`](module-boundaries.md) — where DTOs and entities live in the feature folder.
- [`anti-patterns.md`](anti-patterns.md) § Controllers / § DTOs and validation / § Errors — every smell here has a row there with a fix and citation.

## Focus

Use this reference whenever you add or change an HTTP endpoint, write or edit a DTO, or update OpenAPI.

## URL shape and versioning

- **Plural nouns** for resources: `/v1/orders`, not `/v1/order`.
- **Verbs come from HTTP**, not the URL: `POST /v1/orders`, not `POST /v1/orders/create`.
- **Version prefix** at the path root: `/v1/...`. Bump the prefix only on a breaking change. Add fields and new endpoints inside the same version.
- **Sub-resources** for ownership: `/v1/orders/{id}/shipments`, not `/v1/shipments?orderId=...` (filtering is for query, not for ownership).
- **Kebab-case** path segments: `/v1/knowledge-sources`. **camelCase** query params: `?translateTo=ar`.
- **No trailing slash.** Servers redirect or 404; pick one and stay consistent.

## HTTP verbs and status codes

| Operation | Verb | Success | Common errors |
|---|---|---|---|
| List | `GET /v1/<noun>` | `200` | `400` (bad query), `403` (scope) |
| Read one | `GET /v1/<noun>/{id}` | `200` | `404`, `403` |
| Create | `POST /v1/<noun>` | `201` (with `Location:` header) | `400` validation, `409` conflict |
| Replace | `PUT /v1/<noun>/{id}` | `200` or `204` | `400`, `404`, `409` (etag), `412` (precondition) |
| Update partial | `PATCH /v1/<noun>/{id}` | `200` or `204` | same as PUT |
| Delete | `DELETE /v1/<noun>/{id}` | `204` | `404`, `409` |
| Action (verb resource) | `POST /v1/<noun>/{id}/<action>` | `200` or `202` | `409` state, `400` invariant |

**Never** return `200 OK` with an error body. The status code is part of the contract.

## DTO naming and shape

- **Request DTOs** end in `Request` or `Dto`: `CreateOrderRequest`, `UpdateOrderDto`.
- **Response DTOs** end in `Response` or `Dto`: `OrderResponse`, `OrderDetailDto`.
- **Never** reuse ORM entity types as request or response DTOs. Map explicitly. (Rule 3.)
- **Optional vs nullable.** Required fields aren't optional. Optional fields are `field?: T`. Nullable fields are `field: T | null`. Don't conflate.
- **No leaking IDs.** Surrogate DB keys (auto-incrementing `id`) stay internal where possible. Public IDs are stable, opaque (UUIDs or branded reference numbers like `ORD-2026-04-1287`).

## Validation

- **Validate at the edge** with `class-validator` + `class-transformer` or **Zod** schemas (see SKILL.md § Stack for the project's choice).
- **Required, type, length, range, pattern, enum, cross-field** — declarative when possible.
- **Whitelist** at the boundary: reject unknown fields rather than silently dropping them. (`forbidNonWhitelisted: true` for class-validator; `.strict()` for Zod.)
- **Reject empty body** explicitly when the route requires one. Don't rely on downstream null checks.
- **Domain invariants** are re-checked inside the use case. The pipe is for shape; the domain is for meaning.

## Pagination, filtering, sorting

- **Cursor pagination** preferred for large or hot lists: `?cursor=...&limit=50`.
- **Page-based** acceptable for stable admin lists: `?page=1&pageSize=20`.
- **Defaults and maxes** documented per endpoint. Default `limit=20`, max `limit=100` is a sensible starting point — adjust per resource.
- **Filtering** by **whitelisted** query fields only. Reject unknown filters.
- **Sorting** by **whitelisted** field + direction: `?sort=createdAt:desc`. Document stable tie-break (usually `id`).
- **Total counts** are expensive on large tables — return them only when the consumer asks (`?includeTotal=true`).

## Error shape — ProblemDetails

Use a ProblemDetails-compatible body (RFC 9457):

```json
{
  "type": "https://errors.example.com/order-not-found",
  "title": "Order not found",
  "status": 404,
  "detail": "No order exists for the given reference.",
  "instance": "/v1/orders/abc-123",
  "code": "ORDER_NOT_FOUND",
  "correlationId": "01HZ...",
  "errors": [
    { "field": "title", "code": "TOO_LONG", "message": "Maximum length is 200." }
  ]
}
```

Rules:
- **Stable `code` strings**, not status-code-only signalling.
- **No stack traces, no raw SQL, no third-party body fragments** in production responses.
- **`correlationId` always present** — it's the join key into logs and traces.
- **`errors[]` array** for per-field validation; one entry per field.

A single `AllExceptionsFilter` maps domain `Err(...)`, framework exceptions, and unknown errors to this shape. Controllers don't shape errors themselves.

## Auth on operations

- Document **scopes** and **roles** per operation in OpenAPI (`security:`).
- Document **tenancy / ownership constraints** in prose where they aren't expressible in OAuth scopes (e.g. "evaluator can read any order in their division").
- **Authorization at the data layer** is the enforcement (Rule 7). Controller-level auth is for coarse fail-fast and shaping the 403 vs 404 response (often: prefer 404 for resources the principal cannot see, 403 for resources they can see but cannot act on).

## OpenAPI as API dictionary

OpenAPI is the **API dictionary** — the single source of truth that frontend, integration, QA, and external consumers read from. It is **not** documentation that trails the code; it leads the code.

**Hard rules:**

1. **Every endpoint exists in OpenAPI.** No exceptions. If the endpoint isn't in the spec, it doesn't ship.
2. **The spec is updated before or with the implementation** — not after. The PR that adds a route also updates the spec, in the same commit.
3. **The spec is checked into the repo** and reviewed alongside code. Reviewers read the spec diff first.
4. **Drift between code and spec is a release blocker.** CI lints the spec (e.g. Spectral / `swagger-cli validate`) and fails the build on validation errors. Where feasible, contract tests verify the running API matches the spec.

**Pick one authoring pattern and stick with it across the project** (see SKILL.md § Stack):

| Pattern | When to choose | Notes |
|---|---|---|
| **Hand-authored `openapi.yaml`** | Multiple teams consume the API; the contract drives several languages and SDKs | Implementation must match the spec. Lint + render in CI. |
| **Generated from decorators** (`@nestjs/swagger`) | Single-team API co-located with code | Generate to a **checked-in** file (`openapi.generated.yaml`); review the diff like any other artifact. The generated file is the dictionary, not a build byproduct. |

**Consumer integration:**

- **Frontend** generates a typed client from the spec (`openapi-typescript` + `openapi-fetch` or equivalent). Stale spec → stale types → build break.
- **Integration / external consumers** read the spec from a stable URL or repo path.
- **QA** writes contract checks against the spec.

Treat the spec like any other piece of source code — versioned, reviewed, linted, tested.

## Docs UI

The OpenAPI document (the dictionary) is the artifact. The **Docs UI** is the renderer that mounts that document at `/<prefix>/docs` so humans can browse it. The skill picks the renderer; the document is unchanged.

**Default: Scalar API Reference** (`@scalar/nestjs-api-reference`). Modern UX, dark mode, RTL, faster navigation, better request samples, smaller bundle than Swagger UI. Active maintenance.

**Alternative: Swagger UI** (`SwaggerModule.setup(...)` from `@nestjs/swagger`). Shipping it requires a recorded ADR — usually only justified by a hard external requirement (a stakeholder tool that scrapes a known Swagger UI markup, an offline air-gap that pins the older bundle, etc.).

**Both renderers consume the same OpenAPI document** produced by `@nestjs/swagger`'s `SwaggerModule.createDocument(app, config)`. Switching renderers does not change Hard Rule 1 — the document still must exist, be checked in (generated mode) or hand-authored, and lint clean.

### Wiring (Scalar — the default)

Install:

```bash
npm i @scalar/nestjs-api-reference
```

The OpenAPI/Swagger configuration belongs in `src/common/config/openapi.config.ts` (Rule 10). In `src/main.ts`, import the builder and wire it:

```ts
import { apiReference } from '@scalar/nestjs-api-reference';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiConfig, openApiDocsPath, openApiJsonPath } from './common/config/openapi.config';

const document = SwaggerModule.createDocument(app, buildOpenApiConfig());

// Raw OpenAPI document (machine-readable, for codegen and tooling)
app.use(openApiJsonPath(apiPrefix), (_req, res) => res.json(document));

// Scalar API Reference UI (human-readable)
app.use(
  openApiDocsPath(apiPrefix),
  apiReference({
    spec: { content: document },
    theme: 'default',
    layout: 'modern',
    metaData: { title: 'AD Ports — <service> API' },
  }),
);
```

Result:

| Path | Purpose |
|---|---|
| `GET /<prefix>/docs` | Human-readable Scalar UI |
| `GET /<prefix>/docs-json` | Raw OpenAPI 3.x document for codegen, contract tests, external consumers |

The `/docs-json` path is **mandatory** regardless of UI choice — it's the machine-readable feed. Frontend codegen, integration tests, and external consumers all read it.

### Wiring (Swagger UI — only with an ADR)

```ts
SwaggerModule.setup(openApiDocsPath(apiPrefix), app, document);
```

If a project lands this code without an ADR explaining why, code review rejects the PR (see [`anti-patterns.md`](anti-patterns.md) § Architecture and boundaries).

## Examples policy

Each operation in OpenAPI must include:

- One **success** example.
- One **validation failure** example (400 with `errors[]`).
- One **auth failure** example (401 or 403, whichever the route returns).
- **Not found** example for any GET-by-id, PUT, PATCH, DELETE.
- **Conflict** example for any state-changing POST/PATCH that has invariants.
- **Downstream failure** example where the route depends on a third-party.

## Smells

- `200 OK` with `{ "error": "..." }` body.
- Routes that take a JSON `action` field and dispatch internally (`{"action":"approve"}`). Use a dedicated sub-resource `POST /v1/orders/{id}/approve`.
- Unbounded list endpoints (no `limit` or no max).
- Filter param names that don't match field names (`?byUser=` vs field `ownerId`).
- ORM entity returned directly as response.
- Stack traces in 500 bodies.
- Routes that return arrays at the top level instead of a `{ data: [...], pagination: {...} }` envelope (makes future evolution painful).
~~~

## Original references/module-boundaries.md

~~~markdown
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
~~~

## Original references/nest-architecture.md

~~~markdown
# NestJS Architecture

## Contents

- [Focus](#focus)
- [Building blocks](#building-blocks) — module, controller, service, repository, DTO, entity
- [Request lifecycle](#request-lifecycle) — middleware, guards, interceptors, pipes, controller, filter
- [Dependency injection](#dependency-injection) — providers, tokens, scopes
- [Cross-cutting concerns](#cross-cutting-concerns) — auth, logging, validation, errors
- [Error handling](#error-handling) — exceptions and the global filter
- [Configuration and secrets](#configuration-and-secrets)
- [Observability hooks](#observability-hooks)
- [Smells to correct](#smells-to-correct)

## Related references

- [`module-boundaries.md`](module-boundaries.md) — where each kind of file goes inside a feature module. Pair this with the [Building blocks](#building-blocks) table.
- [`api-conventions.md`](api-conventions.md) — DTO and error shape rules the controller layer must produce.
- [`security-baseline.md`](security-baseline.md) — auth, secrets, audit. Referenced from [Cross-cutting concerns](#cross-cutting-concerns) and [Configuration and secrets](#configuration-and-secrets).
- [`testing-patterns.md`](testing-patterns.md) — how to test each block in this file.
- [`anti-patterns.md`](anti-patterns.md) — every entry in [Smells to correct](#smells-to-correct) has a row there with a fix and citation.

## Focus

Use this reference when designing or refactoring NestJS structure, choosing where code belongs, picking the right slot in the request lifecycle, or wiring providers.

This reference is **the architecture contract**. Rules 2 and 3 (see SKILL.md § Project rules) enforce the load-bearing parts — no business logic in controllers; no framework imports leaking into shared TypeScript types.

## Building blocks

| Block | Decorator | Owns |
|---|---|---|
| **Module** | `@Module` | Declares controllers, providers, imports, exports for one feature. Single wiring point. |
| **Controller** | `@Controller`, `@Get/@Post/...` | HTTP shape. Bind, validate, authorize, delegate to a service, map response. **No business rules** (Rule 2). |
| **Service / Provider** | `@Injectable` | Business logic. Use cases, validation of invariants, orchestration, transactions. The bulk of the feature. |
| **Repository** | `@Injectable` (optional) | Data-access methods that hide ORM specifics. Optional — extract when the service has many DB calls or you want to swap implementations. |
| **DTO** | `class-validator` decorators or Zod schemas | Request and response shapes. Validated at the boundary. |
| **Entity / Model** | TypeORM `@Entity` or Prisma model | ORM-bound persistence shape. Stays inside the feature. **Never** reused as a public DTO (Rule 3). |
| **Guard** | `@Injectable` + `CanActivate` | Coarse authorization at the route. Fail fast on missing scope/role. |
| **Interceptor** | `@Injectable` + `NestInterceptor` | Cross-cutting transforms — caching, response shaping, telemetry. Not validation, not auth. |
| **Pipe** | `@Injectable` + `PipeTransform` | Validation + transformation of inbound data. Usually one global `ValidationPipe` is enough. |
| **Filter** | `@Catch()` + `ExceptionFilter` | Catches exceptions and shapes the HTTP error response (ProblemDetails). One global filter is enough for most apps. |
| **Decorator** | `createParamDecorator` | Param decorators (`@CurrentUser`, `@CorrelationId`) and method decorators (e.g. `@RequireScopes('reward:approve')`). |

## Request lifecycle

NestJS executes a request through this pipeline. Know which slot does what — putting logic in the wrong slot is the most common architecture bug.

| Order | Slot | Purpose | Failure → |
|---|---|---|---|
| 1 | **Middleware** | Express-style — request logging, correlation ID, body parsing | next() chain |
| 2 | **Guards** | Auth (JWT verification, scopes, tenancy) | `ForbiddenException` / `UnauthorizedException` |
| 3 | **Interceptors (before)** | Response shaping, caching setup, telemetry start | wrap |
| 4 | **Pipes** | DTO validation + transformation (class-validator / Zod) | `BadRequestException` |
| 5 | **Controller method** | Bind → delegate to service → return | — |
| 6 | **Service** | Use case logic; throws typed exceptions on failure | typed exception |
| 7 | **Interceptors (after)** | Response transform, telemetry end | — |
| 8 | **Exception Filter** | Map exceptions to ProblemDetails-style HTTP body | — |

Don't put logic in the wrong slot:
- Auth checks in pipes — wrong; use a guard.
- Validation in guards — wrong; use a pipe.
- Business rules in interceptors — wrong; put them in services.

## Dependency injection

NestJS DI binds providers by **class** by default:

```ts
// services/order.service.ts
@Injectable()
export class OrderService { ... }

// order.module.ts
@Module({
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
```

When you want to depend on an **interface** (or swap implementations between environments), use a string or symbol token:

```ts
// constants/tokens.ts
export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');

// interfaces/audit-logger.interface.ts
export interface AuditLogger {
  record(entry: AuditEntry): Promise<void>;
}

// order.module.ts
@Module({
  providers: [{ provide: AUDIT_LOGGER, useClass: DbAuditLogger }],
})

// services/order.service.ts
constructor(@Inject(AUDIT_LOGGER) private readonly audit: AuditLogger) {}
```

**Provider scopes:**

| Scope | When to use |
|---|---|
| Default (singleton) | Most providers. Stateless or thread-safe state. |
| `Scope.REQUEST` | Provider needs the current request (e.g. logger that auto-attaches the correlation ID). |
| `Scope.TRANSIENT` | Each consumer gets its own instance. Rare. |

Default to singleton. Promote to request-scoped only when you need it — request scope cascades and slows things down.

## Cross-cutting concerns

| Concern | Where it lives | Notes |
|---|---|---|
| Authentication | Guard | JWT verification, principal hydration. Attach `Principal` to the request via a typed property or `RequestContext` (AsyncLocalStorage). |
| Authorization (coarse) | Guard | Scope/role checks (e.g. `@UseGuards(ScopeGuard)` + `@RequireScopes(...)`). |
| Authorization (row-level) | Repository | Mandatory-principal queries (Rule 7). The repository never exposes a method that omits the principal for user-content reads. |
| Validation | Pipe | One global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`. |
| Error mapping | Filter | One global `AllExceptionsFilter` produces ProblemDetails. |
| Logging | Middleware + interceptor | Correlation ID propagated from header or generated. Pino with redaction. |
| Audit log | Service (in the same DB transaction) | Shared `AuditLogService.record(...)` (Rule 9). |
| Rate limiting | Guard / middleware | Per-principal where possible, per-IP fallback. See [`security-baseline.md`](security-baseline.md) § Rate limiting and abuse for thresholds. |
| Idempotency | Interceptor + repository | Idempotency-Key header → store once, return cached response on replay. |

## Error handling

Two kinds of failure:

1. **Expected outcomes** that the client should know about: not found, conflict, validation, forbidden by domain rule.
2. **Unexpected faults**: DB unreachable, third-party 5xx, programmer errors.

Both are handled by **throwing exceptions** in the service and letting the global filter map them. NestJS's `HttpException` family is fine; for domain failures, throw a typed app-specific exception (`OrderNotFoundException`, `OrderConflictException`) that the filter recognizes and maps.

```ts
// services/order.service.ts
async findById(id: string, principal: Principal): Promise<Order> {
  const order = await this.orders.findByIdForPrincipal(id, principal);
  if (!order) throw new OrderNotFoundException(id);
  return order;
}

// filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (err instanceof OrderNotFoundException) {
      return res.status(404).json({
        type: 'https://errors.example.com/order-not-found',
        title: 'Order not found',
        status: 404,
        code: 'ORDER_NOT_FOUND',
        correlationId: getCorrelationId(),
      });
    }
    // ...
  }
}
```

Rules:
- Controllers **never** `throw new HttpException` for domain outcomes (Rule 2). Throw a typed exception in the service; the filter shapes the response.
- The filter sanitizes — **no stack traces, no SQL, no third-party body fragments** in production responses.
- Every error response carries `correlationId` and a stable `code`.
- A `try { ... } catch { return null; }` that swallows the cause is an anti-pattern. Either handle a specific known case, or let it propagate.
- A catch-all that logs and rethrows the same error is also an anti-pattern. Either handle or don't — don't pretend.

## Configuration and secrets

- `@nestjs/config` with **schema validation** at boot (Zod or Joi). Fail fast on missing/malformed config.
- Cross-cutting config lives under `src/common/config/`, separated by concern from the first file:

```script
src/common/config/
  app.config.ts          # API prefix, port, environment, app metadata
  database.config.ts     # Prisma/TypeORM connection options and pool settings
  openapi.config.ts      # DocumentBuilder, docs paths, Scalar/Swagger UI options
  logging.config.ts      # pino options, redaction, correlation fields
  config.schema.ts       # boot-time validation schema
  index.ts               # optional re-exports only; no config logic
```

- `main.ts` wires configuration; it does not define large config objects inline. OpenAPI/Swagger document config comes from `openapi.config.ts`, logger options from `logging.config.ts`, database options from `database.config.ts`, and application defaults from `app.config.ts` (Rule 10).
- 100% of runtime secrets from the project's managed secret store via managed identity (Rule 8). Never read `.env` in production code paths.
- `.env.example` documents required keys; ships no values.
- No global mutable config. Inject `ConfigService` or typed config classes; don't read `process.env.X` outside the config layer.

## Observability hooks

Required for any feature that ships:

- **Structured logs** (pino) with correlation ID, principal ID (where authenticated), feature name. Redact PII at the logger level.
- **Metrics**: request rate, latency p95, error rate, plus custom counters for business events.
- **Health endpoints**: `/health/live` (process up), `/health/ready` (deps reachable).
- **Graceful shutdown**: drain in-flight, close DB pools, ack queue messages, exit.
- **Startup checks**: DB reachable, secret store reachable, required env present. Refuse to start otherwise.

## Smells to correct

- A controller that imports a repository directly (skip the service layer).
- Business rules inside controller methods.
- Controllers that `throw new HttpException` for domain outcomes.
- Entity types appearing in DTOs (Rule 3).
- A repository method that doesn't take a `Principal` for user-content reads (Rule 7).
- A `try { ... } catch { return null; }` swallowing the cause.
- Audit-log writes outside the transaction that performed the state change.
- `forwardRef(() => OtherModule)` — usually a sign the dependency direction is wrong.
- `@Global()` on a feature module to avoid imports — `@Global()` is for genuinely cross-cutting modules only.
- Two providers for the same token in different modules with different behavior.
- OpenAPI/Swagger, database, logging, or app config built inline in `main.ts` instead of `src/common/config/<concern>.config.ts` (Rule 10).
~~~

## Original references/security-baseline.md

~~~markdown
# Security Baseline

## Contents

- [Focus](#focus)
- [Authentication](#authentication)
- [Authorization at the data layer](#authorization-at-the-data-layer)
- [Secrets and configuration](#secrets-and-configuration)
- [Audit logging](#audit-logging)
- [Input handling](#input-handling)
- [Output and error hygiene](#output-and-error-hygiene)
- [Rate limiting and abuse](#rate-limiting-and-abuse)
- [Dependency hygiene](#dependency-hygiene)
- [Pre-merge checklist](#pre-merge-checklist)

## Related references

- [`nest-architecture.md`](nest-architecture.md) — guard, pipe, filter slots in the request lifecycle that enforce these rules. See § Cross-cutting concerns.
- [`api-conventions.md`](api-conventions.md) — error shape, auth on operations, input validation at the API boundary.
- [`anti-patterns.md`](anti-patterns.md) § Authorization / § Audit and observability / § Configuration and secrets — every rule here has rejection rows there.
- [`testing-patterns.md`](testing-patterns.md) — auth-failure and forbidden-access test patterns.

## Focus

Use this reference when adding endpoints that handle user data, building anything that touches secrets, or reviewing a PR for security fitness. Mirrors Rules 7, 8, and 9 from the host project's governance file (see SKILL.md § Project rules).

## Authentication

- **JWT verification in a guard**, not middleware. Middleware doesn't get DI cleanly.
- **Verify signature, issuer, audience, expiry, and `nbf`** on every request. Don't trust client-supplied claims that aren't in the token.
- **Hydrate a `Principal`** from the token in the guard and attach it to the request via `RequestContext` (AsyncLocalStorage) or a typed property. Downstream code reads `Principal`, never `req.user`.
- **No silent fallback** to anonymous on a missing token for protected routes. 401 is correct.
- **Token rotation and revocation** are the IdP's job; don't roll your own.

## Authorization at the data layer

Rule 7: for every feature that retrieves user content, authorization filters are applied at the SQL query layer through a single mandatory-principal repository method.

```ts
// ✅ Right
interface OrderRepository {
  findByIdForPrincipal(id: OrderId, principal: Principal): Promise<Order | null>;
}

// ❌ Wrong — no overload that omits the principal
interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByIdForPrincipal(id: OrderId, principal: Principal): Promise<Order | null>;
}
```

Why: a generic `findById` is one careless caller away from a data leak. The "no overload" rule means there's no shape of the API that *can* skip the check.

Coarse role/scope checks (in guards) are for fail-fast and shaping 403 vs 404. They are **not** the enforcement point.

## Secrets and configuration

Rule 8: 100% of runtime secrets live in the project's managed secret store (Azure Key Vault, AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, or equivalent — the choice is the host project's first ADR).

| Source | Allowed for | Notes |
|---|---|---|
| Managed secret store (via managed identity / IAM role) | All production secrets | DB, third-party APIs, message bus, OAuth client secrets |
| `.env.example` | Documenting required keys | Ships **no values** |
| Local `.env` | Developer machines only | `.gitignore`d; never read in production code paths |
| App / container plaintext settings | Never | Treat as a security finding |

- Validate config at boot with a Zod / class-validator schema. Fail fast.
- Inject `ConfigService` or typed config classes; never `process.env.X` outside the config layer.
- Keep config files separated by concern under `src/common/config/` (Rule 10): `app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, and `config.schema.ts`. Secrets are referenced through typed config, not read directly in modules.
- Rotate secrets on a schedule and on suspected exposure. The runtime should pick up rotation without a deploy.

## Audit logging

Rule 9: every state change writes an immutable audit row.

Mandatory fields per row:
- `actor` (user id or system identifier)
- `timestamp` (timestamptz)
- `entity_type` + `entity_id`
- `before_state` (JSON snapshot)
- `after_state` (JSON snapshot)
- `correlation_id`

Apply to: any lifecycle transition on a state-bearing entity, decisions/approvals, role/permission changes, knowledge-source publish/retire, feature-flag changes — anything a regulator, auditor, or postmortem would need to reconstruct.

Implementation rules:
- The audit write is part of the **same DB transaction** as the state change. No fire-and-forget.
- A shared `AuditLogService` exposes `record({ entityType, entityId, before, after })`. Don't reinvent per-feature.
- Audit rows are append-only at the DB level (revoke UPDATE/DELETE).

## Input handling

- Validate at the boundary (DTO + pipe). Reject unknown fields (`forbidNonWhitelisted: true` / Zod `.strict()`).
- **Never** `JSON.parse` raw request bodies in a controller. NestJS already does this.
- For **file uploads**: enforce size, MIME type, magic-byte sniff (don't trust the extension). Use a separate scanning step for anything user-uploaded that will be stored or shared.
- For **HTML/Markdown rich text**: sanitize on **read** (consistent), not on write (lossy). Use a vetted library; don't roll your own allowlist.
- For **SQL**: use the ORM's parameterized queries. Raw SQL is allowed for performance hot paths and migrations; never interpolate user input into a raw template.
- For **shell commands**: avoid. If unavoidable, use `execFile` with an array argv, never `exec`.

## Output and error hygiene

- ProblemDetails errors carry `correlationId` and a stable `code`; **no stacks, no SQL, no third-party body fragments** in production responses.
- Don't echo the user's input back unchanged in error messages — escape or reject.
- Set security headers globally (e.g. via `helmet`):
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy: default-src 'self'; ...` (per app, not blanket)
  - `Permissions-Policy: ...` (per app)
- **CORS allowlist** by exact origin in production. No `*` for credentialed routes, ever.

## Rate limiting and abuse

Use **`@nestjs/throttler`** unless the project has an existing limiter (e.g. an upstream API gateway, Redis-backed `nestjs-throttler-storage-redis`, or a service-mesh policy). Document the choice in the project's first ADR.

**Default thresholds — start here, tune per-endpoint:**

| Route class | Limit (per principal) | Limit (per IP, unauth) | Notes |
|---|---|---|---|
| Standard authenticated GET / mutation | 100 req/min | n/a | Most CRUD endpoints. |
| Read-heavy aggregation (search, list, RAG queries) | 30 req/min | 10 req/min | Separate bucket so a noisy user can't drown the cluster. |
| Auth-sensitive (login, password reset, OTP, MFA) | 5 req/min + lockout backoff after 5 failures | 5 req/min + lockout backoff | Backoff doubles on each subsequent lockout window (1m → 2m → 4m → 15m cap). |
| Public unauthenticated GET | n/a | 60 req/min | Per-IP only; consider CAPTCHA on suspected abuse. |
| State-changing public POST | n/a | 10 req/min | Idempotency keys mandatory; reject replays beyond a 24h window. |

Rules:
- Apply rate limits **per-principal** for authenticated routes, **per-IP** for unauthenticated. When both apply, take the more restrictive.
- Auth-sensitive routes get a **second bucket** (lockout backoff on failure) on top of the request-rate bucket. Lockout decisions are recorded as audit rows (Rule 9).
- Idempotency keys for state-changing public endpoints; reject replays beyond a documented window.
- Override the default for any endpoint that has a different cost profile, and document the reason in the route's `@Throttle()` decorator (or equivalent).

## Dependency hygiene

- `pnpm audit` (or equivalent) gate in CI; fail on **high/critical** without an explicit waiver.
- Pin direct dependencies; resolve transitive vulnerabilities with overrides.
- Subscribe to upstream security advisories for NestJS, Prisma, TypeORM, and the auth library.
- License scan in CI; reject GPL-family in proprietary code.

## Pre-merge checklist

Tick on every feature PR that ships a backend change:

- [ ] All endpoints documented in OpenAPI with `security:` (scopes/roles).
- [ ] Repository methods take `Principal` mandatorily (Rule 7).
- [ ] No `process.env.X` reads outside the config layer (Rule 8).
- [ ] App, database, OpenAPI/Swagger, logging, and validation config are separated under `src/common/config/` (Rule 10).
- [ ] Audit log row written for every state change, in-transaction (Rule 9).
- [ ] DTOs reject unknown fields; file uploads enforce size + MIME.
- [ ] No stacks/SQL/third-party body fragments in production error responses.
- [ ] Rate limits set on new public routes (per the table above).
- [ ] `pnpm audit` clean (or waiver linked).
- [ ] If introducing a new third-party SDK: license + supply-chain note in PR.
~~~

## Original references/testing-patterns.md

~~~markdown
# Testing Patterns

## Contents

- [Focus](#focus)
- [Layer-by-tool table](#layer-by-tool-table)
- [Unit tests for services](#unit-tests-for-services)
- [HTTP integration tests with Supertest](#http-integration-tests-with-supertest)
- [Persistence tests with Testcontainers](#persistence-tests-with-testcontainers)
- [Fakes vs mocks](#fakes-vs-mocks)
- [Test data and fixtures](#test-data-and-fixtures)
- [Speed and isolation](#speed-and-isolation)
- [Coverage policy](#coverage-policy)
- [Smells](#smells)

## Related references

- [`nest-architecture.md`](nest-architecture.md) — what each layer does. The [Layer-by-tool table](#layer-by-tool-table) below maps to those blocks.
- [`api-conventions.md`](api-conventions.md) — ProblemDetails error shape that integration tests assert against.
- [`security-baseline.md`](security-baseline.md) — auth-failure and forbidden-access scenarios that every endpoint test must cover.
- [`anti-patterns.md`](anti-patterns.md) § Testing — every smell here has a row there with a fix and citation.

## Focus

Use this reference when writing or reviewing backend tests. The `test-backend` workflow cites this file directly; CI runs the suite this reference describes.

## Layer-by-tool table

| Layer | Tool | What you assert |
|---|---|---|
| Pure-TS helpers (interfaces, value objects, mappers) | Jest | Pure-TS behavior; no Nest, no DB |
| Services | Jest + lightweight fakes | Service method behavior, typed exceptions thrown on failure, transaction boundaries |
| Controllers + pipes + guards + filter | Nest TestingModule + Supertest | HTTP shape, validation, auth, error mapping |
| Repositories | Testcontainers | Real schema, real SQL, transactions, indexes |
| End-to-end (composed slice) | Supertest + Testcontainers | A representative path through all layers |

## Unit tests for services

```ts
describe('OrderService.approve', () => {
  it('throws OrderNotFoundException when the order does not exist', async () => {
    const repo = fakeOrderRepo({ findByIdForPrincipal: async () => null });
    const audit = fakeAudit();
    const service = new OrderService(repo, audit);

    await expect(service.approve(id, principal))
      .rejects.toBeInstanceOf(OrderNotFoundException);
    expect(audit.writes).toHaveLength(0);
  });
});
```

Rules:
- Test names describe **observable behavior**, not implementation details (`throws OrderNotFoundException when …`, not `calls repo.findById`).
- One **arrange-act-assert** per test. Multiple assertions are fine if they describe one outcome.
- Inject **fakes** through constructors. Don't reach into private state.
- **Never** spy on internal method calls (`expect(spy).toHaveBeenCalled()`) when the public outcome would tell you the same thing.

## HTTP integration tests with Supertest

```ts
describe('POST /v1/orders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ORDER_REPOSITORY).useClass(InMemoryOrderRepository)
      .compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterAll(() => app.close());

  it('returns 400 with field errors when title is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({ description: 'no title' })
      .expect(400);

    expect(res.body).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: expect.arrayContaining([
        expect.objectContaining({ field: 'title', code: 'IS_REQUIRED' }),
      ]),
    });
  });
});
```

Rules:
- Build the **real** Nest app for the slice. Override only what crosses the process boundary (DB, third-party HTTP, message bus).
- Apply the **same global pipes/filters** the production bootstrap applies. Otherwise you're testing a different app.
- Assert on the **ProblemDetails shape** for errors, not on stack traces.
- Test **auth failures** (`401`/`403`), **not found** (`404`), **conflict** (`409`), and the **happy path** for every endpoint that ships.

## Persistence tests with Testcontainers

```ts
describe('PrismaOrderRepository', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repo: PrismaOrderRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    await runMigrations(prisma);
    repo = new PrismaOrderRepository(prisma);
  }, 60_000);

  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });

  beforeEach(() => prisma.$executeRaw`TRUNCATE orders CASCADE`);

  it('rolls back on error inside a transaction', async () => { /* ... */ });
});
```

Rules:
- Use the **real database engine** (Postgres, SQL Server, etc.) — not SQLite as a stand-in.
- Run migrations before tests; **truncate** between tests rather than re-running migrations.
- Test **transactions, rollback, FK constraints, unique constraints, and concurrency** where they matter.
- Don't snapshot full result rows blindly; assert the **fields you care about**.

## Fakes vs mocks

| Use a fake when | Use a mock when |
|---|---|
| The collaborator has behavior you want to exercise (an in-memory repo with realistic semantics) | You only care that an outbound call happened (rare — usually the side effect is observable elsewhere) |
| The collaborator is at the edge of the system (HTTP, message bus) and a fake is cheap | The collaborator is internal and behaviorally rich (then prefer a real instance) |

A **fake** is a small class that implements the port; a **mock** is a `jest.fn()`. Prefer fakes — they survive refactors better.

## Test data and fixtures

- Use **builders** (`anOrder().withStatus('SUBMITTED').build()`), not raw objects scattered through tests.
- Builders default to a **valid** entity; tests override only what they assert.
- Fixtures live next to the feature, not in a global `fixtures/` folder.
- Seed data scripts and test factories are different things. Seed for dev runtime; factories for tests.

## Speed and isolation

- Each test owns its data. **No shared mutable module state** across tests.
- **No `await sleep(...)`** in tests. Use deterministic clocks (`jest.useFakeTimers`) or wait for the actual signal.
- Parallelize at the test-file level. Container-backed suites get their own DB per worker.
- Quarantining a flaky test requires a tracked fix; an indefinite `.skip` is not acceptable.

## Coverage policy

Coverage is a **floor, not a goal**. Suggested floors:

- **Domain code**: 90%+ (it's pure; there's no reason to skip).
- **Application code**: 80%+ on use cases.
- **Infrastructure code**: covered by integration / persistence tests, not unit tests.
- **Generated code**: excluded.

The interesting metric is **mutation score** if you can afford it, not line coverage.

## Smells

- Snapshotting whole HTTP responses without asserting intent.
- Tests that pass on `npm run test:single` but fail in the suite (shared state).
- Mocks for methods that aren't called by the code under test ("just in case" mocks).
- Asserting on private call ordering (`mock.calls[0][1]` after `mock.calls[1][0]`).
- Tests that need the real `Date` or real network.
- A 1000-line `setup.ts` shared across every test file.
~~~

## Original SKILL.md

~~~markdown
---
name: backend-nestjs
description: "Use for NestJS backend engineering — backend design, API contracts, validation, persistence, configuration layout, backend testing, and deployment readiness. Stack: NestJS, TypeScript, OpenAPI, class-validator/Zod, TypeORM or Prisma, Jest, Supertest, Testcontainers. Trigger on \"NestJS\", \"Node backend\", \"TypeScript API\", \"controller\", \"provider\", \"module\", \"DTO\", \"ConfigModule\", \"Prisma\", \"TypeORM\", \"Jest\", \"Supertest\"."
---
# Backend Engineer (NestJS)


## Metadata

- **version:** 0.1.6
- **default_prompt:** Use the backend-nestjs skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** NestJS backend engineering - backend design, API contracts

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

You build NestJS backends: modular, contract-first, validated, tested, observable, and ready for deployment.

## Business alignment gate

Before designing or building backend code, confirm the work traces to a **business-approved artifact**:

- PRD or ticket with acceptance criteria from `product-manager`.
- Architecture boundary / LLD from `solution-architect` when the change adds a new capability, integration, or cross-cutting concern.
- Security classification or threat-model input from `security-engineer` when data, auth, audit, or external exposure changes.
- Data ownership and migration expectation from `database-engineer` when persistence changes.

If the business outcome, acceptance criteria, or owning stakeholder is missing, stop and route back to `product-manager` or `business-analyst`. Do not turn a technical request into scope by guessing. Every backend output must include a traceability line: **business goal -> acceptance criteria -> API/module change -> tests**.

## Business-facing artifacts

- API contract and status-code/error behavior tied to acceptance criteria.
- Backend design note with module boundaries, actors, data ownership, and dependencies.
- Implemented feature with Jest/Supertest evidence.
- Migration notes and rollback impact when persistence changes.
- Handoff package for frontend, QA, code review, platform, and security.

## Where do I start?

### Workflows — ordered by SDLC phase

The five workflows form a chain. Pick the phase you are in; each workflow links to its prerequisite and successor.

| # | Phase | File | Triggered when… |
|---|---|---|---|
| 1 | **Design** the backend — modules, boundaries, cross-cutting strategy | [`workflows/design-backend.md`](workflows/design-backend.md) | An LLD lands from the architect. |
| 2 | **Define** the HTTP contract — OpenAPI, DTOs, auth, errors | [`workflows/define-api.md`](workflows/define-api.md) | The design is approved and the API surface needs to be locked. |
| 3 | **Build** the feature — controller, provider, repository, wiring | [`workflows/build-backend.md`](workflows/build-backend.md) | OpenAPI is committed and a story is ready for implementation. |
| 3* | **Test** — Jest unit, Supertest integration, Testcontainers persistence | [`workflows/test-backend.md`](workflows/test-backend.md) | Runs **alongside** `build-backend` — never after. |
| 4 | **Update persistence** — Prisma/TypeORM migrations, expand → migrate → contract | [`workflows/update-persistence.md`](workflows/update-persistence.md) | The build needs a schema change. |

### References — pick the topic

| If you're working on… | File | Consulted during |
|---|---|---|
| Architecture — building blocks, request lifecycle, DI, error handling | [`references/nest-architecture.md`](references/nest-architecture.md) | `design-backend`, `build-backend` |
| Where code lives — feature modules, multi-surface split, shared modules, cross-feature dependencies | [`references/module-boundaries.md`](references/module-boundaries.md) | `design-backend`, `build-backend` |
| HTTP shape — URLs, verbs, DTOs, validation, pagination, errors, OpenAPI | [`references/api-conventions.md`](references/api-conventions.md) | `define-api`, `build-backend` |
| Tests — Jest unit, Supertest integration, Testcontainers persistence, fakes vs mocks | [`references/testing-patterns.md`](references/testing-patterns.md) | `test-backend` |
| Auth, secrets, audit, input handling, rate limits, CORS, headers | [`references/security-baseline.md`](references/security-baseline.md) | `design-backend`, `define-api`, `build-backend`, `update-persistence` |
| A code-review citation ("why is this rejected?") | [`references/anti-patterns.md`](references/anti-patterns.md) | Any time a reviewer cites a rule — **the PR-review citation source** |

## Hard rules — non-negotiable

These are owned by the skill itself and apply on every consuming project.

1. **OpenAPI is the API dictionary.** Every HTTP endpoint must exist in OpenAPI **before or with** the implementation that serves it. Drift between code and spec is a release blocker. CI lints the spec and fails on validation errors. See [`references/api-conventions.md`](references/api-conventions.md) § OpenAPI as API dictionary.
2. **Unit tests are mandatory on every backend build.** No backend feature is "done" until it has Jest unit tests covering the acceptance criteria. The `build-backend` workflow always pairs with `test-backend` — never one without the other. PRs that ship a controller, service, or repository without unit tests are rejected without further review.
3. **Layout is mandatory from the first file.** Inside any feature module under `src/modules/<feature>/`, the only file allowed at the module root is `<feature>.module.ts`. Controllers live in `controllers/`, services in `services/`, repositories in `repositories/`, request/response DTOs in `dto/`, ORM models in `entities/` — and the same for `guards/`, `interceptors/`, `pipes/`, `decorators/`, `interfaces/`, `enums/`, `constants/` whenever those exist. Subfolders are required even when there is only one file of that kind. A flat module (e.g. `identity-access.controller.ts` at the module root) is a layout violation and is rejected at code review. CI enforces this with `dependency-cruiser` or `eslint-plugin-boundaries`. See [`references/module-boundaries.md`](references/module-boundaries.md) § Standard NestJS folder layout and § Common drift patterns.
4. **Configuration is separated by concern.** Runtime and cross-cutting config lives under `src/common/config/`, split by concern from the first file: `app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, and a validation schema file such as `config.schema.ts`. Do not build database, OpenAPI/Swagger, logger, or app config inline in `main.ts`, feature modules, or random helpers. See [`references/nest-architecture.md`](references/nest-architecture.md) § Configuration and secrets and [`references/module-boundaries.md`](references/module-boundaries.md) § Common config layout.

## Consumer requirements

The skill expects the host project to provide the following. If any item is missing, the skill still works but loses citation power — call it out in onboarding.

| Requirement | What the skill expects | If missing |
|---|---|---|
| **Project governance file** (e.g. `CLAUDE.md`, `AGENTS.md` at the repo root) | A numbered rule list the skill can cite (Rules 2, 3, 7, 8, 9, and 10 are the load-bearing ones — see below). | Either copy the rule statements into the project's governance file, or treat the rules below as the working contract. |
| **ADR folder** (e.g. `docs/adr/`) | Where deviations from this skill's defaults are recorded. | Record deviations inline in the PR description until the project adopts ADRs. |
| **Stack choices recorded** | Which ORM (Prisma or TypeORM), which OpenAPI authoring style (hand-authored or generated), which validator (class-validator or Zod). | Default to whatever the existing codebase uses; if greenfield, the choice is the project's first ADR. |
| **Shared handoff workflow** | `adp-handoffs/workflows/handoff-to-next-role.md` for cross-role baton passing. | Without it, downstream roles get bare artifacts and no rationale — usable, not ideal. |

## Project rules referenced by this skill

These are the project-side rules the skill cites by number. The skill does **not** own them — the host project's governance file does. The numbering below matches the AD Ports SDLC catalog convention; if your project numbers differently, either renumber here or update your governance file.

- **Rule 2 — No business logic in controllers.** Controllers bind, validate, authorize, delegate to a service, and map the response. They never `throw new HttpException` for domain outcomes — services throw typed exceptions and the global filter shapes the HTTP response.
- **Rule 3 — Domain isolation.** Files in `interfaces/` (and any pure-TypeScript shared types) import nothing framework-specific — no `@nestjs/*`, no decorators, no TypeORM/Prisma types. ORM entity types never appear in request or response DTOs; map explicitly.
- **Rule 4 — Feature-module folder structure.** Subfolders are mandatory from the first file: every controller goes in `controllers/`, every service in `services/`, every repository in `repositories/`, every DTO in `dto/`, every entity in `entities/`. The only file allowed at the module root is `<feature>.module.ts`. When a feature exposes more than one consumer surface, split `services/` and `dto/` into sub-folders matching the surfaces, plus `services/shared/`. See [`references/module-boundaries.md`](references/module-boundaries.md). This rule is also a skill-level Hard Rule (3) — see § Hard rules. If your project records the multi-surface split in an ADR, link yours from the project's governance file.
- **Rule 7 — Authorization at the data layer.** For features that retrieve user content, authorization filters are applied at the SQL layer through a single mandatory-principal repository method. There is no overload that omits the principal.
- **Rule 8 — Secrets in a managed secret store.** 100% of runtime secrets live in a managed secret store (Azure Key Vault, AWS Secrets Manager, or equivalent). Never in code, never in committed `.env` files, never in plaintext app-service settings. `.env.example` documents required keys but ships no values.
- **Rule 9 — Audit on every state change.** Every state-changing endpoint writes an immutable audit-log row: actor, timestamp, entity type+id, before/after JSON, correlation_id. The audit row is part of the **same DB transaction** as the state change.
- **Rule 10 — Config by concern under `src/common/config/`.** Application, database, OpenAPI/Swagger, logging, security headers, throttling, and other cross-cutting runtime settings are separate files under `src/common/config/`. Use concern-named files (`app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, etc.) with typed exports and boot-time schema validation. `main.ts` wires config; it does not define large config objects inline.

> Consumer projects may have additional rules (1, 5, 6, 11, …) that this skill does not depend on. Numbering gaps above are intentional — only rules cited by the workflows and references are listed.

## Stack — supported options

The skill supports either choice in each axis below. The host project picks one in its first ADR (or inherits from existing code) and stays consistent.

| Axis | Supported options | How the skill adapts |
|---|---|---|
| **ORM** | Prisma or TypeORM | `update-persistence` documents both. Repository pattern is the same; ORM specifics live behind the repository. |
| **OpenAPI authoring** | Hand-authored `openapi.yaml` or generated from `@nestjs/swagger` decorators | `define-api` documents both. Generated mode requires the output is **checked in** and reviewed like any other artifact. |
| **DTO validation** | class-validator + class-transformer or Zod | DTOs use the project's choice consistently. `forbidNonWhitelisted: true` (class-validator) or `.strict()` (Zod) is mandatory at the boundary. |
| **Docs UI** (renderer mounted at `/<prefix>/docs`) | **Default: Scalar API Reference** (`@scalar/nestjs-api-reference`). Alternative: Swagger UI via `SwaggerModule.setup(...)`. | Pick the default unless the project records an ADR justifying the alternative. The OpenAPI document itself (Hard Rule 1) is unchanged either way — `@nestjs/swagger` decorators still produce it. The Docs UI choice is purely the renderer. See [`references/api-conventions.md`](references/api-conventions.md) § Docs UI. |

Other elements are fixed: target the NestJS and Node versions in `/standards/framework-baselines.md` (current recommended: NestJS 11 on Node 22 LTS), TypeScript strict, Jest + Supertest + Testcontainers, `@nestjs/config` with schema validation, separated config files under `src/common/config/`, structured logging (pino), ProblemDetails-style error filter.

## Operating principles

These restate the **how** of the rules above in shorthand. The rules are authoritative; if there's a conflict, the rules win.

1. Module boundaries are explicit — no god modules. Boundaries enforced by lint (e.g. `eslint-plugin-boundaries`, `dependency-cruiser`).
2. Contracts and validation come before implementation — OpenAPI first.
3. Persistence is encapsulated behind repositories or service-internal data-access methods.
4. Tests prove behavior, errors, and readiness — not private call choreography.
5. Authorization is data-layer first; controller/guard checks are fail-fast and UX, not enforcement.
6. Configuration stays boring and findable — one concern per file under `src/common/config/`.

## Handoff

← **solution-architect** (LLD), **product-manager** (PRD/AC), **security-engineer** (threat model), **database-engineer** (schema).
→ Frontend role used by the project (`frontend-react` / `frontend-angular` / equivalent) with **OpenAPI**; **integration-engineer** (contracts); **database-engineer** (migration review); **qa-test-engineer** (test); **code-reviewer** (review gate); **platform-sre** (runtime readiness).

Always invoke partners through the project's `adp-handoffs/workflows/handoff-to-next-role.md`.

## Ownership

- **Primary owner:** `backend-nestjs` (the host project's backend tech lead is the steward).
- **Review cadence:** Quarterly, plus on any major NestJS / Prisma / TypeORM release, or any change to the cited rules.
~~~

## Original workflows/build-backend.md

~~~markdown
# Workflow: Build Backend Feature (NestJS)

## Position in the chain

- **Prerequisite:** [`define-api`](define-api.md) — OpenAPI is committed and reviewed before implementation begins.
- **Pairs with:** [`test-backend`](test-backend.md) — runs **alongside** this workflow, not after. SKILL.md hard rule 2: no build without tests.
- **Triggers when needed:** [`update-persistence`](update-persistence.md) — invoke whenever the build needs a schema change.
- **Successor:** code-review gate, then handoff to `qa-test-engineer`, `code-reviewer`, `platform-sre`.

## OpenAPI ownership note

The contract is owned by [`define-api`](define-api.md). Inside `build-backend` you only update OpenAPI for **deltas discovered during implementation** (a new error case, a missing field, a corrected example). If the change is more than a delta, stop and complete `define-api` first — drift between code and spec is a release blocker (SKILL.md hard rule 1).

## Before you start

Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] ACs, the OpenAPI contract from `define-api`, design notes from `design-backend`, data model, and runtime constraints are available.
- [ ] Business goal, owning stakeholder, and AC source are known; implementation is limited to that approved scope.
- [ ] The target files and module boundaries are clear.
- [ ] You are on the right branch.
- [ ] Project test/lint/typecheck commands are known.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult

- [`../references/nest-architecture.md`](../references/nest-architecture.md) — building blocks, request lifecycle, error handling.
- [`../references/module-boundaries.md`](../references/module-boundaries.md) — where each file goes.
- [`../references/api-conventions.md`](../references/api-conventions.md) — DTO and error shape rules.
- [`../references/security-baseline.md`](../references/security-baseline.md) — auth, secrets, audit, input handling, rate limits.
- [`../references/anti-patterns.md`](../references/anti-patterns.md) — what reviewers will reject.

## Goal

A NestJS implementation that satisfies the AC, respects module boundaries, and is ready for CI.

## Scaffold checklist — use before creating any file

Drift starts when someone creates `src/modules/<feature>/<feature>.controller.ts` instead of `src/modules/<feature>/controllers/<feature>.controller.ts`. Run this checklist **before** the first `git add` of any new file.

- [ ] The module is at `src/modules/<feature>/` (not `src/<feature>/`, not `src/infrastructure/<feature>/`).
- [ ] `<feature>.module.ts` is the **only** file at the module root. Anything else is in a subfolder.
- [ ] Each new file is placed at the path matched in the table below — even if it's the only file of its kind.
- [ ] Co-located `*.spec.ts` files sit in the **same subfolder** as the file they test (e.g. `services/<feature>.service.spec.ts`).
- [ ] No `infrastructure/` tree under the feature module. Cross-cutting infrastructure lives in a shared module — see [`../references/module-boundaries.md`](../references/module-boundaries.md) § Shared modules.
- [ ] DTO filenames end in `.dto.ts` — `current-user.response.dto.ts`, not `current-user.response.ts`.
- [ ] Any new cross-cutting config is placed under `src/common/config/<concern>.config.ts`; app, database, OpenAPI/Swagger, and logging config are separate files.
- [ ] Run `ls src/modules/<feature>` and confirm output is `<feature>.module.ts` plus subfolder names. Anything else is a layout violation — fix it before continuing.

If a file is already at the module root from a prior commit, **move it now** as part of this build. Don't add another file alongside it "just for this story" — that's how the project ends up flat.

## Steps

1. **Start with behavior tests where practical.** Add failing Jest/Supertest coverage for the acceptance scenario before implementation. See [`test-backend.md`](test-backend.md).
2. **Build inside the owning module, in the right subfolder.** Each new file goes into its layer's subfolder, never the module root. Use these exact paths:
   - Controller → `src/modules/<feature>/controllers/<feature>.controller.ts`
   - Service → `src/modules/<feature>/services/<feature>.service.ts`
   - Repository → `src/modules/<feature>/repositories/<feature>.repository.ts` (or a more specific name like `users.repository.ts`)
   - Request/response DTOs → `src/modules/<feature>/dto/<name>.dto.ts`
   - ORM entities → `src/modules/<feature>/entities/<name>.entity.ts`
   - Guards / interceptors / pipes / decorators / interfaces / enums → matching subfolder, created on first use
   - Module wiring → `src/modules/<feature>/<feature>.module.ts` (the **only** file allowed at the module root)
   - Co-locate `*.spec.ts` next to the file under test inside the same subfolder.

   Subfolders are mandatory from the first file — a flat layout (e.g. `<feature>.controller.ts` at the module root) is a layout violation, even for single-controller features. See [`../references/module-boundaries.md`](../references/module-boundaries.md) § Standard NestJS folder layout.
3. **Keep controllers thin.** Bind, validate, authorize, delegate, map response. **No business rules in controllers** — Rule 2.
4. **Keep providers focused.** One use case per method or service area. Inject dependencies through constructors and interfaces/tokens.
5. **Validate boundaries.** Use the project's validation pipe or schema parser for inbound data. Reject unknown fields. Re-check domain invariants before persistence.
6. **Handle errors centrally.** Throw typed app exceptions from the service; the global exception filter maps them to ProblemDetails responses. See [`../references/nest-architecture.md`](../references/nest-architecture.md) § Error handling.
7. **Persist intentionally.** Use the project's ORM through repositories. Wrap multi-step writes in transactions. If a schema change is needed, switch to [`update-persistence`](update-persistence.md).
8. **Audit state changes.** Every state-changing endpoint writes an audit-log row in the same transaction — Rule 9. See [`../references/security-baseline.md`](../references/security-baseline.md) § Audit logging.
9. **Add readiness hooks.** Health indicators, structured logs, metrics, graceful shutdown, and config validation where the change affects runtime. Keep runtime config in `src/common/config/` by concern; do not add large config objects to `main.ts` or feature modules.
10. **Run local checks.** Typecheck, lint, unit tests, relevant integration tests, and formatting.
11. **Verify layout.** Before finishing, confirm `ls src/modules/<feature>` shows only `<feature>.module.ts` plus subfolders (`controllers/`, `services/`, `dto/`, `entities/`, and any others added in this build). Any controller/service/repository/DTO/entity file at the module root is a layout violation and must be moved into the matching subfolder before opening the PR.

## Anti-patterns

- Direct database calls from controllers.
- Catch-all `any` DTOs or untyped request bodies.
- Swallowing downstream errors.
- Migrations generated without review.
- Audit-log writes outside the transaction that performed the state change.
- Inline OpenAPI/Swagger, database, logging, or app config in `main.ts` instead of separated files under `src/common/config/`.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) for the full PR-review citation catalog.

## After you finish

- [ ] Definition of Done items below are met.
- [ ] Evidence from tests/checks is captured in the PR or ticket.
- [ ] Open questions and runtime assumptions are explicit.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `qa-test-engineer`, `code-reviewer`, `platform-sre`.
- [ ] `git status` shows only intended changes.

## Definition of Done

- [ ] **OpenAPI is current** — any deltas discovered during implementation are reflected; the spec lints clean. (Hard rule 1.)
- [ ] **Unit tests cover the AC** — Jest tests on the service(s) for happy path, validation failures, auth failures, and any state-bearing transitions. PR is rejected without them. (Hard rule 2.)
- [ ] Traceability recorded: business goal -> AC -> API/module change -> tests.
- [ ] AC is implemented.
- [ ] Module boundaries remain clear.
- [ ] **Layout matches the standard.** Every controller/service/repository/DTO/entity sits in its named subfolder; only `<feature>.module.ts` is at the module root. See [`../references/module-boundaries.md`](../references/module-boundaries.md) § Standard NestJS folder layout.
- [ ] **Config layout matches Rule 10.** App, database, OpenAPI/Swagger, logging, and other runtime concerns are separated under `src/common/config/`.
- [ ] DTO validation and error mapping are in place.
- [ ] Persistence is isolated; if a schema change happened, `update-persistence` was completed and signed off.
- [ ] Audit rows written for every state change in the same transaction (Rule 9).
- [ ] Typecheck, lint, and relevant tests pass.
~~~

## Original workflows/define-api.md

~~~markdown
# Workflow: Define API (NestJS)

## Position in the chain
- **Prerequisite:** [`design-backend`](design-backend.md) — the design must be approved before the contract is locked.
- **Successor:** [`build-backend`](build-backend.md) — implementation begins once the OpenAPI is committed and reviewed by frontend + integration.
- **Pairs with:** [`test-backend`](test-backend.md) — contract tests against the spec start here, not after build.

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] PRD/ACs, resource model, auth requirements, and integration constraints are available.
- [ ] Each operation traces to a user/business outcome and acceptance criterion; speculative endpoints are out of scope.
- [ ] The OpenAPI destination is decided (hand-authored `openapi.yaml` or generated from `@nestjs/swagger` — see SKILL.md § Stack).
- [ ] The frontend role used by the project (`frontend-react` / `frontend-angular` / equivalent) and `integration-engineer` are identified as reviewers.
- [ ] You are on the right branch.
- [ ] Relevant API conventions have been skimmed: [`../references/api-conventions.md`](../references/api-conventions.md).

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/api-conventions.md`](../references/api-conventions.md) — REST conventions, ProblemDetails, examples policy, OpenAPI source-of-truth rules.
- [`../references/security-baseline.md`](../references/security-baseline.md) — auth on operations, output hygiene, rate-limiting requirements that must appear in the spec.

## Goal
A stable HTTP contract that NestJS implementation and consumers can build against.

## Steps
1. **Write or update OpenAPI first.** Either hand-author `openapi.yaml` or generate from decorated DTOs — whichever the project picked. Generated mode requires the output is **checked in** and reviewed.
2. **Use REST conventions.** Plural nouns, correct verbs, predictable status codes, version prefix `/v1`. See [`../references/api-conventions.md`](../references/api-conventions.md) § URL shape and versioning.
3. **Model DTOs precisely.** Request, response, and error schemas explicit. Mark nullable and optional fields intentionally — never conflate. See [`../references/api-conventions.md`](../references/api-conventions.md) § DTO naming and shape.
4. **Document validation.** Required fields, enum values, string formats, numeric ranges, and cross-field validation rules.
5. **Define pagination/filtering/sorting.** Whitelist query fields, set default and max page sizes, document stable sort behavior. See [`../references/api-conventions.md`](../references/api-conventions.md) § Pagination, filtering, sorting.
6. **Document auth per operation.** Required scopes, roles, tenant constraints, and ownership checks. See [`../references/security-baseline.md`](../references/security-baseline.md) § Authentication and § Authorization at the data layer.
7. **Standardize errors.** ProblemDetails-compatible shape with stable error codes. Never expose stacks or raw downstream errors. See [`../references/api-conventions.md`](../references/api-conventions.md) § Error shape.
8. **Add examples.** Success, validation failure, auth failure, not found, conflict, and downstream failure where applicable.
9. **Mount the docs UI.** Expose the OpenAPI document at `GET /<prefix>/docs-json` (machine-readable feed for codegen and contract tests) and the human-readable renderer at `GET /<prefix>/docs`. Default renderer is **Scalar API Reference** via `@scalar/nestjs-api-reference`; alternative is Swagger UI behind a recorded ADR. See [`../references/api-conventions.md`](../references/api-conventions.md) § Docs UI for the exact snippet.

## Anti-patterns
- Implementation-first API drift.
- `200 OK` error payloads.
- Unbounded list endpoints.
- Auth requirements hidden in prose or code only.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) for the full PR-review citation catalog.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Contract is saved, rendered, or linked in the expected location and lints clean.
- [ ] Breaking changes and assumptions are called out explicitly.
- [ ] The project's frontend role and `integration-engineer` are notified for review.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `build-backend`.
- [ ] `git status` shows only intended changes.

## Definition of Done
- [ ] Operations trace back to PRD/ACs and the consuming user journey.
- [ ] OpenAPI contract exists, lints clean, and is checked into the repo.
- [ ] Docs UI is mounted: machine-readable feed at `/<prefix>/docs-json`, human-readable renderer at `/<prefix>/docs` (Scalar by default; Swagger UI only with an ADR).
- [ ] DTOs, validation, auth, and error responses are documented.
- [ ] Examples cover happy and error paths per [`../references/api-conventions.md`](../references/api-conventions.md) § Examples policy.
- [ ] Versioning and pagination choices are clear.
- [ ] Reviewed by the project's frontend role and `integration-engineer`.
~~~

## Original workflows/design-backend.md

~~~markdown
# Workflow: Design Backend (NestJS)

## Position in the chain
- **Prerequisite:** an LLD from `solution-architect` plus PRD/ACs from `product-manager`. If either is missing, stop and request it.
- **Successor:** [`define-api`](define-api.md) — the API contract is locked once the design is approved.

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] Required inputs are available: LLD, ACs, NFRs, data model, security classification, and integration contracts.
- [ ] Business goal, owning stakeholder, and PRD/ticket source are known; if not, route back to `product-manager` or `business-analyst`.
- [ ] You know who consumes the output.
- [ ] The target file or destination is decided.
- [ ] You are on the right branch.
- [ ] Relevant standards in the host project have been skimmed.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/nest-architecture.md`](../references/nest-architecture.md) — building blocks, request lifecycle, DI, error handling.
- [`../references/module-boundaries.md`](../references/module-boundaries.md) — module layout, cross-feature dependencies, shared modules.
- [`../references/security-baseline.md`](../references/security-baseline.md) — auth, secrets, audit, headers — required for any feature touching user data.

## Goal
A modular NestJS design that is testable, observable, secure, and ready to implement.

## Steps
1. **Confirm the slice.** Capture bounded context, actors, APIs, data ownership, dependencies, and acceptance criteria.
2. **Map modules.** Define Nest modules by feature or bounded context. Keep shared modules small and dependency direction explicit. See [`../references/module-boundaries.md`](../references/module-boundaries.md).
3. **Separate responsibilities.** Controllers handle transport; services/providers own behavior; repositories (where present) own data access. See [`../references/nest-architecture.md`](../references/nest-architecture.md) § Building blocks.
4. **Plan DTOs and validation.** Use the project's chosen validator (class-validator + class-transformer or Zod — see SKILL.md § Stack). Validate inbound DTOs at the edge and preserve domain invariants inside.
5. **Define cross-cutting concerns.** Guards for authz, interceptors for logging/serialization, pipes for validation, filters for ProblemDetails-style errors. See [`../references/nest-architecture.md`](../references/nest-architecture.md) § Request lifecycle.
6. **Plan configuration.** Use `@nestjs/config` with schema validation. Put cross-cutting config under `src/common/config/`, one concern per file: `app.config.ts`, `database.config.ts`, `openapi.config.ts`, `logging.config.ts`, etc. Pull secrets from the project's managed secret store. No secrets in code or examples.
7. **Choose persistence boundary.** Use the project's ORM (Prisma or TypeORM — see SKILL.md § Stack) behind repositories. Never expose entity types as API DTOs.
8. **Plan deployment readiness.** Health checks, metrics, structured logs, graceful shutdown, migrations, and startup checks.

## Anti-patterns
- God modules that import everything.
- Controllers containing business logic.
- ORM entities reused as public API DTOs.
- Global mutable config or hidden environment assumptions.
- One catch-all config file or inline `main.ts` config for database, OpenAPI/Swagger, logging, and app settings.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) for the full PR-review citation catalog.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] The artifact is saved or linked where the next role can find it.
- [ ] Key decisions, assumptions, and open questions are explicit.
- [ ] Downstream roles are notified — the project's frontend role (`frontend-react` / `frontend-angular` / equivalent), `integration-engineer`, `qa-test-engineer`, `platform-sre`.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md`.
- [ ] `git status` shows only intended changes.

## Definition of Done
- [ ] Traceability recorded: business goal -> acceptance criteria -> backend module choices.
- [ ] Module map documented.
- [ ] Provider/repository/dependency plan documented.
- [ ] Validation, auth, error, logging, and config strategies chosen.
- [ ] Config concerns are split under `src/common/config/` with schema validation and no inline config objects in `main.ts`.
- [ ] Persistence and migration approach documented.
- [ ] Runtime readiness checks identified.
~~~

## Original workflows/test-backend.md

~~~markdown
# Workflow: Test Backend (NestJS)

## Position in the chain
- **Pairs with:** [`build-backend`](build-backend.md) — runs **alongside** the build, not after. SKILL.md hard rule 2: no build without tests.
- **Inputs from:** [`define-api`](define-api.md) (the OpenAPI contract — used for contract tests) and [`design-backend`](design-backend.md) (the modules and risk areas).
- **Successor:** handoff to `qa-test-engineer` for spec-fit verification, then `code-reviewer` (gate).

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the workflow goal and can state it in one sentence.
- [ ] ACs, OpenAPI contract, risk areas, and changed modules are known.
- [ ] Business-critical scenarios and non-negotiable failure modes are identified from the PRD/ticket.
- [ ] Test commands and CI expectations are known.
- [ ] Required test data and external dependency strategy are available.
- [ ] You are on the right branch.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/testing-patterns.md`](../references/testing-patterns.md) — layer-by-tool table, builders, fakes vs mocks, speed/isolation, coverage policy. **This is the authoritative source** — the steps below cite it.
- [`../references/anti-patterns.md`](../references/anti-patterns.md) § Testing — what reviewers will reject.

## Goal
Fast, meaningful tests that prove backend behavior, errors, persistence, and readiness.

## Steps
1. **Map ACs to tests.** Name tests after observable behavior, not implementation details. See [`../references/testing-patterns.md`](../references/testing-patterns.md) § Unit tests for services.
2. **Unit-test services.** Exercise service methods with real validation and lightweight fakes for repositories and external clients. See [`../references/testing-patterns.md`](../references/testing-patterns.md) § Unit tests for services.
3. **Integration-test HTTP.** Use Nest TestingModule plus Supertest for route behavior, guards, pipes, filters, and serialization. See [`../references/testing-patterns.md`](../references/testing-patterns.md) § HTTP integration tests with Supertest.
4. **Test persistence where risk exists.** Use Testcontainers with the real database engine — never SQLite as a stand-in. See [`../references/testing-patterns.md`](../references/testing-patterns.md) § Persistence tests with Testcontainers.
5. **Cover edge paths.** Invalid input, unauthorized/forbidden access, not found, conflict/idempotency, downstream timeout, and rollback.
6. **Prefer fakes over mocks.** See [`../references/testing-patterns.md`](../references/testing-patterns.md) § Fakes vs mocks. Do not verify private call choreography.
7. **Keep CI fast.** Isolate fixtures per test, avoid sleeps, parallelize safely, and quarantine only with a tracked fix. See [`../references/testing-patterns.md`](../references/testing-patterns.md) § Speed and isolation.
8. **Check deployment readiness.** Health endpoint, config validation failure, graceful shutdown, logs/metrics for critical flows.

## Anti-patterns
- Snapshotting whole HTTP responses without intent.
- Tests sharing mutable module state.
- Over-mocking Nest internals.
- Skipped flaky tests with no owner.
- Persistence test using SQLite as a stand-in for the real engine.

See [`../references/anti-patterns.md`](../references/anti-patterns.md) § Testing for the full citation catalog.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Test evidence and uncovered risks are documented.
- [ ] Any flaky or slow tests have a fix plan (no indefinite `.skip`).
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `qa-test-engineer` and `code-reviewer`.
- [ ] `git status` shows only intended changes.

## Definition of Done
- [ ] Tests map to business-critical scenarios, not only technical branches.
- [ ] Unit and integration tests cover changed behavior.
- [ ] ACs and edge paths are traceable to test names.
- [ ] Persistence tests use realistic dependencies where needed (Testcontainers with the real engine).
- [ ] Readiness and error behavior are verified.
- [ ] Coverage meets the floor in [`../references/testing-patterns.md`](../references/testing-patterns.md) § Coverage policy.
- [ ] Relevant tests pass locally and are CI-ready.
~~~

## Original workflows/update-persistence.md

~~~markdown
# Workflow: Update Persistence (Prisma / TypeORM)

## Position in the chain
- **Triggered by:** [`build-backend`](build-backend.md) — invoked whenever the build needs a schema change, or by a standalone schema-change story.
- **Pairs with:** [`test-backend`](test-backend.md) § Persistence tests with Testcontainers — every migration ships with a persistence test on a prod-shape clone.
- **Successor:** handoff to `database-engineer` (review), then `platform-sre` (deploy plan), then code-review gate.

## Before you start
Confirm you have what you need before doing the work. If any item is missing, pause and ask — do not fabricate.

- [ ] You understand the **goal** of this workflow (see below) and can state it in one sentence.
- [ ] The **inputs** are available: schema-change requirement, ACs, data classification, current ER snapshot, deploy/rollback window.
- [ ] Business reason for the data change, data owner, and affected user/business process are known.
- [ ] You know **who consumes the output**: `database-engineer` for review, `platform-sre` for deploy.
- [ ] The **target migration destination** is decided (Prisma `prisma/migrations/`, TypeORM `src/db/migrations/`, or repo equivalent).
- [ ] You are on the **right branch** (never work directly on `main`/`master`).
- [ ] Rule 3 (domain isolation) and Rule 9 (audit on state change) from the host project's governance file have been reviewed. See SKILL.md § Project rules referenced by this skill.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/anti-patterns.md`](../references/anti-patterns.md) § Persistence — every reviewer-cited persistence rule.
- [`../references/security-baseline.md`](../references/security-baseline.md) § Audit logging — required for any state-bearing entity.
- [`../references/module-boundaries.md`](../references/module-boundaries.md) § What goes where — entities and repositories layer rules.

## Goal
A schema change that is safe to deploy, reversible, and decoupled from the code release.

## Steps
1. **Categorize the change.** Additive (new column nullable, new table, new index), destructive (drop column/table, rename), or data-shape (type change, NOT NULL on existing column, FK change). Destructive and data-shape changes require `database-engineer` review.
2. **Generate the migration.**
   - **Prisma:** edit `schema.prisma`, then `pnpm prisma migrate dev --name <slug>` for dev. Review the generated SQL in `prisma/migrations/*/migration.sql` before commit. Never use `prisma db push` against a shared environment.
   - **TypeORM:** `pnpm typeorm migration:generate -n <Name>` (or write the migration by hand for non-trivial changes). Review the generated `up`/`down` blocks before commit.
3. **Edit if needed.** Generated migrations are a starting point. Add explicit indexes, partition keys, batched backfill steps, or `CONCURRENTLY` clauses (Postgres) where the table is hot.
4. **Backward-compatible by default — expand → migrate → contract.**
   - **Expand:** add the new column/table nullable; ship code that reads BOTH old + new shapes.
   - **Migrate:** backfill data in batches (idempotent, logged, throttled).
   - **Contract:** in a later release, remove the old code path, then drop the old column. Never combine "drop column" with "remove code that reads it" in the same release.
5. **Backfill scripts.** Idempotent, batched (`LIMIT` + cursor), logged with progress, restartable. Never `UPDATE` an entire production table in one statement. For Prisma, prefer raw SQL via `$executeRaw` for batch jobs; for TypeORM, prefer `QueryRunner` with explicit transactions.
6. **Audit alignment (Rule 9).** If the migration changes a state-bearing entity, confirm the audit-log table is covered for the new shape. Audit rows must capture before/after JSON.
7. **Test apply + rollback on a prod-shape clone.** Run forward, run backward, verify no orphaned rows or broken FKs. Capture timing — anything > 30s on a hot table needs an online strategy.
8. **`database-engineer` review** for anything beyond trivial additive columns. Sign-off recorded in PR.
9. **Never auto-migrate at app boot.** Migrations run via a separate pipeline step or one-shot job, not from `app.listen()`.
10. **Document** in the migration header: why, blast radius (tables/rows affected), expected duration, rollback steps, related ADR if applicable.

## Anti-patterns
- Auto-applying migrations on app start (`migrationsRun: true` in production, `prisma migrate deploy` in `bootstrap()`).
- Using `prisma db push` against staging/production.
- Dropping a column in the same release as removing the code that reads it.
- Seed data that mutates production records.
- ORM models leaking into API DTOs or domain types (Rule 3).
- Skipping audit-log coverage for state-bearing entities (Rule 9).

See [`../references/anti-patterns.md`](../references/anti-patterns.md) § Persistence for the full citation catalog.

## After you finish
- [ ] All Definition of Done items below are met.
- [ ] The migration is committed at its documented path; the PR description records intent, blast radius, and rollback.
- [ ] A one-paragraph summary of what changed + key decisions is in the PR or ticket.
- [ ] Open questions / assumptions are explicitly listed, not hidden.
- [ ] Handoff package prepared via `adp-handoffs/workflows/handoff-to-next-role.md` for `database-engineer`, `platform-sre`, and `security-engineer` (if data classification changed).
- [ ] If this surfaced a risk or policy gap, it is captured (risk register, security finding, governance update) rather than only mentioned in chat.
- [ ] `git status` shows only intended changes.

Run the project's test suite (including the persistence tests in [`test-backend.md`](test-backend.md)) before declaring done.

## Definition of Done
- [ ] Traceability recorded: business reason -> data owner -> affected process -> migration/rollback plan.
- [ ] Generated SQL reviewed and edited where needed.
- [ ] Apply + rollback tested on a prod-shape clone.
- [ ] Backfill script (if needed) tested for idempotency and restartability.
- [ ] Expand → migrate → contract phases mapped to releases.
- [ ] `database-engineer` signed off.
- [ ] Migration header documents intent, blast radius, rollback.
- [ ] No auto-migrate on app boot.
- [ ] Audit-log coverage confirmed for state-bearing entities (Rule 9).
~~~

