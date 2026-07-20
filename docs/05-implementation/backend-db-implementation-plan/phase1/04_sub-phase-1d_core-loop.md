# Sub-Phase 1D — Core Loop (Block D)

**The accountability loop itself:** the eligibility gate, self-service booking with mandatory digital consent, and handover/return with damage capture. Order inside the block is deliberate — **compliance (the gate) is built before booking**, because a booking cannot exist without the single "can this driver take this vehicle now?" truth.

- **Entry dep:** 1A (PDP rules, workflow, notifications, HCM sync), 1B (vehicles), 1C (auto-odometer / trip context; trip-attach now integrates for real — closes P1B-R1-1).
- **Unlocks:** 1E (governance), 1F (dashboards).
- **Migrations:** `0008_compliance`, `0009_booking`, `0010_handover`.

---

## M7 — `compliance` (built first — the gate)

### DB (`0008_compliance`)
- **`compliance_item`** — per-vehicle/per-driver compliance obligation (Mulkiya, insurance, licence, black-point): status, expiry, **`next_alert_at`**; **partial indexes** on expiries *where not-expired* (hot path).
- **`eligibility_evaluation`** — **append-only** record of every eligibility check (who/what/when/verdict/reasons/policy version) — the audit trail for "why was this allowed/denied".
- **`access_block`** — platform-wide blocks (e.g. overdue black-point transfer) that stop a driver from booking/using/accessing any vehicle service.

### Module — `compliance/`
- **`EligibilityService`** — the **single source of truth** for "can this driver take this vehicle now?" (FR-COMP-10). Composes: licence validity, `access_block`, vehicle document validity, driver-eligibility-gate PDP. Surfaces **"data as of"** (HCM freshness) at the gate; **fail direction = block + escalate** on stale/failed data (P1B-R2-2).
- **`ComplianceEngine`** — scheduled expiry **ladders** via `scheduled_work` (alert offsets from PDP `compliance-alert-ladders`); emits `ComplianceExpiryApproaching` → notification dispatcher (unmutable).
- **Hard block (no override)** — expired **Mulkiya/insurance** structurally blocks booking; there is **no override path** (PDP `hard-block-conditions`). Overdue black-point transfer ⇒ `access_block` platform-wide.

### PDP
`compliance-alert-ladders`, `hard-block-conditions`, `driver-eligibility-gate`.

### Endpoints
`GET /eligibility` (+ "data as of"), `GET /compliance/expiries`, `GET /compliance/blocks`.

---

## M4 — `bookings`

### DB (`0009_booking`)
- **`booking`** — persisted **`reservation_start`/`reservation_end`** (PDP-expanded with buffers) + **policy version in force**; **`btree_gist` exclusion constraint** on `(vehicle_id, reservation range)` for **active statuses** — makes double-booking structurally impossible.
- **`waitlist_entry`** — waitlist when no vehicle available.
- **`booking_event`** — **append-only** booking state transitions.
- **`consent_record`** — **insert-only** pointer to the immutable WORM consent blob; binds driver + vehicle category + window + **policy version**; stored with employee ID, timestamp, IP, device.
- **`consent_lifecycle_event`** — consent signed / voided (on decline) / re-consent (on material change).

### Module — `bookings/`
The flow is **search → select → consent → submit**:
- **Search / availability** — `GET /vehicles/available` computes availability from the **same persisted reservation range** the commit uses (no separate availability logic — closes P1B-R2-1).
- **Consent (non-negotiable)** — captured **after vehicle selection and before submission**. **No consent ⇒ no booking number ⇒ no allocation, ever.** The **unique booking number is issued only after the consent row commits.**
- **Consent atomicity (P1B-R2-3)** — consent pointer + booking row + audit entry + outbox event are written in **one Postgres transaction**; the number is issued only after that commit. No path issues a number without committed consent, and none commits consent without a booking.
- **Rules via PDP** — buffer (`booking-buffer`), duration (`max-booking-duration`), eligibility (`driver-eligibility` via compliance), approval chain (`booking-approval-chain` → workflow), re-consent tolerance (`consent-re-consent-tolerance`).
- **Concurrency** — **409 on overlap**; concurrent create/modify/extend are serialized by the exclusion constraint.
- **Lifecycle** — no-show / late-return capture; **mid-trip extend**; cancel; approve/decline/modify via workflow (modify beyond tolerance voids consent ⇒ re-consent).

