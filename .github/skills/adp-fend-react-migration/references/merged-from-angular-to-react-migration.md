# Merged Legacy Guidance: angular-to-react-migration

## Table of Contents

- Original references/guidance.md
- Scope
- Rules
- Review checklist
- Original SKILL.md
- Metadata
- Abu Dhabi Ports Group Context
- Business Alignment Gate
- Business-Facing Artifacts
- Workflows
- Operating Principles
- Partner Skills


This reference preserves the canonical guidance merged from the removed non-ADP source skill `angular-to-react-migration`.
The active ADP task skill is `adp-fend-react-migration`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.

## Original references/guidance.md

~~~markdown
# Guidance

## Scope

Use this reference for detailed decisions that are too specific for `SKILL.md`.

This angular-to-react-migration reference is intended for requests that need extra framework, schema-data guidance. Load it only when the current request depends on those details.

## Rules

- Keep implementation guidance tied to the owning skill.
- Prefer existing project conventions when working in a brownfield repository.
- Record assumptions when evidence is incomplete.
- Match the implementation approach to the framework already present in the target repository before introducing new patterns.
- Name the data grain, ownership, schema/version impact, migration path, and validation evidence.

## Review checklist

- The guidance was applied only to the requested scope.
- Source evidence or project context is named.
- Deviations are explained.
~~~

## Original SKILL.md

~~~markdown
---
name: angular-to-react-migration
description: "Use when planning, governing, executing, validating, or cutting over an Angular to React / ReactJS migration. Trigger on \"Angular to React\", \"Angular migration\", \"migrate to React\", \"ReactJS migration\", \"replace Angular\", \"strangler frontend\", \"micro frontend migration\", \"component parity\", \"route parity\", \"AngularJS to React\". Focus on business-safe migration, not rewrite enthusiasm."
---
# Angular To React Migration


## Metadata

- **version:** 0.1.4
- **default_prompt:** Use the angular-to-react-migration skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Planning, governing, executing, validating, or cutting over

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

You guide AD Ports teams through Angular to React migration without losing business behavior, accessibility, security, data contracts, or delivery control. This skill is for migration strategy and migration execution; use `frontend-angular` to understand the current Angular implementation and `frontend-react` to build the target React implementation.

## Business Alignment Gate

Before recommending or executing migration, confirm the work traces to a business-approved reason:

- Business driver: cost, delivery speed, product roadmap, hiring/supportability, performance, vendor/tooling direction, or platform consolidation.
- Sponsor and owning product area.
- Critical user journeys that must keep working during migration.
- Target value and risk tolerance: faster delivery, reduced maintenance, reduced incident rate, better UX, or technology-standard alignment.
- Constraints: release window, parallel-run duration, budget, team skills, compliance, security, accessibility, i18n/RTL, and support obligations.

If the migration reason is only "React is preferred" or "Angular is old", stop and route to `product-manager` / `solution-architect` to define value and scope. Every migration output must include a traceability line: **business driver -> critical journeys -> migration slice -> parity evidence -> cutover decision**.

## Business-Facing Artifacts

- Angular estate assessment with route/component/service inventory and risk map.
- Migration strategy with slice order, strangler/cutover approach, team plan, and rollback model.
- Feature-slice migration package with React implementation, parity notes, and known gaps.
- State/data migration note covering Angular services/RxJS/forms/API behavior to React equivalents.
- Parity validation report covering functional, visual, accessibility, i18n/RTL, security, and performance checks.
- Cutover plan with release gates, rollback, support readiness, and decommission checklist.

## Workflows

| Intent | Read |
|---|---|
| Assess the Angular app before migration | `workflows/assess-angular-app.md` |
| Plan the migration strategy and slice order | `workflows/plan-migration-strategy.md` |
| Migrate one feature slice from Angular to React | `workflows/migrate-feature-slice.md` |
| Migrate state, forms, and data contracts safely | `workflows/migrate-state-and-data.md` |
| Validate parity before release | `workflows/validate-parity.md` |
| Plan cutover, rollback, and Angular decommission | `workflows/plan-cutover.md` |

Load only the workflow relevant to the current migration phase.

