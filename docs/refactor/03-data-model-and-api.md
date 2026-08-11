# Data Model & API Design

Technology-consistent with the codebase: Drizzle ORM (`fleet` schema), hand-authored migrations + rollback, Zod contracts, RFC-7807 errors, `orgId()` org scoping, `guard:contracts`/`guard:org`. All new PII is classified **sensitive**.

> This is the design reference; each phase file lists the exact subset it implements.

---

## 1. Schema changes

### 1.1 Person credentials (P1)

Extend `fleet.person` (additive, nullable):

```
emirates_id             text
emirates_id_expiry      date
-- provenance/verification (per credential domain)
licence_source          text   -- 'hcm' | 'manual' | 'seed'
licence_verified        boolean not null default false
licence_updated_by      uuid   references person(id)
emirates_id_source      text
emirates_id_verified    boolean not null default false
emirates_id_updated_by  uuid   references person(id)
last_hcm_synced_at      timestamptz   -- distinct from updated_at_utc
```

Rationale: separate `last_hcm_synced_at` from `updated_at_utc` so the freshness gate no longer treats *any* row edit as a "sync". Provenance columns enable the precedence rule (§3).

### 1.2 Person documents (P2)

New `fleet.person_document` (mirrors `vehicle_document`):

```
id                uuid pk
organization_id   uuid (orgId)
person_id         uuid not null references person(id)
doc_type_code     text not null  -- 'DRIVING_LICENCE' | 'EMIRATES_ID' | 'MEDICAL' | 'TRAINING' | 'OTHER'
document_reference text
blob_ref          text           -- object key 'person-documents/<personId>/...'
issue_date        date
expiry_date       date
version           int not null default 1
status            text not null default 'Uploaded' -- Uploaded|Confirmed|Superseded
uploaded_by       uuid references person(id)
created_at_utc / updated_at_utc
```
Indexes: `(person_id, doc_type_code)`, `(expiry_date)`. Classification: **sensitive**.

### 1.3 Driver profile & assignment (P4)

```
fleet.driver_profile
  id, organization_id, person_id (unique), status ('Active'|'Suspended'|'Onboarding'),
  medical_expiry date, training_expiry date, endorsements text[],
  onboarded_at, onboarded_by, created/updated

fleet.driver_assignment
  id, organization_id, driver_person_id, vehicle_id, valid_from, valid_to (null=open),
  assignment_type ('Dedicated'|'Substitute'), created_by, created/updated
  -- btree_gist exclusion: no overlapping open assignment per vehicle & per driver
```
(`vehicle.assigned_driver_person_id` stays as the current effective pointer; `driver_assignment` adds history + exclusivity.)

### 1.4 Passengers (P8)

```
fleet.booking_passenger
  id, booking_id references booking(id), seq int,
  person_id uuid null, full_name text, phone text null, is_employee boolean
```

### 1.5 Reason catalog (P8)

```
fleet.reason_message
  id, reason_code text, locale text, scope_node_id uuid null,
  title text, body text, severity ('block'|'warn'|'info'), guidance_url text null
  unique (reason_code, locale, scope_node_id)
```

### 1.6 Help content (P7)

```
fleet.help_article
  id, organization_id, slug unique, category, locale, title, body_md,
  reason_code text null, sort_order, published boolean, created/updated
```

### 1.7 In-app notifications (P8)

```
fleet.notification_inbox
  id, organization_id, person_id, category ('compliance'|'operational'|'informational'),
  title, body, correlation_id, read_at timestamptz null, created_at_utc
```

---

## 2. API surface (by phase)

**P1 — credentials & reasons**
- `GET /v1/me/credentials` → `{ licence:{number?,expiry?,status,source,verified}, emiratesId:{...}, overallEligible:bool, blockers:[{code,severity}] }`
- Eligibility response gains `remediable: boolean` + explicit `reasons[]` (specific first).

