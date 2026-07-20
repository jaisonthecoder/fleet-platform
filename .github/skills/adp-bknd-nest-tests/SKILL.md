---
name: adp-bknd-nest-tests
description: "NestJS unit, integration, contract, and end-to-end test authoring for the backend slice (Jest, ts-jest, Supertest, @nestjs/testing TestingModule, Testcontainers, Pact, Stryker, coverage). Use when producing or updating \\\"backend Nest test files (*.spec.ts, *.e2e-spec.ts), integration/contract/E2E test suites, coverage/mutation evidence\\\". Owned by AI Backend Engineer (NestJS)."
---

# adp-bknd-nest-tests

## Metadata

- **kind:** skill
- **version:** 0.3.4
- **stability:** alpha
- **role:** ai-backend-nestjs
- **tiers:** essentials: baseline · advanced: baseline · enterprise: baseline
- **why_critical:** Framework-specific NestJS test patterns (TestingModule overrides, Supertest against a compiled app, BullMQ/Kafka contract tests, dynamic-module testing) are the dominant correctness lever for Nest slices; without an owned skill, every backend feature reinvents the harness and DI-scope mistakes ship to QA.
- **default_prompt:** Use the adp-bknd-nest-tests skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** NestJS Jest, Supertest, Testcontainers, Pact, Stryker tests

**Owner role:** AI Backend Engineer (NestJS) (`ai-backend-nestjs`)
**Primary artifact:** backend Nest test files (*.spec.ts, *.e2e-spec.ts), integration/contract/E2E test suites, coverage/mutation evidence

## Why critical
Framework-specific NestJS test patterns (TestingModule overrides, Supertest against a compiled app, BullMQ/Kafka contract tests, dynamic-module testing) are the dominant correctness lever for Nest slices; without an owned skill, every backend feature reinvents the harness and DI-scope mistakes ship to QA.

## Purpose
NestJS unit, integration, contract, and end-to-end test authoring for the backend slice (Jest, ts-jest, Supertest, @nestjs/testing TestingModule, Testcontainers, Pact, Stryker, coverage).

## Abu Dhabi Ports Group context

Apply this skill as AI Backend Engineer (NestJS) delivery guidance for AD Ports work. The NestJS test edges that matter here are tenant isolation enforced inside interceptors and `CanActivate` guards (a passing handler test means nothing if the guard test does not also prove cross-tenant 404/403), Arabic/RTL-safe error messages emitted from `HttpException` filters so customer-facing strings round-trip through Supertest assertions without mojibake, and time-zone correctness around `Asia/Dubai` customs cut-offs (vessel ATA computations, BullMQ delayed jobs, and Postgres `timestamptz` round-trips must all be tested with a fixed clock). Integration boundaries to SAP, Oracle EBS, port community systems, and partner webhooks are exercised through Pact contract tests plus Testcontainers-backed Kafka/BullMQ suites rather than hand-rolled fakes, because the failure modes that hit production are connection drops mid-saga and idempotency-key collisions, not happy-path payload shape. Keep test outputs traceable to acceptance criteria, tenant-aware, regulatory-aware, and ready for audit handoff.

## Mental model

- **Protects:** correctness of every Nest slice that ships — controllers, services, processors, sagas, guards, interceptors.
- **Optimizes for:** fast, deterministic feedback against a real Nest DI graph and real infrastructure containers.
- **Refuses to leave ambiguous:** DI scope (REQUEST vs DEFAULT vs TRANSIENT), guard/interceptor behavior under failure, persistence transaction boundaries, queue idempotency, or contract drift between consumer and provider.
- **Primary artifact focus:** `*.spec.ts` (unit + integration), `*.e2e-spec.ts` (end-to-end), Pact JSON, coverage HTML, Stryker mutation report.
- **Default stance:** build the real `TestingModule` and override only at the process boundary; never instantiate providers manually when DI scopes or interceptors matter.

## Hard rules

