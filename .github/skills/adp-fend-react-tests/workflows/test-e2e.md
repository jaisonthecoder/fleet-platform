# Workflow: Test End-to-End (React)

Authoritative slice-level workflow for the React-driven invocation of Playwright + axe-playwright: a complete user journey through the running app in a real browser. Project bootstrap, page-object scaffolding, and spec-driven generation are owned by [`../../adp-qa-playwright/SKILL.md`](../../adp-qa-playwright/SKILL.md); this workflow owns what the React engineer authors before that handoff.

## Position in the chain

- **Pairs with:** `workflows/test-component.md`, `workflows/test-integration.md`, and feature implementation — runs alongside the build, not after.
- **Inputs from:** deployed UAT URL or local `pnpm dev` build, route map, top-journey list per persona from the PRD, tenancy mapping, Playwright project from `adp-qa-playwright`.
- **Successor:** handoff to `ai-quality-engineer` via `adp-qa-tests/workflows/test-feature-react.md`, then `ai-reviewer` (gate).

## Goal
Prove one happy path plus one critical-failure path per route in a real browser, with zero critical/serious axe-playwright violations, full trace + video on failure, and `en-AE` + `ar-AE` parity assertions.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.
- Check the applicable shared standards: `/standards/test-plan.md`, `/standards/definition-of-done.md`.
- The Playwright project is bootstrapped per [`../../adp-qa-playwright/workflows/bootstrap-playwright-project.md`](../../adp-qa-playwright/workflows/bootstrap-playwright-project.md). Do not bootstrap inside this workflow.
- The route under test, the top journeys for it (from the PRD), and the failure paths to assert are listed.
- Tenancy fixture and auth storage states are in place under `tests/.auth/<tenant>.json`.
- `pnpm playwright test` resolves and runs locally against UAT or `pnpm dev`.

If inputs are missing, write a short "waiting on" note and stop.

## References
- [`../references/testing.md`](../references/testing.md) — authoritative source for the React-side E2E policy: when to defer to `adp-qa-playwright`, axe matrix, accessibility rules. Load `## End-to-end testing` and `## Accessibility testing` for this workflow.
- [`../../adp-qa-playwright/SKILL.md`](../../adp-qa-playwright/SKILL.md) — project bootstrap, page objects, fixtures, CI wiring, AD Ports edges (tenancy, RTL, cut-off, replay).

## Steps

1. **Use Playwright (project standard).** For setup, page objects, fixtures, and CI integration see [`../../adp-qa-playwright/SKILL.md`](../../adp-qa-playwright/SKILL.md). This workflow only covers React-driven spec authoring.
2. **One happy + one critical-failure path per route.** Title the `test()` with the AC it covers. Happy path: the journey succeeds end-to-end with realistic data. Critical-failure path: 5xx, 401, tenancy violation, or optimistic-locking 409 — whichever the route can hit in production.
3. **Mock external partners at the network layer.** Use MSW (browser handler set) or Playwright `page.route('**/partner-api/**', ...)` for SAP, Oracle, and Port Community System (PCS). Never hit live partner endpoints from CI.
4. **Assert RTL layout in Arabic.** Run the spec under the `chromium-ar` project as well as `chromium-en`. Assert `await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')` and that Arabic-Indic digits appear in numeric fields.
5. **Run axe-playwright on every page touched.** `import AxeBuilder from '@axe-core/playwright'; const results = await new AxeBuilder({ page }).analyze(); expect(results.violations.filter(v => ['critical','serious'].includes(v.impact))).toEqual([])`. Zero critical/serious violations is a gate.
6. **Capture trace + video on failure.** Set `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'` in `playwright.config.ts`. The CI job publishes the artefacts so a reviewer can open the trace from the PR.
7. **Tag specs with `@e2e`.** Use `test.describe('Vessel arrival board @e2e', ...)` so the suite can be filtered (`pnpm playwright test --grep @e2e`).
8. **Spec-driven generation defers to qa-playwright.** For `plan → generate → heal` loop authoring, page-object scaffolding, and bulk spec generation across every route, use [`../../adp-qa-playwright/workflows/spec-driven-testing.md`](../../adp-qa-playwright/workflows/spec-driven-testing.md). Do not reinvent that loop here.

## Anti-patterns
- E2E in a `*.test.tsx` file — that's the Vitest/Jest layer; E2E lives in `tests/e2e/*.spec.ts`.
- `page.waitForTimeout(2000)` — flake magnet; rely on Playwright's auto-waiting assertions (`expect(locator).toBeVisible()`).
- Shared login in `beforeAll` without isolation — leaks tenant state across specs.
- No isolation between specs — assertions pass when run alone, fail when run together.
- Hitting live SAP / Oracle / PCS from CI — outages flake every PR.
- Skipped flaky tests without an owner and fix date.

## After you finish
- Definition of Done items below are met.
- Trace/video artefacts published from the CI run; the PR links to them.
- axe-playwright report published with the violation counts.
- Flaky tests have an owner and fix path (no indefinite `test.skip`).
- Handoff package prepared for `ai-quality-engineer` and `ai-reviewer`.
- `git status` shows only intended changes.

## Definition of Done
- Traceability recorded: AC → journey → spec path.
- One happy + one critical-failure spec per route the slice touches.
- Both `chromium-en` and `chromium-ar` projects pass.
- Zero critical/serious axe-playwright violations on the changed screen.
- Trace + video published on failure; CI artefacts retained.
- No live partner endpoints contacted from CI.
- Suite is tagged `@e2e` and runs in under five minutes for the slice.

## CI configuration baseline

- Install Chromium only: `npx playwright install chromium --with-deps`
- Trace on first retry: `use: { trace: 'on-first-retry' }`
- Sharding when suite > 10min wall clock: `--shard=1/3`
- Reuse MSW handlers via `router.use(...handlers)` in `test.beforeEach`.
- Accessibility scan: chain `@axe-core/playwright` via `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag22aa']).analyze()` — 0 critical / 0 serious violations on changed screens.
