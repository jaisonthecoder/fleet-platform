# Gap Analysis & Critique — Driver Licence / Emirates ID Capture, Passenger Details, and User-Facing Block Messaging

**Date:** 2026-07-31
**Author:** Engineering review (code-evidence based)
**Status:** Findings for triage — no code changed by this report
**Scope of code reviewed:** `app-api` (schema, contracts, compliance/eligibility, identity, bookings, policy authoring, platform/HCM), `app-ui` (booking, dedicated-vehicle, identity, i18n)

---

## 1. Executive summary

Three product needs were raised:

1. **Driver licence & Emirates ID capture** — record licence number/expiry and upload licence + Emirates ID files. Optional at user creation; **required at booking time if missing**.
2. **Passenger details** — when more than one passenger is selected, capture/fetch the passenger identities (not just a count).
3. **Actionable block messaging** — show the *exact* reason a booking/request is blocked, and let the rule‑management (Policy Studio) screen (or elsewhere) configure custom warning/error messages.

**Verdict:** All three are **genuine gaps**. The data model has licence *columns* but no Emirates ID field, no person‑document storage, and no first‑class capture path (licence is only writable via an unimplemented HCM adapter or seed scripts). Bookings capture a passenger **count only**. Block reasons are surfaced with **developer‑owned i18n codes**, the specific compliance sub‑reason is **swallowed** behind a generic message, and Policy Studio rows carry reason **codes**, not admin‑authored messages. There is also **no file‑upload pipeline** at all (documents are metadata + a `blobRef` string).

Severity summary:

| # | Requirement | Current state | Gap severity |
|---|---|---|---|
| 1a | Person: licence number/expiry fields | Columns exist, no write path/UI | **High** |
| 1b | Person: Emirates ID field | Does not exist | **High** |
| 1c | Person: licence + Emirates ID file upload | No person docs, no upload pipeline | **High** |
| 1d | Booking‑time licence capture if missing | Not implemented (hard‑block only) | **High** |
| 2 | Passenger identities / fetch details | Count only (1–7 stepper) | **Medium** |
| 3a | Show exact block reason to user | Specific reason swallowed; generic text | **High** |
| 3b | Configurable custom block messages in rule mgmt | Not supported (codes only) | **Medium‑High** |

---

## 2. Requirement 1 — Driver licence & Emirates ID capture

### 2.1 Data model — what exists today

`person` has licence columns but **no Emirates ID** and **no documents**:

- `licenceNumber: text('licence_number')`, `licenceExpiry: date('licence_expiry')` — `app-api/src/common/database/schema/platform.schema.ts` (≈L147–148).
- No `emiratesId` / `emiratesIdExpiry` column anywhere on `person`.
- There is **no `person_document` table**. Document tables exist only for **vehicles** (`vehicle_document`) and **vendors** (`vendor_document`) — `app-api/src/common/database/schema/vehicle.schema.ts` (L159), `.../vendor.schema.ts` (L223).

### 2.2 Write path — how licence data is (not) captured

- The **only** writer of `licenceNumber`/`licenceExpiry` is the HCM sync: `upsertPersonFromHcm(...)` — `app-api/src/modules/platform/repositories/platform.repository.ts` (≈L113–124) called from `HcmSyncService` (`.../services/hcm-sync.service.ts` L28–36).
- The dev HCM adapter is a **stub that returns `[]`**: `StubHcmSource.fetchActivePersons()` — `.../services/hcm-sync.service.ts` (≈L57–63). So in dev/local **no licence data ever flows in**; the only values present come from seed/refresh SQL (`scripts/seed-dev.sql`, `scripts/refresh-demo-booking-people.mjs`).
- The identity/user‑admin module has **no create‑person and no edit‑person**. `UserAdminController` exposes only `assignRole`, `suspend`, `reactivate` — `app-api/src/modules/identity/controllers/user-admin.controller.ts` (L60–104). There is no endpoint to set licence number/expiry, Emirates ID, or upload a document for a person.