1. **Build the full TestingModule.** Use `Test.createTestingModule({...}).compile()` whenever the test exercises DI, interceptors, guards, pipes, filters, or `REQUEST`-scoped providers — never instantiate providers with `new` because it bypasses DI scopes and silently breaks RBAC tests.
2. **Override providers explicitly.** Replace dependencies via `.overrideProvider(TOKEN).useValue(fake)` or `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })`. Do not mutate provider instances after compilation and do not use `jest.doMock` against Nest module code.
3. **Integration tests run the real Nest app.** Compose `INestApplication` via `mod.createNestApplication()` + `await app.init()`, apply the same global `ValidationPipe`, `ProblemDetailsFilter`, and interceptors the production bootstrap applies, and drive it through Supertest against `app.getHttpServer()`.
4. **Persistence tests use the real engine.** Run Postgres / SQL Server / Mongo via `@testcontainers/postgresql` (or equivalent) and apply migrations on container start. SQLite is forbidden as a stand-in for Postgres — it hides FK, JSONB, `timestamptz`, partial-index, and concurrency bugs that AD Ports tenant tables depend on.
5. **No real timers, no real network.** Use `jest.useFakeTimers({ advanceTimers: true })` or a polling helper for delays. Forbid `setTimeout`, `sleep`, and live HTTP calls in tests; intercept outbound HTTP with `nock` and assert the request was made.
6. **Cover guards and 401/403 on every route.** Every controller route ships with at least one Supertest test for the happy path plus one for an authentication or authorization failure that returns RFC 7807 problem details with the correct `code` and `traceId`.
7. **Coverage floor enforced in CI.** Jest `--coverage` must hit ≥75% line and ≥65% branch on changed files; Stryker mutation testing runs on critical domain modules (pricing, customs, billing, tenant guards) and surfaces survived mutants as PR comments.
8. **Globally-registered enhancers use `useExisting` for override.** When registering `APP_GUARD`/`APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR`, declare a real provider class and reference it via `{ provide: APP_GUARD, useExisting: JwtAuthGuard }` — never `useClass`. This makes the guard overridable in `TestingModule` via `.overrideProvider(JwtAuthGuard).useClass(MockAuthGuard)`. Tests that need to bypass a global enhancer fail silently if this pattern is not followed.
9. **Logger must be silenced in test contexts.** Set `setLogger(new SilentLogger())` (or pass `false`) on the `TestModuleBuilder` so CI output stays scoped to test results, not Nest bootstrap noise.

## Pitfalls

- **Over-mocking the EntityManager / repositories.** Replace it once with a fake or run against Testcontainers; spying on every `find`/`save` call creates a test that asserts implementation choreography instead of behavior.
- **BullMQ tested without a real Redis.** In-memory queue stubs do not exercise visibility timeouts, lock loss, repeat jobs, or DLQ paths — start `redis:7` via Testcontainers for processor tests.
- **Snapshotting whole HTTP responses.** A snapshot of the full body locks in `traceId`, timestamps, and locale strings; assert the fields you care about and use shape matchers (`expect.objectContaining`) for the rest.
- **DI-scope mistakes hidden in tests.** A `REQUEST`-scoped provider tested by direct instantiation appears to work but throws `Nest can't resolve dependencies` in production — always go through `TestingModule`.
- **Missing guard-failure tests.** Asserting only the happy path lets a misconfigured `RolesGuard` or `TenantInterceptor` ship; one 401, one 403, and one cross-tenant 404 are mandatory per controller.
- **Contract drift between consumer and provider.** Hand-rolled Supertest stubs against an internal service drift silently; Pact + `can-i-deploy` is the only acceptable gate for cross-service breakage.
- **Boilerplate-heavy mocking.** When a class has 5+ injected providers, declaring each `.overrideProvider(...)` chokes the test. Use `.useMocker((token) => ...)` with `jest-mock`'s `ModuleMocker` to auto-generate mocks for unspecified providers; reserve explicit overrides for the providers the test actually exercises.
- **REQUEST-scoped provider tested by `get()`.** `moduleRef.get(REQUEST_SCOPED_TOKEN)` returns a new instance each call and bypasses the request context entirely. Use `jest.spyOn(ContextIdFactory, 'getByRequest').mockImplementation(() => contextId)` + `moduleRef.resolve(token, contextId)` to access the same sub-tree the request actually used.
- **Replacing a whole module is harder than replacing one provider.** When the test needs to swap out an entire `DatabaseModule` or `TelemetryModule`, use `.overrideModule(DatabaseModule).useModule(InMemoryDatabaseModule)` instead of overriding every provider exported by the original module.

