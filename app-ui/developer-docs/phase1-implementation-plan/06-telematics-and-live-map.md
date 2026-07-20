# U6 — Telematics & Live Map

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the telematics domain UI (M10) — live vehicle map, device registry/pairing, trips, and alerts. Can run in **parallel after U2**.

**Entry:** U2 done (vehicles exist to pair/track).
**Exit:** the fleet command console shows live positions with freshness, device pairing is manageable, trips and alerts are visible — on the real backend, with **MapLibre GL + Azure Maps** (never Google — UAE residency + billing).

---

## 1. Backend dependencies (M10)
- `GET /vehicles/:id/telemetry/live` — latest position/status + freshness ("is it online?").
- `GET /devices`, `POST /devices`, `POST /devices/pair`, `POST /devices/:id/unpair`.
- `GET /telematics/alerts`, `POST /telematics/alerts`.
- `GET /trips`, `GET /trips/:id` (if exposed) — derived trips with booking attribution.
- Contract: `telematics.contract.ts`. Privacy: access to location/trip data is audited server-side (D4/PDPL); off-shift masking is applied server-side — the UI just renders what it receives.

## 2. Screens & routes
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| Fleet command console (live map) | `/{lang}/console` | — | live telemetry per vehicle + alerts |
| Device registry & pairing | `/{lang}/admin/devices` or `/{lang}/fleet/devices` | — | `GET/POST /devices`, pair/unpair |
| Vehicle live panel | (tab in vehicle detail) | B3 | `GET /vehicles/:id/telemetry/live` |
| Telematics alerts | `/{lang}/console#alerts` | — | `GET /telematics/alerts` |

## 3. Components
- **Live map**: `maplibre-gl` map (Azure Maps tiles/style via env key) with vehicle markers coloured by status + **freshness** (online/stale); marker popup → vehicle + last-seen; scope-filtered. Poll `telemetry/live` on an interval (or SSE later); show "data as of".
- **Device registry**: `DataTable` of devices (identifier, model, firmware, status, health); pair (`POST /devices/pair`, device↔vehicle) / unpair with `useConfirm`; overlap prevented server-side (surface `exclusion-violation` reason).
- **Alerts**: list of unplug/tamper/silent alerts with `status-chip`; acknowledge action if exposed.
- **a11y map fallback**: the map has an sr-only / table fallback listing vehicles + positions (colour-never-alone; keyboard-reachable).

## 4. Data & state
- Keys: `['telemetry','live', scopeId]` (polled, short `staleTime`), `['devices']`, `['telematics','alerts', scopeId]`.
- Pair/unpair invalidate `['devices']`; alerts poll.

## 5. States
- No devices/coverage → empty-state; map key missing → graceful "map unavailable, list view" fallback; stale telemetry → explicit "last seen …" chip; pairing overlap → conflict reason.

## 6. RBAC & scope
- Console/live map: FleetManager+ / operations roles, scoped. Device write: FleetManager+ / SystemAdmin. Location reads are audited server-side.

## 7. i18n / RTL
- Map controls + alert strings bilingual; RTL: keep the map LTR internally but mirror surrounding chrome; timestamps Asia/Dubai.

## 8. MSW → real API
- Mock telemetry/devices/alerts to build; retire to real API; keep MSW (with a deterministic position fixture) for tests. Use the simulator-backed backend for realistic live data.

## 9. Tests
- Live map renders markers + freshness from fixture; stale → "last seen" chip.
- Pair/unpair happy path + overlap conflict.
- Map-unavailable → table fallback.

## 10. Exit gate
- Live map (MapLibre + Azure Maps) with freshness, device pairing, alerts — real-backend, scope/RBAC-correct, a11y fallback present. Gate green + browser-verified against the simulator.

## 11. Traceability
- FRs: FR-TEL-01..12 (device/live map/trip/alerts/privacy). Backend: M10. Constraint: MapLibre GL + Azure Maps (not Google).