## Operating Principles

1. **Migration is a business change, not a framework swap.** Preserve user outcomes first; change technology second.
2. **Slice by journey, not by technical layer.** Migrate routes/features that users can validate independently.
3. **Parity before polish.** Do not improve UX during migration unless the improvement is explicitly approved scope.
4. **Strangler by default.** Prefer incremental route/feature migration with rollback unless a small app justifies a big-bang rewrite.
5. **Contracts stay stable.** Backend APIs, auth behavior, error semantics, locale behavior, and analytics events should not drift accidentally.
6. **Evidence gates cutover.** Functional, visual, accessibility, i18n/RTL, security, and performance evidence decide release readiness.

## Partner Skills

- Use `frontend-angular` to analyze Angular routes, components, services, guards, resolvers, forms, RxJS flows, and existing tests.
- Use `frontend-react` to design and implement the target React feature module.
- Use `ux-ui-designer` when visual/interaction parity or approved UX improvements need design ownership.
- Use `qa-test-engineer` for parity test cases, regression scope, and release validation.
- Use `release-engineer` and `platform-sre` for cutover, routing, hosting, monitoring, and rollback.
- Use `security-engineer` when auth, tokens, CSP, sanitization, secrets, or data exposure could change.

## References

Load only when the request needs detailed guidance:

- `references/guidance.md`

## Handoff

← **product-manager** (business driver, scope, ACs), **solution-architect** (target architecture), **frontend-angular** (current-state inventory), **ux-ui-designer** (approved UX behavior).
→ **frontend-react** (target implementation), **qa-test-engineer** (parity validation), **release-engineer** / **platform-sre** (cutover), **support-analyst** (post-cutover support).

Always use `adp-handoffs/workflows/handoff-to-next-role.md` when passing a migration slice or cutover package to another role.

## Ownership

- **Primary owner:** frontend-react
- **Supporting owners:** frontend-angular, solution-architect, qa-test-engineer
- **Review cadence:** Quarterly, plus after major Angular, React, routing, or design-system changes
- **Last reviewed:** 2026-05-01
~~~

## Original workflows/assess-angular-app.md

~~~markdown
# Workflow: Assess Angular App Before Migration

## Before you start

- [ ] Business driver, sponsor, and affected product area are known.
- [ ] Repository access and Angular app entry points are available.
- [ ] Current production routes, critical user journeys, analytics, and incident history are available.
- [ ] Existing Angular version, build tool, routing mode, state patterns, form patterns, and test setup are known or discoverable.
- [ ] Target destination for the assessment report is decided.

## Goal

Produce a migration assessment that explains what exists, what matters to users, what is risky, and which slices are realistic migration candidates.

## Steps

1. **Inventory routes and journeys.** Map Angular routes to business journeys, personas, traffic, revenue/compliance relevance, and support criticality.
2. **Inventory code shape.** Components, modules/standalone components, services, guards, resolvers, pipes, directives, shared UI, state services, NgRx/SignalStore, RxJS patterns, forms, and interceptors.
3. **Inventory contracts.** API clients, OpenAPI usage, error models, auth/token behavior, permissions, feature flags, analytics events, and environment config.
4. **Inventory tests and evidence.** Unit, component, E2E, visual, accessibility, i18n/RTL, and manual regression assets.
5. **Find migration blockers.** Hidden global state, framework-specific libraries, deep template logic, direct DOM access, custom validators, hard-coded English strings, third-party widgets, and security-sensitive rendering.
6. **Score each slice.** Business criticality, technical complexity, test coverage, migration risk, dependency count, and rollback ease.
7. **Recommend first candidates.** Pick low-risk/high-learning slices first unless business priority forces otherwise.

## Anti-patterns

- Counting files/components but not mapping them to user journeys.
- Starting with a shared component library rewrite before validating any product route.
- Treating missing tests as "fine" instead of a migration blocker.
- Ignoring auth, analytics, i18n/RTL, or accessibility because the UI looks simple.

## After you finish

- [ ] Assessment report is saved and linked from the migration ticket.
- [ ] Slice risk scores and recommended order are visible.
- [ ] Blockers are routed to owners.
- [ ] Handoff prepared for `plan-migration-strategy`.

