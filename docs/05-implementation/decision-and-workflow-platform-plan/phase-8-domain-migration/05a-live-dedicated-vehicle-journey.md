# 8.5A - Live Dedicated Vehicle Journey

## Objective

Replace the placeholder/static entitlement experience with production-backed Wayfinder journeys for dedicated vehicle request, eligibility, approval, driver consent, allocation, lifecycle management and BSD return-to-pool.

This is not a trip booking variation. It is an effective-dated entitlement/allocation lifecycle governed by `dedicated-vehicle-eligibility`, `entitlement-approval-chain`, mandatory consent and organization hierarchy scope.

## Owners and dependencies

- Primary: Entitlement Backend and React Frontend owners
- Contributors: HR, Fleet Operations, Cluster CEOs, Legal, Finance, Workflow, QA, UX
- Depends on: 8.5 backend policy/workflow migration, live organization hierarchy, vehicle master and compliance eligibility gate
- Human gates: D3 justification categories, D8 eligibility criteria, request-axis clarification and professional-driver scope

## Source requirements

- PRD C3 / FR-DVR-01 through FR-DVR-13 in `docs/startup-doccs/02_Fleet_Management_Platform_PRD_v3.0.md`.
- Phase 1 M5 in `docs/startup-doccs/03_Phase1_MVP_PRD_ADPorts.md`.
- Consent and D1 Entitlement Decision in `docs/startup-doccs/07_Page_Functional_Specifications.md`.
- Shared workflow/SoD rules in `docs/03-architecture/deep-dives/04_approval-workflow-engine.md`.
- Attached dedicated-vehicle mockup is visual/information-hierarchy reference only and must remain unchanged.

## Business journeys

### Employee self-request

1. Open Dedicated Vehicle.
2. Choose duration mode: Long-term or Temporary.
3. Choose driver mode: With driver or Without driver.
4. Enter dates/duration, organization location, business unit, cost centre, justification category and detailed justification.
5. Attach supporting evidence where required.
6. Run eligibility using authoritative HR/person facts and organization scope.
7. Review eligible vehicle classes/options and estimated cost.
8. Create Draft and submit to approval.
9. Track approval chain and remediation/modification requests.
10. Assigned driver signs versioned digital consent.
11. Fleet Manager allocates a specific eligible vehicle.
12. Request remains visible through allocation, expiry, cancellation, return and BSD windows.

### Fleet Manager on-behalf request

A Fleet Manager, Cluster Fleet Lead or Group Fleet Lead may create a request for an active person within their authorized hierarchy closure. The authenticated actor is recorded separately from the requester and assigned driver. The requester may not approve their own entitlement.

### With-driver allocation

The request captures a professional driver separately from the requester. Driver identity, licence/employment/contract status and organization authorization are checked through the common eligibility gate. Consent is signed by the assigned driver before allocation.

### Approval and senior decision

Configured workflow routes may include Line Manager, Cluster Fleet Lead and Cluster CEO. The decision view shows requester context, concrete ask, eligibility evidence, route reason, prior decisions, policy version/scope, justification, attachments and cost comparison.

### BSD return-to-pool

Confirmed leave/absence windows temporarily make an allocated dedicated vehicle bookable to the shared pool, then automatically restore the dedicated assignment at window end. Proposed, confirmed, cancelled and completed states are auditable.

## Business decisions that must not be guessed

1. **Request axes:** Model Long-term/Temporary and With-driver/Without-driver as separate fields, not one mutually exclusive enum. Existing enum is a compatibility input only.
2. **D3 justification categories:** Seed a governed reference-data type from approved categories: operational requirement, executive assignment, project support, site visits, temporary replacement and emergency operations.
3. **D8 eligibility:** HR and Cluster CEOs own grade, role, tenure, duration and cluster exceptions. The current `grade exists` proxy is not production eligibility.
4. **D13/D15 personal use and recharge:** Explicitly deferred unless HR/Finance/Legal approve the policy and recovery integration.
5. **D16 professional drivers:** Required if With-driver remains Phase 1 scope; otherwise With-driver is capability-disabled with a visible governance reason.
6. **Extensions:** Decide whether extension is a new request or a modification with re-approval.
7. **D14 utilisation:** Finance/Fleet Operations approve the calculation and under-utilisation threshold.