## Evidence expectations

- **Minimum evidence:** Jest JUnit XML (`jest-junit`), coverage HTML/LCOV report, list of new test files, and the command used (`pnpm test --coverage --ci`).
- **When persistence is touched:** Testcontainers startup log excerpt, migration output, and a sample seed/teardown trace.
- **When contracts are touched:** Pact JSON published to the broker, `can-i-deploy` exit status, and broker URL for the verified version.
- **When mutation testing runs:** Stryker HTML report path plus the survived-mutant count for changed modules.
- **When E2E runs:** docker-compose / Testcontainers manifest, test correlation IDs, and the scenario name in the JUnit output.

## Decision checkpoints

- **Before writing a `*.spec.ts`:** decide unit vs integration vs contract — if the test asserts HTTP status codes, it is integration and must use `INestApplication`.
- **Before mocking a collaborator:** check whether a fake (in-memory repo, in-memory event bus) or Testcontainers instance would survive the next refactor better — prefer fakes/real containers over `jest.mock`.
- **Before snapshotting:** confirm the snapshot covers a stable shape (DTO, error envelope) and not volatile fields (timestamps, UUIDs, trace IDs).
- **Before marking done:** rerun `pnpm test --ci --coverage` locally and confirm the coverage delta on changed files, not only the global number.
- **Before routing to `ai-quality-engineer`:** confirm the test names map back to PRD acceptance criteria so QA can run spec-fit verification without re-reading the implementation.

## Escalation triggers

- **Test reveals a security control gap (missing auth/authz, RBAC bypass):** involve `ai-security-engineer` before publishing the failing test publicly.
- **Test reveals an integration-contract break with SAP, Oracle, or a partner system:** involve `ai-integration-engineer` and pause the Pact publish.
- **Persistence test exposes a schema or migration risk:** involve `ai-database-engineer` before merging the fix.
- **E2E test depends on an environment that does not exist yet:** involve `ai-platform-engineer` to provision Testcontainers images or shared infra.
- **Coverage floor cannot be met without compromising test quality:** involve `ai-quality-engineer` rather than lowering the floor silently.

## Review lens

- A reviewer should be able to see how each acceptance criterion maps to one or more test names.
- A reviewer should be able to tell which tests run against real infrastructure (Testcontainers / Pact / nock) and which run pure.
- A reviewer should see explicit 401/403 / cross-tenant / Arabic-string coverage on every controller route that changed.
- A reviewer should be able to rerun the suite with one command and read JUnit + coverage output without re-deriving paths.
- A reviewer should be able to route survived mutants or contract failures to one named role.

## When to use
Trigger this skill when:
- A new instance of `backend Nest test files (*.spec.ts, *.e2e-spec.ts), integration/contract/E2E test suites, coverage/mutation evidence` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work (typically `ai-quality-engineer` for spec-fit, `ai-reviewer` for PR gate, or `ai-platform-engineer` for CI evidence).

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill — UI E2E goes to `adp-fend-react-feature` or `adp-qa-tests` (Playwright), cross-service performance goes to `adp-qa-performance`, and dashboard/data-quality tests go to `adp-data-quality`.

## Inputs
- Backlog story or defect ID with explicit acceptance criteria.
- The Nest implementation slice under test — controller, service, processor, saga, dynamic module, guard, or interceptor — from `adp-bknd-nest-api`, `adp-bknd-nest-db`, `adp-bknd-nest-consumer`, or `adp-bknd-nest-worker`.
- The OpenAPI contract (`lld-api-spec.md` or generated `openapi.json`) for HTTP slices, or the AsyncAPI / message schema for consumers and workers.
- NFR thresholds (latency, throughput, error budget) from `nfr.md` that the test must guard.
- Existing Testcontainers / Pact / Stryker config from the repo's scaffold.

