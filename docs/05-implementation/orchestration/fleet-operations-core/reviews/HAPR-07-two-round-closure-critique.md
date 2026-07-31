# HAPR-07 Two-Round Closure Critique

| Field | Result |
|---|---|
| Date | 2026-07-30 |
| Scope | Screens 25-28, Handover evidence/data/API, Booking approval projection, EN/AR/RTL and compatibility |
| Decision | `VERIFIED_NO_BLOCKING_HIGH` |

## Round 1 - Backend, Data and Security

Verified:

- Staged evidence is organization/uploader-bound, expiry-checked and atomically claimed; exact preflight/claim counts are enforced.
- Object keys are generated server-side; image magic bytes, size, dimensions and metadata are validated.
- Open/Return replay resolves before mutable lifecycle/revision checks and preserves immutable result snapshots.
- Lost keys require and persist incident reason/review reference and emit one review event without false Returned custody.
- Completed Handover and child evidence are immutable; corrections append optimistic, replay-safe amendments without updating the original row.
- Migration `0056` backfills only known legacy facts as `LegacyPartial`; it invents no location/photo/signer evidence.
- Approval `evidenceItems` are sourced from eligibility, consent and reservation persistence; requester aggregates are bounded and raw HR/licence/signature/IP/device fields are excluded.
- Hourly evidence cleanup expires unclaimed metadata and retries private-object deletion with contained failures.

Rejected stale findings:

- Missing evidence claim checks: disproved by exact count checks before transition.
- Client-generated/colliding object keys: disproved by server UUID path generation and unique constraint.
- Lost-key reason absent: disproved by migration/schema/service/PostgreSQL test.
- Amendment blocked by completed trigger: amendments are inserts and never bump the immutable Handover row.
- Register status should be materialized: rejected because Fine/key/review signals can arrive later; source-derived query signals remain authoritative.
- Legacy fixed approval summary is a compatibility field only; the current UI renders typed persisted `evidenceItems` and no sensitive data.

## Round 2 - Frontend, Fidelity and Accessibility

Verified:

- `/handover` follows screen 26: filters, historical table, statuses, View/Edit/Locked, page metadata and append-only note.
- Capture follows the demo/screens 27-28: five PASS/FAIL rows, readings, fuel gauge, key outcome, Return condition, carried/new pins, photos, witnessed signature and readiness footer.
- Failed inspections/new damage require note plus staged evidence.
- Camera uses Blob/File output; photos and signatures share bounded three-attempt staging and visible retry state.
- Typed signatures start empty and require interaction; signer and Fleet capture actor remain distinct.
- Dirty navigation uses `useBlocker` and `beforeunload`; explicit Stay/Discard controls prevent silent loss.
- Chain page renders immutable Handover/Return inspections, keys, completeness, receipt and revision-bound amendments.
- Screen 25 renders requester identity/relationship/behavior, four facts, persisted verdict stack, justification, SoD and actions; unavailable cost/forecast remain visible and honest.
- Booking decision reasons are retained per task; Dedicated approval tab behavior remains unchanged.
- EN/AR RTL at 320 and 1440 has no page overflow; physical damage coordinates are not mirrored.
- Sticky capture and approval actions include mobile safe-area padding.

## Executable Evidence

- Backend focused units/contracts: `86/86`.
- PostgreSQL/HTTP Handover + Booking: `26/26`.
- Migration forward/second-run no-op: pass.
- Backend contract manifest, organization guard, typecheck, lint and build: pass.
- Frontend Handover/Approval/shared components: `40/40`; seven unrelated/later todos remain outside HAPR acceptance.
- Frontend typecheck, focused lint and production build: pass.
- HAPR acceptance inventory has no remaining todo.
- Live screen 26, demo-parity Return and LegacyPartial chain inspected against current API.
- Deterministic safe screen-25 contract inspected in EN/AR.
- Desktop/mobile document widths remain within viewport; table scrolling is locally contained.

## Residual Non-Code Dependencies

- Production must register an approved private object-storage adapter for `HandoverEvidenceStore`; local/development uses the private filesystem adapter and higher environments fail closed without an adapter.
- Evidence-cleanup metrics currently log structured counts; operational dashboard/alert thresholds remain release observability work.
- Real telematics freshness depends on the production telematics adapter; missing timestamps remain honestly `STALE`/`UNAVAILABLE` and do not overwrite telemetry.

These residuals do not reopen HAPR code correctness. Production release remains subject to the broader release/UAT/performance/accessibility gates in the master plan.