> **Consequence:** A user/admin literally cannot enter or upload a driver licence or Emirates ID anywhere in the product today. The eligibility gate silently depends on data that has no capture surface.

### 2.3 File upload — no pipeline exists

- "Documents" are **metadata records pointing at a text `blobRef`** (an object key string). There is **no multipart handler, no `FileInterceptor`, no presigned‑URL issuance, no storage service**. Evidence: `blobRef` is a plain `text`/`z.string()` everywhere and is validated only as a *path‑shaped string* (`vendor-documents/...`) — `app-api/src/modules/vendors/services/vendor.service.ts` `assertDocumentBlobRef` (≈L1360–1366); `app-api/src/contracts/vehicle.contract.ts` (L136).
- Grep for `multipart|FileInterceptor|uploadFile|presigned|BlobStorage` returns **no upload implementation**.

> **Consequence:** "Upload the licence and Emirates ID file" requires building an actual object‑storage upload path (presigned PUT to S3/Azure Blob or a multipart endpoint) that does not exist yet — this is net‑new infrastructure, not a form tweak.

### 2.4 Booking‑time behaviour — hard block, no capture

- At consent, `BookingService.signConsent` calls `EligibilityService.evaluate({ driverPersonId, vehicleId })` **before** reserving — `app-api/src/modules/bookings/services/booking.service.ts` (≈L368).
- The gate's `hardBlockCheck` treats an **expired** licence as a block (`licence-expired`) but a **missing** (`null`) licence as *not* expired → not blocked — `app-api/src/modules/compliance/internal/eligibility-rules.ts` (L41; `isExpired(null) === false`, L22–28).
- `createBookingSchema` captures **no licence fields** — `app-api/src/contracts/booking.contract.ts` (L55–63).

> **Two real issues:** (a) There is **no prompt** to supply licence details when missing — the requirement ("if missing, ask at booking time") is unmet. (b) A **null** licence currently *passes* the hard gate, so a driver with no licence on file can book — arguably a compliance hole (only *expired* licences block; *absent* ones do not).

---

## 3. Requirement 2 — Passenger details

- Bookings persist a **count only**: `passengerCount: z.number().int().min(0).max(100).optional()` — `app-api/src/contracts/booking.contract.ts` (L62). No passenger identity table, no per‑passenger records.
- The UI is a **1–7 stepper**: `adjustPassengers` clamps to `Math.min(7, Math.max(1, ...))` — `app-ui/src/features/booking/booking-discovery-view.tsx` (≈L156–160). The count only drives the **seating‑capacity** gate (`draftCapacityError`, `booking-vehicle-capacity-insufficient`).
- There is **no** capability to fetch/select passenger persons. The `bookablePeople` list (`useBookablePeople`) exists **only** for the "book on behalf of" requester selection, not passengers.

> **Consequence:** "Select multiple passengers → fetch their details" is entirely unbuilt. Requires a passenger sub‑model (identities, possibly non‑employee guests), a picker UI, and a decision on whether passengers are employees (directory lookup) or free‑text guests (name/phone).

---

## 4. Requirement 3 — Actionable block messaging & configurable messages

### 4.1 The exact reason is produced by the API but swallowed by the UI

- On a compliance block, the API returns **both** the generic code and the specific sub‑reason: `reasons: [BOOKING_REASON.eligibilityDenied, ...verdict.reasons]` — `app-api/src/modules/bookings/services/booking.service.ts` (≈L378–382). `verdict.reasons` is e.g. `['hcm-data-stale']`, `['licence-expired']`, `['hard-block-registration-expired']`, `['access-blocked:<reason>']`, `['employment-inactive']`, `['vehicle-not-bookable']` — `app-api/src/modules/compliance/internal/eligibility-rules.ts` (L36–48) and `.../services/eligibility.service.ts` (L23–41).
- The UI **picks the first known code**, which is the generic `booking-eligibility-denied`, and never shows the specific one: `consentErrorText()` → `error.reasons.find(r => KNOWN_CONSENT_REASONS.has(r))` — `app-ui/src/features/booking/book-vehicle-page.tsx` (helper added ≈L131). The specific sub‑reasons (`hcm-data-stale`, `licence-expired`, …) are **not in any i18n file** (`app-ui/src/i18n/locales/en.json` / `ar.json` have no keys for them), so even if surfaced they'd render as raw codes.

