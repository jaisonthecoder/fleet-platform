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