## Definition of Done

- [ ] Traceability recorded: business driver -> critical journeys -> Angular route/component inventory.
- [ ] Route and feature inventory completed.
- [ ] Contract, auth, config, analytics, and test assets inventoried.
- [ ] Migration blockers and dependencies listed.
- [ ] Candidate slices scored by business value and technical risk.
~~~

## Original workflows/migrate-feature-slice.md

~~~markdown
# Workflow: Migrate Feature Slice

## Before you start

- [ ] Migration strategy and slice order are approved.
- [ ] Slice has PRD/story acceptance criteria and current Angular behavior evidence.
- [ ] Angular route/component/service inventory for this slice is complete.
- [ ] Target React feature module plan exists or will be produced with `frontend-react/workflows/plan-feature.md`.
- [ ] Parity test cases and rollback path are known.

## Goal

Migrate one business-validatable Angular route or feature slice to React while preserving behavior, contracts, accessibility, i18n/RTL, telemetry, and rollback.

## Steps

1. **Freeze the scope.** Identify exact route(s), user journey, Angular components/services/forms, APIs, guards, analytics, and acceptance criteria in scope.
2. **Capture current behavior.** Screenshots, journey recordings, existing tests, network calls, validation messages, error states, permissions, and analytics events.
3. **Plan React module.** Use `frontend-react/workflows/plan-feature.md` for route, state, data, forms, UI states, i18n/RTL, and test approach.
4. **Build React implementation.** Use `frontend-react/workflows/start-new-feature.md`, `implement-component.md`, and `wire-data.md` as needed. Reuse design-system primitives.
5. **Preserve contracts.** Keep API requests/responses, auth behavior, error mapping, and analytics event meaning stable unless product explicitly approves a change.
6. **Bridge routing safely.** Route traffic to React behind a flag, path mapping, or shell configuration that supports rollback to Angular.
7. **Document parity gaps.** Any intentional behavior change needs PM/UX approval; any unintentional gap blocks cutover.

## Anti-patterns

- Migrating by copying templates line-for-line instead of preserving user behavior.
- Changing API contracts to suit React without backend/product approval.
- Treating parity gaps as polish.
- Removing Angular code before React is validated and rollback-safe.

## After you finish

- [ ] React feature slice is implemented and linked to the migration ticket.
- [ ] Parity gaps and approved behavior changes are documented.
- [ ] Feature flag/routing rollback is documented.
- [ ] Handoff prepared for `validate-parity`.

## Definition of Done

- [ ] Traceability recorded: business journey -> Angular behavior -> React implementation -> parity tests.
- [ ] React feature module matches approved route and acceptance scope.
- [ ] API, auth, error, analytics, accessibility, and i18n/RTL behavior are preserved or approved as changed.
- [ ] Rollback to Angular route remains possible.
- [ ] Known gaps are documented with owner and decision.
~~~

## Original workflows/migrate-state-and-data.md

~~~markdown
# Workflow: Migrate State, Forms, And Data

## Before you start

- [ ] Feature slice scope and current Angular behavior are known.
- [ ] Angular services, RxJS streams, stores, forms, validators, interceptors, and API calls are inventoried.
- [ ] Target React state-by-kind decision is known from `frontend-react`.
- [ ] Backend API contract and auth/error behavior are available.
- [ ] Test data and parity cases exist.

## Goal

Translate Angular state, forms, and data behavior into React patterns without changing business rules, validation, permissions, or data freshness semantics accidentally.

## Steps

1. **Classify state by kind.** Local UI state, route state, server state, cross-feature state, URL state, and persisted state.
2. **Map Angular patterns to React patterns.** Angular service/signals/RxJS local state -> React state/reducer/context where scoped; NgRx/SignalStore -> Zustand or context only when needed; HttpClient resource/server state -> TanStack Query.
3. **Preserve forms.** Reactive Forms validators, async validators, disabled/submitting behavior, dirty guards, server validation mapping, and error messages become react-hook-form + zod behavior.
4. **Preserve API behavior.** Request shape, response parsing, auth, 401/403 flow, retry, cancellation, cache/freshness, and error mapping stay stable.
5. **Preserve permissions.** Angular guards/resolvers/interceptors map to React Router guards/loaders, shared API interceptors, and server-enforced authorization.
6. **Preserve i18n/RTL and formatting.** Translation keys, date/number/currency formatting, direction-sensitive layout, and Arabic behavior are verified.
7. **Add parity tests.** Unit tests for reducers/stores/forms, component tests for visible states, MSW handlers for API flows, and Playwright journey tests for migrated behavior.

