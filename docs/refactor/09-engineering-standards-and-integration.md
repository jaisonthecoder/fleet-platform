# Engineering Standards & Integration (app-specific)

Every phase in this program **must** follow the patterns already established in this codebase. This document is the checklist reviewers apply to each PR. It exists because the plan's phase files describe *what* to build; this describes *how* to build it so it fits Wayfinder.

---

## 1. Reuse what already exists (do not reinvent)

| Need | Reuse this | Where |
|---|---|---|
| Private file storage/upload | **Evidence-store port + local disk adapter** | `modules/handover/internal/evidence-store.port.ts`, `local-evidence.store.ts`; Azure Blob env already in `config.schema.ts` (`STORAGE_*`) |
| Feature flag / optional integration | **Config namespace pattern** | `hcmConfig` (`common/config/hcm.config.ts`), `identityConfig`; `boolFromEnv` + `registerAs` + inject `KEY` |
| Access blocks (raise/lift) | **ComplianceService.raiseBlock** + `access_block` | `modules/compliance` (`raiseBlockSchema`, controller) |
| Fines / black points / recovery | **FinesModule** (`fine` status machine) | `modules/fines` (`Recorded→Attributed→Disputed→Recovered→Closed`, auto-raises block on overdue black points) |
| Consent records | booking `consent_record`, entitlement consent | `modules/bookings`, `modules/entitlements` |
| Directory search | `bookablePeople`, `listProfessionalDrivers` | `modules/bookings`, `modules/entitlements` |
| Bulk import | **MigrationModule** | `modules/migration` (steward-gated import) |
| Notifications | **NotificationService + port** (compliance category is unmutable) | `common/notifications` |
| Dashboards/analytics | **DashboardsModule** (cost masking, activeBlocks count) | `modules/dashboards` |
| Scheduled jobs | `@Cron` workers | e.g. `workflow-sla.worker.ts`, `*-retention.worker.ts` |

---

## 2. Write-path conventions (mandatory for all new mutations)

1. **Idempotent commands.** Every state-changing endpoint takes an idempotency key and de-dupes via the command table pattern (see `BookingService.signConsent`/`submit`, `EntitlementService`). New writes (credential update, document add, driver onboard/assign, dispute) follow the same claim/replay/complete pattern.
2. **Transactional side effects.** Persist + emit within one `repo.transaction(...)`. Never write the row and emit outside the tx.
3. **Outbox events.** Domain changes enqueue to the **transactional outbox** (`this.outbox.enqueue({ aggregateType, aggregateId, eventType, payload })`) — at-least-once, DLQ-safe. New aggregates: `person-credential`, `person-document`, `driver-assignment`.
4. **Audit, append-only.** Record every sensitive read/write via `AuditService.record({ actorRef, action, entityRef, before?, after? })`. Credential/document access is audited (PII).
5. **Optimistic concurrency.** Use `expectedRevision`/`stateVersion` guards where an aggregate can be edited concurrently (mirror booking/entitlement `revisionConflict`).
6. **RFC-7807 errors with stable reason codes.** Throw `{ title, reasons: [code] }`; never leak internals. Codes are localized on the client (see §5).

---

## 3. Policy-driven, not hard-coded (leverage the PDP / Policy Studio)

Credential/eligibility **requirements should be policy facts**, not constants, wherever they vary by grade/scope:

- Extend `POLICY_FACT_CATALOG` (`contracts/policy-authoring.contract.ts`) with facts like `emiratesIdRequired`, `licenceVerificationRequired`, `medicalRequired` (driver).
- The eligibility gate keeps **structural hard blocks** (expired/missing licence, expired vehicle docs, active block) in code (fail-safe, no override), but **configurable requirements** (e.g. "EID required for grade ≥ X", "medical required for professional drivers") go through the **`driver-eligibility-gate`** decision table so admins tune them in Policy Studio without a deploy.
- This resolves the "EID block would mass-block" risk: default the policy to **warn**, opt-in to **block** per scope.

---

## 4. RBAC & SoD

- Gate new endpoints with `@Roles(...)` using existing role names (`SystemAdmin`, `DataSteward`, `FleetManager`, `ClusterFleetLead`, `GroupFleetLead`, `HSE`, `InternalAudit`, `ProfessionalDriver`, `Employee`).
- Self-service endpoints (`/v1/me/*`) are scoped to the caller's `personId` only.
- Respect **SoD** (`platform/internal/sod-rules.ts`): e.g. the person who enters a credential should not be the sole verifier where segregation applies; a driver cannot lift their own block; steward-verify is distinct from self-entry.
- Add new org-scoped files to `scripts/guard-organization-id.mjs` allowlist.

---

## 5. Messaging & i18n (never show raw codes)

- i18n EN/AR is the **always-present default** for every reason/label. The optional **reason catalog** (P8) overlays admin copy but is never a hard dependency.
- Add new keys to `app-ui/src/i18n/locales/{en,ar}.json`; verify RTL.
- Booking/dedicated surfaces the **most-specific** appended reason (fixed in P1a), with a remediation affordance.

---

## 6. Data protection (PII + UAE residency)

- Licence, Emirates ID, medical docs, fines detail = **sensitive personal data**. `DATA_REGION=uae-north` — keep storage in-region; do not export.
- Exclude from safe list/read projections and logs (extend the discipline in `bookings/repositories/bookings.repository.ts` which forbids raw licence/HR).
- Define **retention** per document type and add a **`@Cron` retention worker** (mirror `handover-evidence-retention.worker.ts`, `entitlement-preview-retention.worker.ts`).
- Uploads: private, short-lived presign/local-disk, path-scoped (`person-documents/<personId>/...`), size/type-limited.

---

## 7. Testing & gates (per PR)

- BE: unit (`*.spec.ts`) + integration (`*.int-spec.ts` via `createCoreHierarchyFixture`, real DB/Redis) for new gates/lifecycles.
- FE: Vitest + RTL + MSW; a11y; EN/AR.
- Run: `pnpm typecheck` (BE+FE), `pnpm lint`/`oxlint`, `pnpm guard:org`, `pnpm guard:contracts` (`:update` for new DTOs), hand-authored migration **+ rollback**, `git diff --check`.
- Update **existing** specs impacted by gate changes (e.g. `eligibility-rules.spec.ts`, `vehicle.controller.spec.ts` exact-arg assertions).

---

## 8. Rollout & flags

- Every behaviour-changing gate ships behind a **config flag** (default = current behaviour) using the `boolFromEnv` + config-namespace pattern.
- Backfill migrations covered by a **migration test** (`scripts/migration-test.mjs`).
- `dev:bootstrap` seeds a working demo state (extend seed with sample documents/driver profiles) and stays idempotent; keep `refresh-demo-booking-people.mjs` working (or fold its intent into the HCM-off freshness path — already done in P1a).
