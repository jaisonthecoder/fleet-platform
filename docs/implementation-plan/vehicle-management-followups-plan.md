# Vehicle Management — Follow‑ups Execution Plan (Phase 8)

> Detailed, verifiable plan for four follow‑ups: (A) clean server smoke test,
> (B) finish Phase 6 (server sort/pagination/export), (C) the Live Map page, and
> (D) drawer tab redesign (booking‑style tabs) + modern, on‑theme polish.
> Owner: continues the vehicle-management-execution-plan.md work.

## Ground truth (verified)
- **Tabs primitive exists**: `app-ui/src/components/ui/tabs.tsx` (Radix) — booking uses it: `TabsList` = `flex gap-1 border-b border-border`; active `TabsTrigger` = `-mb-px border-b-2 border-signal text-foreground` (gold underline). This is the "booking page tab" look. The drawer currently uses `Segmented` (pill) — that is what we replace.
- **Tabs is controllable** via `value` + `onValueChange` on `Tabs` (Radix Root).
- **MapLibre** is available and already used in `app-ui/src/features/organization/location-picker.tsx` with a Google raster basemap (`GOOGLE_STYLE`, `VITE_MAP_STYLE_URL` override). Reuse it.
- **No bulk telemetry endpoint** — only `GET /v1/vehicles/:id/telemetry/live` (per vehicle). The Live Map needs a new bulk endpoint.
- **Registry list** returns a plain `Vehicle[]` (client‑filtered). Server `search` + `GET /v1/vehicles/summary` already exist (Phase 6 partial).
- `DataTable` (TanStack) component exists and is used by vendors/identity — reuse for sortable/paged registry.
- Terminal history shows `pnmp`/`npm` typos → real commands are **pnpm**.

---

## Part A — Clean server smoke test (verification only, no code)

**Steps**
1. Free ports: stop any process on the API port (3000) and UI port (3175).
2. Start API (async): `pnpm --filter fleet-platform-api start:api` — confirm boot + `GET /health` (or `/v1/health`) returns ok.
3. Start UI (async): `pnpm --filter app-ui dev` — confirm Vite serves.
4. Smoke routes (browser tools): `/en/vehicles` (list + tiles), open a row → each drawer tab loads, `/en/vehicles/onboard`, `/en/vehicles/import`, `/en/live-map`.
5. Capture console/network errors; note any unhandled 4xx/5xx.

**Exit criteria**: both servers boot, all listed routes render, no console errors. Findings recorded (no doc unless requested).

---

## Part B — Finish Phase 6 (server sort · pagination · export)

### Backend (`app-api`)
- **List envelope + sort + pagination**: extend `GET /v1/vehicles` to accept `page`, `pageSize`, `sort` (`field:dir`, whitelist: `plate|make|model|lifecycle|mulkiyaExpiry|createdAt`), keep `search`. Return `{ items, total, page, pageSize }`.
  - `vehicle.repository.list(...)`: add `orderBy` from a **whitelisted** column map (never raw input) + a sibling `count(*)` query (reuse the same `where`). Add `VehicleListResult` shape in the service.
  - Update `vehicle.controller.list` to parse the new query params and return the envelope.
  - **Update `vehicle.controller.spec.ts`** (asserts exact `list()` args — bump to match new signature).
- **CSV export**: `GET /v1/vehicles/export` (roles = FLEET_WRITE_ROLES) → `text/csv` of the **full scoped set** honoring `search` (no pagination). Columns: plate, VIN, make, model, lifecycle, operational, node, mulkiyaExpiry, insuranceExpiry, odometer. Stream via Fastify reply; escape commas/quotes.