## Anti-patterns

- Turning every Angular service into a global React store.
- Replacing RxJS behavior without understanding cancellation, debounce, or error recovery.
- Rewriting validation messages and formats without UX/product approval.
- Caching server data in client state instead of using server-state tooling.

## After you finish

- [ ] State/data mapping note is saved.
- [ ] Tests cover the migrated state, form, and API behavior.
- [ ] Security-sensitive auth/token behavior is reviewed when changed.
- [ ] Handoff prepared for `validate-parity`.

## Definition of Done

- [ ] Traceability recorded: Angular state/data behavior -> React state/data design -> parity tests.
- [ ] State mapped by kind, not by framework habit.
- [ ] Forms and validation preserve business behavior.
- [ ] API, auth, error, retry, and freshness behavior preserved or approved as changed.
- [ ] Tests cover state transitions, forms, and API outcomes.
~~~

## Original workflows/plan-cutover.md

~~~markdown
# Workflow: Plan Cutover And Angular Decommission

## Before you start

- [ ] Parity validation report is complete.
- [ ] Release owner, support owner, and rollback owner are named.
- [ ] Routing/flag/hosting mechanism for cutover is known.
- [ ] Monitoring, support, and incident response expectations are known.
- [ ] Angular cleanup scope is identified.

## Goal

Cut over a migrated React slice safely, monitor production behavior, and remove Angular code only after the business and support gates are satisfied.

## Steps

1. **Choose release pattern.** Internal preview, canary, percentage rollout, tenant/location rollout, or full cutover. Match business risk.
2. **Define go/no-go gates.** Parity pass, test pass, accessibility pass, performance signal, security review, support readiness, and rollback rehearsal.
3. **Prepare rollback.** Exact route/flag/config change that returns users to Angular, with owner and expected time to restore.
4. **Prepare monitoring.** Error rate, route traffic, page load, key user action completion, support tickets, analytics events, and user feedback.
5. **Prepare support.** KB notes, known differences, escalation path, support analyst handoff, and incident labels.
6. **Execute cutover.** Record time, version, owner, gates, and observations.
7. **Stabilize before removal.** Keep Angular route/code until agreed observation window passes.
8. **Decommission Angular.** Remove old route, module/component/service/tests/dependencies/build config only after rollback window closes and support confirms no active issues.

## Anti-patterns

- Deleting Angular code during the same release that first enables React.
- No tested rollback path.
- Cutover without support readiness.
- Declaring success before observing real production traffic.

## After you finish

- [ ] Cutover plan and release record are saved.
- [ ] Monitoring links and support notes are available.
- [ ] Rollback path is tested or explicitly blocked with owner.
- [ ] Angular decommission tasks are created with timing.

## Definition of Done

- [ ] Traceability recorded: parity evidence -> cutover gate -> production observation -> decommission decision.
- [ ] Go/no-go gates and owners documented.
- [ ] Rollback path rehearsed or blocker escalated.
- [ ] Support and monitoring ready before cutover.
- [ ] Angular removal happens only after observation window passes.
~~~

## Original workflows/plan-migration-strategy.md

~~~markdown
# Workflow: Plan Angular To React Migration Strategy

## Before you start

- [ ] Angular assessment report exists.
- [ ] Business driver, sponsor, target outcomes, timeline, and risk tolerance are known.
- [ ] Target React standards are known from `frontend-react`.
- [ ] Hosting/routing constraints are known from `platform-sre` or `solution-architect`.
- [ ] Cutover and rollback expectations are agreed at a high level.

## Goal

Create a migration strategy that defines slice order, target architecture, coexistence model, verification gates, and rollback before any feature migration starts.

## Steps

