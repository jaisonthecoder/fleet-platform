# CI Pipeline

The gates that run on every PR. The PR is not mergeable until all required gates pass.

## Required gates

| Gate | What it runs | Fails on |
|---|---|---|
| **Typecheck** | `tsc --noEmit` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`) | Any type error. |
| **Lint** | ESLint with the plugin set in `references/coding-conventions.md`; warnings treated as errors. | Any lint error or unsuppressed warning. |
| **Format** | Prettier check (`pnpm prettier --check`). | Any unformatted file. |
| **Unit tests** | Vitest. | Any failing test; suite total > 30s. |
| **E2E tests** | Playwright on the top journeys per persona, headless. | Any failing test; suite total > 5 min. |
| **Accessibility** | `jest-axe` on critical components in unit; `axe-playwright` in E2E. Storybook a11y addon if Storybook is in CI. | Any axe violation. |
| **Bundle size** | `size-limit` (or equivalent). | Initial bundle regression beyond the project's budget. |
| **Lighthouse** | `@lhci/cli` (Lighthouse CI) on a representative page; pin a baseline in `lighthouserc.json`. | Performance score below project budget on changed pages. |
| **OpenAPI client** | Regenerate the client; fail if the generated diff isn't committed. | Stale client. |

## Optional gates (recommended)

- **Visual regression** — Playwright screenshot diffs on critical components. Skip on UI-churning teams; enable once the design system stabilizes.
- **Mutation testing** — **Stryker.js** (`@stryker-mutator/core`) on critical pure modules (validators, mappers). Slow; run nightly, not per PR.
- **License / supply-chain scan** — Snyk / `pnpm audit` / equivalent. High-severity findings open issues, not silent warnings.

## Speed budget

- Total CI wall time per PR: ≤ 10 min on a green pipeline.
- Cache typecheck and lint outputs by file hash; only re-run on changed files where possible.
- E2E parallelizes across workers — do not run journeys sequentially.

## When a gate fails

- **Author fixes**, then pushes a new commit. Reviewers do not merge red CI.
- **Quarantine** flaky tests with an issue link and an owner; do not silently skip.
- **Bundle / Lighthouse regressions** — diagnose with `source-map-explorer` (bundle) or the Lighthouse trace (perf) before relaxing the budget. Budgets relax with an ADR, not a one-off override.
- **Auth / security gate failures** (axe violations on auth flows, supply-chain high-severity) — escalate to the Security reviewer per `references/coding-conventions.md` §Review process before merging.
