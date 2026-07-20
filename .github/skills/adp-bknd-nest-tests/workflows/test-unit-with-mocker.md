# Workflow — Unit Test with `useMocker`

Use when the unit under test has 5+ injected providers and listing each `.overrideProvider(...)` would dominate the test.

## Steps

1. Confirm the unit qualifies (5+ deps, or REQUEST-scope present).
2. Import `ModuleMocker` from `jest-mock`.
3. Build the TestingModule with `controllers: [Foo]` only (no providers); `useMocker` handles the rest.
4. Provide explicit overrides only for the dependencies the test asserts against.
5. Run `pnpm test --coverage`; coverage on the unit's collaborators is expected to drop — that is fine for unit tests.

## Definition of done

- Test asserts behavior of the unit, not collaborators.
- No collaborator's method is asserted unless explicitly overridden.
- Test name maps to one acceptance criterion.

## Before you start

- [ ] You have the SKILL.md `## Hard rules` and `## Quality bar` in view.
- [ ] You have read the topical sections of this workflow before starting work.
- [ ] Required inputs named in the parent SKILL.md `## Inputs` are present.

## Anti-patterns

- Skipping the `## Before you start` checklist.
- Diverging from the topical guidance without recording an exception.
- Marking work complete without the evidence listed in the workflow body.

## After you finish

- [ ] Each topical section above is addressed (or skipped with a recorded reason).
- [ ] Evidence committed alongside the artefact per the parent `SKILL.md` quality bar.
- [ ] Handoff routed per the `## Handoff` block above (or per `SKILL.md` if absent).