## Backend and database changes

### Entitlement model

Replace the overloaded `request_type` meaning with additive fields:

- `duration_mode`: `LongTerm | Temporary`.
- `driver_mode`: `WithDriver | WithoutDriver`.
- `professional_driver_person_id` nullable and required for WithDriver.
- `requested_by_person_id` separate from `requester_person_id`.
- `organization_id`, `location_node_id` and effective scope validated by composite FKs.
- `eligibility_provenance` and `approval_route_provenance` stored separately.
- `workflow_definition_version_id` / pinned workflow deployment.
- `modification_comment`, `extension_of_entitlement_id`, `periodic_review_due_at` as approved.
- Add append-only `entitlement_policy_decision` evidence equivalent to Booking decision history.

### Lifecycle

Support and validate:

```text
Draft
-> PendingApproval
-> ModificationRequested -> Draft/resubmit
-> Approved
-> AwaitingConsent
-> Allocated
-> Returned/Expired/Cancelled
```

Published workflow instances remain immutable. Resubmission starts a new pinned cycle while retaining prior workflow evidence.

### Request authority

- Employee: self-request only.
- Fleet Manager/Cluster Fleet Lead/Group Fleet Lead: on-behalf within managed scope.
- System Admin: configuration only; structurally blocked from operational submission/approval per SoD-05.
- Requester, actor and assigned driver organization/scope must agree.

### APIs

- `GET /api/v1/entitlements/request-context` - self/on-behalf authority, defaults and capability flags.
- `GET /api/v1/entitlements/people?search=&scopeId=` - scoped active requester/driver picker.
- `GET /api/v1/entitlements/justification-categories` - governed reference data.
- `POST /api/v1/entitlements/eligibility-preview` - side-effect-free typed eligibility + eligible classes/options.
- Existing create/get/list/submit endpoints updated to bind actor and organization server-side.
- `PATCH /api/v1/entitlements/:id` for Draft/ModificationRequested edits with revision.
- `POST /api/v1/entitlements/:id/request-modification` for workflow outcome.
- `GET /api/v1/entitlements/:id/decision-evidence` for approval UI.
- Existing consent/allocate endpoints hardened for assigned driver and authorized Fleet Manager scope.
- BSD APIs: propose, confirm, update/cancel and close/revert.
- Attachment APIs use immutable object storage references, validated type/size and malware scanning.

### Eligible vehicle options

Use vehicle master, assignment model, lifecycle/compliance status, organization scope and PDP eligibility output. Dedicated vehicles are excluded from normal booking pools except during confirmed BSD windows.

### Cost and utilisation evidence

Expose a computed read model for monthly lease/depreciation, insurance, expected fuel/tolls, request-duration total and pool alternative. Do not calculate commercial rules in React.

## Frontend routes and pages

### `/{lang}/entitlements`

Employee request list with Draft, Pending Approval, Modification Requested, Approved, Awaiting Consent, Allocated and terminal states. Actions depend on status and actor authority.

### `/{lang}/entitlements/new`

Mockup-aligned request form with:

- Long-term/Temporary segmented control.
- With-driver/Without-driver segmented control.
- Requester picker shown only for on-behalf authority.
- Professional-driver picker when With-driver is enabled.
- Duration/date range.
- Organization hierarchy location picker.
- Cost centre and business unit.
- Governed justification category and detailed text.
- Attachments.
- Eligibility check and eligible vehicle/class results.
- Review and Submit action.

### `/{lang}/entitlements/:id`

Requester lifecycle view showing ask, decision reasons, approval progress, modification comments, consent requirement, allocation and BSD windows.

