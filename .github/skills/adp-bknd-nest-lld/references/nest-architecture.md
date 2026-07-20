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
