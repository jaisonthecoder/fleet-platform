# Phase 2 — Scale & Automate (Backend + DB)

**Goal:** roll out group-wide and automate what Phase 1 did manually — including the first real hardware telemetry sources — **without re-architecting**. New rule types register on the same PDP engine; a fourth deployable (`ocr-worker`) appears. **Governing doc:** `04_Phase2_Scale_Automate_ADPorts.md`.

**Precondition:** Phase 1 production-readiness gate green; Phase 1 KPIs met at GS Pool. **Exit:** §7 production-readiness gate green.

---

## 1. Workstream slices (backend + DB)

### W1 — Group-wide rollout (backend enablers)
- **DB:** none new; per-cluster/pool policy rows (scoped overrides) + hierarchy nodes via config.
- **Backend:** harden the **PAP** (authoring, review, diff, effective-dating) so multi-cluster config is safe (P2-R1-2); per-cluster onboarding uses M3 tooling.
- **Exit:** two additional clusters onboarded with their own scoped policy rows; no code change.

### W2 — Advanced telematics + real hardware sources
- **Backend:** implement `AggregatorSource` / `DirectVendorSource` as new `TelemetrySource` implementations — **domain module untouched**. Add route-replay reads (over Phase-1 raw trips), geofence corridors + deviation alerts (D21), harsh-driving signals.
- **DB:** `geofence_corridor`, `route_deviation_event`; extend `telematics_alert` types; keep `telemetry` hypertable (retention set in Phase 1 for retroactive replay).
- **New rule types:** geofence tolerance (if policy-driven).
- **Exit:** production swap simulator→real source with **contract/conformance tests against real vendor payload samples** (P2-R1-1); domain module diff = 0.

### W3 — Mobile + offline field capture
- **Backend:** sync API for offline handover/return; conflict model (fleet-manager review queue); push + SMS via notifications.
- **DB:** `offline_sync_record`, conflict queue fields on `handover`.
- **Exit:** field-pilot; merge/conflict tests (P2-R2-3).

### W4 — Mobile damage capture
- **Backend:** photo upload pipeline (Blob), annotations; builds on `damage_pin` (already normalized in Phase 1).
- **Exit:** handover/return photo sets stored, comparable.

### W5 — Fuel automation (OCR) — new `ocr-worker` deployable
- **Backend:** `ocr-worker` (rides in ingest in P1 volume; own container app at P2 volume) — async submit-and-poll to Azure AI Document Intelligence; **never awaited in a request handler**. Confirm-until-≥95% flow.
- **DB:** `fuel_transaction`, `fuel_card`, `ocr_proposal` (confidence, confirmed_by), extend `vehicle` cost fields.
- **Events:** DocumentParsed. **Exit:** labeled invoice **eval set + accuracy job + owner** defined; ≥95% before manual confirm removed (P2-R1-5).

### W6 — Toll management
- **DB:** `toll_account`, `toll_transaction` (attribution basis).
- **Backend:** Salik/Darb ingestion (statement fallback); auto-attribution honouring **substitution windows** (sequence W7 before/with W6 — P2-R1-4); recharge policy → recovery.
- **New rule types:** toll-recharge-policy (D19). **Exit:** toll auto-attribution ≥90%.

### W7 — Replacement & substitute self-service
- **Backend:** UI-facing endpoints over the Phase-1 attribution model; replacement preserving booking number; substitute authorisation + auto-revert on expiry.
- **DB:** `replacement_link` (extends substitution model). **Exit:** self-service flows + auto-revert tested.

### W8 — Vendor & lease management
- **DB:** `vendor`, `lease_contract`, `off_hire`, `vendor_scorecard` (computed).
- **Backend:** vendor master, lease pipeline (90/60/30 renewal alerts), off-hire workflow + penalty computation, scorecards from platform data, contract-vs-invoice flags.
- **Exit:** lease-expiry alerts fire; scorecards computed from operational data; non-AED currency handling decided (P2-R2-6).

### W9 — Behaviour scoring
- **DB:** `behaviour_score`, `behaviour_event` (from Phase-1 `booking_event`).
- **Backend:** score from captured events; **self-visible + HR gate** as explicit deliverables (surveillance risk R10/P2-R2-1).
- **New rule types:** behaviour-weights/thresholds/window (D11). **Exit:** rubric transparency + self-view + HR-gate workflow shipped.

### W10 — Recovery automation + break-glass + recurring + public API (unbundle!)
- **Recovery/payroll:** payroll integration (I13) executing approved recovery instructions — **gated on D13** (legal). Ship independently of the rest (P2-R1-3).
- **Break-glass:** emergency categories (D17), consent still mandatory, mandatory post-hoc review.
- **Recurring bookings:** series on M4.
- **Public API v1:** versioned REST + signed webhooks — **needs an API security design first** (P2-R2-2).
- **New rule types:** break-glass-categories (D17). **DB:** `recovery_instruction`, `api_client`, `webhook_subscription`.

---