## Outputs
- `*.spec.ts` (unit + integration) and `*.e2e-spec.ts` co-located with the Nest module under test.
- Pact consumer/provider JSON files plus broker publish evidence.
- Testcontainers fixtures and per-suite setup helpers in `test/` or `__tests__/` shared folders.
- Jest coverage HTML/LCOV, JUnit XML, and (when applicable) Stryker mutation HTML report.
- Handoff note to `ai-quality-engineer` and `ai-reviewer` summarizing scenarios covered and residual risk.

## Artifact path routing

When this skill creates or updates documentation artifacts, resolve the target path through `/standards/artifact-path-routing.md` before writing files. Write documentation output relative to the target repository root, using the numbered SDLC folders under `docs/`:

- `docs/00-governance/` for governance, repo instructions, catalog docs, workflow diagrams, and tutorials.
- `docs/01-discovery/` for demand intake, BRD, discovery notes, sponsor constraints, and business risks.
- `docs/02-product/` for PRD and product-definition artifacts.
- `docs/03-architecture/` for architecture and design artifacts, using typed subfolders: `DOMAIN/`, `HLD/`, `LLD/`, `NFR/`, `ADR/`, and `SECURITY/` as defined in `/standards/artifact-path-routing.md`.
- `docs/04-planning/` for backlog, roadmap, iteration, rollout, and planning artifacts.
- `docs/05-implementation/` for implementation notes, handoffs, and code-facing delivery notes.
- `docs/06-verification/` for tests, reviews, security assessment, audits, and dry-run evidence.
- `docs/07-release/` for release plans, release notes, runbooks, support, versioning, publishing, and deprecation docs.

Do not create new documentation artifacts inside skill or catalog folders such as `.agents/skills/`, `.claude/skills/`, `catalog/source/skills/`, or plugin cache. Do not create new documentation artifacts at legacy flat paths such as `docs/brd.md`, `docs/prd.md`, `docs/lld.md`, `docs/adrs/`, `docs/dry-runs/`, or `docs/runbooks/`. If the user gives a conflicting path, record it as an explicit path exception. Source code, tests, infrastructure, and app config stay in the repository's application structure, not under `docs/`.

## Workflows

Load only the workflow file that matches the current request:

- `workflows/produce-artifact.md` — Create the owned artifact from approved inputs.
- `workflows/update-artifact.md` — Revise an existing artifact when scope, risk, evidence, or feedback changes.
- `workflows/review-artifact.md` — Review the owned artifact for fit, completeness, traceability, and evidence.
- `workflows/test-unit.md` — Unit-test services, pipes, guards, and pure helpers in isolation.
- `workflows/test-unit-with-mocker.md` — Auto-mock high-dependency providers with `useMocker()` and `ModuleMocker`.
- `workflows/test-integration.md` — Drive the real `INestApplication` plus persistence via Supertest and Testcontainers.
- `workflows/test-contract.md` — Author Pact consumer or provider verification for cross-service contracts.
- `workflows/test-e2e.md` — Cover a full business scenario across the Nest service and real dependencies.

## References

