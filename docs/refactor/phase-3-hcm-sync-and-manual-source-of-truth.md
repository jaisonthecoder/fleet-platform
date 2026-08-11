# Phase 3 — HCM Sync vs Manual (Source of Truth)

**Goal:** Make HCM a real, optional accelerator. When enabled it syncs on a schedule and can be triggered by an admin; when disabled the platform runs entirely on verified manual data. Divergence between HCM and manual is resolved by an explicit, audited precedence rule — verified manual data is never silently overwritten.

**Scenarios:** S-01, S-02, S-03, S-09, S-11, S-80, S-81, S-82, S-83, S-84
**Features:** F-20, F-21, F-22, F-23, F-24, F-25

---

## In scope
- Scheduled + admin-triggered HCM sync; real adapter behind a flag; precedence/merge engine; sync health + staleness alert; enable/disable config.

## Out of scope
- Real-time webhooks (out of program); OCR.

## Config
- `HCM_ENABLED` (bool), `HCM_SYNC_CRON` (cron), `HCM_FRESHNESS_SLA_MINUTES` (int), adapter selection (`HCM_ADAPTER=stub|fusion`).

## Backend
- `HcmSyncService`: add `@Cron(HCM_SYNC_CRON)` guarded by `HCM_ENABLED`; wrap `reconcile()` with per-record error capture; record `last_hcm_synced_at` per person and a global `hcm_sync_run` summary.
- Real `FusionHcmSource` adapter (behind `HCM_ADAPTER=fusion`) implementing `HcmSource`; keep `StubHcmSource` for local/off.
- **Precedence/merge** on upsert (§03 3): HCM authoritative when fresh; if a differing verified-manual value exists, keep both, write an audit record, and flag for Steward review (do not overwrite). Set `source`, `verified`, `last_hcm_synced_at` accordingly.
- `POST /v1/admin/hcm/sync` (SystemAdmin) → trigger; `GET /v1/admin/hcm/status` → last run time, synced/failed counts, staleness flag.
- Staleness alert: reuse `NotificationService` (`compliance` category) or an ops signal when last successful sync exceeds SLA.

## Frontend
- Admin → HCM status card: enabled/disabled, last sync, counts, "Sync now" button, staleness warning.
- Person detail: show per-field `source` badge (HCM/Manual/Verified) and divergence flags for Steward action.

## Contracts / guards
- New DTOs (`HcmStatusDto`) → `guard:contracts:update`. Config schema updated + documented.

## Tests
- BE unit: precedence rule (HCM fresh overrides; manual-verified divergence flagged not overwritten; HCM-off uses manual); cron gated by flag; status aggregation; partial-failure capture.
- BE int: trigger endpoint upserts + records run; freshness uses `last_hcm_synced_at`.
- FE: status card states; sync-now; source badges.

## Acceptance criteria
- With `HCM_ENABLED=false`, all flows work on manual data; no `hcm-data-stale`.
- With `HCM_ENABLED=true`, scheduled sync runs; admin can trigger; status is visible; stale sync alerts.
- A verified manual licence is never silently overwritten by a divergent HCM value — it is flagged for review with full audit.

## Dependencies
P1 (provenance fields), P2 (manual data exists to reconcile against).
