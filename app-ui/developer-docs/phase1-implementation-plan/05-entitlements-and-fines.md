# U5 — Governance: Entitlements & Fines

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the governance half of the loop — dedicated-vehicle **entitlements** up to Cluster CEO (M5) and driver-accountability **fines / accidents / substitution / black points** (M8).

**Entry:** U3/U4 done (bookings drive fine attribution; consent pattern reused).
**Exit:** requesters raise dedicated-vehicle entitlements through the Cluster-CEO chain with consent + allocation; fleet staff record fines/accidents with correct auto-attribution and substitution windows — on the real backend.

---

## 1. Backend dependencies
- **Entitlements (M5):** `POST /entitlements`, `POST /entitlements/:id/{submit,approve,decline,consent,allocate,bsd-windows,cancel}`, `GET /entitlements[/:id]`. Contract: `entitlement.contract.ts` (`ENTITLEMENT_REASON`, statuses, request types).
- **Fines (M8):** `POST /fines`, `GET /fines`, `POST /accidents`, `POST /fines/:id/recovery`, `POST /vehicles/:id/substitution-windows`. Contract: `fine.contract.ts` (`AttributionBasis`, statuses, `FINE_REASON`).

## 2. Screens & routes
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| My entitlements | `/{lang}/entitlements` | — | `GET /entitlements` |
| Request entitlement (wizard) | `/{lang}/entitlements/new` | D1 | create → submit → (approve) → consent → allocate |
| Entitlement decision | `/{lang}/entitlements/:id` | D1 | approve/decline (Cluster CEO chain) |
| Fines & accidents register | `/{lang}/fines` | B4 | `GET /fines`, `POST /fines`, `POST /accidents` |
| Record fine (modal) | (modal) | B4 | `POST /fines` (plate/date → auto-matched driver) |
| Recovery / substitution | (tabs/modals) | B4 | `POST /fines/:id/recovery`, `POST /vehicles/:id/substitution-windows` |

## 3. Entitlement flow
- **Request**: request type (LongTerm/Temporary/WithDriver/WithoutDriver), justification category + text, duration, location, business unit, cost centre → `POST /entitlements` (Draft) → `submit` (PDP eligibility pre-check; DENY → reason banner; routes chain up to Cluster CEO).
- **Decision** (approvers, incl. Cluster CEO): approve/decline; **SoD-02** (own request) blocked server-side → surface reason. Show the requestor track record + justification (rich content per D1).
- **Consent + allocate**: driver consent (`POST /consent`, before allocation) then `POST /allocate` (vehicle) — the UI blocks allocate until consent is signed (mirrors backend). BSD windows via `POST /bsd-windows`.

## 4. Fines flow
- **Record fine**: plate/date/amount/authority (+ optional points) → `POST /fines`; the response shows the **auto-attributed driver + `attributionBasis`** (substitution-window / booking-active-driver / assigned-driver / unattributed) for the fleet manager to review (not blindly trust). Money shown with currency, never re-computed.
- **Accidents**: `POST /accidents` register.
- **Recovery**: `POST /fines/:id/recovery` (minimal entry; payroll export is P2).
- **Substitution windows**: `POST /vehicles/:id/substitution-windows` (the minimal admin entry so attribution is correct); black-point overdue → platform-wide block is enforced/scheduled server-side (surface the block in compliance/U2).

## 5. Data & state
- Keys: `['entitlements', scopeId]`, `['entitlement', id]`, `['fines', scopeId, params]`.
- Entitlement decision/consent/allocate invalidate `['entitlement', id]` + list; fine record invalidates `['fines']` (+ may raise a compliance block → invalidate `['compliance','blocks']`).

## 6. States
- Eligibility DENY on submit → reasons; SoD-02 on decision → reason; allocate-without-consent → blocked with `entitlement-consent-required…`; fine unattributed → clear "no driver matched" state; substitution boundary edges handled server-side (UI just displays basis).

## 7. RBAC & scope
- Entitlement request: any employee; decisions: approver roles up to ClusterCEO, scoped. Fines/accidents/substitution/recovery: FleetManager+ (recovery also Finance). Scope-filtered.

## 8. i18n / RTL
- Justification categories from lookups (bilingual); reason codes localised; amounts + currency RTL-safe.

## 9. MSW → real API
- Add entitlement/fine handlers to build, then retire; keep for tests (incl. attribution-basis variants).

## 10. Tests
- Entitlement: submit eligibility DENY reason; SoD-02 on self-approve; allocate blocked without consent; happy allocate.
- Fine: record → attribution basis displayed (substitution vs booking vs assigned).

## 11. Exit gate
- Entitlement create→submit→approve(Cluster-CEO)→consent→allocate + BSD; fines/accidents register with correct attribution basis + recovery + substitution windows — real-backend, RBAC/scope-correct, four-states complete. Gate green + browser-verified.

## 12. Traceability
- FRs: FR-DVR-01..13 (entitlements), FR-FINE-01..12 + FR-SUB-01/02 (fines/substitution), SoD-02. Backend: M5, M8.
