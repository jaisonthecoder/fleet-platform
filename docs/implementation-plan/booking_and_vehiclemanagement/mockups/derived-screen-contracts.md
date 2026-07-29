# Approved Derived Screen Contracts

> **Status:** Approved for phased implementation on 2026-07-21.
> **Purpose:** Define business-required screens not supplied as separate PNGs precisely enough that implementation does not invent behavior. These contracts do not authorize fake data or bypass missing backend operations.

## Global Rules

- Render page content inside the existing application shell. Do not implement shell chrome or a role switcher from the mockups.
- English and Arabic use the same component tree. Use URL locale, translated catalogs, logical RTL properties, `<bdi>` for identifiers and locale-aware `Intl` formatting.
- Responsive evidence is required at 320, 768, 1024 and 1440. Tables may become labelled rows/cards below 768; actions remain at least 44px.
- Loading uses structure-shaped skeletons; empty states name the next permitted action; errors show a stable reason and remediation; permission denied never exposes hidden data.
- External integrations without a verified adapter render `Future integration` or `Unavailable`, never a simulated success status.
- If a required API operation below is absent, implement and verify the backend operation first. The UI must not use hardcoded production data, a silent no-op or a false success toast.

## External Integration Display Override

This contract overrides status badges visible in prototype screen `07` until environment evidence proves otherwise:

| Prototype integration | Current display | Enabled only when |
|---|---|---|
| Oracle Fusion Procurement sync (I3) | `Future integration` | Signed adapter contract, connectivity and reconciliation evidence pass |
| Finance AP invoice feed (I2) | `Future integration` | Signed adapter contract and real invoice conformance evidence pass |
| Document OCR pipeline | `Future integration` | OCR region/privacy approval and extraction validation pass |
| Vendor portal | `Future integration` | Partner identity, contract isolation and security tests pass |

Manual capture, upload and review remain the operational fallback. A disabled future option explains its dependency; it does not block unrelated manual onboarding.

## Booking Consent Sheet and Confirmation

### Traceability

- Phase: B2 Availability, Eligibility, Consent and Submission.
- Actors: authenticated driver; Fleet Manager may create an on-behalf draft but cannot consent for the driver.
- APIs: create Draft, sign consent, submit booking. Backend prerequisites: scoped booking context/people API and authenticated-driver enforcement on consent.

### Consent Sheet

Opened after a vehicle is selected and a server Draft exists. Display:

- driver and requester/on-behalf actor;
- vehicle make/model/plate/category;
- pick-up, return and destination;
- consent language and immutable template version;
- policy/decision version reference and material-change warning;
- explicit agreement control and signature/confirmation action.

The primary action is `Sign consent and continue`. While committing, disable dismissal and duplicate submission. On success the server returns the immutable consent reference and booking number/reservation. On failure no number or confirmed state is displayed. If the selected vehicle/window/driver changes, invalidate the sheet and reload the applicable consent.

Consent version is server-authoritative. The Draft/context response supplies the applicable template/version and content hash. The consent command submits that version; inside the commit boundary the server re-resolves the effective version. A mismatch returns stable `409 consent-version-changed` with the replacement version and no consent/number/reservation side effect. The client replaces the sheet content, moves focus to the change notice and requires a fresh explicit agreement. Polling or a background policy watch is not required.

### Confirmation

After consent and submit, show persisted status, booking number, vehicle/window, next approval step, Fleet handover guidance, calendar action and My Bookings link. A pending booking is labelled `Pending approval`; emergency bookings are `Confirmed - post-review required` only after consent and server confirmation. Never infer status from the client sequence.

### Failure States

- Eligibility denial: show specific safe remediation reason and owner from Phase B2.
- Vehicle conflict: show stable 409 message, refresh availability and preserve the search input.
- Policy/consent version changed: reload text and require a new explicit agreement.
- Consent/submit timeout: query the existing booking before retrying; never create a second draft/workflow.

## My Bookings

### Traceability

- Phase: B4 My Bookings, Changes and Completion.
- Actors: employee owns their bookings; scoped operational roles may use separate operations views.
- Backend prerequisite: scoped `GET /bookings` list/filter endpoint and owner-authorized detail/events. Existing modify, extend and cancel commands remain server-authorized.

