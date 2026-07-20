---
name: adp-fend-react-tests
description: "React unit, component, hook, integration, contract, and end-to-end test authoring for the frontend slice (Vitest/Jest, React Testing Library, renderHook, MSW, Pact, Playwright, axe-playwright, coverage). Use when producing or updating \\\"frontend React test files (*.test.tsx, *.spec.tsx), MSW handlers, Pact/E2E suites, coverage and a11y evidence\\\". Owned by AI Frontend Engineer (React)."
---

# adp-fend-react-tests

## Metadata

- **kind:** skill
- **version:** 0.3.4
- **stability:** alpha
- **role:** ai-frontend-react
- **tiers:** essentials: baseline · advanced: baseline · enterprise: baseline
- **why_critical:** Framework-specific React test patterns (RTL queries by role, renderHook for hooks, MSW-only HTTP mocking, TanStack Query/Zustand factories, axe-playwright) are the dominant correctness lever for React slices; without an owned skill, every page reinvents the harness and accessibility/data-fetching mistakes ship to QA.
- **default_prompt:** Use the adp-fend-react-tests skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** React Vitest/RTL/MSW/Playwright tests with a11y + coverage

**Owner role:** AI Frontend Engineer (React) (`ai-frontend-react`)
**Primary artifact:** frontend React test files (*.test.tsx, *.spec.tsx), MSW handlers, Pact/E2E suites, coverage and a11y evidence

## Why critical
Framework-specific React test patterns (RTL queries by role, renderHook for hooks, MSW-only HTTP mocking, TanStack Query/Zustand factories, axe-playwright) are the dominant correctness lever for React slices; without an owned skill, every page reinvents the harness and accessibility/data-fetching mistakes ship to QA.

## Purpose
React unit, component, hook, integration, contract, and end-to-end test authoring for the frontend slice (Vitest/Jest, React Testing Library, renderHook, MSW, Pact, Playwright, axe-playwright, coverage).

## Abu Dhabi Ports Group context

Apply this skill as AI Frontend Engineer (React) delivery guidance for AD Ports operational web tiers (vessel ops, customs declarations, gate appointments, KEZAD tenant portals). The role-specific AD Ports edges are Arabic / RTL parity asserted in every component and route test, tenant-scoped MSW fixtures so Terminal A specs never leak Terminal B data, Asia/Dubai date and customs-cut-off formatting validated against fixed clock fakes, and WCAG 2.2 AA accessibility for operational dashboards used under glare on terminal apron tablets. Keep outputs tenant-aware, locale-parity-aware, UAE-regulatory aware, and ready for QA and reviewer handoff.

## Mental model

- **Protects:** correctness and accessibility of the React slice before QA inherits the suite.
- **Optimizes for:** behavior-focused tests by user-visible outcome, with MSW-driven HTTP and stable fixtures.
- **Refuses to leave ambiguous:** which RTL query was used, whether `userEvent` or `fireEvent` was used, whether the QueryClient/store is per-test, or whether the RTL parity case was covered.
- **Primary artifact focus:** `*.test.tsx` / `*.spec.tsx` files, MSW handlers under `src/mocks/`, Pact JS consumer suites, Playwright suites, coverage HTML, axe-playwright report.
- **Default stance:** smallest viable suite that exercises the user-perceivable contract of the slice, with the AD Ports edges asserted where the surface touches them.

## Hard rules