Load only the references needed for the current request:
- `references/testing.md` — layer-by-tool table, unit/integration/contract/E2E patterns, coverage policy, anti-patterns, CI integration. **Authoritative source** for this skill's workflows.
- `references/azure-testcontainers.md` — AD-Ports-relevant Testcontainers modules: PostgreSQL, MSSQL, Redis, Kafka, Azure Service Bus, Azurite, CosmosDB, LocalStack.
- Cross-reference: `../adp-qa-test-strategy/references/test-repo-layout.md` — co-located vs. unit/integration submodule layouts; AD Ports recommendation matrix.
- Cross-reference: `../adp-qa-test-strategy/references/testing-skills-catalog.md` — full catalog mapping all 13 testing skills by owner / function / layer / stack.
- Cross-reference: `../adp-qa-tests/references/nestjs-testing-patterns.md` — the original QA-owned NestJS patterns reference; consult when aligning with cross-service test strategy authored by `ai-quality-engineer`.
- Cross-reference: `../adp-bknd-nest-crosscut/references/testing-patterns.md` — short crosscut testing notes (interceptors, filters, logging) that supplement the patterns here.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/test-plan.md`
- `/standards/definition-of-done.md`
- `/standards/code-review-checklist.md`

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Implementation verification
- **Ordered by:** `ai-backend-nestjs`
- **Required inputs:** `prd.md`, `acceptance criteria`, `lld-api-spec.md`, `Nest implementation slice (controller/service/processor)`, `nfr.md`
- **Generated artifact:** `*.spec.ts files`, `*.e2e-spec.ts files`, `Pact JSON`, `coverage report`, `Stryker mutation report (where applicable)`
- **Next roles:** `ai-quality-engineer`, `ai-reviewer`, `ai-platform-engineer`
- **Human gate:** `coverage waiver`, `mutation-survived risk acceptance`

## Handoff

- **Upstream:** Implementation slice from `ai-backend-nestjs` via `adp-bknd-nest-api` (REST/gRPC/GraphQL), `adp-bknd-nest-db` (persistence), `adp-bknd-nest-consumer` (queue/event), or `adp-bknd-nest-worker` (scheduled/batch). Confirm the slice compiles, lint passes, and the OpenAPI/AsyncAPI contract is current.
- **Downstream:** `ai-quality-engineer` (spec-fit verification, cross-service E2E, performance), `ai-reviewer` (PR gate). Loop in `ai-platform-engineer` when CI/Testcontainers infra needs change.
- **Evidence:** Summarize new/changed test files, the scenarios they cover, Jest + coverage + Pact + Stryker output paths, residual risk, and any failing-but-tracked test before routing onward.

## Security shift-left (Checkmarx)

After this skill ships new or changed tests, hand off to the `adp-sec-checkmarx` skill and run `adp-sec-checkmarx/workflows/post-implementation-review.md` against the diff. Test code is in scope for Checkmarx One SAST/SCA/Secrets/IaC scans — common NestJS test-code findings include Use_Of_Hardcoded_Password in `*.spec.ts` fixtures and `.env.test`, NoSQL/SQL injection in test repositories that bypass repository pattern, SSRF in MSW/nock handlers that call live URLs, prototype pollution in dynamic fixture builders, insecure deserialisation in test seed data, missing `@UseGuards` coverage in supertest scenarios, and leaked tokens in Jest snapshot output or Pact pacts. Bootstrap the guardrails once via `adp-sec-checkmarx/workflows/bootstrap-copilot-guardrails.md`, which writes `.github/instructions/typescript-security.instructions.md` (`applyTo: '**/*.ts,**/*.tsx,**/*.html,**/*.js,**/*.jsx'`) and the repo-wide `.github/copilot-instructions.md`. The Checkmarx skill is owned by `ai-devsecops`; this skill only references it.

## Ownership

- **Primary owner:** `ai-backend-nestjs` (AI Backend Engineer (NestJS))
- **Review cadence:** Quarterly
- **Last reviewed:** 2026-06-28

## Quality bar
- Trace to backlog story / defect / ADR.
- Smallest viable artifact for the product tier and change risk.
- Evidence attached, not claimed.
- Reviewed by the owning role and any required cross-role reviewer.
- Stored at the target-repository-root-relative numbered SDLC repo path from `/standards/artifact-path-routing.md` for documentation artifacts.

## Tier guidance
Per the AI Role Skills Tier Application Guide:
- Tier 1: include this skill only if it is in the Tier 1 baseline or its should-have trigger fires.
- Tier 2: include if listed as Tier 2 baseline or its should-have trigger fires.
- Tier 3: included by default if listed in Tier 3 baseline.

If unsure, default to producing the artifact at the depth required by the change's blast radius.