### Frontend (`app-ui`)
- `vehicle.contract.ts`: change `fetchVehicles` → returns `{ items, total, page, pageSize }`; add `sort/page/pageSize` to the query; add `fetchVehiclesCsv()` (blob) hitting `/v1/vehicles/export`.
- `use-vehicles.ts`: `useVehicles(query)` returns the envelope; keep `['vehicles', query]` key (invalidations still match on prefix).
- `vehicle-management-page.tsx`: migrate the raw `Table` → `DataTable` (TanStack) in **manual** sort+pagination mode:
  - Column defs with sortable headers (plate, node, lifecycle, operational, gps, mulkiya, insurance).
  - Server‑driven sort/pagination state → `useVehicles({ search, sort, page, pageSize })`.
  - Pager (Prev/Next + "x–y of total"), page‑size select.
  - **Export** button in the toolbar → downloads CSV blob.
  - Row click still opens the `VehicleDetailDrawer`.
- i18n EN+AR: `vehicleManagement.table.*` (sort labels, pagination, export, page size).
- Tests: update `vehicle-management-page.test.tsx` (list now returns envelope — update the `GET /vehicles` mock to `{ items:[vehicle], total:1, page:1, pageSize:25 }`), add a sort + a pagination assertion, and an export‑button presence test.

**Risk**: envelope change is breaking — update the single `fetchVehicles` caller, the summary already separate, and all vehicle test mocks in one pass. Keep `useVehicleSummary` for tiles.

**Exit**: server sort/pagination/export work; registry uses `DataTable`; FE+BE typecheck + tests green.

---

## Part C — Live Map page

### Backend (`app-api`)
- **Bulk live endpoint**: `GET /v1/telematics/live` → latest telemetry per **scoped** vehicle.
  - `TelematicsRepository.latestPerVehicle(organizationId, authorizedNodeIds, includeUnassigned)`: Postgres `DISTINCT ON (telemetry.vehicle_id) ... ORDER BY vehicle_id, time DESC`, joined to `vehicle` (plate) and active `vehicle_hierarchy_assignment` for scope (mirror `vehicle.repository.list` scope filter). Only vehicles with telemetry.
  - `LiveMapService.getFleetLive(principal)`: scope via `ScopeAuthorizationService` (like the vehicle controller), compute `online` (< 5 min), **audit one bulk `TELEMATICS_LIVE_FLEET_ACCESS`** (D4).
  - DTO `LiveFleetPositionDto[]`: `{ vehicleId, plate, lat, lon, speed, online, at }`.
  - Controller method on `TelematicsController` (place before any `:id` route to avoid capture).

### Frontend (`app-ui`)
- Extract the shared map style/config from `location-picker.tsx` into `app-ui/src/lib/map-style.ts` (`GOOGLE_STYLE`, `MAP_STYLE`, `DEFAULT_CENTER`) and re‑use in both.
- `features/telematics/live-map.contract.ts` + `hooks/use-fleet-live.ts` (`useFleetLive()` polling 30s).
- `features/telematics/live-map-page.tsx`:
  - MapLibre map (full‑height), markers for each **online** vehicle (offline greyed / listed but not plotted or shown faint), popup on click (plate · speed · last seen · "Open vehicle" → navigates to `/vehicles` with the drawer, or a details link).
  - Left/side list of vehicles (online first) with fly‑to on click; online/offline `StatusChip`.
  - Empty state (no telemetry), privacy/masking note, loading + error states.
  - RTL‑safe layout (logical props), on‑theme surfaces.
- Route: replace `ComingSoonPage` for the `live-map` segment in `router.tsx` with `LiveMapPage` (nav already has the segment).
- i18n EN+AR `liveMap.*`.
- Test: mock `GET /v1/telematics/live` → assert the vehicle appears in the side list + marker count (map lib mocked/guarded in jsdom — assert list + online chip rather than canvas).

**Risk**: MapLibre in jsdom — guard map init (it already calls `resize()` in rAF); test asserts the DOM list, not the GL canvas.

**Exit**: `/live-map` shows live scoped vehicles; polls; audited; tests green.

---

