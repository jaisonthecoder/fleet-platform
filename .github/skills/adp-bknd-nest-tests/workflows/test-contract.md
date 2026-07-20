# Workflow: Test Contract (NestJS)

## Position in the chain
- **Pairs with:** any Nest slice that calls or exposes a cross-service API — REST consumer of SAP / Oracle / partner systems, REST provider for the mobile or portal frontends, or a Kafka producer/consumer whose schema is governed.
- **Inputs from:** `lld-integration-spec.md` (consumer/provider sides, interactions, states), the OpenAPI / AsyncAPI contract, and the unit + integration tests for the same slice.
- **Successor:** the Pact broker's `can-i-deploy` gate runs in CI before any deploy; route survived contract failures back to `ai-integration-engineer`.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
- [ ] `@pact-foundation/pact` is installed and the Pact broker URL + token are available as CI secrets.
- [ ] You have decided which side this slice owns: consumer (calls another service) or provider (exposes an endpoint other services call).
- [ ] The git branch name is known — Pact tags contracts by branch.
- [ ] You are on a feature branch, not `main`.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/testing.md`](../references/testing.md) § Contract testing — Pact JS consumer + provider, broker, `can-i-deploy`. **Authoritative source.**
- [`../references/testing.md`](../references/testing.md) § Anti-patterns catalog — hand-rolled HTTP fakes, skipping `can-i-deploy`.

## Goal
Prove that this Nest service is a valid consumer or provider of a Pact-governed contract, and gate deploys on broker verification so cross-team breakage cannot reach production.

## Steps
1. **Identify the side.** Consumer = your slice calls another service (SAP customs API, partner webhook). Provider = your slice exposes endpoints another service calls (mobile app, portal frontend, Khalifa Port community system). A slice can be both; write each side as a separate test file.
2. **Consumer side — author interactions with the Pact DSL.** In `*.pact.spec.ts`, instantiate `new PactV3({ consumer: 'adp-vessel-svc', provider: 'sap-customs-api' })`. For each interaction: `.addInteraction({ states: [{ description: 'a vessel with IMO 9300000 exists' }], uponReceiving: 'a request to clear vessel', withRequest: {...}, willRespondWith: {...} })`. Drive the real consumer client (your `SapCustomsClient`) against the Pact mock server and assert on the parsed response.
3. **Consumer side — publish the pact.** `await pact.finalize()` writes `pacts/adp-vessel-svc-sap-customs-api.json`. In CI, publish to the broker with `pact-broker publish ./pacts --consumer-app-version=$GIT_SHA --branch=$GIT_BRANCH --broker-base-url=$PACT_BROKER_URL --broker-token=$PACT_BROKER_TOKEN`.
4. **Provider side — verify against the real Nest app.** In `*.provider.spec.ts`, boot the same `INestApplication` you build for integration tests (Testcontainers + real migrations + production-equivalent globals), then run `new Verifier({ providerBaseUrl: 'http://localhost:3001', provider: 'adp-vessel-svc', pactBrokerUrl: process.env.PACT_BROKER_URL, providerVersion: process.env.GIT_SHA, providerVersionBranch: process.env.GIT_BRANCH, publishVerificationResult: true }).verifyProvider()`.
5. **Provider side — implement state handlers.** For each `given` state Pact declares (`'a vessel with IMO 9300000 exists'`), implement a handler that seeds Testcontainers Postgres with the precise rows the consumer expects. Keep state handlers in a single `states.ts` file per provider so consumer additions are visible.
6. **Tag with branch and environment.** Always publish with `--branch=$GIT_BRANCH`. After deploy, record environment via `pact-broker record-deployment --pacticipant=adp-vessel-svc --version=$GIT_SHA --environment=staging`.
7. **Gate deploy on `can-i-deploy`.** CI runs `pact-broker can-i-deploy --pacticipant=adp-vessel-svc --version=$GIT_SHA --to-environment=staging`. Non-zero exit blocks the deploy step. This is the only acceptable signal that cross-service compatibility holds.

## Anti-patterns
- **Hand-rolled fetch fakes** (`jest.spyOn(httpService, 'post').mockResolvedValue(...)`) instead of Pact. The fake drifts silently the moment the real provider changes; the broker cannot detect it.
- **Skipping `can-i-deploy`.** Publishing pacts without gating on broker verification turns the contract into a vanity artifact.
- **Snapshotting the pact JSON in git diffs.** Pact files are generated artifacts; review the interaction list in the spec file, not the JSON.
- **Provider state handlers that mutate shared infra.** State handlers must seed only the rows the interaction needs and clean up in `afterEach` or via Testcontainers truncation, not leave data behind.
- **Coupling consumer pacts to provider implementation details** (asserting on internal `traceId` formats or non-contract headers). Pact covers the **contract** — keep assertions to the documented shape.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Pact JSON for this slice is published to the broker tagged with branch + commit SHA.
- [ ] Provider verification (if applicable) returns green and is recorded in the broker.
- [ ] `can-i-deploy` against the target environment exits zero before the PR is merged.
- [ ] `git status` shows only intended changes (new `*.pact.spec.ts` / `*.provider.spec.ts`, state handlers, CI step).
- [ ] Notify downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-integration-engineer`.

## Definition of Done
- [ ] Side identified (consumer / provider / both) and one spec file per side exists.
- [ ] Consumer side drives the real client against the Pact mock server.
- [ ] Provider side verifies against the real `INestApplication` plus Testcontainers, not a stub.
- [ ] State handlers cover every `given` clause and clean up between interactions.
- [ ] Pacts publish to the broker with branch + version tags.
- [ ] CI runs `can-i-deploy` and blocks deploy on failure.
