# Workflow: Build Backend Module Structure

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Open `../SKILL.md` and confirm this request touches NestJS module layout, provider wiring, dependency boundaries, or DI scope.
- [ ] Inspect the existing repository layout before adding files. Prefer the project pattern when it already satisfies the standard.
- [ ] Load [`../references/module-boundaries.md`](../references/module-boundaries.md) for file placement and cross-module dependency rules.
- [ ] Load [`../references/nest-architecture.md`](../references/nest-architecture.md) only if the request needs controller/service/provider responsibility guidance.

## Goal

NestJS source follows the module structure standard every time a feature module is created or changed.

## Steps

1. **Identify the owning feature.** Place feature source under `src/modules/<feature>/`; do not create `src/<feature>/` or `src/infrastructure/` as a parallel layer.
2. **Place files by responsibility.** Controllers go in `controllers/`, services in `services/`, DTOs in `dto/`, entities in `entities/`, repositories in `repositories/`, and other Nest artifacts in their named subfolders from the first file.
3. **Keep the root clean.** The only source file at the feature-module root is `<feature>.module.ts`.
4. **Wire dependencies only in the module.** Register controllers, providers, imports, and exports in `<feature>.module.ts`; do not let controllers or services reach across feature internals.
5. **Split multi-surface services deliberately.** If a module has admin/public/internal surfaces, split `services/` and `dto/` by surface and put shared behavior in `services/shared/`.
6. **Protect DI boundaries.** Export only the provider contracts another module needs. Do not export repositories, ORM entities, or broad shared modules to make imports convenient.
7. **Handle config and infrastructure through shared modules.** Runtime config goes under `src/common/config/`; platform adapters such as database clients, queues, secret stores, logging, and audit belong in focused shared modules.
8. **Validate before handoff.** Check the review checklist in `../references/module-boundaries.md`, run the narrowest relevant tests or lint rules, and record any remaining layout risk.

## Anti-patterns

- Flat feature modules with `<feature>.controller.ts`, `<feature>.service.ts`, or `<feature>.repository.ts` at the module root.
- Empty folder scaffolding for every possible Nest artifact before files exist.
- Importing another feature module's internal service, controller, or repository directly.
- Adding `forwardRef()` or `@Global()` to bypass an unclear dependency direction.
- Creating `src/infrastructure/` instead of focused shared modules.

## After you finish

- [ ] Changed files and module paths are listed in the handoff.
- [ ] The module-boundaries checklist is satisfied or deviations are captured with owner and reason.
- [ ] Tests, lint, or review evidence are summarized.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-sre`.

## Definition of Done

- [ ] Feature source is under `src/modules/<feature>/`.
- [ ] Only `<feature>.module.ts` is at the feature-module root.
- [ ] New source files are in the required subfolders from the first file.
- [ ] Cross-module imports use exported providers or interfaces, not another feature's internals.
- [ ] Runtime config and infrastructure adapters follow the shared-module standard.
