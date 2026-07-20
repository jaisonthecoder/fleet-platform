# Phase 1 — Shared Domain Contracts and Data Foundation

## Objective

Freeze the cross-domain contracts and database invariants required before Vehicle Management, Pool Booking or Dedicated Entitlement UI can safely write live data.

## Dependencies

- Phase 0 approved
- Organization hierarchy O0–O6 and policy/workflow foundations
- No UI mockup required; contract review required

## Shared identity and scope

- Every resource carries organization and effective hierarchy scope.
- Principal organization and authorized scope closure are server-derived.
- Person roles are scoped and effective-dated.
- Requester, beneficiary, driver, approver, allocator, handover actor and on-behalf-of person are separate fields.
- Cross-organization references are rejected by composite constraints.
- Vendor, contract, vehicle and hierarchy references carry the same organization; leased vehicles cannot reference cross-org vendors/contracts.

Organization consistency uses composite unique keys/FKs or validated triggers, not application-only checks. Every repository method accepts organization from authenticated Principal/context; client-provided organization is ignored.

## Shared lifecycle contracts

- Vehicle lifecycle and operational status are distinct.
- Booking-pool inclusion is independent of lifecycle but constrained by lifecycle/body type/compliance.
- Booking, entitlement, handover and workflow states use stable enums/codes.
- History is append-only; current tables are projections.
- Vendor, contract, renewal, discrepancy and off-hire lifecycles use stable states and immutable approved versions.
- Effective dates/timezone and concurrency revision are explicit.

## Shared evidence/provenance

- Policy requested/resolved scope, immutable version IDs, matched row, reasons and fact fingerprint.
- Workflow definition/deployment/version and task actor/delegation.
- Audit correlation ID and outbox event ID.
- Consent version, language, timestamp, driver, vehicle/category/window, device/IP/signature reference.
- Raw sensitive facts are not stored in shadow-comparison evidence.

## Time and effective-date semantics

- Store all instants as `timestamptz` UTC. API instants are ISO-8601 with offset/`Z`.
- Date-only business boundaries (lease day, BSD day, expiry day) are interpreted at 00:00 in the organization's configured IANA timezone and converted to UTC once.
- Booking/recurrence retains the generating timezone; DST behavior is tested even though UAE currently has no DST.
- Effective ranges are half-open `[from,to)` unless a business rule explicitly says otherwise.
- Historical queries use the scope/contract/policy version effective at event time; later hierarchy/term changes never rewrite past attribution.

## Transaction, concurrency and idempotency model

- Do not rely on a pre-check alone. Booking overlap remains enforced by PostgreSQL GiST exclusion on active reservation ranges.
- Dedicated allocations, maintenance windows, vehicle assignments/device pairing and other exclusive effective ranges use DB exclusion/unique constraints plus transaction retry/error mapping.
- State commands lock the aggregate row (`FOR UPDATE`/advisory lock as appropriate), validate revision/state, write projection + append-only event + audit + outbox in one transaction.
- Use the repository's normal transaction isolation plus structural constraints for booking; use serializable/advisory locking only where cross-row invariants require it. Blanket SERIALIZABLE is not required.
- Every externally retryable command (create/submit/approve/allocate/transfer/off-hire complete/return/import/source event) has an idempotency key and durable result/command ledger. Duplicate retries return the original result; keys are scoped by organization+endpoint+actor.
- State-machine command matrices define allowed source/action/target and stable conflict reasons.

## Database invariants

- Vehicle VIN/chassis and organization+plate uniqueness.
- Effective vehicle hierarchy assignment has no overlaps.
- Booking active reservation ranges do not overlap for a vehicle.
- Consent/booking number/allocation atomic gates.
- Dedicated allocation prevents conflicting active entitlements.
- Device pairing, substitute-driver and BSD windows do not overlap illegally.
- Cross-table organization consistency.
- Active leased vehicle references exactly one Active lessor and one effective lease contract; contract vehicle windows cannot overlap.
- Approved vendor/contract terms and source invoice lines are immutable; corrections append versions/events.
- Vendor external IDs, TRN/trade licence and contract references follow approved organization/jurisdiction uniqueness rules.
- Append-only state/evidence tables protected against mutation where required.

Explicit append-only candidates: consent/lifecycle events, booking/entitlement/workflow events, hierarchy/vendor/contract/off-hire/handover evidence, decision/comparison logs, audit chain, source-ingest evidence and immutable contract/policy/workflow versions. Enforce through no-mutate triggers and/or restricted DB role; tests attempt UPDATE/DELETE and expect rejection. Mutable projections/drafts use revision locking.