**P2 — document center**
- `POST /v1/persons/:personId/documents/upload-url` → presigned PUT + `blobRef`
- `POST /v1/persons/:personId/documents` (metadata) · `GET /v1/persons/:personId/documents` · `POST /v1/persons/:personId/documents/:id/confirm`
- Self scope: `/v1/me/documents*` (own records only).

**P3 — HCM**
- `POST /v1/admin/hcm/sync` (trigger) · `GET /v1/admin/hcm/status` (last sync, counts, health)
- Config: `HCM_ENABLED`, `HCM_SYNC_CRON`, `HCM_FRESHNESS_SLA_MINUTES`.

**P4 — driver**
- `POST /v1/drivers` (onboard) · `GET /v1/drivers` (register) · `GET /v1/drivers/:personId`
- `POST /v1/drivers/:personId/assignments` · `DELETE .../assignments/:id` · `GET /v1/vehicles/:id/driver`

**P5 — booking capture**
- Reuse `/v1/me/documents` + credential PATCH inside consent; `POST /v1/bookings/:id/reevaluate` (or re-run gate on resubmit).

**P6 — profile**
- Aggregate read `GET /v1/me/overview` → `{ credentials, documents, bookings, requests, blockers }` (composes existing endpoints).

**P7 — help**
- `GET /v1/help/articles?category=&reasonCode=` · admin CRUD `/v1/admin/help/articles`.

**P8 — passengers/notifs/reasons**
- `POST /v1/bookings/:id/passengers` · `GET /v1/me/notifications` · `POST /v1/me/notifications/:id/read`
- `GET /v1/reasons/:code` (resolved message) · admin CRUD `/v1/admin/reasons`.

---

## 3. Source-of-truth & precedence (the core rule)

For each credential field:

1. If **HCM enabled** and it returns a **fresh** value → HCM is authoritative; set `source='hcm'`, `verified=true`, update `last_hcm_synced_at`. If a prior **manual** value differs, **do not delete it** — record both in audit and flag for Steward review.
2. If **HCM disabled or no value** → the **manual** value stands. `source='manual'`, `verified=false` until a Steward confirms.
3. The **eligibility gate** uses the *effective* value with this trust order: `verified` (hcm or steward-verified manual) > `unverified manual`. Expiry/missing hard-blocks apply **regardless of source**.
4. Freshness (`hcm-data-stale`) only blocks when **HCM is enabled**; with HCM off, verified manual data is trusted (F-06).

```mermaid
flowchart TD
  Q{HCM enabled?}
  Q -- no --> M[Use manual value\n(block only on expiry/missing)]
  Q -- yes --> F{HCM value fresh?}
  F -- yes --> H[HCM authoritative\nflag manual divergence]
  F -- no --> V{Verified manual exists?}
  V -- yes --> M
  V -- no --> Stale[Block hcm-data-stale\n(+ offer manual capture)]
```

---

## 4. Migrations & guards

- One hand-authored migration per phase under `app-api/drizzle/migrations/` + matching `rollback/`.
- New org-scoped files → add to `scripts/guard-organization-id.mjs` allowlist.
- New DTOs → `pnpm guard:contracts:update`.
- Seed updates for local: extend `seed-dev.sql` with sample documents/driver profile; keep `refresh-demo-booking-people.mjs` working.

## 5. PII & security controls

- Licence/EID numbers + files are **sensitive**: RBAC-scoped reads, never in safe list projections/logs (extend the existing discipline in `bookings/repositories/bookings.repository.ts`), audited on every read/write, retention policy defined.
- Uploads: presigned PUT, ≤ e.g. 10 MB, `application/pdf|image/*`, private bucket, key prefix `person-documents/<personId>/`, short TTL.
- Self-service writes create `Unverified` records; expiry hard-blocks still apply.

---

## 6. Existing capabilities to reuse (do not rebuild)

