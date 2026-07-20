# U8 — Hardening: a11y · i18n/RTL · Contract-drift · E2E

> **Phase-exit critique gate (mandatory).** This phase **is** the binding critique/hardening pass for the whole app-ui. Still run **two rounds of rigorous critique + gap analysis** across every prior phase — **Round 1** completeness/integration, **Round 2** correctness/security/a11y/RTL — fix every finding (or accept-with-dated-risk), and close only on a fully green UI gate (`tsc` · `oxlint` · `vitest` · axe · i18n-parity · contract-drift · Playwright core-loop · `vite build`) verified against the running backend.

**Goal:** the binding hardening pass over the whole app-ui — accessibility, full EN/AR + RTL, contract-drift protection, MSW retirement, performance, a states audit, and end-to-end coverage of the accountability loop. Mirrors the backend's 1G.

**Entry:** U1–U7 built.
**Exit:** the UI is accessible, fully bilingual/RTL, contract-safe, MSW-free in production, and the core loop is proven end-to-end against the real backend.

---

## 1. Accessibility (WCAG AA)
- **axe** in CI (`@axe-core/playwright` on key routes + `jest-axe`/`vitest-axe` on components) — zero serious/critical violations.
- Keyboard-operable everywhere (wizards, dialogs, tables, map fallback); visible focus ring; `aria-current` on nav; colour-never-alone (`status-chip` audit).
- Live regions for toasts; forms fully labelled; the live-map has the sr-only/table fallback.

## 2. i18n & RTL completeness
- No hard-coded UI strings — every string via `react-i18next`; run a **missing-keys check** (en vs ar parity).
- Arabic RTL verified on every screen (logical CSS props; mirrored layouts; numerals/dates via the i18n formatter; Asia/Dubai display of UTC instants).
- Reason-code catalogue (EN + AR) covering all backend `*_REASON` codes surfaced by the app.

## 3. Contract-drift guard
- Script comparing each UI feature `*.contract.ts` (types/enums/reason codes) to the backend `app-api/src/contracts/contracts.manifest.json`; **fail CI on divergence**. Regenerate/mirror UI contracts from the backend as the single source of truth for data shape.

## 4. MSW retirement
- MSW disabled in dev/prod when `VITE_API_URL` is set; handlers retained **only** under `mocks/` for component/unit tests. Confirm no screen depends on a mock at runtime.

## 5. End-to-end (Playwright, against the running backend + simulator)
- **The accountability loop**: dev-login → book → consent → submit → approve (as approver) → handover (→Active) → return (→Completed) → record fine (auto-attributed) → nothing bookable on expired documents (hard-block). One green E2E spec proving the whole loop the backend enforces.
- Admin: lookup add + role assign + SoD rejection.
- Dashboards: scope switch re-fetch + cost masking per role (Finance vs FleetManager).

## 6. Performance & UX
- Route-level code-splitting confirmed (heavy libs — charts, maplibre — lazy per route); bundle budget check.
- Loading/empty/error/denied **states audit** across every screen (checklist per phase).
- Optimistic updates + query invalidation reviewed for correctness (no stale lists after mutations).

## 7. Security (client-side)
- No secrets in the bundle (only `VITE_*` public config); token handled by MSAL (no long-lived storage); 401 → session drop; RBAC hiding is UX-only (server enforces) — verify no client-only "security".

## 8. Tests / evidence
- `tsc` clean · `oxlint` clean · `vitest` (unit + component + MSW) green · axe green · i18n parity green · contract-drift green · Playwright loop green · `vite build` within budget.

## 9. Exit gate
- All of §1–§8 green; the core-loop E2E passes against the real backend; app-ui is accessible, bilingual/RTL, contract-safe, mock-free at runtime. This is the UI counterpart to the backend Phase-1 gate; **ops/UAT sign-off** (with the backend's 09 gate) closes Phase 1 for the product.

## 10. Traceability
- NFRs: accessibility, i18n/RTL (S-01 Arabic), performance; cross-cutting FR-IAM-03 (masking), consent hard gate, SoD. Mirrors backend `07_sub-phase-1g` + `09_production-readiness-gate`.