1. **Choose migration model.** Strangler-by-route, micro frontend, parallel app, or big-bang. Default to strangler-by-route unless the app is small and low-risk.
2. **Define target React architecture.** Feature modules, routing, design-system usage, state-by-kind, API client generation, i18n/RTL, tests, telemetry, and build pipeline.
3. **Define coexistence.** How Angular and React route together, share auth/session, share navigation, share design tokens, and avoid duplicate analytics.
4. **Sequence slices.** Order by business priority, dependency risk, learning value, and rollback ease. Avoid migrating core shell/shared components first unless required for coexistence.
5. **Define parity gates.** Functional, visual, accessibility, i18n/RTL, security, analytics, performance, and support-readiness evidence required per slice.
6. **Define team plan.** Owners, review path, pairing between Angular and React engineers, QA involvement, and release cadence.
7. **Define decommission model.** How old Angular routes, modules, dependencies, tests, and deployment paths will be removed after cutover.

## Anti-patterns

- "Rewrite everything in React" with no slice order or rollback.
- Mixing migration with broad UX redesign without product approval.
- Choosing micro frontends because they are fashionable, not because deployment boundaries require them.
- Leaving QA, support, or platform out until the final release.

## After you finish

- [ ] Strategy is documented and linked from the migration epic.
- [ ] Slice order and gates are reviewed by PM, architecture, QA, release, and platform.
- [ ] First migration slice is selected.
- [ ] Handoff prepared for `migrate-feature-slice`.

## Definition of Done

- [ ] Traceability recorded: business driver -> migration model -> slice order -> release gates.
- [ ] Migration model and target architecture documented.
- [ ] Coexistence and routing approach documented.
- [ ] Slice order, owners, and gate evidence defined.
- [ ] Rollback and Angular decommission approach documented.
~~~

## Original workflows/validate-parity.md

~~~markdown
# Workflow: Validate Migration Parity

## Before you start

- [ ] Migrated React slice is available behind a route/flag or review environment.
- [ ] Original Angular behavior evidence is available.
- [ ] Acceptance criteria, parity test cases, and approved behavior changes are known.
- [ ] Test commands and environments are available.
- [ ] QA owner and release gate owner are known.

## Goal

Produce evidence that the React slice is safe to release because it matches the Angular behavior that matters to users and the business.

## Steps

1. **Functional parity.** Run acceptance and regression cases for the migrated journey. Compare Angular vs React for happy path, validation failures, auth failures, empty/error/loading states, and edge cases.
2. **Visual and interaction parity.** Compare layout, responsive behavior, keyboard navigation, focus, modal/dropdown behavior, and approved design differences.
3. **Accessibility parity.** Run axe checks and manual keyboard/screen-reader smoke for critical controls.
4. **i18n/RTL parity.** Verify English and Arabic, formatting, logical layout, icon mirroring, and translation key coverage.
5. **Security parity.** Verify auth guards, token handling, sanitized rendering, URL safety, and no new client-side exposure.
6. **Analytics and telemetry parity.** Verify key events, page views, correlation IDs, error reporting, and no PII leakage.
7. **Performance parity.** Compare route load, interaction latency, bundle impact, and Lighthouse or agreed frontend performance signal.
8. **Decide readiness.** Pass, conditional pass, or fail. Conditional pass must name owners, deadlines, and non-release-blocking rationale.

## Anti-patterns

- Validating only the happy path.
- Treating screenshots as sufficient parity evidence.
- Skipping Arabic/RTL because the English page passed.
- Accepting a conditional pass with no owner or expiry.

## After you finish

- [ ] Parity report is saved and linked from the migration ticket.
- [ ] Release blockers and non-blockers are separated.
- [ ] Approved behavior changes are listed.
- [ ] Handoff prepared for `plan-cutover` or back to implementation if failed.

## Definition of Done

- [ ] Traceability recorded: critical journey -> parity cases -> pass/fail evidence -> release decision.
- [ ] Functional, visual, accessibility, i18n/RTL, security, analytics, and performance parity checked.
- [ ] Approved behavior changes are documented.
- [ ] Release readiness verdict recorded with owner.
~~~