| Domain | Existing artifact | Use it for |
|---|---|---|
| File storage | `evidence-store.port.ts` + `local-evidence.store.ts` (handover); `STORAGE_*` env | P2 document upload (add a `PersonDocumentStore` adapter over the same port) |
| Access blocks | `access_block` table, `raiseBlockSchema`, `ComplianceService.raiseBlock` | P9 block explanation + lift (add `source_ref` + localized reason) |
| Fines | `fine` status machine (`Recorded→Attributed→Disputed→Recovered→Closed`), auto-block on overdue black points | P9 driver fines view + dispute/adjudicate (add `POST /fines/:id/dispute` `/adjudicate`) |
| Consent | booking `consent_record`, entitlement consent | P9 "my consents" + re-consent |
| Feature flags | `hcmConfig` pattern (`boolFromEnv` + `registerAs`) | Every gate-behaviour flag |
| Bulk import | MigrationModule | P4 bulk people/driver/credential import |
| Dashboards | DashboardsModule (`countActiveBlocks`, cost masking) | P8 expiry/compliance/block analytics |
| Notifications | NotificationService/port (`compliance` unmutable) | P8 expiry reminders + inbox persistence |

Minor additive columns for reuse: `access_block.source_ref` (fine/black-point/manual) + `reason_code`; no new fines/consent tables (extend endpoints only).

## 6b. Feature management & forced document requests (developer addition)

### Runtime feature flags (per-org, DB-backed)

```
fleet.feature_flag
  id, organization_id, key text, enabled boolean not null,
  updated_by_person_id uuid null, updated_at_utc
  unique (organization_id, key)
```
- A **flag registry** (code) defines known keys + safe defaults; the table stores per-org overrides. Effective value = override ?? default.
- Keys (initial): `self-service-credentials`, `licence-missing-block`, `emirates-id-required` (warn|block via policy), `document-requests`.
- API: `GET /v1/admin/features` (list with effective values), `PATCH /v1/admin/features/:key` `{ enabled }` (SystemAdmin). Audited + optimistic.
- Read via `FeatureFlagService.isEnabled(orgId, key)` (small table; optional short cache). Self-service credential/document endpoints are gated by `self-service-credentials`.

### Forced document requests

```
fleet.document_request
  id, organization_id, subject_person_id, doc_type_code, reason text,
  due_date date null, status ('Pending'|'Fulfilled'|'Cancelled'),
  requested_by_person_id, fulfilled_document_id uuid null,
  created_at_utc, updated_at_utc
```
- API: `POST /v1/persons/:personId/document-requests` (admin/steward) → creates task, emits outbox + **email + in-app notification**; `GET /v1/me/document-requests` (employee) + `GET /v1/persons/:personId/document-requests`; auto-`Fulfilled` when the matching document is uploaded.
- Notifications reuse `NotificationService` (email) + `notification_inbox` (P8); compliance-category reminders are unmutable.

### Flag layering (deploy-time vs runtime)

| Layer | Mechanism | Scope | Example |
|---|---|---|---|
| **Deploy-time** | env + config namespace (`hcmConfig`) | environment | `HCM_ENABLED`, `HCM_FRESHNESS_SLA_MINUTES` |
| **Runtime** | `feature_flag` table + admin Settings UI | per-org | `self-service-credentials`, `licence-missing-block` |

Rule: infrastructure/integration switches are **deploy-time**; product capabilities admins tune are **runtime**. Safety-critical hard-block *logic* is never a runtime toggle for its rule — only whether an *optional* requirement is enforced.

## 7. Cross-cutting engineering standards
All schema/endpoint work follows `09-engineering-standards-and-integration.md`: **idempotent commands**, **transactional outbox events** (`person-credential`, `person-document`, `driver-assignment`, `fine-dispute`), **append-only audit** on PII, **optimistic concurrency**, **policy-driven requirements** via `POLICY_FACT_CATALOG` / `driver-eligibility-gate` (e.g. `emiratesIdRequired` defaults to warn), **RBAC + SoD**, **UAE data residency**, and **retention `@Cron` workers** for documents/credentials.
