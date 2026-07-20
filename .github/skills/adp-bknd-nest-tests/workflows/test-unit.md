# Workflow: Test Unit (NestJS)

## Position in the chain
- **Pairs with:** the Nest implementation slice from `adp-bknd-nest-api`, `adp-bknd-nest-db`, `adp-bknd-nest-consumer`, or `adp-bknd-nest-worker` — unit tests are written **alongside** the service/pipe/guard they cover, not after.
- **Inputs from:** the slice's LLD section (module boundaries, pure helpers), the DTO definitions (`class-validator` decorators), and acceptance criteria from the backlog story.
- **Successor:** `test-integration.md` exercises the same code through the HTTP boundary; route to it once unit coverage on the slice is in place.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- [ ] Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`.
- [ ] You can name the service methods, pipes, guards, validators, and pure helpers under test in one sentence each.
- [ ] DTO classes and their `class-validator` decorators are committed.
- [ ] The slice compiles (`pnpm build`) and lint passes (`pnpm lint`) on your branch.
- [ ] You are on a feature branch, not `main`.

If inputs are missing, write a short "waiting on" note and stop.

## References to consult
- [`../references/testing.md`](../references/testing.md) § Unit testing — Jest configuration, fakes vs mocks, DTO validation, builders. **Authoritative source.**
- [`../references/testing.md`](../references/testing.md) § Anti-patterns catalog — what to avoid.

## Goal
Prove that service methods, pipes, guards, and pure helpers behave correctly in isolation, with deterministic feedback under one second per file.

## Steps
1. **Choose the harness shape.** If the test touches DI scopes, interceptors, or `REQUEST`-scoped providers, build the module via `Test.createTestingModule({ providers: [...] }).compile()` and resolve through `module.get(MyService)`. If the service is a plain class with constructor injection only, `new MyService(deps)` is acceptable and faster.
2. **Inject fakes through constructors.** A fake is a small class implementing the port (`class InMemoryVesselRepository implements VesselRepository {}`). Use `jest.fn()` or `jest-mock` for sparse spy needs (audit writes, outbound notifications). Reach for `ts-mockito` only when you must intercept a method on an interface you do not own.
3. **Prefer fakes over mocks for collaborators with behavior.** An in-memory tenant-scoped repository (`vesselsByTenant: Map<string, Vessel[]>`) catches RBAC and tenant-leak regressions a `jest.fn().mockResolvedValue(...)` will silently miss.
4. **Use builders for fixtures.** Centralize in `test/builders/vessel.builder.ts`: `aVessel().forTenant('PCFC').withEta('2026-06-26T18:00:00+04:00').build()`. Builders default to a valid entity; tests override only the field they assert.
5. **Test `class-validator` DTOs directly.** Instantiate via `plainToInstance(CreateVesselDto, payload)` and assert `validate(dto)` returns the expected `ValidationError[]` — do not push DTO validation into an HTTP test when the rule is purely structural.
6. **Pin the clock and locale.** Use `jest.useFakeTimers({ now: new Date('2026-06-26T12:00:00+04:00') })` so Asia/Dubai cut-off logic is deterministic. Set `process.env.TZ = 'Asia/Dubai'` in `jest.setup.ts`.
7. **Run deterministically.** `pnpm test --coverage --runInBand --testPathPattern='\.spec\.ts$'` for CI; locally `pnpm jest path/to/file.spec.ts` while iterating. Configure `jest-junit` so CI uploads `junit.xml`.

## Anti-patterns
- **Over-mocking `EntityManager` / `Repository<T>`.** Verifying that `repo.findOne` was called with a specific options object asserts choreography, not behavior — replace with a fake repository or move to an integration test.
- **Spy-on-private.** `jest.spyOn(service as any, 'privateHelper')` couples the test to internal structure; assert the public outcome instead.
- **Snapshotting whole DTOs or whole `ValidationError` trees.** Snapshots lock in `target`, `value`, and constraint message strings (which break under Arabic/RTL changes). Assert specific `property` + `constraints` keys.
- **Calling `new MyService(deps)` when the service is `@Injectable({ scope: Scope.REQUEST })`.** It works in the test and throws `Nest can't resolve dependencies` in production — always use `TestingModule`.
- **Stubbing the clock via `Date = ...` reassignment.** Use `jest.useFakeTimers()` so async timers also advance.

## After you finish
- [ ] Definition of Done items below are met.
- [ ] Coverage on changed files is ≥75% line / ≥65% branch (`pnpm test --coverage --collectCoverageFrom='src/<slice>/**'`).
- [ ] No `.skip` or `.only` left in the suite.
- [ ] `git status` shows only intended changes (new `*.spec.ts`, updated builders).
- [ ] Hand off to `test-integration.md` for the HTTP-boundary coverage on the same slice.
- [ ] Notify downstream role(s): `ai-quality-engineer`, `ai-reviewer`.

## Definition of Done
- [ ] Every public service method on the slice has at least one happy-path and one failure-path test.
- [ ] DTO validation rules from the OpenAPI contract are covered by direct `class-validator` tests.
- [ ] Guards that enforce tenant isolation have a dedicated test for the cross-tenant rejection path.
- [ ] Tests use fixed timers and `Asia/Dubai` time-zone where temporal logic exists.
- [ ] Test names describe observable behavior, not implementation calls.
- [ ] Coverage floor in `../references/testing.md` § Coverage policy is met on changed files.
- [ ] `pnpm test --ci --coverage --runInBand` passes locally before push.