### `/{lang}/approvals`

Unified approval inbox for Booking and Entitlement tasks. Entitlement evidence includes policy trace, scope/version, requester context, justification, cost and prior approvals.

### `/{lang}/entitlements/:id/decision`

Cluster CEO/senior approver view matching D1 page specification with Approve, Request Modification and Decline outcomes. Modified-duration approval requires a governed command and refreshed evidence, not client-only mutation.

### Fleet Manager allocation/BSD administration

Fleet Manager can select an eligible vehicle, assign professional driver, capture consent status, allocate, schedule/confirm BSD return windows and see automatic reversion status.

## UI states

- Initial/loading and field-level validation.
- Eligibility checking, allowed, denied, stale-facts and service unavailable.
- No eligible vehicles.
- Draft saved and revision conflict.
- Pending approval with SLA/step status.
- Modification requested with approver comment.
- Approved awaiting driver consent.
- Consent mismatch or expired consent version.
- Allocation conflict/compliance block.
- BSD proposed/confirmed/active/completed/cancelled.
- Access denied and no authorized on-behalf scope.
- Empty list, API error/retry and offline/degraded states.

## Accessibility, i18n and responsive behavior

- EN/AR copy and stable localized reason codes.
- RTL segmented controls, forms, steppers and decision dock.
- Keyboard-operable requester/location/vehicle pickers.
- Consent uses a full-attention accessible dialog/sheet and cannot be skipped.
- Status is never communicated by color alone.
- Mobile uses step-by-step form sections; desktop may use the mockup’s constrained form and evidence panel.
- No visible instructional text about implementation or keyboard shortcuts.

## Tests

### Backend

- Self vs. authorized on-behalf submission.
- Cross-organization/scope denial.
- Orthogonal duration/driver combinations.
- D8 allow/deny/stale/missing facts and scoped inheritance.
- Separate eligibility/route provenance and append-only history.
- SoD-02/SoD-05, delegation, timeout, no approver and modify/resubmit.
- Consent actor/version/vehicle change and allocation-before-consent denial.
- Professional-driver eligibility.
- BSD propose/confirm/auto-open/auto-revert/cancel concurrency.
- Attachment validation and audit.
- Selector modes, shadow comparison, rollback and side effects exactly once.

### Frontend

- Request form combinations and conditional fields.
- Scoped on-behalf picker.
- Eligibility result/remediation states.
- Draft/edit/resubmit lifecycle.
- Approval inbox and senior decision controls.
- Consent and allocation states.
- BSD management.
- EN/AR, RTL, keyboard, axe and responsive layouts.

### End to end

- Employee self-request through allocation.
- Fleet Manager on-behalf request.
- With-driver request and professional-driver consent.
- Eligibility denial.
- Modification request/resubmit.
- Cluster CEO threshold route.
- BSD return and automatic reversion.

## Rollout and rollback

1. Request form/live Draft only.
2. Eligibility in shadow, then controlled scope canary.
3. Approval workflow canary for new requests only.
4. Consent/allocation and BSD administration.
5. Senior decision and operational evidence UI.
6. Notifications and reporting.

Rollback returns new submissions to legacy selector/workflow. Existing pinned requests continue on their recorded workflow/version unless explicitly migrated. Additive data, consent and audit evidence are never deleted.

## Critique checklist

Check request-axis modeling, authoritative HR facts, actor/requester/driver separation, cross-scope access, System Admin SoD, consent ownership, duplicate workflow/effects, provenance overwrite, attachments security, cost accuracy, professional-driver attribution, BSD race/reversion, RTL and mobile form usability.

## Exit gate

8.5A passes when employee self-request, scoped Fleet Manager on-behalf request, eligibility, approval evidence, consent, allocation and BSD lifecycle run end-to-end against live APIs; no static entitlement data remains; request axes and professional-driver scope are approved; all critical/high critique findings are closed.
