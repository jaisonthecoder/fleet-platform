# Workflow: Test Integration (NestJS)

## Position in the chain
- **Pairs with:** the controller / processor / module slice from `adp-bknd-nest-api`, `adp-bknd-nest-db`, or `adp-bknd-nest-consumer`. Integration tests run **after** unit tests cover the service layer and **before** contract or E2E tests.
- **Inputs from:** the OpenAPI contract from `adp-bknd-nest-architecture`, the migrations from `adp-bknd-nest-db`, the global pipes/filters/interceptors from `adp-bknd-nest-crosscut`, and the auth/guard wiring from the bootstrap.
- **Successor:** `test-contract.md` for cross-service Pact verification; `test-e2e.md` for full-scenario coverage.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
- [ ] Docker Desktop / Colima is running and `@testcontainers/postgresql` (or your engine module) is installed.
- [ ] The same Postgres / SQL Server / Mongo version that production runs is pinned in the container image tag.
- [ ] Database migrations apply cleanly from an empty schema (`pnpm migration:run`).
- [ ] The bootstrap-equivalent global pipes (`ValidationPipe`), filters (`ProblemDetailsFilter`), and interceptors (`TenantInterceptor`, `CorrelationIdInterceptor`) are exported from a shared module you can re-import in tests.
- [ ] You are on a feature branch, not `main`.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/testing.md`](../references/testing.md) § Integration testing — TestingModule deep dive, Supertest patterns, Testcontainers, BullMQ/Kafka, time abstraction. **Authoritative source.**
- [`../references/testing.md`](../references/testing.md) § Anti-patterns catalog — SQLite stand-in, shared global app, hand-rolled auth.

## Goal
Prove that the HTTP boundary, guards, pipes, filters, interceptors, and persistence layer behave correctly together against the real database engine and a production-shaped Nest app.

## Steps
1. **Compose the real Nest app.** Build the module under test (or the slice-specific feature module) via `Test.createTestingModule({ imports: [TestModule] }).compile()`, call `mod.createNestApplication()`, apply the **same** global `ValidationPipe`, `ProblemDetailsFilter`, `TenantInterceptor`, and `CorrelationIdInterceptor` the production bootstrap applies, then `await app.init()`. Anything you skip is a test of a different app.
2. **Override only at the process boundary.** Replace the JWT guard with a deterministic version using `.overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx) => attachPrincipal(ctx, 'pcfc-operator') })`. Replace outbound HTTP via `nock` and assert the outbound call shape. Replace the clock with `jest.useFakeTimers({ now: ... })`. **Do not** override repositories — let them hit Testcontainers.
3. **Boot the real database engine via Testcontainers.** In `beforeAll`, start `new PostgreSqlContainer('postgres:16').withDatabase('adports_test').start()`, point Prisma/TypeORM/MikroORM at the connection URI, and run migrations. SQLite is forbidden — it hides FK cascade, `timestamptz`, JSONB containment, partial-index, and concurrent-update bugs that AD Ports tenant tables depend on.
4. **Reset data between tests.** Two acceptable patterns: (a) `TRUNCATE <table> RESTART IDENTITY CASCADE` in `beforeEach` (simple, slower) or (b) wrap each test in a transaction and roll back in `afterEach` (faster, but Prisma needs `$transaction` + interactive transactions enabled). Pick one per suite and document it in the file header.
5. **Drive through Supertest.** `await request(app.getHttpServer()).post('/v1/vessels').set('x-tenant-id', 'PCFC').send(payload).expect(201)`. Use a helper (`authedRequest(app, principal)`) to attach correlation IDs and tenant headers — never hand-construct auth headers inline.
6. **Assert the envelope, not snapshots.** For errors, assert RFC 7807 `ProblemDetails` shape: `{ status, code, title, detail, errors[].field, errors[].code, traceId }`. For success, assert the DTO fields plus `ETag` / `Last-Modified` where the route emits them. Assert correlation IDs round-trip from request header to response header.
7. **Cover the negative paths every route ships.** One 400 (validation), one 401 (no auth), one 403 (wrong role / wrong tenant), one 404 (missing resource), one 409 (idempotency or unique-constraint violation), plus the happy path. Cross-tenant access must return 404 (not 403) per the tenancy convention.
8. **Run with the real CI command.** `pnpm test:integration --runInBand --testPathPattern='\.spec\.ts$' --reporters=default --reporters=jest-junit`. Use `--runInBand` because Testcontainers ports collide under parallel workers unless you template per-worker DB names.

## Global enhancers override checklist

Before writing integration tests for any controller route:

- [ ] Confirm globally-registered guards/pipes/filters/interceptors use `useExisting`.
- [ ] Override the guard in the TestingModule.
- [ ] Add one 401 test (missing token) and one 403 test (wrong tenant / wrong role).
- [ ] Assert RFC 7807 problem details: `code`, `traceId`, `instance`.

## Anti-patterns
- **SQLite as a Postgres stand-in.** It does not implement `timestamptz`, JSONB operators, partial indexes, or row-level concurrency the way Postgres does — a passing test means nothing.
- **Sharing one global `INestApplication` across unrelated suites.** Module-level mutation, interceptor state, and `REQUEST`-scoped providers leak across files. Build the app per `describe` block (or per file, if isolation holds).
- **Hand-rolling JWT headers inline.** `set('Authorization', 'Bearer eyJ...')` strewn across files goes stale at the first token-shape change. Centralize via a helper that constructs principals.
- **Asserting on full response snapshots.** Volatile fields (`traceId`, timestamps, generated UUIDs) thrash snapshots and hide intent. Match shape with `expect.objectContaining` and assert specific fields.
- **Skipping the global `ValidationPipe` / `ProblemDetailsFilter` in the test app.** The test then green-lights payloads production would reject — and never sees the real 400 envelope.
- **Mocking the repository in an integration test.** It defeats the purpose. If you must mock, the test is a unit test — move it.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Testcontainers startup logs are captured and the database engine + version match production.
- [ ] Every controller route changed in this slice has happy + 400 + 401 + 403 + 404 + 409 (where applicable) coverage.
- [ ] `pnpm test:integration --ci --runInBand` passes locally and emits `junit.xml`.
- [ ] `git status` shows only intended changes (new `*.spec.ts`, shared test helpers, Testcontainers setup).
- [ ] Hand off to `test-contract.md` if the slice is a Pact consumer/provider; otherwise to `test-e2e.md`.
- [ ] Notify downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-platform-engineer`.

## Definition of Done
- [ ] Real `INestApplication` composed with production-equivalent global pipes/filters/interceptors.
- [ ] Real database engine via Testcontainers; SQLite stand-in not used.
- [ ] Auth/tenant overrides go through `.overrideGuard` and a `authedRequest` helper.
- [ ] RFC 7807 `ProblemDetails` shape asserted on every error response.
- [ ] Cross-tenant access returns 404 and is covered.
- [ ] Outbound HTTP intercepted via `nock`; no live network in tests.
- [ ] Tests pass in CI with `--runInBand` and emit JUnit XML.
