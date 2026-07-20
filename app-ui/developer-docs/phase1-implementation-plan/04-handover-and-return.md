# U4 — Handover & Return

> **Phase-exit critique gate (mandatory).** When this phase's build is complete, run **two rounds of rigorous critique + gap analysis** *before* starting the next phase:
> - **Round 1 — completeness & integration:** every listed screen + endpoint wired to the real backend; UI contracts match `app-api/src/contracts/`; loading/empty/error/denied states present; MSW retired for shipped screens; nav/routes/RBAC correct.
> - **Round 2 — correctness, security & UX:** RBAC + scope filtering right; consent/SoD/cost-mask rules mirrored (never bypassed); edge/concurrency/error + reason-code handling; keyboard + screen-reader a11y (axe); EN/AR + RTL; money/time formatting.
>
> Fix every finding (or record accept-with-dated-risk), then re-run the full UI gate — `tsc` · `oxlint` · `vitest` · `vite build` + in-browser vs the running backend. **A green gate + closed findings is what unlocks the next phase.**

**Goal:** the fleet-manager handover/return loop (M6). A `handover` mock page + the reusable `DamageMarker` / `SignaturePad` / `CameraCapture` components already exist; this phase **wires them to the real backend** and completes reconciliation.

**Entry:** U3 done (an Approved booking exists to hand over).
**Exit:** a fleet manager opens a handover (moving the booking to Active), records the return with fuel/odometer reconciliation, damage, and keys (completing the booking) — on the real backend.

---

## 1. Backend dependencies (M6)
- `POST /handovers` — open (verifies booking Approved + employee == booking driver; moves booking → Active).
- `POST /handovers/:id/return` — reconciliation (fuel deviation advisory; odometer-conflict vs telematics; late-return flag; moves booking → Completed).
- `POST /handovers/:id/damage` — add a damage pin.
- `GET /handovers/:id`, `GET /vehicles/:id/keys`.
- Contract: `handover.contract.ts` (phases, damage pin x/y, key custody, `HANDOVER_REASON`).

## 2. Screens & routes
| Screen | Route | Page-spec | Consumes |
|---|---|---|---|
| Handover queue | `/{lang}/handover` | B1 | `GET /bookings?status=approved&pool` |
| Vehicle handover | `/{lang}/handover/:bookingId` | B2 | `POST /handovers` (+ existing damage) |
| Vehicle return | `/{lang}/return/:handoverId` | B2 | `POST /handovers/:id/return` |
| Key custody | (tab in vehicle detail) | — | `GET /vehicles/:id/keys` |

> The existing consolidated `/handover` page (Handover/Return toggle) can stay, but should adopt the roadmap's booking-scoped routes for deep-linking.

## 3. Handover capture (reuse existing components)
- **Open handover**: verify booking + employee (server enforces `employee == driver`; surface `handover-employee-mismatch`); capture start odometer, fuel eighths (slider), GPS status, key issue ref, walkaround checklist (pass/fail), **existing** damage pins (`DamageMarker`, state `existing`), signature (`SignaturePad`), photos (`CameraCapture`). Submit → booking becomes Active.
- **Return**: end odometer + fuel; new damage pins (state `new`); optional observed litres; return condition; key return. Backend computes **fuel-deviation flag** (advisory — show as a non-blocking chip) and **odometer conflict** (telematics is system of record — show "telematics N km vs manual M km, telematics retained" data-quality flag). Late return flagged. Submit → booking Completed.

## 4. Data & state
- Keys: `['handover-queue', scopeId]`, `['handover', id]`, `['vehicle', id, 'keys']`.
- Open/return mutations invalidate the queue, the handover, the booking (`['booking', bookingId]`), and keys.

## 5. States
- Queue empty → empty-state; employee mismatch → forbidden reason banner; return before start-odometer → validation error; already-returned → conflict; offline capture flag (P2) shown but sync is P2.

## 6. RBAC & scope
- Handover/return/damage: FleetManager / ClusterFleetLead / GroupFleetLead / SystemAdmin, scoped to the pool.

## 7. i18n / RTL
- Checklist + condition strings bilingual; damage regions labelled; signature "type" mode supports Arabic names; RTL-safe layout of the two-column capture view.

## 8. MSW → real API
- Replace handover mock handlers with real calls; keep MSW for the capture-component tests.

## 9. Tests
- Open handover moves booking to Active (MSW asserts the booking status flip).
- Employee-mismatch blocked with reason.
- Return reconciliation: fuel-deviation chip + odometer-conflict flag rendered; booking Completed.
- Damage pin add persists with photo pointer.

## 10. Exit gate
- Queue → open (→Active) → return (reconciliation, →Completed) → keys, on the real backend; DamageMarker/SignaturePad/CameraCapture reused; advisory fuel + odometer-conflict shown correctly (telematics never overwritten). Gate green + browser-verified.

## 11. Traceability
- FRs: FR-HAND-01..11 (handover/return/damage/odometer-conflict/late-return). Backend: M6.