### PDP
`driver-eligibility`, `booking-buffer`, `max-booking-duration`, `booking-approval-chain`, `consent-re-consent-tolerance`.

### Events
`BookingConfirmed`, `BookingCancelled`, `ConsentSigned`.

### Endpoints
`GET /vehicles/available`, `POST /bookings`, `POST /bookings/:id/consent`, `POST /bookings/:id/submit`, `POST /bookings/:id/{approve,decline,modify,cancel}`, `POST /bookings/:id/extend`.

---

## M6 — `handover`

### DB (`0010_handover`)
- **`handover`** — phase (**Handover / Return**), odometer, fuel, GPS, signature, **`fuel_deviation`**, **`offline_captured`** flag.
- **`damage_pin`** — **normalized x/y + region + template_version** + photo pointer + state (existing/new). Template-versioned so the car diagram can evolve without corrupting old pins.
- **`key_log`** — key set custody in/out.

### Module — `handover/`
- Verify **booking + employee** match before capture.
- **Capture** — odometer, fuel eighths, GPS, walkaround checklist, damage pins (+ photos), signature; **offline-ready shapes** (`offline_captured`).
- **Return reconciliation** — compare against handover; **fuel-deviation flag** (advisory only, PDP `fuel-deviation-threshold`).
- **Odometer-conflict rule** — when captured odometer disagrees with telematics, **telematics is the system of record** (1C); the conflict is flagged, not silently overwritten.
- **Key log** — record custody.

### PDP
`fuel-deviation-threshold` (advisory).

### Events
`HandoverCompleted`, `ReturnCompleted`, `DamageRecorded`.

### Endpoints
`POST /handovers`, `POST /handovers/:id/return`, `POST /handovers/:id/damage`, `GET /vehicles/:id/keys`.

---

## Cross-cutting (Block D)

- **Consent wording (D7)** — Legal-reviewed **v0** (EN + AR) pre-loaded to unblock **build** (not go-live); D7 escalated with a date (P1B-R1-3).
- **Time-zone / DST (P1B-R2-5)** — store UTC; localise to Asia/Dubai; centralised conversion; boundary tests across buffers, 24 h / 1 h reminders, expiry ladders.
- **Hard-block override attempt (P1B-R2-9)** — any attempt is a **logged denial** in the exception report; a test proves **no override path exists**.

## Tests (Block D)

- **Zero bookings on expired documents** — expired Mulkiya/insurance ⇒ hard block, proven; no override path.
- **Consent gate** — no number/allocation without a committed, versioned consent record; **single-transaction atomicity** tested (number never issued if consent write fails, and vice-versa); re-consent on material change.
- **Double-booking race impossible** — `btree_gist` + concurrent create/modify/extend tests all green (P1B-R2-1).
- **Eligibility freshness** — stale HCM ⇒ block + escalate + "data as of" shown (P1B-R2-2).
- **Handover** — booking/employee verification; return reconciliation; fuel-deviation flag; odometer conflict defers to telematics.
- **SoD-01** — a user cannot approve a booking they raised (executable).
- **tz/DST** boundary cases.

## Exit gate (Block D)

- End-to-end loop works: **book → consent → approve → handover → return**.
- **Zero bookings on expired documents**; override attempts denied + logged.
- **Double-booking race prevented** (concurrent tests).
- Consent atomicity proven; re-consent on material change.

## Traceability

- **FRs:** FR-COMP-01..10 (compliance/eligibility), FR-BOOK-01..14 (booking/consent), FR-HAND-01..09 (handover/return/damage), FR-SUB-01/02 (attribution model referenced by 1E).
- **Critique resolved:** P1B-R1-1 (trip-attach full integration) ✅; P1B-R1-3 (consent v0) ✅; P1B-R2-1 (double-booking) ✅; P1B-R2-2 (freshness) ✅; P1B-R2-3 (consent atomicity) ✅; P1B-R2-5 (tz/DST) ✅; P1B-R2-9 (override logged denial) ✅.
- **Gate items advanced:** consent hard gate; zero-bookings-on-expired; double-booking race; SoD-01.
- **Migration catalog:** `0008_compliance`, `0009_booking`, `0010_handover`.
- **D-list:** **D7** (consent wording) build-unblocked via v0; D3/D9 (duration/ladder values) fixture-gated.

**Next:** [Sub-Phase 1E — Governance](05_sub-phase-1e_governance.md).