## Part D — Drawer tab redesign (booking‑style) + modern polish

### Drawer tabs → booking look
- In `vehicle-detail-drawer.tsx` replace the `Segmented` tab bar with the Radix `Tabs` primitive:
  - `<Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>` wrapping a `TabsList` of `TabsTrigger`s (underlined, gold `data-[state=active]:border-signal`).
  - Make the list horizontally scrollable for 8 tabs: `TabsList className="w-full overflow-x-auto"` (and `flex-nowrap`), keep it sticky under the drawer header.
  - Keep the existing conditional `{tab === '…' && …}` bodies (minimal churn) **or** move each into `TabsContent` (cleaner; preferred if low‑risk). Data hooks stay gated by the active tab.
  - Remove the now‑unused `Segmented` import.
- Verify keyboard/RTL (Radix handles arrow‑key + `dir`).

### Modern, on‑theme polish (registry + drawer)
- Registry: tighten the `PageHeader`, metric tiles (consistent `StatCard`/tokens: brand/signal/success), toolbar (search + export + page size) as one aligned bar; `DataTable` styling aligned to tokens; empty/loading states.
- Drawer: header already uses the shared `Drawer` (eyebrow · title · status chip). Ensure tab bar spacing, section cards, and metric tiles use consistent radius/border/tokens; verify the Telematics/Activity metric tiles and Device/Assignment/Documents section cards share one visual rhythm.
- Keep everything token‑driven (no hard‑coded colors); RTL logical spacing.

### Tests / verification
- Update any drawer test that selected tabs by `role="tab"` name — Radix `TabsTrigger` still exposes `role="tab"`, so existing `getByRole('tab', { name })` assertions keep working (validate).
- i18n unchanged (tab labels already keyed).

**Exit**: drawer tabs match the booking underline style, the registry + drawer look modern and on‑theme, all tests green.

---

## Global sequencing & gates
1. **A** smoke test (baseline) →
2. **D** tab redesign + polish (fast visual win, low risk) →
3. **C** Live Map (new BE endpoint + page) →
4. **B** finish Phase 6 (biggest blast radius — envelope change + DataTable migration, do last with full test sweep).

Each part: EN+AR i18n, `pnpm typecheck` (both), targeted vitest, then a final full FE suite + BE unit specs. Update this plan's Status and repo memory at the end.

## Status — ALL DONE
- [x] A — smoke test: API rebuilt + running on :3003 (new build); every new route mapped and returning 200 with real seeded data; routes render + RBAC gates correctly (the dev browser user is a SystemAdmin without fleet roles, so /vehicles + /live-map show Access-restricted — switch to a FleetManager to view).
- [x] D — drawer tabs swapped from `Segmented` to Radix `Tabs`/`TabsList`/`TabsTrigger` (underlined gold-active, horizontally scrollable); registry toolbar modernised (search + export + pager).
- [x] C — Live Map: bulk `GET /v1/telematics/live` (DISTINCT ON latest per scoped vehicle, audited) + `LiveMapPage` at `/live-map` (MapLibre, shared `lib/map-style.ts`, side list + fly-to, 30s poll). Test passes (MapLibre mocked for jsdom).
- [x] B — server sort (`sort=field:dir`, whitelisted) + pagination envelope `{items,total,page,pageSize}` + `GET /v1/vehicles/export` CSV; FE table gained sortable headers, pager, Export button; `vehicle.controller.spec` updated.
- [x] Real seed: `scripts/seed-demo-telematics.mjs` (+ `pnpm db:seed-demo-telematics`) inserts devices+pairings, recent telemetry, trips, documents and alerts for every vehicle — features are backed by real, editable data.

**Gates:** FE typecheck + 133 tests + lint(0 errors); BE typecheck + 25 unit specs + lint(0 errors); guard:contracts (manifest updated for `LiveFleetPositionDto`); guard:org (telematics-domain scope files allowlisted).