### Views

- `Upcoming`: Draft, Pending Approval and Approved.
- `Active`: Active trip with expected return and Return/Handover status.
- `Past`: Completed, Declined, Cancelled, Expired and No Show.

Each row/card displays number/status, vehicle, window and next required action. Detail includes immutable consent/policy references and event history appropriate to the actor.

### Actions

- Draft/Pending Approval: modify; material changes return to Draft and require re-consent.
- Approved before handover: cancel when server permits.
- Active: request extension; a downstream conflict shows mediation, not false success. Early return opens the Return workflow.
- Terminal: read-only.

Actions render only when allowed by current server state, but the backend remains authoritative. A 409 refreshes the projection and explains the new state.

Materiality is never calculated in React. The Booking service evaluates the governed `consent-re-consent-tolerance` decision at modification time. Vehicle or driver change is always material; window changes follow the effective policy tolerance. The server response/status and consent linkage determine whether the UI opens re-consent. No minutes/hours threshold is embedded in the client.

## Dedicated Vehicle D1-D2

### Eligibility Result

After request creation/submit, show request evidence and one of:

- `Eligible - pending approval`, with route steps and expected approver;
- `Action required`, with safe reason, source freshness and remediation owner;
- `Unable to evaluate`, fail-safe blocked with retry/escalation.

Do not expose private HR facts beyond the approved reason contract.

### Approval Decision

Master-detail layout follows the Booking approval evidence pattern: requester, request type/duration/location/cost centre, policy verdict, endorsements, justification and immutable workflow step. Approve, request change and decline remain SoD- and assignee-gated. Backend prerequisite: request-change support if absent from the current entitlement API.

### Driver Consent

After final approval and before allocation, show the assigned driver, entitlement window, vehicle class and versioned consent. The actual driver signs; Fleet Manager cannot substitute their identity.

### Allocation

Fleet Manager sees only scoped, compliant, compatible and unallocated vehicles. Selection revalidates on commit. On success show the allocated vehicle, effective window, consent reference and return/review schedule. A conflict refreshes candidates and preserves the request.

### BSD and Lifecycle

Entitlement detail shows Active allocation, scheduled/active/completed BSD windows, utilization review, expiry, renewal request, cancellation and return. BSD calendar cannot create overlaps or exceed the allocation range. Early beneficiary return is blocked while a pool booking/handover is active and routes to Fleet Manager mediation.

Backend prerequisites before claiming complete D2: scoped list/detail authorization, immutable workflow versioning, exclusive allocation concurrency, BSD scheduler/read model, utilization review and renewal/return operations.

## Handover Return and Reconciliation

### Traceability

- Phase: H1 Handover, Return, Damage, Keys and Accountability.
- Actors: scoped Fleet Manager or higher operational role.
- APIs: current Handover detail and Return command. Backend prerequisites: scoped custody queue/list API; server-derived actor/driver authorization; return location, key-lost state and telematics freshness/reference fields where absent.

### Return Layout

Use the approved Handover composition but change the page purpose to `Return vehicle`. Keep prior Handover evidence visible as a fixed comparison reference:

| Evidence | Handover baseline | Return capture | Result |
|---|---|---|---|
| Odometer | Start/manual + telematics | End/manual + latest telematics | Distance and conflict/advisory |
| Fuel | Start eighths | End eighths | Expected/actual deviation advisory |
| Damage | Existing numbered pins/photos | Carried and newly added pins/photos | `Carried` or `New - review required` |
| Key | Issued key reference | Returned or Lost | Custody closed or incident opened |
| Location | Release location | Return location | Same/alternate location evidence |

The return checklist captures body/glass, tyres/spare, lights, assets and cabin. Existing damage is read-only; new damage requires note and photo. Telematics stale/absent shows last-seen evidence and accepts governed manual readings without overwriting telemetry.

