# U2 — Vehicle Master & Compliance

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the vehicle registry (M2) and the compliance/eligibility surface (M7), plus the data-migration steward UI (M3). These are the master-data foundations every later loop screen references.

**Entry:** U1 done (lookups seeded — vehicle classification dropdowns resolve from `/lookups`).
**Exit:** fleet staff manage the vehicle master, see compliance status/expiries/blocks, run the eligibility check, and stewards commit validated imports — all on the real backend.

---

## 1. Backend dependencies
- **Vehicles (M2):** `GET /vehicles`, `GET /vehicles/:id`, `GET /vehicles/:id/history`, `POST /vehicles`, `PATCH /vehicles/:id`, `POST /vehicles/:id/transition`, `POST /vehicles/:id/documents`.
- **Compliance (M7):** `POST /eligibility` (`{driverPersonId, vehicleId}` → `{decision, reasons, dataAsOf, policyVersion}`), `GET /compliance/expiries`, `GET /compliance/blocks`, `POST /compliance/blocks` (HSE/Audit/FleetManager/SystemAdmin).
- **Migration (M3):** `POST /imports`, `GET /imports/:id`, `GET /imports/:id/rows`, `POST /imports/:id/resolve`, `POST /imports/:id/sign-off` (steward roles).
- Contracts: `vehicle.contract.ts`, `compliance.contract.ts`, `import.contract.ts`; classification codes validated against `lookup` types (`vehicle-body-type`, `fuel-type`, `use-category`, `make`→`model`).

## 2. Screens & routes
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| Fleet (Vehicle Registry) | `/{lang}/fleet` | B3 | `GET /vehicles?scope` |
| Vehicle detail / inspector | `/{lang}/fleet/:id` | B3 | `GET /vehicles/:id`, `/history`, `/keys`, live telemetry (U6) |
| Add / edit vehicle | `/{lang}/fleet/new`, `…/:id/edit` (modal or page) | B3 | `POST/PATCH /vehicles` |
| Lifecycle transition | (modal) | B3 | `POST /vehicles/:id/transition` |
| Documents vault | (tab in detail) | B3 | `POST /vehicles/:id/documents` |
| Compliance runway | `/{lang}/compliance` | — | `GET /compliance/expiries`, `/blocks` |
| Eligibility check | (inline pattern) | A1 step | `POST /eligibility` |
| Data import (steward) | `/{lang}/data-quality/imports` | H1 | `POST /imports`, rows, resolve, sign-off |

## 3. Components
- **Registry**: `DataTable` (plate, make/model, body type, use category, lifecycle + operational `status-chip`, pool flag, next-maintenance); scope-filtered; Finder search; row → inspector.
- **Vehicle form**: RHF/Zod; classification selects populated from `/lookups` (code-valued, bilingual labels); ownership/lease/compliance field groups; on `bodyType` = BUS/EQUIPMENT show "not bookable" note (server trigger enforces).
- **Lifecycle transition**: guarded action; shows allowed target states; reason capture; history timeline (from `/history`).
- **Compliance runway**: per-vehicle expiry bars (Mulkiya/insurance/licence) with `status-chip` (Valid/ExpiringSoon/Expired); hard-blocked vehicles clearly flagged ("no bookings until renewed"); blocks list; raise/lift block (authorised roles) via `useConfirm`.
- **Eligibility check** (reusable): given driver + vehicle → ALLOW/DENY with reason codes + **"data as of"** freshness; used inline by the booking wizard (U3).
- **Import steward**: upload/create batch → row-level validation table → dedup compare-and-merge (`useConfirm`, destructive) → completeness score → **sign-off** button gated at ≥98%.

## 4. Data & state
- Keys: `['vehicles', scopeId, params]`, `['vehicle', id]`, `['vehicle', id, 'history']`, `['compliance','expiries', scopeId]`, `['compliance','blocks']`, `['imports', id]`.
- Mutations invalidate the registry + detail; transition invalidates history; block raise invalidates blocks + (indirectly) eligibility.

## 5. States
- Registry empty (no vehicles in scope) → empty-state; vehicle 404 → not-found; classification code unknown → the backend 400 reason shown; import < 98% → sign-off disabled with the completeness reason; hard-block clearly non-actionable.

## 6. RBAC & scope
- Registry read: any authenticated in scope; write/transition/documents: FleetManager+ / SystemAdmin. Blocks: HSE/InternalAudit/FleetManager/SystemAdmin. Imports: DataSteward. Everything scope-filtered via the Scope Switcher.

## 7. i18n / RTL
- Lookup-driven labels localise automatically; status chips carry icon+label (colour-never-alone); dates as Asia/Dubai.

## 8. MSW → real API
- Build vehicle/compliance/import handlers, then retire to real API; keep for tests.

## 9. Tests
- Create vehicle with lookup-validated classification (MSW) + invalid code rejected.
- Lifecycle transition guard (illegal target blocked).
- Compliance runway shows Expired → hard-block flag.
- Eligibility DENY surfaces reasons + "data as of".
- Import sign-off disabled below 98%.

## 10. Exit gate
- Registry + detail + create/edit + transition + documents + history; compliance runway + blocks; eligibility check; import steward flow — all real-backend, scope/RBAC-correct, four-states complete. Gate green.

## 11. Traceability
- FRs: FR-INV-01..11 (vehicle master), FR-COMP-01..10 (compliance/eligibility), P7 (migration). Backend: M2, M7, M3.
