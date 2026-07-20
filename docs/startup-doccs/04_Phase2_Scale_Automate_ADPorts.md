# AD Ports Group — Fleet Management Platform
# Phase 2 Scope — Scale & Automate

**Version 3.1-P2 (Outline) · Precondition: Phase 1 KPIs met at GS Pool pilot**

## Goal

Roll the proven Phase 1 loop out group-wide across UAE entities, and automate the manual steps (fuel entry, fines, tracking, notifications).

## Scope — 10 workstreams

| # | Workstream | What ships | Builds on (P1) |
|---|---|---|---|
| W1 | Group-wide rollout | Onboard remaining clusters/pools using M3 migration tooling; per-cluster policy configuration; entity champions | M1–M3 |
| W2 | Advanced telematics + real hardware sources | **Core GPS shipped in Phase 1 as a pluggable module with a `SimulatorSource` (M10).** Phase 2 (a) swaps in **real hardware sources** — `AggregatorSource` (flespi/equiv.) and/or `DirectVendorSource` — which are just new `TelemetrySource` implementations behind the same contract, so the domain module is untouched; and (b) adds the advanced layer: full route-replay player with scrubber (works retroactively on Phase 1 trip data), geofence corridor authoring + deviation alerts (D21), harsh-driving signals feeding W9, hardwired-TCU rollout for buses/high-value vehicles, optional video telematics evaluation | M10 |
| W3 | Mobile app (iOS + Android) | Booking + consent + handover/return on mobile; **offline field capture with sync** for ports/yards; push + SMS for critical alerts | M4, M6 |
| W4 | Mobile damage capture | Photos, annotations, timestamps, digital acknowledgment at handover/return | M6 |
| W5 | Fuel automation | OCR/NLP ingestion of consolidated supplier invoices (fleet-manager confirm until ≥95% accuracy); Oracle Fusion AP path where per-vehicle breakdown exists; fuel card master + misuse flags (volume > tank, card/vehicle mismatch) | M2 cost fields |
| W6 | Toll management | Salik/Darb ingestion where APIs available (statement import fallback); auto-attribution to booking/driver honouring substitution windows; recharge policy (D19) feeding recovery | M8 attribution model |
| W7 | Replacement & substitute workflows | Self-service UI on the P1 attribution model: replacement vehicle assignment preserving booking number; substitute driver authorisation with line-manager approval, auto-revert on expiry | FR-SUB-01/02 |
| W8 | Vendor & lease management | Vendor master + lease contract records, off-hire workflow with penalty computation, renewal pipeline (90/60/30), vendor scorecards from platform data, contract-vs-invoice discrepancy flags | M2 commercial fields |
| W9 | Behaviour scoring | Score per employee from P1-captured events (no-shows, late/early returns, overbooking); employee sees own score; HR review mandatory before action; escalation via HR disciplinary integration | FR-BOOK-12 events |
| W10 | Recovery automation + break-glass | Payroll integration executing approved recovery instructions (D13); emergency break-glass booking (categories per D17, consent still mandatory, 100% post-hoc review); recurring booking series | M8 recovery records |

## New integrations

GPS/telematics vendor APIs · Salik/Darb · Oracle Fusion AP · Azure AI Document Intelligence (OCR) · Mobile push + SMS gateway · HR disciplinary workflow · Payroll (recovery instructions).

## Key requirements added (summary level — detail at Phase 2 design)

- **Policy engine rule types registered in Phase 2** (on the P1 engine — FR-POL-09, no re-architecture): toll recharge policy (D19), behaviour score weights/thresholds/window (D11), break-glass emergency categories and review SLA (D17), maintenance-due thresholds per category, professional-driver eligibility composition (D16). Each ships as a decision table with input schema, reason codes and safe default, following the P1 §4.6 pattern.

- Maintenance scheduling automation: km/date-based due computation, downtime metrics (days off-road, repeat failures, vendor turnaround).
- Notification upgrades: channel preferences with policy floors (compliance alerts unmutable), digests, push/SMS for critical.
- Odometer conflict rule: telematics is system of record; manual retained; mismatch flags to fleet manager.
- Telematics resilience: gap detection and backfill; vendor outage never blocks booking/handover.
- Privacy gate: PDPL privacy-by-design review, purpose-bound replay access, retention for location data (D4) — **before** W2 go-live.

## Phase 2 KPIs (added to P1 set)

| KPI | Target |
|---|---|
| Group-wide booking adoption | ≥ 90% every entity |
| Fuel invoices auto-ingested (OCR or AP) | ≥ 80% of volume |
| OCR line accuracy | ≥ 95% before manual confirm removed |
| Toll auto-attribution | ≥ 90% |
| Recovery within 90 days (recovered or waived) | ≥ 80% |
| Lease expiries actioned before expiry | 100% |
| Break-glass post-hoc reviews completed | 100% |

## Blocking decisions for Phase 2

D1 (tracker fields — lessor vs D&T) · D2 (OCR service) · D4 (location-data residency/retention) · D11 (behaviour rubric) · D16 (professional-driver liability) · D17 (break-glass categories) · D18 (smart key cabinets — which sites) · D19 (toll recharge policy).

## Top risks

| Risk | Mitigation |
|---|---|
| Telematics APIs unavailable on leased vehicles (High) | Negotiate API access into lease renewals (W8 gives leverage); manual odometer fallback |
| OCR below accuracy threshold | Hybrid confirm mode until KPI met |
| Behaviour scoring perceived as surveillance | Transparent rubric, self-visibility, HR gate |
| Salik/Darb API access delays | Statement import fallback ships first |
| Offline sync conflicts | Conflict queue to fleet manager; field pilot before rollout |
