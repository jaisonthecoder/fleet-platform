# DEDICATED-01 - Request, Eligibility, Preference and Draft

> **Status:** `VERIFIED_CONFIGURED_ELIGIBILITY`

## Implemented partial slice - 2026-07-25

- Owner Drafts can be reopened and edited through strict `PATCH /v1/entitlements/:id`.
- PATCH is Principal/organization/owner/scope bound, requires `expectedRevision` and durable `Idempotency-Key`, and records audit/outbox in the command transaction.
- Material edits clear stale eligibility, policy/route provenance and preferred Vehicle while preserving the optional preference note unless changed.
- My Requests exposes Edit Draft; EN/AR four-step guidance shows Details active and Eligibility visibly policy-pending.
- Revision conflicts preserve entered values and provide localized refresh guidance.
- Unit 25/25, PostgreSQL 4/4 and frontend 5/5 pass; production build and responsive EN/AR browser evidence pass.
- Three independent critique rounds report no unresolved Blocking/High finding for this bounded slice.

## Completed configured eligibility - 2026-07-25

- Manual D3 categories and Vehicle classes are editable in the existing Reference Data administration page; no external HCM dependency is required.
- Manual D8 direct-fact rules, simulation, versioning and activation are editable in the existing Policy Studio; the active baseline is deny by default.
- Eligibility preview persists opaque 15-minute evidence bound to organization, requester, location, policy version, request fingerprint, permitted classes and bounded eligible Vehicle IDs.
- Draft create/update requires current matching `ALLOW` evidence. A preferred Vehicle is accepted only when present in that evidence; the preference creates no hold or allocation.
- Safe Vehicle options are scope-bound and exclude active overlaps, Vendor health holds, inactive/non-pool Vehicles, and registration or insurance that expires before the requested period ends.
- React now uses bilingual governed category/class dropdowns, live ALLOW/DENY/error/empty states, optional eligible-Vehicle selection and preview-backed create/update in EN/AR RTL.
- Submission, WithDriver, consent and allocation remain fail closed for later phases.

Validation: migrations `0047`/`0048` forward and idempotent; backend focused 31/31; PostgreSQL 5/5; frontend 5/5; backend/frontend builds pass; live EN/AR mobile has no horizontal overflow; Reference Data and Dedicated Policy Studio render with the seeded values/rules.

Residual risks: preview availability is a non-reserving snapshot and may change before allocation; DEDICATED-03 must requalify and enforce exclusivity. Preview evidence needs scheduled retention cleanup before production scale.

## Objective

Deliver the live Employee Dedicated Vehicle request through an idempotent Draft and side-effect-free eligibility preview, including optional non-binding Vehicle preference.

## Entry Criteria

- DEDICATED-00 contracts and migrations verified.
- D3 justification categories and D8 eligibility policy approved for production; otherwise eligibility and submit remain fail closed.
- Screen 22 composition and derived states approved.
- D16 either approved or WithDriver visibly capability-disabled.

## Business Form Flow

1. Choose Long-term or Temporary.
2. Choose Without driver; show With driver only when D16 capability is enabled.
3. Enter dates, location, business unit, cost centre, justification category and detailed justification.
4. Add approved supporting evidence when required.
5. Run eligibility preview using authoritative HR/person/scope facts.
6. Show Allow/Deny/Escalate, localized reasons, permitted classes, approval-route preview where available and safe remediation.
7. Select a permitted class.
8. Optionally select one currently eligible Vehicle from a bounded dropdown.
9. Optionally enter a preference note up to 500 characters, for example `I'd prefer a Toyota Fortuner if available` or `Left-hand drive preferred - driving on E11`.
10. Display `Preferences are not guaranteed. Fleet makes the final allocation after approval and consent.`
11. Save exactly one Draft with pinned eligibility evidence and original preference.

## Backend Work

- Add context, governed justification lookup and side-effect-free eligibility-preview APIs.
- Eligibility input includes authoritative grade/role/employment/tenure, duration, scope, driver mode and approved exceptions; never hard-code thresholds in React/service branches.
- Return permitted classes and bounded Employee-safe `eligibleVehicleOptions`: ID, make/model, class, fuel and safe location only.
- The options projection creates no hold and excludes VIN, Vendor/lease, cost, compliance evidence and other-person facts.
- Validate optional preferred Vehicle against preview scope/class/effective window and optional note length.
- Create/update Draft with revision and durable idempotency; pin policy version/scope/fact fingerprint.
- Material form changes invalidate stale eligibility and preferred Vehicle while preserving the preference note for review.

## Frontend Work

- `/dedicated-vehicle` uses the same shell and white tab band: `Request a vehicle` and `My requests`.
- Four-step request guidance: Details, Eligibility, Review, Submitted.
- Use shadcn controls, TanStack Query and EN/AR catalogs.
- Render loading, denied, escalated, stale facts, no eligible classes/options and service-unavailable states.
- Preferred Vehicle dropdown and preference note are optional and clearly non-binding.
- Never display an exact cost or recommendation unless returned by a verified server read model.

## Tests and Evidence

- All duration/driver combinations and D16 disabled state.
- D8 boundaries, stale/missing facts, cluster exception, deny/escalate and fail-closed outage.
- Empty/valid/stale/foreign-scope preferred Vehicle and note 0/500/501 characters.
- Same-key Draft replay and revision conflict.
- EN/AR, RTL, keyboard, axe and responsive 320/768/1024/1440.

## Three Critique Rounds

### Round 1 - Contract, Security and Data

Review eligibility input/output minimization, HR privacy, scoped options, preference storage, XSS-safe note rendering and idempotent Draft. Repair and rerun contract/HTTP tests.

### Round 2 - Behavior and Policy

Walk every duration x driver x eligibility x preference scenario, stale facts and material edits. Challenge guarantee wording and class/Vehicle confusion. Repair and rerun service/component/E2E tests.

### Round 3 - UX and Accessibility

Compare against screen 22; review form density, reason clarity, disabled capabilities, optional-field semantics, mobile progression, Arabic RTL and keyboard behavior. Repair and capture browser evidence.

## Exit Gate

An authenticated Employee can create exactly one scoped Draft backed by approved eligibility evidence, with an optional non-binding preferred Vehicle/note. No approval, consent, reservation or allocation is implied.
