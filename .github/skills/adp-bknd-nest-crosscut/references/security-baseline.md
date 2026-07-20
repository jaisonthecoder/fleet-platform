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
