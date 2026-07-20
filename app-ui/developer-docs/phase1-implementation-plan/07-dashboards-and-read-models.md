# U7 — Dashboards & Read Models

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the role/scope-aware read-model dashboards (M9) — operations overview and the KPI tiles — with **cost masking respected** (Finance full · Executive aggregate · others masked). Reads everything built in U2–U5, so it comes late.

**Entry:** U2–U5 done (real data to aggregate). U6 optional (coverage tile).
**Exit:** operations overview + all tiles render real aggregates, scope-switch re-fetches, and cost visibility matches the caller's role — on the real backend.

---

## 1. Backend dependencies (M9)
- `GET /operations/overview?scopeId` — availability, bookings today, active bookings, attention (expiring compliance + blocks), utilisation%. (Authenticated.)
- `GET /dashboards/utilisation?scopeId`
- `GET /dashboards/fines-per-user?scopeId` — **cost-masked**: response `costVisibility` = `full` (per-user + total) / `aggregate` (total only) / `masked` (counts only, `totalAmount: null`).
- `GET /dashboards/compliance-heat-map?scopeId`
- `GET /dashboards/entitlement-inventory?scopeId`
- `GET /dashboards/telematics-coverage?scopeId`
- Contracts: `operations-overview.contract.ts`, `dashboards.contract.ts`.

## 2. Screens & routes
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| Operations overview | `/{lang}/operations` | — | `GET /operations/overview` |
| Executive dashboard | `/{lang}/dashboards/executive` | — | utilisation, fines-per-user, compliance heat map, entitlement inventory, coverage |
| Finance dashboard | `/{lang}/dashboards/finance` | — | fines-per-user (full), utilisation |

## 3. Components (reuse the charts library — Recharts)
- **Operations overview**: KPI stat cards (available/total, bookings today, active, utilisation%), availability breakdown, **attention list** (danger/warning chips from compliance/blocks), upcoming bookings list. Scope-driven.
- **Utilisation tile**: bar/sparkline of utilisation% + counts.
- **Fines-per-user tile (cost-masked)**: the UI **renders whatever the server returns** — if `costVisibility==='masked'`, show counts only (no amounts); `aggregate` → grand total only; `full` → per-user table. Never attempt to show cost the server withheld. A small "cost visibility: <role>" note explains the masking.
- **Compliance heat map**: valid/expiring/expired/blocks tiles.
- **Entitlement inventory**: allocated count + by-category breakdown.
- **Telematics coverage**: devices-reporting / fleet gauge (%).
- Every chart has the **sr-only data-table fallback** (a11y governance) and reads tokens via `chart-theme`.

## 4. Data & state
- Keys: `['operations','overview', scopeId]`, `['dashboards', tile, scopeId]`. Changing the Scope Switcher changes `scopeId` → automatic re-fetch (prove "scope change refetches").
- Read-only; short `staleTime`; no mutations.

## 5. States
- Empty scope (0 vehicles) → tiles show zeros gracefully (backend allows 0); masked cost → counts-only rendering; error → banner; loading → stat/chart skeletons.

## 6. RBAC & scope
- Overview: any authenticated (no cost). Tiles: authenticated; **cost visibility is server-enforced** — the UI must not infer or reconstruct masked cost. Finance dashboard route gated to Finance; Executive to Executive; both still get server-masked payloads defensively.

## 7. i18n / RTL
- KPI labels + chart legends bilingual; numbers/currency localised; charts mirror sensibly in RTL (axis order via config).

## 8. MSW → real API
- Mock the six read endpoints to build tiles; retire to real API; keep MSW fixtures (one per `costVisibility`) for tests.

## 9. Tests
- Overview conforms to `operationsOverviewSchema` (MSW) and renders KPIs.
- Fines tile: masked → no amounts; aggregate → total only; full → per-user (three fixtures).
- Scope switch changes `scopeId` on the query.

## 10. Exit gate
- Operations overview + 5 tiles on real backend; scope-switch re-fetch; cost masking honoured exactly as the server sends; charts have a11y fallbacks. Gate green + browser-verified. **This retires the last MSW dashboard mock.**

## 11. Traceability
- FRs: FR-DASH-01..08, P11 (reporting), FR-IAM-03 (cost masking). Backend: M9 (operations overview + tiles).