1. **Test through React Testing Library — query by role + accessible name, NOT by class or test-id unless absolutely required (and prefer `data-testid` over class).**
2. **HTTP is mocked ONLY via MSW 2.x** (`http.get`, `http.post`, `HttpResponse.json(...)`); never via `vi.mock('axios')`, `jest.mock('@/lib/http')`, or 1.x `rest.get`. The handler set under `src/mocks/handlers/` MUST also work in dev runtime (Vite plugin) and Storybook to enforce single-source-of-truth.
3. **Hooks tested via `renderHook` from `@testing-library/react`; never extract hook logic to test in isolation.**
4. **TanStack Query: wrap with a fresh `QueryClient` per test (`retry: false`, `gcTime: 0`); do not share clients across tests (cache leaks).**
5. **Zustand: use the factory pattern — `createStore(initial)` returns a fresh instance per test; do not import the singleton store.**
6. **Every page route has at least one component test (happy + one error/empty state) plus one Playwright smoke test.**
7. **Coverage floor 70% line / 60% branch via Vitest/Jest + v8/Istanbul; a11y gate via axe-playwright with 0 critical violations.**
8. **Playwright tests reuse the same MSW handlers via `router.use(...handlers)`.** Use `import { handlers } from '@src/mocks/handlers'` then `await router.use(...handlers)` in `test.beforeEach` — handlers do not get redeclared in the E2E layer.
9. **Web-first assertions only.** Use `await expect(locator).toBeVisible()`; forbidden: `expect(await locator.isVisible()).toBe(true)` (returns instantly, defeats auto-wait).
10. **CI installs only the browsers used.** Run `npx playwright install chromium --with-deps` in CI unless cross-browser is in scope; never `install --with-deps` (all browsers) by default.

## Pitfalls

- **Class or text-id selectors over role queries** — couples the test to markup; refactors break tests that should not break.
- **`jest.mock('axios')` or `vi.mock('@/lib/http')`** — hides interceptor and contract drift; MSW is the single source of HTTP truth.
- **Shared `QueryClient` across tests** — query cache leaks success state into the next `isLoading` assertion.
- **Singleton Zustand store** — set state in one test bleeds into the next; factory + Provider is mandatory.
- **`fireEvent` for typing or clicking** — synthetic events skip `pointerdown`/`focus`/composition; use `userEvent.setup()`.
- **Snapshot bloat on the whole DOM** — every refactor diffs hundreds of lines; snapshot small fragments or assert directly.
- **Missing RTL parity test** — the slice ships looking correct in `en-AE`, breaks on `ar-AE` with mirrored padding, wrong Arabic-Indic digits, or chopped labels.
- **MSW v1 handlers (`rest.get(...)`) in a v2 codebase.** Migrate to `http.get`/`HttpResponse.json`; the two syntaxes are not interchangeable. Pin `msw@^2` in `package.json`.
- **Different MSW handlers for tests and Playwright.** The whole point of MSW is one source of truth — keep the handlers in `src/mocks/handlers/` and import them in both Vitest setup and Playwright `router.use`.
- **`isVisible()` / `isHidden()` instead of `expect(...)` assertions.** Returns immediately, ignores Playwright's auto-wait, leads to flaky tests.
- **Whole-`render()` snapshots on a 50-row table.** Diffs hundreds of lines on every layout tweak. Snapshot only the row component or use ARIA snapshots (Vitest Browser Mode).

## Evidence expectations

- **Minimum evidence:** path to each new `*.test.tsx`, the AC it covers, the test category (unit / component / hook / integration / E2E / a11y), and the command used to run it.
- **When code is touched:** include `pnpm vitest run --coverage` JUnit summary, coverage HTML link, `pnpm playwright test` trace/video for any failure, axe-playwright JSON report.
- **When MSW handlers change:** include the handler file path and the OpenAPI operation they cover.
- **When risk is found:** record owner, severity, mitigation, and whether the slice can ship.
- **When using adp-fend-react-tests:** finish with the files changed, the coverage delta, and the artefacts a reviewer should inspect first.

## Decision checkpoints

- **Before producing tests:** confirm the slice is owned by this skill (a React app surface) and not by `adp-qa-tests` (cross-service) or `adp-qa-playwright` (E2E project bootstrap / spec-driven generation).
- **Before changing scope:** confirm the change still covers every rendered state of the touched component and still asserts the RTL parity case.
- **Before marking done:** confirm coverage floor met, axe-playwright is green on the changed screen, and Playwright smoke covers the route.
- **Before routing onward:** confirm `ai-quality-engineer` and `ai-reviewer` have a clear next action and the evidence path.
- **Before accepting missing input:** record whether the gap blocks work, creates risk, or can be carried as an assumption.