> **Consequence:** The user sees "*This vehicle or driver failed a compliance check (for example an expired document)*" regardless of whether the true cause was **stale HCM data**, an **expired licence**, an **expired Mulkiya/insurance**, an **active access block**, or an **inactive employee**. This is exactly the "doesn't show the actual reason" complaint.

### 4.2 Reason strings are developer‑owned, not admin‑configurable

- Every reason is a **stable machine code** mapped to a hard‑coded i18n string in `en.json`/`ar.json` (e.g. `dedicated.reasons.*`, `booking.consent.reasons.*`). Adding or changing a message requires a **developer + redeploy** — there is no runtime/admin authoring of these strings.

### 4.3 Policy Studio (rule management) cannot attach custom user messages

- Authored policy rows carry a list of reason **codes**, not messages: `authoredDecisionRowSchema = { id, conditions, decision, reasons: string[], route?, value? }` and the same for the default — `app-api/src/contracts/policy-authoring.contract.ts` (L44–61). There is **no `messageEn`/`messageAr`/`guidance`/`severity`** field.
- Critically, the **hard‑block reasons are not policy‑driven at all** — they are code constants in `hardBlockCheck` and `EligibilityService`, evaluated *before* the PDP. So even a fully‑featured Policy Studio message field would **not** be able to customise the very messages the user is hitting (licence/registration/insurance/stale/block).

> **Consequence:** "Configure a custom warning message in the rule‑management screen" is unsupported on two counts: (1) the authoring schema has no message field, and (2) the blocking logic the user cares about lives outside the policy tables.

---

## 5. Real‑time issues observed

1. **Demo/UAT blocker — 24h HCM staleness.** `DEFAULT_HCM_FRESHNESS_SLA_MINUTES = 1440` (`app-api/src/modules/platform/internal/hcm.ts` L30). The gate uses `person.updatedAtUtc` as "last sync"; seeded people age past 24h and every booking/dedicated request then fails with `hcm-data-stale`, shown as the generic compliance message. Mitigated today only by re‑running `pnpm --filter app-api db:refresh-demo-booking-people`. This will bite every multi‑day test/demo.
2. **Silent "missing licence passes" hole.** A `null` licence expiry is *not* a hard block (§2.4), so an unlicensed driver can currently book — the opposite of the intended control, and inconsistent with the requirement to *require* licence at booking.
3. **Message masking.** The most useful diagnostic (`hcm-data-stale` vs `licence-expired` vs `hard-block-insurance-expired`) is discarded at the UI boundary (§4.1).
4. **No self‑service remediation.** Because there's no licence/EID capture UI, even when the reason *is* "licence expired/missing", the user has no in‑product way to fix it.

---

## 6. Consolidated gap register

| ID | Area | Requirement | Current | Gap | Sev |
|----|------|-------------|---------|-----|-----|
| G1 | Data model | Emirates ID number/expiry on person | Absent | Add columns | High |
| G2 | Data model | Person document store (licence, EID scans) | Absent (`person_document` missing) | New table | High |
| G3 | Infra | File upload/storage pipeline | Only `blobRef` strings; no upload | New storage + upload endpoint/presign | High |
| G4 | API/UI | Create/edit person with licence + EID (optional) | Only role assign/suspend | New person profile write API + UI | High |
| G5 | Booking | Prompt for licence details/files when missing | Hard block only, no prompt | Inline capture step | High |
| G6 | Compliance | Treat *missing* licence as a block | Only *expired* blocks | Tighten `hardBlockCheck` | High |
| G7 | Booking | Passenger identities / fetch details | Count 1–7 only | Passenger sub‑model + picker | Medium |
| G8 | Messaging | Show exact block reason | Generic; specific swallowed | Surface + translate sub‑reasons | High |
| G9 | Messaging | Translations for compliance codes | None for `hcm-data-stale`/`licence-*`/`hard-block-*` | Add i18n keys | Medium |
| G10 | Policy Studio | Author custom user messages per rule/reason | Codes only | Add message fields + resolver | Medium‑High |
| G11 | Policy scope | Hard blocks configurable/messaged | Hard‑coded, pre‑PDP | Reason‑catalog + config layer | Medium |
| G12 | Ops | Freshness SLA breaks demos | 24h fixed | Config/env override or auto‑refresh | Medium |