## Hierarchy and external master contracts

Reuse the approved Organization O0–O6 contracts: stable node codes, effective N-level paths, authorized closure and historical attribution. HCM owns employee/status/manager/leave facts through its adapter and freshness SLA. Unavailable/stale HCM data follows decision-specific fail-safe behavior; UI shows source freshness, never assumes eligibility.

## Policy/workflow provenance contract

Reuse the approved Decision/Workflow platform. Every domain decision stores organization, requested/resolved scope, decision key, immutable policy rule/version/deployment, matched row, reasons, effective/evaluated time, facts fingerprint, selector mode/source and correlation. Every workflow instance stores immutable definition/deployment/version, organization/scope, subject, correlation and task actor/delegation. Shadow evaluation is effect-free; domain effects execute once after the authoritative decision.

## Consent evidence contract

- Legal-approved template/version and language.
- Requester/beneficiary/driver/vehicle/category/window and linked transaction.
- Authenticated person/session, timestamp, IP/device metadata where approved, signature/reference and evidence/document hash.
- Consent number and reservation/workflow submission commit atomically with audit/outbox.
- Verification/replay API lets Internal Audit prove the evidence hash/template/version without exposing secrets.
- Retention and acceptable signature assurance are Legal/Privacy gates; touchscreen signature alone is not automatically claimed as strong identity proof.

## Audit, outbox and notification guarantees

- Projection/event/audit/outbox commit in one DB transaction; failure rolls back all.
- Hash-chain audit is append-only and partitioned by organization sequence.
- Outbox delivery is at-least-once; consumers deduplicate by message/idempotency key. Retries use bounded exponential backoff; exhausted work enters DLQ with owner/runbook/replay evidence.
- Notification delivery is at-least-once with channel-specific dedupe, mandatory/optional classification, locale and suppression rules. It never controls domain correctness.
- Retention/archival periods are configured only after Legal/Records approval; no destructive job ships before that decision. Evidence keeps retention class and `retention_until` where required.

## Sensitive-field authorization

Define a field-level response matrix, enforced server-side:

- Finance: approved cost/AP/FX/payment fields; bank data only in dedicated Finance DTOs.
- Procurement: vendor/contract terms and costs, excluding bank secrets and per-driver recovery.
- Fleet roles: operational status/utilization/compliance for authorized scopes; cost only where explicitly approved.
- Insurance/HSE/HR: only role-owned evidence.
- Employee/Driver: own booking/allocation/consent and permitted vehicle availability; no commercial or other-person data.
- Internal Audit: approved read-only evidence; sensitive access is itself audited.

## Base observability contract

Every command/evaluation emits correlation, organization/scope, outcome/reason, latency and degraded-mode indicators without raw sensitive facts. Each phase names dashboards, alert thresholds, owner and runbook before cutover.

## API conventions

RFC-7807 errors with stable reasons; Zod/class-validator input schemas; optimistic revisions; idempotency keys for commands; typed pagination/filtering; correlation IDs; server-side authorization; no direct `fetch` in React components.

External systems are accessed only through ports/adapters. Source field provenance (`sourceSystem`, `externalId`, `sourceRevision`, `syncedAtUtc`, freshness) is explicit. OCR values are proposals until human-confirmed. Secrets and bank data never enter general DTOs/logs.

## Frontend foundations

Typed contracts, TanStack Query keys, route guards, scope-aware caches, unsaved-change protection, shared state/status/empty/error patterns, EN/AR/RTL, 44px targets, keyboard operation and real-browser validation.

## Tests

Schema/migration fresh+upgrade+rollback; property tests for state machines; cross-org/scope tests; concurrency and idempotency; contract drift; audit/outbox atomicity; accessibility foundations.

Also verify UTC/org-timezone boundaries, DST recurrence, immutable-table mutation rejection, DLQ/replay/dedup, retention-job dry run, field-level masking, HCM/source freshness and decision/workflow provenance completeness.

## Rollback

Only additive storage/contracts until consumers cut over. Compatibility adapters remain until final cutover; never rewrite historical evidence.

## Mandatory critique

Look for overloaded actor IDs, implicit scope, silent defaults, nullable audit fields, non-atomic consent/allocation, cross-org leakage and UI/backend schema divergence.

## Exit gate

Shared contract matrix, invariants, reason codes, state machines and migration sequence approved by DB/BE/FE/Security/QA.