Reconciliation thresholds are server-authoritative policy values, not UI constants. Fuel uses the effective `fuel-deviation-threshold` decision; odometer conflict uses a governed reconciliation rule/config with source freshness and measurement tolerance. The Return API supplies observed values, configured threshold, decision/advisory code and provenance. The UI only presents `Matched`, `Advisory review` or `Conflict - action required` from the response. Missing/invalid policy produces a degraded review state and never silently substitutes a percentage.

### Completion Receipt

After a successful Return command, show booking status `Completed`, return time/location, odometer/fuel reconciliation, key outcome, new-damage review status, late/early flag, handover/return evidence references and receipt/export action. Corrections append amendments; completed records are locked.

### Lost Key and Degraded Modes

- Lost key: require incident reason; do not close custody as returned; create review evidence.
- Storage/photo failure: retain the in-progress server record and retry evidence upload; do not falsely complete.
- Offline web: no offline completion in Phase 1. Show retry and manual continuity instructions; offline mobile synchronization remains a later capability.

Lost-key handling is append-only: the Return command records key custody `Lost`, links the Handover/Booking/Vehicle/actor and reason, appends audit evidence and emits an idempotent `VehicleKeyLost` outbox event. The event creates the Fleet Operations review task/notification; it does not auto-assign employee liability. The Handover may complete its vehicle-condition evidence, but key custody remains open in `Lost - review required` until a governed amendment records replacement/recovery. Backend support and tests for this command/event are prerequisites before enabling the Lost action.

## Vehicle Overview and Quick View

- Row selection opens quick-view drawer `15` for a read-only operational glance.
- `Open full record` navigates to the full-page `vehicle-overview-tab.png` design.
- The full Overview contains identity/classification, current state, hierarchy assignment, map/last ping and risk counters. It uses real scoped data; unavailable sources show `Not available` with freshness, never fabricated numbers.
- Transfer is a V3 command. Until V3 is implemented, the control is hidden or explicitly unavailable; it is never a no-op.

## Field Visibility and Masking Matrix

The backend DTO is authoritative. Hidden fields are omitted or masked server-side; the client never receives secrets and cannot reveal them by toggling a role or inspecting state.

| Screen/content | Full-value roles | Other authorized viewers |
|---|---|---|
| Vendor bank IBAN (`05`) | Finance | Masked last-four/reference only for Procurement/System Admin; absent for Fleet roles |
| Vendor commercial terms and monthly spend (`01`-`03`) | Procurement, Finance | Aggregate/operational status only for authorized Fleet leads; absent for Employees |
| Vehicle monthly rental, purchase cost and lifetime cost (`16`) | Finance, Procurement, explicitly authorized Executive | Fleet roles receive operational lease dates/vendor/contract ref with cost values masked; Employees receive none |
| Employee identity/contact/licence/HR eligibility evidence (`21`-`25`, D1-D2) | The person, scoped HR and the minimum assigned approver/fleet actor fields | Other users receive display name/employee reference and stable decision reason only; no private source facts |
| Consent/audit device/IP/signature evidence | Internal Audit, Security/Privacy under audited access | Operational screens receive signed status, version and timestamp only |
| Vehicle VIN, plate, compliance references | Scoped Fleet/Data Steward/Compliance roles | Employees receive only availability-safe vehicle summary; document blobs and full history are omitted |

Every sensitive read is itself audited where required. UI tests assert both full and masked DTO variants; visual hiding does not count as authorization.

## Map Provider

Use Leaflet behind a local provider interface with OpenStreetMap tiles and visible `© OpenStreetMap contributors` attribution in Phase 1 and simulator environments. Keep tile URL, attribution and provider adapter configurable so an approved enterprise provider can replace it without changing Vehicle/Handover domain components.

## Verification Contract

For every supplied or derived screen:

1. English and Arabic use the same route and behavior.
2. Verify LTR/RTL at 320, 768, 1024 and 1440 without overlap or horizontal page overflow.
3. Keyboard path, focus restoration and screen-reader names pass.
4. Loading, empty, denied, validation, conflict, dependency unavailable and success states are exercised.
5. Browser screenshots are compared to the approved content mockup; shell differences are excluded from visual-diff judgment.
6. No external integration displays a live status without environment evidence.