---

## 7. Recommended design (per requirement)

### 7.1 Licence & Emirates ID capture (G1–G6)

**Data model**
- Add to `person`: `emirates_id text`, `emirates_id_expiry date` (nullable). Keep licence columns.
- New table `person_document` mirroring `vehicle_document`: `id, organization_id, person_id, doc_type_code ('DRIVING_LICENCE'|'EMIRATES_ID'), document_reference, blob_ref, issue_date, expiry_date, version, status, created_at_utc`. Classify as **sensitive PII** (see §9). Add a hand‑authored migration + rollback (repo convention).

**Storage/upload (G3)** — pick one:
- *Preferred:* **presigned‑URL** flow — API issues a scoped PUT URL (S3/Azure Blob), client uploads directly, then posts the `blobRef` metadata (matches the existing `blobRef` convention and keeps large binaries out of the API).
- *Alternative:* multipart `FileInterceptor` endpoint that streams to storage. Heavier on the API; only if direct‑to‑blob is not allowed.
- Enforce content‑type/size limits and the existing path‑shape validation (`person-documents/<personId>/...`).

**Write API + UI (G4)**
- New `PATCH /v1/admin/users/:personId/profile` (SystemAdmin/DataSteward) to set licence number/expiry + Emirates ID + document metadata — **all optional** at creation/edit (satisfies "not mandatory").
- Surface in the identity/access‑management UI as a "Driver credentials" panel with two document upload slots.

**Booking‑time capture (G5) + block on missing (G6)**
- Change `hardBlockCheck` so a **missing** licence (null number *or* null expiry) yields a `licence-missing` block (new reason), alongside `licence-expired`.
- When the gate denies with `licence-missing`/`licence-expired`, the booking consent step should render an **inline capture** (licence number + expiry + file, optional EID) that writes to `person_document`/`person`, then re‑evaluates. Requires: the eligibility denial to return a **remediable** flag/reason so the UI can branch to capture instead of a dead end.
- Decision needed: is booking‑time capture **self‑service** (employee updates own licence) or **admin‑gated**? Self‑service is better UX but has integrity/PII implications (see §9) — recommend self‑service with the record marked `Unverified` until a DataSteward confirms, and keep the hard block on **expired** regardless.

### 7.2 Passenger details (G7)
- New `booking_passenger` table: `booking_id, seq, person_id (nullable), full_name, phone (nullable), is_employee`.
- UI: when `passengerCount > 1`, reveal a passenger list; each row either **picks an employee** (reuse the directory/`bookablePeople`‑style search) or enters a **guest** name/phone.
- Keep `passengerCount` as the capacity driver; validate `passengers.length === passengerCount`.
- Confirm privacy stance: passenger identities are personal data → minimise, and mask on approver/read projections (the booking read model already avoids raw PII — extend the same discipline).

### 7.3 Actionable & configurable messaging (G8–G11)

**Immediate, low‑risk (surface the real reason) — G8/G9**
- In `consentErrorText()` (and the dedicated `reasonText`), prefer the **most specific** appended sub‑reason over the generic `booking-eligibility-denied`. Add i18n keys for: `hcm-data-stale`, `licence-expired`, `licence-missing`, `hard-block-registration-expired`, `hard-block-insurance-expired`, `employment-inactive`, `vehicle-not-bookable`, `access-blocked` (EN + AR). Each message should be **actionable** ("Your driving licence has expired — update it to book").
- This is a small, self‑contained change and the highest ROI for the "show the actual reason" ask.