## 2. New PDP rule types (registered on the same engine — no re-architecture)
toll-recharge-policy (D19) · behaviour-weights (D11) · break-glass-categories (D17) · maintenance-due thresholds · professional-driver eligibility composition (D16). Each ships as a decision table with input schema + reason codes + safe default (Phase-1 §4.6 pattern).

## 3. New deployable
`ocr-worker` — BullMQ sandboxed processor; async Document Intelligence; own container app at volume. dependency-cruiser rule: ocr-worker ⇏ request-path modules.

---

## 4. Critique & gap analysis — Round 1 (rollout, automation, ordering)

| # | Gap | Sev | Resolution |
|---|---|---|---|
| P2B-R1-1 | Canonical schema unproven vs real hardware (vendor quirks, clock skew, new DTCs) | H | Contract-test canonical schema against **real vendor payload samples**; per-vendor conformance suite before prod swap |
| P2B-R1-2 | PAP too minimal for per-cluster authoring at scale | M | Harden PAP (authoring/review/diff/effective-dating) as a W1 prerequisite |
| P2B-R1-3 | W10 bundles unlike work; payroll (D13) legally gated can sink the bundle | M | Unbundle W10; gate only payroll on D13; ship rest independently |
| P2B-R1-4 | W6 toll attribution "honours substitution windows" but self-service is W7 | M | Sequence W7 before/with W6, or fall back to Phase-1 manual substitution |
| P2B-R1-5 | OCR ≥95% has no labeled eval set / owner | M | Define labeled invoice eval set + accuracy job + owner before auto-ingest |
| P2B-R1-6 | Replay needs Phase-1 retention set long enough | M | Confirm Phase-1 telemetry retention covers Phase-2 replay window (a Phase-1 decision) |

## 5. Critique & gap analysis — Round 2 (trust, security, scale)

| # | Gap | Sev | Resolution |
|---|---|---|---|
| P2B-R2-1 | Behaviour scoring surveillance risk (R10) | H | Ship rubric transparency + self-view + HR-gate as explicit W9 deliverables; HR/Legal consult |
| P2B-R2-2 | Public API v1 has no security design (authN/Z, versioning, rate-limit, abuse, signed webhooks) | H | API security design (OWASP API Top 10, scoped tokens, quotas, HMAC webhooks) before exposure |
| P2B-R2-3 | Offline sync conflict resolution is genuinely hard | M | Define conflict model (fleet-manager review queue); field pilot; merge tests |
| P2B-R2-4 | Geofence D21 owner/tolerance undefined | M | Close D21 before building geofence authoring |
| P2B-R2-5 | Full-rollout load unproven (2,000 bookings/day + 5,000 real devices) | M | Re-run and **re-baseline the load test** at full-rollout volume before W1 go-live |
| P2B-R2-6 | Non-AED currency in vendor/lease before multi-currency (Phase 3) | L | Decide contract-currency handling (store+convert) or constrain to AED |
| P2B-R2-7 | OCR/ingest CPU leaking into `api` | H | ocr-worker in its own process; dependency-cruiser + event-loop-lag alert |
| P2B-R2-8 | Payroll recovery legally challenged (R11) | H | Legal sign-off (D13) before enabling; consent text covers it; waiver path with audit |

## 6. Validation & verification
- Per-vendor telemetry conformance suite (real payload samples) green; domain-module diff = 0 on source swap.
- OCR accuracy job ≥95% on the labeled eval set before manual-confirm removed.
- Toll auto-attribution ≥90% incl. substitution windows.
- Public API: OWASP API Top-10 review + signed-webhook + rate-limit tests.
- Behaviour: self-view + HR-gate workflow tests; rubric documented.
- **Re-baselined load test** at full-rollout volume passes the Phase-0 thresholds.

## 7. ✅ Production-readiness gate — Phase 2 (all must pass)
- [ ] Real telematics source swapped in production with **zero domain-module change**; per-vendor conformance green.
- [ ] `ocr-worker` isolated; OCR ≥95% on eval set; low-confidence fields human-confirmed; corrections logged.
- [ ] Toll auto-attribution ≥90%; recharge → recovery; substitution windows honoured.
- [ ] Vendor/lease: renewal alerts (90/60/30) fire; scorecards from platform data; currency handling decided.
- [ ] Behaviour scoring: transparent rubric + employee self-view + mandatory HR gate shipped; HR/Legal signed.
- [ ] Payroll recovery **only if D13 signed**; break-glass 100% post-hoc review; recurring bookings tested.
- [ ] Public API v1 security design implemented (scoped tokens, quotas, HMAC webhooks, versioning) + pen-tested.
- [ ] PDPL privacy-by-design review **before W2 go-live**; geofence D21 closed.
- [ ] **Re-baselined load test** at group-wide volume passes.
- [ ] New rule types pass decision-table tests; engine **not re-architected**.
- [ ] Round 1 & Round 2 findings each **closed or accepted-with-dated-risk**.

**Next:** [Phase 3 — Intelligence & International](03_phase3-intelligence-international.md).
