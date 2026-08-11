# Phase 1 — Credential Foundation & Blocking Reasons

**Goal:** Give the platform a real employee/driver credential model with provenance, expose it for auto-fill/warnings, make the eligibility gate fail-closed on missing licence, and make every block **specific and localized**. This unblocks all later phases and immediately fixes the "generic error / silent stale-block" pain.

**Scenarios:** S-01, S-04, S-05, S-06, S-07, S-09, S-10, S-11, S-27, S-28, S-29, S-41, S-60, S-81
**Features:** F-01, F-02, F-03, F-04, F-05, F-06, F-07 (partial), F-50, F-51

---

## v2 revisions (post-critique)

The critique found a sequencing hazard: enabling a fail-closed `licence-missing` block **before** any capture UI exists would make bookings harder with no in-app remedy. P1 is therefore **split**:

- **P1a (safe, ship first — no new blocks):**
  1. ✅ **Freshness fix (DONE):** `HCM_ENABLED` (default **false**) + `HCM_FRESHNESS_SLA_MINUTES` (default 1440) config; when HCM is disabled the staleness check is **skipped** (only expiry/missing hard-blocks apply). Implemented in `common/config/hcm.config.ts` + `EligibilityService`. This fixes the real "stale after 24h" demo block with zero new blocking.
  2. ✅ **Specific block reasons (DONE):** `book-vehicle-page.tsx` now prefers the most-specific appended reason over the generic umbrella (`pickConsentReasonKey`), collapses `access-blocked:*`, and EN/AR translations added for `hcm-data-stale`, `licence-expired`, `licence-missing`, `hard-block-registration-expired`, `hard-block-insurance-expired`, `employment-inactive`, `access-blocked`. Unit test: `book-vehicle-reasons.test.ts`.
  3. ✅ **`/me/credentials` read (DONE):** `GET /me/credentials` returns the caller's licence `{number, expiry, status: Missing|Valid|ExpiringSoon|Expired}` (computed in `AccessService`). Contract `MeCredentialsResponse`; test `credential-status.spec.ts`. (Emirates ID + provenance land in P1b.)
- **P1b (after manual entry exists):**
  1. ~~Feature-management foundation~~ — **skipped for now** (per direction); credential entry is available to both admin and self-service unconditionally.
  2. ✅ **Credential columns + provenance (DONE):** migration `0057_person_credentials` adds `emirates_id(+expiry)`, per-domain `*_source`/`*_verified`/`*_updated_by`, and `last_hcm_synced_at`; backfilled (`licence_source='seed'`, `last_hcm_synced_at=updated_at_utc`). Schema in `platform.schema.ts`; rollback provided.
  3. ✅ **Manual credential entry (DONE):** `PATCH /v1/me/credentials` (self → `source='manual'`, `verified=false`) and `PATCH /v1/admin/persons/:personId/credentials` (SystemAdmin/DataSteward → `verified=true`). `AccessService.updateMyCredentials`/`updatePersonCredentials`, audited (field names only, no PII values). `GET /me/credentials` now returns licence + Emirates ID with `{status, source, verified}`. Tests: `access-credentials.spec.ts`, `credential-status.spec.ts`.
  4. **Fail-closed `licence-missing`** — **deferred** until the FE inline capture ships (avoid dead-ends), then enable.
  5. **Forced document requests + notifications** — deferred with feature-management.

Additional corrections applied program-wide:
- `last_hcm_synced_at` (separate from `updated_at_utc`) is **deferred to P3** (when sync actually runs); P1a reuses `updated_at_utc` and simply gates on `HCM_ENABLED`.
- HCM-off must **never require "verified" to book** — it just skips freshness.
- Emirates ID defaults to **warn**, not block (opt-in per policy).
- Every gate-behavior change ships behind a flag; affected specs (`eligibility-rules.spec.ts`, booking specs) are updated in the same change.

---

## In scope
- Person credential fields + provenance (§03 1.1).
- Computed credential status + `/me/credentials`.
- Fail-closed `licence-missing`; configurable freshness; trust-manual-when-HCM-off.
- Surface the most-specific block reason with EN/AR translations.

## Out of scope
- Document files/upload (P2), HCM adapter (P3), inline capture UI at consent (P5).

## DB
- Migration: add credential + provenance columns to `person` incl. `last_hcm_synced_at`; backfill `licence_source='seed'` for existing rows, `last_hcm_synced_at = updated_at_utc`. Rollback drops columns.

## Backend
- `EligibilityService`/`hardBlockCheck`: add `licence-missing` (null number **or** null expiry ⇒ block, fail-closed).
- Freshness: read SLA from config (`HCM_FRESHNESS_SLA_MINUTES`); when `HCM_ENABLED=false`, **skip** the staleness block and instead require **verified** credentials (or block with a *manual-capture* remediable reason).
- Use `person.last_hcm_synced_at` (not `updated_at_utc`) for freshness.
- New `GET /v1/me/credentials`: returns per-credential `{number?, expiry?, status: Missing|Valid|ExpiringSoon|Expired, source, verified}` + `blockers[]` + `overallEligible`.
- Ensure eligibility denials return the specific reason list (already appended in `signConsent`); add `remediable` boolean to the compliance result contract.

## Frontend
- `book-vehicle-page.tsx` `consentErrorText()` / dedicated `reasonText`: prefer the **most specific** appended reason over the generic `booking-eligibility-denied`.
- Add EN/AR i18n for: `hcm-data-stale`, `licence-missing`, `licence-expired`, `hard-block-registration-expired`, `hard-block-insurance-expired`, `employment-inactive`, `booking-vehicle-not-bookable`, `access-blocked`, and a fallback for `access-blocked:*`.
- Optional: a small "credential status" read from `/me/credentials` for a pre-consent hint (full UI in P5/P6).

## Contracts / guards
- New DTOs (`MeCredentialsDto`) → `pnpm guard:contracts:update`.
- Config keys documented; env schema updated.

## Tests
- BE unit: `hardBlockCheck` blocks on missing licence; freshness respects config + HCM-off path; `/me/credentials` status computation (Missing/Valid/ExpiringSoon/Expired).
- BE int: booking consent denied with `licence-missing` when no licence.
- FE: `consentErrorText` shows specific reason; new i18n keys resolve EN/AR.

## Acceptance criteria
- A driver with no licence is **blocked** (`licence-missing`), not allowed through.
- With `HCM_ENABLED=false`, a **verified** manual licence lets booking proceed with **no** staleness block.
- Every block in booking/dedicated shows a specific localized message (no raw codes, no misleading "reconciled" text).
- `GET /v1/me/credentials` returns actionable status for the signed-in user.

## Dependencies
None (foundation). Enables P2–P6, P8.
