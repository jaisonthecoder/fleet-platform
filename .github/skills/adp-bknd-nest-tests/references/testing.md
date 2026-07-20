# NestJS Testing Patterns

## Table of Contents

- [Focus](#focus)
- [Layer-by-tool table](#layer-by-tool-table)
- [Unit testing](#unit-testing)
- [Integration testing](#integration-testing)
- [Contract testing](#contract-testing)
- [End-to-end testing](#end-to-end-testing)
- [Coverage policy](#coverage-policy)
- [Auto-mocking high-dependency providers](#auto-mocking-high-dependency-providers)
- [Overriding globally-registered guards / pipes / filters / interceptors](#overriding-globally-registered-guards--pipes--filters--interceptors)
- [Testing REQUEST-scoped providers](#testing-request-scoped-providers)
- [Overriding an entire module](#overriding-an-entire-module)
- [Vitest as an alternative](#vitest-as-an-alternative)
- [Anti-patterns catalog](#anti-patterns-catalog)
- [CI integration](#ci-integration)

## Focus

This reference is the authoritative source cited by every workflow in `adp-bknd-nest-tests`. It covers the four NestJS test layers (unit, integration, contract, end-to-end), the tools that own each layer, the coverage floor enforced in CI, and the anti-patterns reviewers reject. Read only the section the active workflow points at — do not load the whole file by default.

## Layer-by-tool table

| Layer | Tool | Why | Speed | Coverage focus |
|---|---|---|---|---|
| Pure-TS helpers (interfaces, value objects, mappers, validators) | Jest + `class-validator` | No Nest, no DB, no DI; deterministic | <50 ms / file | Branch coverage on rule logic, locale formatting (Arabic/English), Asia/Dubai date math |
| Services, pipes, guards | Jest + lightweight fakes (or full `TestingModule` when DI scope matters) | Test method behavior, typed exceptions, transaction boundaries, guard logic | <200 ms / file | Service paths, RBAC decisions, tenant filtering |
| Controllers + pipes + guards + filters + interceptors | `@nestjs/testing` `TestingModule` + Supertest | Real HTTP envelope, validation, auth, `ProblemDetails` shape | <2 s / file | Route matrix × negative paths (400/401/403/404/409), correlation IDs |
| Repositories | Testcontainers + real engine (Postgres / SQL Server / Mongo) | Real schema, real SQL, real transactions, FKs, indexes, concurrency | 5–30 s startup, <500 ms / test | Migration correctness, query plans, transaction rollback |
| Cross-service contract | Pact JS (consumer + provider) | Prevent silent breakage across team boundaries | <5 s consumer, 15–60 s provider | Every interaction the consumer relies on |
| End-to-end (composed slice) | In-process `INestApplication` + Testcontainers (Postgres + Redis + Kafka) | One real business scenario through the full stack | 30 s – 2 min / scenario | Happy + critical-failure path |

## Unit testing

### Jest configuration

Use `ts-jest` with `isolatedModules: true` for fast TypeScript compilation. Pin `process.env.TZ = 'Asia/Dubai'` in `jest.setup.ts` so customs cut-off logic is deterministic. Configure `jest-junit` so CI uploads `junit.xml`.

```ts
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/**/index.ts'],
  coverageThreshold: { global: { lines: 75, branches: 65 } },
  setupFilesAfterEach: ['<rootDir>/test/jest.setup.ts'],
  reporters: ['default', ['jest-junit', { outputDirectory: 'reports', outputName: 'junit.xml' }]],
};
```

### `jest-mock` for sparse spies, fakes for behavior

```ts
// fake: survives refactors, models tenant isolation
class InMemoryVesselRepository implements VesselRepository {
  private byTenant = new Map<string, Vessel[]>();
  async findByImoForTenant(imo: string, tenantId: string) {
    return (this.byTenant.get(tenantId) ?? []).find(v => v.imo === imo) ?? null;
  }
}

// mock: when you only care that an outbound call happened
const audit = { write: jest.fn() };
```

A **fake** implements the port; a **mock** is a `jest.fn()`. Prefer fakes — they catch tenant-leak and RBAC regressions that mocks silently miss.

### Builders for fixtures

```ts
// test/builders/vessel.builder.ts
export const aVessel = () => new VesselBuilder();
class VesselBuilder {
  private v: Vessel = { imo: '9300000', tenantId: 'PCFC', eta: new Date('2026-06-26T18:00:00+04:00') };
  forTenant(t: string) { this.v.tenantId = t; return this; }
  withEta(iso: string) { this.v.eta = new Date(iso); return this; }
  build(): Vessel { return { ...this.v }; }
}
```

Builders default to a valid entity; tests override only the field they assert. Builders live next to the feature, not in a global `fixtures/` folder.

### `class-validator` DTOs tested directly

```ts
it('rejects vessel payload missing imo', async () => {
  const dto = plainToInstance(CreateVesselDto, { name: 'MV Khalifa' });
  const errors = await validate(dto);
  expect(errors.map(e => e.property)).toContain('imo');
});
```

Push purely structural DTO validation into a unit test, not the HTTP integration suite — it runs 10× faster and pinpoints the constraint.

## Integration testing

### TestingModule deep dive

```ts
let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [VesselsModule, DatabaseTestModule] })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx) => attachPrincipal(ctx, 'pcfc-operator') })
    .overrideProvider(SAP_CUSTOMS_CLIENT).useValue(new NockBackedCustomsClient())
    .compile();

  app = mod.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new TenantInterceptor());
  await app.init();
});

afterAll(() => app.close());
```

Rules:

- **Build the real Nest app.** Override only at the process boundary (auth guard, outbound HTTP client, clock).
- **Apply the same global pipes/filters/interceptors production applies.** Anything you skip is a test of a different app.
- **Compose one app per `describe`** (or per file if isolation holds). Sharing a global app across unrelated suites leaks state.

### Supertest patterns

```ts
it('returns 400 with field errors when imo is missing', async () => {
  const res = await authedRequest(app, { tenantId: 'PCFC', role: 'operator' })
    .post('/v1/vessels')
    .send({ name: 'MV Khalifa' })
    .expect(400);

  expect(res.body).toMatchObject({
    status: 400,
    code: 'VALIDATION_FAILED',
    errors: expect.arrayContaining([
      expect.objectContaining({ field: 'imo', code: 'IS_REQUIRED' }),
    ]),
    traceId: expect.stringMatching(/^[0-9a-f]{32}$/),
  });
});
```

Centralize `authedRequest(app, principal)` so token shape changes happen in one place. Never hand-construct `Authorization` headers inline.

### Testcontainers — Postgres

```ts
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('adports_test')
    .withUsername('test')
    .withPassword('test')
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
  await runMigrations(process.env.DATABASE_URL);
}, 60_000);

afterAll(() => container.stop());
beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE vessels, declarations RESTART IDENTITY CASCADE');
});
```

Pin the container image tag to the same Postgres major version production runs. Truncate between tests is simpler than transaction-wrapping; transaction-wrapping is faster once suites grow.

### BullMQ test patterns

```ts
let redis: StartedRedisContainer;
let queue: Queue<CustomsJob>;
let worker: Worker<CustomsJob>;

beforeAll(async () => {
  redis = await new RedisContainer('redis:7').start();
  const connection = { host: redis.getHost(), port: redis.getMappedPort(6379) };
  queue = new Queue('customs', { connection });
  worker = new Worker('customs', async (job) => customsProcessor.process(job), { connection });
});

afterAll(async () => { await worker.close(); await queue.close(); await redis.stop(); });

it('moves job to DLQ after 3 retries when SAP returns 503', async () => {
  sapNock.replyTimes(3, 503);
  const job = await queue.add('clear', { vesselImo: '9300000' }, { attempts: 3, backoff: { type: 'fixed', delay: 50 } });
  await waitFor(async () => {
    const state = await job.getState();
    expect(state).toBe('failed');
  });
  const dlq = await queue.getJobs(['failed']);
  expect(dlq).toHaveLength(1);
});
```

In-memory queue stubs do not exercise visibility timeouts, lock loss, repeat jobs, or DLQ paths. Always use a real Redis via Testcontainers.

### Kafka contract tests

For Kafka producers/consumers, start `KafkaContainer('confluentinc/cp-kafka:7.6.0')` and assert on the produced messages via a test consumer. For schema-governed topics, validate the produced message against the Avro/JSON Schema in the schema registry as part of the test — this is the lightweight contract test that complements Pact for HTTP.

### Time abstraction

Inject a `Clock` port. In tests, use `jest.useFakeTimers({ now: new Date('2026-06-26T17:55:00+04:00'), advanceTimers: true })` so customs cut-off (18:00 Asia/Dubai) logic is deterministic. `BullMQ` `delay`, `@nestjs/schedule` cron, and any code that calls `new Date()` must go through the injected clock — otherwise tests are flaky on slow CI.

## Contract testing

### Pact JS consumer

```ts
const pact = new PactV3({
  consumer: 'adp-vessel-svc',
  provider: 'sap-customs-api',
  dir: path.resolve(__dirname, '../pacts'),
});

it('clears a vessel via customs API', async () => {
  pact.addInteraction({
    states: [{ description: 'a vessel with IMO 9300000 exists' }],
    uponReceiving: 'a request to clear vessel 9300000',
    withRequest: { method: 'POST', path: '/v1/clearances', body: { imo: '9300000' } },
    willRespondWith: { status: 200, body: { clearanceId: like('cl_123'), status: 'CLEARED' } },
  });

  await pact.executeTest(async (mockServer) => {
    const client = new SapCustomsClient(mockServer.url);
    const result = await client.clearVessel('9300000');
    expect(result.status).toBe('CLEARED');
  });
});
```

### Pact JS provider

```ts
new Verifier({
  providerBaseUrl: 'http://localhost:3001',
  provider: 'adp-vessel-svc',
  pactBrokerUrl: process.env.PACT_BROKER_URL,
  providerVersion: process.env.GIT_SHA,
  providerVersionBranch: process.env.GIT_BRANCH,
  publishVerificationResult: true,
  stateHandlers: {
    'a vessel with IMO 9300000 exists': async () => {
      await prisma.vessel.create({ data: { imo: '9300000', tenantId: 'PCFC', eta: new Date() } });
    },
  },
}).verifyProvider();
```

### Broker + `can-i-deploy`

```bash
pact-broker publish ./pacts \
  --consumer-app-version=$GIT_SHA \
  --branch=$GIT_BRANCH \
  --broker-base-url=$PACT_BROKER_URL \
  --broker-token=$PACT_BROKER_TOKEN

pact-broker can-i-deploy \
  --pacticipant=adp-vessel-svc \
  --version=$GIT_SHA \
  --to-environment=staging
```

Non-zero exit from `can-i-deploy` blocks the deploy step. This is the only acceptable signal that cross-service compatibility holds.

## End-to-end testing

### In-process vs deployed

| Mode | Use when | Trade-off |
|---|---|---|
| **In-process** `INestApplication` + Testcontainers (preferred) | The scenario can run with containerized infra; you control timing and seed data | Fast, hermetic, deterministic; cannot exercise real partner sandboxes |
| **Deployed environment** (staging URL) | Scenario requires real network egress, real Azure/AWS managed services that cannot run in containers, or a real partner sandbox | Slower, flakier, harder to isolate; required when integration goes beyond what Testcontainers can mimic |

Document the harness mode in the file header (`/** @harness in-process */`).

### File layout

```
test/
  e2e/
    vessel-arrival.e2e-spec.ts
    customs-failure-saga.e2e-spec.ts
    fixtures/
      pcfc-tenant.ts
```

Tag each describe block: `describe('vessel arrival @e2e', () => {...})`. CI runs E2E in a stage separate from PR-blocking suites.

### Polling helper

```ts
export async function waitFor<T>(
  fn: () => Promise<T>,
  { timeout = 10_000, interval = 100 }: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, interval)); }
  }
  throw lastErr;
}
```

Use `waitFor` to assert on async worker outcomes. Forbid `await sleep(...)`.

## Coverage policy

| Layer | Floor | How measured |
|---|---|---|
| Line coverage on changed files | 75% | `jest --coverage --collectCoverageFrom='src/<slice>/**'` |
| Branch coverage on changed files | 65% | Same command, `coverageThreshold` enforced |
| Mutation score on critical domain (pricing, customs, billing, tenant guards) | 70% | Stryker; survived mutants reported as PR comments |
| Generated code | Excluded | `coveragePathIgnorePatterns` |

Coverage is a **floor, not a goal**. The interesting metric is **mutation score** on critical modules — a 90%-line test suite with 30% mutation score has theatre coverage.

```bash
pnpm test --coverage --ci
pnpm stryker run    # critical domain modules only; configure in stryker.conf.json
```

## Auto-mocking high-dependency providers

For a class with 5+ injected providers, listing every `.overrideProvider(...)` is noise. Use `useMocker` with `jest-mock`'s `ModuleMocker`:

```ts
import { ModuleMocker, MockMetadata } from 'jest-mock';
const moduleMocker = new ModuleMocker(global);

const moduleRef = await Test.createTestingModule({
  controllers: [VesselsController],
})
  .useMocker((token) => {
    if (token === CustomsService) {
      return { lookupHsCode: jest.fn().mockResolvedValue('1234.56') };
    }
    if (typeof token === 'function') {
      const meta = moduleMocker.getMetadata(token) as MockMetadata<any, any>;
      const Mock = moduleMocker.generateFromMetadata(meta) as ObjectConstructor;
      return new Mock();
    }
  })
  .compile();
```

**When NOT to use:** when the test asserts side effects on >2 collaborators, explicit overrides are clearer. `REQUEST` and `INQUIRER` cannot be auto-mocked.

## Overriding globally-registered guards / pipes / filters / interceptors

If `JwtAuthGuard` is registered as `{ provide: APP_GUARD, useClass: JwtAuthGuard }`, the `TestingModule` cannot override it — `useClass` creates a new instance owned by the multi-provider slot.

**Correct production registration:**

```ts
providers: [
  JwtAuthGuard,
  { provide: APP_GUARD, useExisting: JwtAuthGuard },
],
```

**Test:**

```ts
await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(JwtAuthGuard)
  .useClass(MockAuthGuard)
  .compile();
```

Every controller route ships with at least one Supertest test for the AuthN failure (401) and AuthZ failure (403) — both require this override to work.

## Testing REQUEST-scoped providers

```ts
const contextId = ContextIdFactory.create();
jest.spyOn(ContextIdFactory, 'getByRequest').mockImplementation(() => contextId);

const handler = await moduleRef.resolve(TenantScopedHandler, contextId);
const tenant = await moduleRef.resolve(TENANT_TOKEN, contextId);
```

Use this pattern when the unit under test is `Scope.REQUEST` or depends on a request-scoped collaborator. Calling `moduleRef.get(token)` on a request-scoped provider returns a fresh instance and bypasses the request sub-tree entirely.

## Overriding an entire module

```ts
await Test.createTestingModule({ imports: [AppModule] })
  .overrideModule(DatabaseModule)
  .useModule(InMemoryDatabaseModule)
  .compile();
```

Use when swapping every provider in the target module would be noisier than swapping the module.

## Vitest as an alternative

NestJS 11+ runs cleanly on Vitest with `@nestjs/testing`. The same TestingModule API works; replace `jest.fn()` with `vi.fn()` and `jest.spyOn` with `vi.spyOn`. Use Vitest only when:

- The repo already uses Vite for the frontend and a unified test runner is wanted.
- ESM-only dependencies break ts-jest transformation.

Otherwise prefer Jest 30 (lower migration cost).

## Anti-patterns catalog

| Smell | Why it bites | Fix |
|---|---|---|
| **SQLite as Postgres stand-in** | Hides FK cascade, JSONB, `timestamptz`, partial-index, concurrent-update bugs that tenant tables depend on | Use `@testcontainers/postgresql` |
| **Snapshot bloat** (full HTTP response snapshots) | Locks in `traceId`, timestamps, locale strings; thrashes on Arabic/RTL changes | Assert specific fields with `expect.objectContaining` |
| **Async deadlocks (missing `await`)** | Test passes by accident because the promise resolved after the assertion | Lint with `@typescript-eslint/no-floating-promises`; fail PRs on unawaited promises |
| **DI scope confusion** (`REQUEST` vs `DEFAULT` vs `TRANSIENT`) | `new MyService(deps)` works in tests but throws `Nest can't resolve dependencies` in production | Always build via `TestingModule.compile()` when DI scopes matter |
| **Missing 401/403 tests** | Misconfigured `RolesGuard` or `TenantInterceptor` ships unnoticed | One 401, one 403, one cross-tenant 404 mandatory per controller route |
| **Hand-rolled HTTP fakes** instead of Pact | Drift silently the moment the real provider changes | Pact for cross-service; `nock` only for outbound integration tests |
| **In-memory BullMQ stubs** | Skip visibility timeout, lock loss, repeat jobs, DLQ — the only failures worth testing | Real Redis via Testcontainers |
| **Shared global `INestApplication`** | Interceptor state, `REQUEST`-scoped providers, module-level mutation leak across files | One app per `describe` block (or per file if isolation holds) |
| **`await sleep(5000)`** | Brittle on slow CI, flaky on fast laptops | `waitFor` polling helper |
| **Asserting only the happy path** | The interesting failure modes never get exercised | One happy + one critical-failure per scenario |
| **Tests of `jest.fn()` choreography** (`expect(spy).toHaveBeenCalledWith(...)`) | Asserts implementation, not behavior; brittle under refactor | Assert observable outcomes; prefer fakes that surface the side effect naturally |
| **Skipping global pipes/filters in the test app** | Test green-lights payloads production rejects; never sees the real 400 envelope | Apply the same `ValidationPipe`, `ProblemDetailsFilter`, interceptors as the bootstrap |

## CI integration

### Command per stage

```bash
# Fast suite (blocks PR merge): unit + integration, <10 min total
pnpm test --ci --coverage --runInBand --reporters=default --reporters=jest-junit

# Contract suite (blocks PR merge): consumer pacts publish + provider verification
pnpm test:contract --ci --runInBand
pact-broker publish ./pacts --consumer-app-version=$GIT_SHA --branch=$GIT_BRANCH
pact-broker can-i-deploy --pacticipant=$SVC --version=$GIT_SHA --to-environment=staging

# E2E (nightly + on-demand, separate stage): full-scenario coverage
pnpm test:e2e --ci --runInBand

# Mutation (nightly, critical modules only)
pnpm stryker run
```

### Gate criteria

| Stage | Gate | Action on fail |
|---|---|---|
| Fast suite | All tests pass; coverage on changed files ≥75% line / ≥65% branch | Block PR merge |
| Contract suite | Consumer pacts publish; provider verification green; `can-i-deploy` exits zero | Block PR merge |
| E2E (nightly) | All `@e2e` scenarios pass | Page on-call; do not auto-block trunk |
| Mutation (nightly) | No new survived mutants in critical modules vs baseline | PR comment with survived list; block release if uncleared |

### Required artifacts uploaded by CI

- `reports/junit.xml` — Jest test results, surfaced in the PR check.
- `coverage/lcov-report/` — coverage HTML, uploaded to the artifact store.
- `coverage/lcov.info` — coverage data for SonarQube / Codecov.
- `pacts/*.json` — contracts published to the broker.
- `reports/mutation/index.html` — Stryker HTML, when the mutation stage ran.
- `testcontainers.log` — container startup logs, attached on failure for debugging.

### Local equivalents

```bash
# Mirror the fast suite locally before push
pnpm test --ci --coverage --runInBand

# Run one E2E scenario while iterating
pnpm jest test/e2e/vessel-arrival.e2e-spec.ts --runInBand

# Run mutation on one module while iterating
pnpm stryker run --mutate 'src/customs/**/*.ts'
```