**Configurable messages (G10/G11)**
- Introduce a **Reason Catalog**: `reason_message` table keyed by `reason_code` + `locale` + optional `scope_node_id`, with `title`, `body`, `severity ('block'|'warn'|'info')`, `guidance_url`. A resolver overlays catalog entries on top of the built‑in i18n defaults (fallback‑safe).
- Extend `authoredDecisionRowSchema`/default with optional `messageRef` (a reason code) so Policy Studio rows can point at a catalog entry; add a management screen to edit catalog copy without a deploy.
- For the **hard blocks** (which are pre‑PDP and code‑owned), route their reason codes through the **same** catalog so admins can at least customise the *message* (not the rule). This closes the "rule‑management screen should show a custom message" ask without making safety‑critical hard blocks user‑configurable logic.

### 7.4 Operational (G12)
- Make the HCM freshness SLA env‑configurable (e.g. `HCM_FRESHNESS_SLA_MINUTES`) and/or have `dev:bootstrap` call `db:refresh-demo-booking-people` so demos don't silently rot. Do **not** relax it in production.

---

## 8. Suggested sequencing

1. **Quick win (days):** G8/G9 — surface + translate the specific block reason; add `licence-missing` reason and block on missing licence (G6). Env‑configurable freshness (G12).
2. **Foundation (1–2 iterations):** G1/G2 person schema + `person_document`; G3 presigned upload; G4 profile write API + UI.
3. **Booking integration:** G5 inline licence capture + remediable‑reason plumbing.
4. **Passengers:** G7 sub‑model + picker.
5. **Config messaging:** G10/G11 reason catalog + Policy Studio message authoring.

---

## 9. Risks, compliance & security notes

- **PII / sensitive data:** Driving licence and Emirates ID are sensitive personal data. The fact catalog already classifies licence facts as `classification: 'personal'` (`policy-authoring.contract.ts`). New columns/tables must be classified **sensitive**, access‑scoped (RBAC), excluded from safe read projections/logs (the booking read repo explicitly warns "never add raw HR/licence…" — `bookings/repositories/bookings.repository.ts` L190), and covered by audit + retention.
- **Do not fail‑open:** Keep the "block on stale/expired" fail‑safe direction. When adding `licence-missing`, ensure it blocks (fail‑closed) — do not weaken existing hard blocks.
- **Storage security:** Presigned URLs must be short‑lived, scoped to `person-documents/<personId>/...`, content‑type/size limited, and private (no public read). Reuse the existing `blobRef` path‑validation discipline.
- **Self‑service capture integrity:** If employees can enter their own licence at booking time, mark records `Unverified` and keep expiry‑based hard blocks; require DataSteward verification for the authoritative flag. Avoid letting unverified self‑entry bypass compliance.
- **Message config authority:** Custom messages must be copy‑only. Never allow the rule‑management UI to disable or alter **hard‑block decision logic** (registration/insurance/licence/employment) — only the presentation.

---

## 10. Acceptance criteria (proposed)

- A DataSteward/Admin can add a person's licence number/expiry, Emirates ID number/expiry, and upload both files (optional), stored as classified `person_document`s.
- Booking consent, when blocked for a **missing/expired licence**, shows the **specific** reason and offers an inline path to provide the licence, after which re‑evaluation proceeds.
- A driver with **no** licence on file is **blocked** from booking (fail‑closed), with a clear message.
- Selecting N (>1) passengers lets the requester attach N passenger identities (employee pick or guest entry); the count still gates seating capacity.
- Every compliance/eligibility block renders a **specific, localized, actionable** message (EN + AR), with no raw codes.
- An admin can edit the user‑facing copy for a reason code (block/warn/info) without a code deploy, and Policy Studio rows can reference a catalog message.

---

*Evidence pointers use `path (approx. line)` from the repository at review time; line numbers may drift as code changes.*
