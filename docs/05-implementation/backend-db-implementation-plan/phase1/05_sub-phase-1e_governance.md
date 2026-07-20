# Sub-Phase 1E — Governance (Block E)

**The governance half of the loop:** structured dedicated-vehicle entitlements up to Cluster CEO, and driver accountability for fines / black points / accidents with correct auto-attribution (including the substitution model that must ship in Phase 1 even though its self-service UI is Phase 2).

- **Entry dep:** 1D (bookings/consent, compliance, handover), 1A (workflow chains, PDP rules).
- **Unlocks:** 1F (dashboards: entitlement inventory, fines-per-user).
- **Migrations:** `0011_entitlement`, `0012_fines`.

---

## M5 — `entitlements`

### DB (`0011_entitlement`)
- **`entitlement_request`** — request type, requestor, justification, target vehicle/category, status, approval chain state, driver-consent pointer, policy version.
- **`bsd_return_window`** — Business-Suspension-of-Duty / leave windows during which a dedicated vehicle must be returned, sourced from the HCM calendar.

### Module — `entitlements/`
- **Request types** + **eligibility pre-check** (PDP `dedicated-vehicle-eligibility`, **D8**).
- **Justification** capture (required).
- **Approval chain to Cluster CEO** — PDP `entitlement-approval-chain` resolved through the **workflow engine** (1A): multi-step, one-hop delegation, 48 h SLA escalation.
- **Driver consent before allocation** — same non-negotiable consent gate as bookings (no consent ⇒ no allocation).
- **BSD leave return** — from the HCM calendar; **auto-revert** the vehicle when a return window opens.
- **Utilisation / justification report** — supports periodic review of dedicated allocations.

### PDP
`dedicated-vehicle-eligibility` (D8), `entitlement-approval-chain`.

### Events
`EntitlementRequested`, `EntitlementDecided`, `EntitlementAllocated`, `BsdReturnDue`.

### Endpoints
`POST /entitlements`, `POST /entitlements/:id/submit`, approval **via workflow**, `GET /entitlements/:id`, `POST /entitlements/:id/bsd-windows`.

### SoD
**SoD-02** — no one approves an entitlement they raised (executable test); chain enforces senior-approver separation up to Cluster CEO.

---

## M8 — `fines` (+ substitution model)

### DB (`0012_fines`)
- **`fine`** — `booking_id` **nullable**, `attributed_person_id`, **`attribution_basis`** (how the driver was determined), amount (`numeric(14,2)`+currency), authority, status.
- **`black_point`** — points, transfer deadline, transfer status.
- **`accident`** — accidents register.
- **`recovery_record`** — minimal recovery instruction record (payroll **export** is D13 / Phase 2 — Phase 1 records only).
- **`substitution_window`** — **substitution attribution model live in Phase 1** (UI is Phase 2): vehicle, substitute driver, window start/end, reason. Ships now so a month-one fine is never pinned to the wrong driver (FR-SUB-01/02).

### Module — `fines/`
- **Auto-attribution** — attribute to the **booking-active driver**; else the **assigned driver**; **honouring substitution windows** (a fine whose event time falls in an active window attributes to the substitute).
- **Fines-per-user + HR alert** — **≥ 3 fines / 12 months** raises an HR alert (PDP `fines-hr-threshold`, **D12**).
- **Accidents register.**
- **Black-point transfer** — deadline tracked; **overdue ⇒ platform-wide `access_block`** (PDP `black-point-timeframe`, **D14**) — the driver is blocked from booking/using/accessing any vehicle service until resolved.
- **Recovery record** — minimal entry; export deferred to Phase 2 (D13).
- **Minimal admin/API entry for substitution windows (P1B-R2-4)** — so the model is reachable without the Phase-2 UI.

### Attribution boundary rule (P1B-R2-7)
- Define **inclusive/exclusive** boundaries for a fine at the exact edge of a substitution window; define precedence for **overlapping** windows; tests for overlap, boundary, and **no-active-booking** (falls back to assigned driver).

### PDP
`fines-hr-threshold` (D12), `black-point-timeframe` (D14).

### Events
`FineRecorded`, `FineAttributed`, `BlackPointRecorded`, `AccessBlockRaised`, `RecoveryRecorded`.

### Endpoints
`POST /fines`, `POST /accidents`, `GET /fines`, `POST /fines/:id/recovery`, `POST /vehicles/:id/substitution-windows`.

---

## Tests (Block E)

- **Entitlement runs the Cluster-CEO chain** end-to-end; SoD-02 proven; 48 h escalation fires; driver consent before allocation.
- **BSD return** auto-revert when a window opens.
- **Fine in a substitution window attributes to the substitute**; boundary + overlapping-window + no-active-booking edges tested (P1B-R2-7).
- **≥3/12 mo** raises an HR alert.
- **Overdue black-point blocks the driver platform-wide** (`access_block`), verified against the compliance gate and booking path.

## Exit gate (Block E)

- Entitlement runs the Cluster-CEO chain.
- A fine in a substitution window attributes to the substitute (with boundary/overlap correctness).
- Overdue black-point blocks the driver platform-wide.

## Traceability

- **FRs:** FR-ENT-01..08 (entitlements, BSD, Cluster-CEO chain), FR-FINE-01..12 (fines/black points/accidents/recovery), FR-SUB-01/02 (substitution attribution).
- **Critique resolved:** P1B-R2-4 (substitution reachable) ✅; P1B-R2-7 (attribution edges) ✅; SoD-02 ✅.
- **Gate items advanced:** "fine auto-attribution incl. substitution + boundary/overlap"; entitlement chain; SoD-02..08.
- **Migration catalog:** `0011_entitlement`, `0012_fines`.
- **D-list:** **D8** (dedicated eligibility), **D12** (fines HR threshold), **D14** (black-point timeframe) fixture-gated; **D13** (payroll export) → Phase 2.

**Next:** [Sub-Phase 1F — Read Models](06_sub-phase-1f_read-models.md).
