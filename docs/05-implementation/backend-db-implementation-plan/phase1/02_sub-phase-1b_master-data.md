# Sub-Phase 1B — Master Data (Block B)

**The single governed vehicle master + the bulk migration path that fills it.** Runs in parallel with 1C after 1A₂. Everything downstream (booking, compliance, telematics attach, fines) references a `vehicle`, so this is the first feature block.

- **Entry dep:** 1A₂ green (hierarchy full + **lookups** — body type / use category / fuel type / make→model feed the vehicle master; audit + outbox live).
- **Unlocks:** 1D (booking/compliance need vehicles), 1C (devices pair to vehicles).
- **Migrations:** `0005_vehicle`, `0006_migration`.

> **Carried from Phase 0:** `vehicle_hierarchy_assignment` was deferred out of Phase 0 (it forward-referenced `vehicle`); it lands **here** in `0005_vehicle`, effective-dated with an exclusion constraint.

---

## M2 — `vehicles`

### Contracts
`contracts/vehicle.contract.ts` (`vehicle.request` / `vehicle.response`), `contracts/vehicle-document.contract.ts`, `contracts/vehicle-transfer.contract.ts`. Enums for lifecycle status, operational status, body type, ownership, fuel type.

### DB (`0005_vehicle`)
- **`vehicle`** — the master, **61+ fields across 6 groups** (identity, technical, ownership/finance, compliance/documents, telematics/keys, cost/ESG). Closed sets as **enums**: **7 lifecycle statuses** (e.g. Ordered→Registered→Active→InService→OffHire→Disposed→Sold) + **5 operational statuses** (Available/InUse/Reserved/Maintenance/Unavailable).
  - **Uniqueness:** `plate`, `chassis_vin`, `salik_tag`, `darb_tag` (partial-unique where not null).
  - **Indexes:** `booking_pool_flag`, `mulkiya_expiry`, `insurance_expiry`, `assigned_driver_person_id`.
  - **Trigger:** `body_type ∈ {Bus, Equipment} ⇒ booking_pool_flag = false` (equipment/buses appear in inventory for cost reporting but are **never bookable** — scope boundary).
  - Dormant `organization_id`; `*_at_utc timestamptz`; money `numeric(14,2)`+`currency`.
- **`vehicle_document`** — **versioned** document vault pointer (Mulkiya, insurance, etc.): type, issue/expiry, WORM blob pointer, version; insert-only (new version supersedes).
- **`vehicle_lifecycle_history`** — **append-only** status/lifecycle transitions (who/when/why); soft-state, never hard-deleted.
- **`vehicle_transfer`** — inter-pool/cluster transfer records (from/to hierarchy node, effective date, reason).
- **`vehicle_hierarchy_assignment`** — effective-dated assignment of a vehicle to a hierarchy node; **`btree_gist` exclusion constraint** prevents overlapping active assignments for the same vehicle (carried from Phase 0).

### Module — `vehicles/`
- **`VehicleService`** — CRUD; lifecycle + operational status transitions (guarded, logged to history); pool include/exclude; uniqueness enforcement; hierarchy assignment.
- **`DocumentVaultService`** — versioned document add/read; feeds compliance expiry items (1D).
- **`TransferService`** — transfer between nodes with effective-dated reassignment + history.

### Endpoints
`GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/:id`, `GET /vehicles/:id`, `POST /vehicles/:id/documents`, `POST /vehicles/:id/transfer`, `GET /vehicles/:id/history`. **Event-publish on every change** (FR-INV-11).

### PDP
None (configuration/master data only).

### Events
`VehicleChanged` (created/updated/status/transfer/document) → consumed by compliance (expiry items), telematics (pairing), dashboards.

---

## M3 — `migration`

### DB (`0006_migration`)
- **`import_batch`** — one upload: source, uploader, status, completeness score, steward sign-off.
- **`import_row`** — per-row staged record + **status + reason** (valid/invalid/duplicate/needs-resolution).
- **`dedup_candidate`** — suspected duplicate pairs + match basis for steward resolution.

### Module — `migration/`
- **`ImportService`** — CSV/XLSX ingest; parsing runs in a **BullMQ sandboxed** worker (never on the `api` thread — booking path stays sacred).
- **`ValidationService`** — pre-commit validation against `vehicle` rules (uniqueness, enums, required fields, expiry sanity).
- **`DedupService`** — duplicate detection → `dedup_candidate`.
- **`ReconciliationService`** — completeness score per batch; reports gaps.

### Endpoints
`POST /imports` (**202 + jobId**), `GET /imports/:id`, `POST /imports/:id/resolve` (steward resolves rows/dedup), `POST /imports/:id/sign-off`.

### Events
`ImportBatchCompleted`, `VehicleImported` (per committed row → same path as `VehicleChanged`).

### Cleansing & correction (critique)
- **Cleansing sprint runs in parallel** with 1B–1E; a **data steward is assigned at kickoff** (P1B-R1-4).
- **Corrective-entry pattern** for post-go-live fixes to a bad migrated record: a **new versioned record + audit reason**, never an in-place edit — compatible with append-only history + steward sign-off (P1B-R2-8).

---

## Tests (Block B)

- **Migration:** `0003`/`0004` apply forward + compensate cleanly; FK/seed tests.
- **Vehicle uniqueness:** duplicate plate/VIN/salik/darb rejected; partial-unique on null tags.
- **Not-bookable trigger:** a Bus/Equipment row cannot have `booking_pool_flag = true`.
- **Lifecycle/operational transitions:** invalid transitions rejected; every transition writes `vehicle_lifecycle_history` + audit + outbox in one transaction.
- **Transfer:** effective-dated reassignment; exclusion constraint blocks overlapping active assignments.
- **Import pipeline:** sandboxed parse (not on `api` thread); validation catches bad rows with reasons; dedup surfaces candidates; **completeness ≥ 98%** computed; sign-off gate.

## Exit gate (Block B)

- A **real pilot inventory imports to ≥ 98 % completeness** with steward sign-off.
- Uniqueness + lifecycle enforced (mitigates R5).
- Every vehicle change emits an event + audit entry; corrective-entry pattern defined.

## Traceability

- **FRs:** FR-INV-01..11 (vehicle master, documents, transfer, lifecycle), FR-MIG-01..06 (import/validate/dedup/reconcile/sign-off).
- **Critique resolved:** P1B-R1-4 (cleansing sprint + steward) ✅; P1B-R2-8 (corrective-entry) ✅; Phase-0 R1#1 (vehicle_hierarchy_assignment forward-ref) ✅ landed here.
- **Gate items advanced:** "inventory migrated ≥98% complete, steward signed off; corrective-entry pattern defined".
- **Migration catalog:** `0005_vehicle`, `0006_migration`.
- **D-list:** none blocking (master data is configuration).

**Next:** [Sub-Phase 1C — Telematics Domain](03_sub-phase-1c_telematics-domain.md).