## Escalation triggers

- **Security or privacy uncertainty:** involve `ai-security-engineer` before locking auth/token tests.
- **Architecture or integration uncertainty:** involve `ai-solution-architect` or `ai-integration-engineer` before locking contract-test scope.
- **Operational readiness uncertainty:** involve `ai-platform-engineer` or `ai-sre` before release-facing handoff.
- **Test-strategy uncertainty:** involve `ai-quality-engineer` via `adp-qa-test-strategy` before locking E2E breadth.
- **Ownership uncertainty:** involve `ai-governance-lead` rather than leaving the skill, artifact, or exception owner implicit.

## Review lens

- A reviewer should be able to map every new test to a backlog AC or risk area.
- A reviewer should be able to confirm RTL queries are used and `userEvent` (not `fireEvent`) drives interactions.
- A reviewer should be able to see one MSW handler set powering both tests and dev mocks.
- A reviewer should be able to open the coverage HTML and axe-playwright report from the PR.
- A reviewer should be able to rerun the suite with one `pnpm` command.

## When to use
Trigger this skill when:
- A new instance of `frontend React test files (*.test.tsx, *.spec.tsx), MSW handlers, Pact/E2E suites, coverage and a11y evidence` is required.
- An existing instance must be updated due to scope, risk, or feedback change.
- Another role asks for this artifact as an input to their work.

Do not use this skill for artifacts owned by other skills. If the request straddles multiple artifacts, split the request and route each part to its owning skill. Specifically:

- For Playwright project bootstrap, spec-driven generation, page-coverage matrices, or CI wiring of the E2E suite, defer to [`../adp-qa-playwright/SKILL.md`](../adp-qa-playwright/SKILL.md) — this skill owns the React-driven invocation only.
- For cross-service or backend contract testing, route to `adp-qa-tests` or the relevant backend skill.

## Inputs
- Backlog story / defect / ADR follow-up that justifies the change.
- The React slice under test (page, component, feature, hook, store) produced by `adp-fend-react-page`, `adp-fend-react-component`, `adp-fend-react-feature`, or `adp-fend-react-crosscut`.
- Design tokens and UX handoff for state matrix (loading / empty / error / success / partial).
- NFR targets that gate this slice (latency, a11y, locale parity).
- OpenAPI contract for the endpoints the slice consumes (drives MSW handlers).

## Outputs
- `*.test.tsx` / `*.spec.tsx` files co-located with the unit under test.
- MSW handler files under `src/mocks/handlers/<feature>.ts` shared with dev runtime.
- Playwright suite under `tests/e2e/` (this skill owns React-driven specs; `adp-qa-playwright` owns project bootstrap).
- Coverage HTML report (Vitest v8 or Jest Istanbul) and JUnit XML.
- axe-playwright JSON report with 0 critical/serious violations on changed screens.
- Pact JS consumer pacts where the slice contracts a partner API directly.

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
- `workflows/test-unit.md` — Prove pure functions, hooks, utilities, and Zod/Yup validators in isolation.
- `workflows/test-component.md` — Prove a component renders correctly, responds to props, fires callbacks, and integrates with hooks.
- `workflows/test-integration.md` — Prove route + page + feature state + API interaction across the React app boundary (includes contract-test notes for Pact JS).
- `workflows/test-e2e.md` — Prove a complete user journey through the React app in a real browser via Playwright + axe-playwright.
- `workflows/test-component-pwct.md` — Component test in a real browser via `@playwright/experimental-ct-react`. Use when a component depends on layout / IntersectionObserver / CSS computed values. **(NEW)**

## References

Load only the references needed for the current request:

