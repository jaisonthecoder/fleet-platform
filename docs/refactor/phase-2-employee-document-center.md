# Phase 2 — Employee Document Center (Centralized)

**Goal:** One centralized store for employee documents (licence, Emirates ID, medical, training, other) with a real upload pipeline and a reusable UI panel surfaced consistently across every related module.

**Scenarios:** S-04, S-12, S-13, S-14, S-52, S-62
**Features:** F-10, F-11, F-12, F-13, F-14, F-15

---

## In scope
- `person_document` table + presigned-URL upload pipeline.
- Reusable `<PersonDocuments>` panel (list, upload, replace, version, expiry chips).
- Surfacing hooks so the same panel appears in booking capture (P5), driver mgmt (P4), profile (P6), and admin.

## Out of scope
- OCR/auto-extraction (out of program). Driver-specific medical/training lifecycle logic (P4 consumes this store).

## DB
- Migration: `fleet.person_document` (§03 1.2) + indexes; classification sensitive. Rollback drops table.
- Seed: add a sample confirmed licence doc for demo employees in `seed-dev.sql`.

## Backend
- New `PersonDocumentsModule` (or extend Identity/Platform):
  - `POST /v1/persons/:personId/documents/upload-url` → issues a short-lived presigned PUT to `person-documents/<personId>/<uuid>.<ext>`; validates content-type/size intent.
  - `POST /v1/persons/:personId/documents` (metadata: type, blobRef, issue/expiry).
  - `GET /v1/persons/:personId/documents`; `POST .../:id/confirm` (Steward); versioning (new upload supersedes prior of same type).
  - Self scope alias `/v1/me/documents*` restricted to the caller's own person.
- Storage abstraction `ObjectStorageService` with an S3/Azure adapter + a **local/dev adapter** (filesystem or MinIO) so it runs without cloud.
- Reuse the existing `blobRef` path-validation discipline; enforce prefix + traversal guards.
- On document create/replace with an expiry, **update the corresponding `person` credential expiry** and set `source='manual'`, `verified=false` (Steward confirm → `verified=true`).

## Frontend
- Reusable `PersonDocuments` component: list with type, version, status, expiry chip (Valid/ExpiringSoon/Expired/Missing), upload + replace via presigned flow.
- Wire into Admin access-management (person detail) first; export for reuse by later phases.

## Contracts / guards
- New DTOs → `guard:contracts:update`; new org-scoped files → `guard:org` allowlist.

## Tests
- BE: upload-url issuance + validation; metadata create/confirm/version; expiry propagation to `person`; RBAC (self vs steward vs admin); path/traversal rejection.
- FE: panel renders list, uploads (mock presign), shows expiry chips; a11y.

## Acceptance criteria
- A document uploaded once is retrievable and appears wherever the panel is embedded.
- Uploading a licence with an expiry updates the person's credential status (Unverified until confirmed).
- Files are private, scoped, size/type-limited; only authorized roles can read.

## Dependencies
P1 (credential fields/status). Enables P4, P5, P6.
