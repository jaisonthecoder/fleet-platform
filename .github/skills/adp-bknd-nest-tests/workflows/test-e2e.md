# Workflow: Test End-to-End (NestJS)

## Position in the chain
- **Pairs with:** a complete business scenario that crosses multiple Nest modules and at least one piece of real infrastructure (Postgres + Redis + BullMQ worker, or Postgres + Kafka consumer). E2E runs **after** unit, integration, and contract tests for the slice are green.
- **Inputs from:** the PRD scenario (happy path + critical-failure path), the LLD sequence diagram, and the integration test harness from `test-integration.md`.
- **Successor:** for full-stack UI E2E (browser-driven scenarios that include the frontend), defer to `adp-qa-tests` Playwright workflows owned by `ai-quality-engineer`.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
- [ ] The PRD scenario is named and has a single happy path plus at least one critical-failure path (e.g., customs API down, Redis lock lost, vessel ATA missed cut-off).
- [ ] Docker Desktop / Colima is running and the Testcontainers modules for every dependency in scope (Postgres, Redis, Kafka, MinIO) are installed.
- [ ] The Nest app boots in-process with the same global pipes/filters/interceptors production uses.
- [ ] You are on a feature branch, not `main`.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/testing.md`](../references/testing.md) § End-to-end testing — in-process vs deployed-environment trade-offs. **Authoritative source.**
- [`../references/testing.md`](../references/testing.md) § Anti-patterns catalog — E2E in `*.spec.ts`, no isolation, hand-rolled queue stubs.

## Goal
Prove that one complete AD Ports business scenario (vessel arrival, customs declaration, gate pass issuance, billing entry) flows correctly through the Nest service and its real dependencies, including at least one critical-failure path.

## Steps
1. **Pick the harness mode.** **In-process + Testcontainers (preferred):** boot `INestApplication` in the test process, start Postgres + Redis + Kafka via Testcontainers, drive via Supertest. Fast feedback, full control, hermetic. **Deployed environment (when justified):** drive against an actual staging URL when the scenario requires real network egress, real partner sandbox, or real Azure/AWS managed services that cannot run in containers. Document the choice in the spec file header.
2. **Compose the full infra surface.** In `beforeAll`, start every container the scenario touches: `PostgreSqlContainer('postgres:16')`, `RedisContainer('redis:7')`, `KafkaContainer('confluentinc/cp-kafka:7.6.0')` (or `LocalStackContainer` for SQS). Apply migrations. Wire connection strings into `process.env` **before** boot. Boot the Nest app and start the BullMQ worker / Kafka consumer the scenario depends on.
3. **Drive the scenario.** Use Supertest against `app.getHttpServer()` for HTTP entry points (`POST /v1/vessels/{id}/declare-customs`). Use `undici` only when you must hit external HTTPS endpoints that Supertest cannot reach. Walk the scenario step-by-step the way an operator would: arrive vessel, declare customs, wait for worker to process, fetch status.
4. **Use polling helpers, not sleeps.** Workers and consumers run asynchronously; assert with `await waitFor(async () => { const status = await getStatus(); expect(status).toBe('CUSTOMS_CLEARED'); }, { timeout: 10_000, interval: 100 })`. Forbid `await sleep(5000)`.
5. **Cover one happy path and one critical-failure path per scenario.** Happy: vessel ATA before 18:00 Asia/Dubai cut-off → customs cleared → gate pass issued. Failure: customs API returns 503 → saga marks declaration `FAILED_RETRYABLE` → DLQ entry present → operator can resubmit. Both paths must assert the operator-visible outcome and the audit trail.
6. **Tag the suite for CI gating.** Name files `*.e2e-spec.ts`, place them in `test/e2e/`, and tag the describe block: `describe('vessel arrival e2e @e2e', () => {...})`. Jest config: `testRegex: '\\.e2e-spec\\.ts$'`. CI runs E2E in a separate stage (nightly + on-demand) so it does not block PRs unnecessarily.
7. **For full-stack frontend scenarios, hand off.** If the scenario requires the React/Angular portal to render and a user to click, this skill stops. Route to `adp-qa-tests` Playwright workflows owned by `ai-quality-engineer` and provide the Nest-side scenario as an input.

## Anti-patterns
- **E2E test in a `*.spec.ts` file** (instead of `*.e2e-spec.ts`). It runs on every PR, blows out the fast suite, and conflates fast feedback with deep verification.
- **No isolation between scenarios.** Reusing a container across files leaks Postgres rows and Redis keys; each E2E describe block owns its container lifecycle or its own database schema name.
- **Hand-rolled BullMQ/Kafka stubs in E2E.** Stubs do not exercise lock loss, visibility timeouts, repeat jobs, partition rebalancing, or DLQ — the exact failures E2E exists to catch.
- **`await sleep(...)` instead of polling for the worker outcome.** Brittle on slow CI, flaky on fast laptops; always poll for the observable state change.
- **Asserting only the happy path.** The point of E2E is the critical-failure path; without it, the test only proves the demo.
- **Calling production APIs.** E2E never hits production partner systems — use partner sandboxes or contract-test stubs governed by Pact.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Every E2E file is named `*.e2e-spec.ts` and tagged `@e2e`.
- [ ] The scenario covers one happy path + one critical-failure path with audit-trail assertions.
- [ ] Testcontainers logs and correlation IDs are captured in JUnit output for debugging.
- [ ] `pnpm test:e2e --ci --runInBand` passes locally.
- [ ] `git status` shows only intended changes.
- [ ] For UI-driven scenarios, the Nest scenario is documented and the handoff to `adp-qa-tests` (Playwright) is recorded.
- [ ] Notify downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-platform-engineer`.

## Definition of Done
- [ ] Harness mode (in-process vs deployed) chosen and recorded in the file header.
- [ ] Real Postgres + Redis + Kafka (as applicable) via Testcontainers; no stubs.
- [ ] Real BullMQ worker / Kafka consumer started in-process.
- [ ] Polling helper used; no `sleep` calls.
- [ ] One happy + one critical-failure path per scenario.
- [ ] Files named `*.e2e-spec.ts`, isolated by container lifecycle, gated in a CI stage separate from PR-blocking unit/integration runs.