- `references/testing.md` — authoritative React testing reference: layer-by-tool table, RTL/`renderHook` patterns, MSW policy, TanStack Query/Zustand factories, axe matrix, coverage policy, anti-patterns, CI integration.
- `references/msw-handler-catalog.md` — MSW 2.x handler patterns, OpenAPI binding, tenant-scoped fixtures, RTL parity (`ar-AE`) fixtures. **(NEW)**
- `references/vitest-projects.md` — Vitest 4.x `projects` / workspace config for monorepo + submodule layouts. **(NEW)**
- Cross-reference: [`../adp-qa-test-strategy/references/test-repo-layout.md`](../adp-qa-test-strategy/references/test-repo-layout.md) — co-located vs. unit/integration submodule layouts. **(NEW)**
- Cross-reference: [`../adp-qa-test-strategy/references/testing-skills-catalog.md`](../adp-qa-test-strategy/references/testing-skills-catalog.md) — full catalog mapping all 13 testing skills by owner / function / layer / stack.
- Cross-reference: [`../adp-qa-playwright/SKILL.md`](../adp-qa-playwright/SKILL.md) — defer here for Playwright project bootstrap, spec-driven generation, page-object scaffolding, fixtures, and CI wiring.

## Standards

Use the shared standards by link rather than copying their content:

- `/standards/test-plan.md`
- `/standards/definition-of-done.md`
- `/standards/code-review-checklist.md`

## Autonomous SDLC contract

Use this contract when the catalogue is orchestrated by autonomous agents. Start only when the required inputs exist; otherwise route back to the ordering role or stop at the human gate.

- **SDLC stage:** Implementation verification
- **Ordered by:** `ai-frontend-react`
- **Required inputs:** `prd.md`, `acceptance criteria`, `changed React slice (page/component/feature/hook)`, `OpenAPI contract for consumed endpoints`, `UX handoff with state matrix`
- **Generated artifact:** `*.test.tsx` / `*.spec.tsx` files, `MSW handlers`, `Playwright suite`, `coverage HTML`, `axe-playwright report`, optional `Pact JS consumer pacts`
- **Next roles:** `ai-quality-engineer`, `ai-reviewer`
- **Human gate:** `release quality approval`

## Handoff

- **Upstream:** Implementation slice produced by `adp-fend-react-page`, `adp-fend-react-component`, `adp-fend-react-feature`, or `adp-fend-react-crosscut`. Confirm the AC list, the touched files, the OpenAPI contract, and the UX state matrix before authoring tests.
- **Downstream:** `ai-quality-engineer` (cross-service / QA-level coverage via `adp-qa-tests`), `ai-reviewer` (PR review gate).
- **Evidence:** Summarise changed test files, MSW handler delta, coverage delta, axe-playwright report, and Playwright trace links before routing onward.

## Security shift-left (Checkmarx)

After this skill ships new or changed tests, hand off to the `adp-sec-checkmarx` skill and run `adp-sec-checkmarx/workflows/post-implementation-review.md` against the diff. Test code is in scope for Checkmarx One SAST/SCA/Secrets/IaC scans — common React test-code findings include XSS via `dangerouslySetInnerHTML` inside `render()` test setups, Use_Of_Hardcoded_Password in MSW handlers and Cypress/Playwright fixtures, hardcoded API keys/JWTs in `.env.test`, open redirect coverage gaps in route tests, unsafe `target="_blank"` in component snapshots, insecure JWT decoding helpers, weak crypto in synthetic data factories, and leaked tokens in Vitest/Jest snapshots or axe-playwright reports. Bootstrap the guardrails once via `adp-sec-checkmarx/workflows/bootstrap-copilot-guardrails.md`, which writes `.github/instructions/typescript-security.instructions.md` (`applyTo: '**/*.ts,**/*.tsx,**/*.html,**/*.js,**/*.jsx'`) and the repo-wide `.github/copilot-instructions.md`. The Checkmarx skill is owned by `ai-devsecops`; this skill only references it.

## Ownership

- **Primary owner:** `ai-frontend-react` (AI Frontend Engineer (React))
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
