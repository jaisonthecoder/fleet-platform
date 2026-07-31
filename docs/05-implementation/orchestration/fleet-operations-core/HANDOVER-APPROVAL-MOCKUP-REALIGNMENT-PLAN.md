# Handover, Return and Approval Mockup Realignment Plan

> **Status:** `HAPR_00_07_VERIFIED_COMPLETE`
> **Date:** 2026-07-30
> **Controlling visual sources:** screens `25`-`28`, `handover-page-demo.tsx`, and the approved derived Return contract
> **Preserved technical baseline:** atomic Booking/Handover transitions, Principal/scope authorization, audit/outbox and durable command replay

## 1. Objective

Restore exact mockup composition and complete the missing evidence model for:

1. Booking approval inbox (screen `25`).
2. Handover custody register (screen `26`).
3. Handover walkaround (screens `27`/`28` and `handover-page-demo.tsx`).
4. Derived Return comparison, chain view and completion receipt.

The demo component is the implementation template. Layout, controls, states and interaction hierarchy are retained. Hardcoded sample people, Bookings, Vehicles, readings, consent text and English strings are replaced by authenticated API data and EN/AR translations; they are not copied as operational facts.

## 2. Detailed Inspection

### 2.1 Demo Handover contract

The demo contains these mandatory elements:

- Fleet Manager/pool page context and Handover/Return segmented mode.
- Navy Booking strip: Booking, Vehicle, driver, GPS state, eligibility/no-block and consent evidence.
- Five fixed inspection rows with independent `PASS`/`FAIL` verdicts and descriptions.
- Completed-check counter.
- Starting/ending odometer with telematics comparison.
- Fuel eighths slider, labels and severity-coloured gauge.
- Explicit key issue/return confirmation.
- Return-only standardized condition selector.
- Vehicle top-view damage map with numbered carried/new pins.
- Required note/photo evidence for every new damage pin.
- General handover/return vehicle photos.
- Draw/type signature pad for the designated signer.
- Consent-versus-condition-signature explanation.
- Itemized readiness footer and gated primary command.
- Confirmation dialog, success feedback and reset behavior.

### 2.2 Current live Handover divergence

| Area | Demo/mockup | Current live page | Required correction |
|---|---|---|---|
| Register | Full table, filters, pagination, history, View/Edit/Locked | Approved/Active sidebar only | Restore screen `26` as the route landing page |
| Workflow routing | Register -> new/view/edit/return | Register and capture merged into one page | Separate register, chain detail and capture routes |
| Checklist | PASS/FAIL per item with descriptions | Boolean checkbox, pass only | Preserve verdict tri-state and descriptions |
| Damage | Top-view marker, true coordinates, carried/new evidence | Region/note text; fixed `0.5/0.5` coordinate | Reuse `DamageMarker`; persist exact coordinates and photo refs |
| Photos | General Vehicle photos plus per-pin photos | None | Add evidence upload/reference workflow |
| Signature | `SignaturePad` draw/type | Typed-name UUID placeholder | Store opaque signature evidence ref and metadata |
| Key | Explicit confirmation; Returned/Lost on return | Free-text key ref only | Add key outcome and lost-key review lifecycle |
| Return condition | Good / Minor wear / Damage noted | Free text | Use governed enum/code |
| Telematics | Reading, freshness and reconciliation state | Manual input; response flags only | Project source reading/freshness and server verdict |
| Receipt | Full comparison, key/damage/late/evidence refs/export | Three values and generic warning | Implement derived completion receipt |
| Append-only | Locked completed records; amendments | Returned row disappears from worklist | Historical register, immutable chain and amendments |
| i18n/RTL | English/Arabic mirrored | Current live strings translated; demo strings hardcoded | Extract exact demo copy to both catalogs, logical layout only |

### 2.3 Current backend/data strengths to preserve

- Fleet role and hierarchy authorization.
- Driver and Booking state verification.
- One Handover per Booking.
- Atomic `Approved -> Active` and `Active -> Completed` transitions.
- Durable payload-bound replay for Open and Return.
- Damage-pin storage with normalized coordinates and template version.
- Key Issue/Return log.
- Fuel advisory, odometer conflict and late-return calculations.
- Audit, outbox and rollback behavior.

### 2.4 Backend/data gaps

- `GET /handovers` is a pending worklist, not the historical custody register.
- Returned records are excluded, preventing screen `26`, filters and chain view.
- Open checklist is JSON and Return has no separate checklist.
- No general Vehicle photo-evidence aggregate.
- Damage `photoRef` has no validated object-key/upload contract.
- Signature refs have no evidence type/signer/device/time projection.
- No release or return location evidence.
- Key custody has no `Lost`, recovery/replacement or review state.
- No append-only amendment entity or completed-record immutability trigger.
- Reconciliation exposes booleans but not server verdict, threshold/source/provenance/freshness.
- No receipt/export projection.
- Register has no charge/fine summary integration.

### 2.5 Approval page divergence

| Area | Screen `25` | Current page | Required correction |
|---|---|---|---|
| Master-detail | Queue and selected detail | Present | Retain and tune dimensions/spacing |
| Requester | Avatar, employee ID, manager relationship, behavior summary | Name only | Add privacy-safe server projection |
| Fact strip | Vehicle, window/duration, purpose/passengers, cost | Separate generic cards; no destination/cost | Match four-fact composition; represent unavailable governed cost honestly |
| Verdicts | Stacked detailed banners | Compact grid with hardcoded generic labels | Return typed verdict facts/reasons/timestamps from server |
| Justification | Prominent blockquote | Purpose only in fact card | Add persisted justification/purpose block |
| Forecast | Peak forecast evidence | Hardcoded `NOT_AVAILABLE` | Keep banner in place; use provider status/evidence, never invent 88% |
| Actions | Sticky Approve/Request change/Decline | Bottom actions present | Match visual hierarchy and confirmation behavior |
| SoD | Clear requester self-approval explanation | Present | Retain |
| Tabs | Booking screen only | Booking/Dedicated tabs added | Preserve app requirement but do not let tabs alter screen `25` composition |

The existing approval service returns `eligibility`, `consent` and `reservation` as hardcoded literals. This must become a projection of persisted Booking, consent, eligibility/policy and reservation evidence.

### 2.6 Cross-page and shared-component impact

| Consumer/surface | Current dependency | Effect of HAPR changes | Required protection |
|---|---|---|---|
| Booking preparation | Shows Approved Bookings but has no Handover action | Must launch `/handover/new?bookingId=...` | Add locale-aware action link; retain preparation query until Open succeeds |
| My Bookings | Active Booking exposes Return capability | Fleet Return remains the custody command; Employee early-return only requests/links to Fleet workflow | Do not expose Fleet evidence mutation to Employee roles |
| Operations dashboard | Counts Booking statuses directly | Open/Return changes availability and active counts | Invalidate/refetch Operations after local commands; server remains source for other sessions |
| Vehicle Management | Vehicle status, odometer, custody and documents are separate projections | Chain/detail may deep-link to Vehicle; manual Handover reading must not overwrite telematics | Keep Vehicle APIs authoritative; show Handover snapshot as evidence only |
| Fines/black points | Fine links to Booking, not Handover | Register may show `FINE_ATTACHED` after Return | Query source dynamically or use a dedicated read projection; never mutate Handover evidence when a Fine arrives |
| Booking approvals | Strict Zod work-item schema and shared Booking/Dedicated page | Additive Booking projection can break a frontend deployed before backend | Backend-first additive deployment; old fields retained until FE cutover |
| Dedicated approvals | Shares `/approvals` page tabs/hooks | Booking screen realignment must not alter Entitlement DTO/action behavior | Separate Booking detail component and tests; retain Dedicated tab/query keys |
| Navigation/landing | `/handover`, `/approvals`, `/booking-preparation` are established links | New nested routes can break bookmarks and role landing | Keep `/handover` as register; add children without renaming established routes |
| Auth/role guards | Fleet-only Handover; mixed approval roles | Child routes need the same or narrower guards | Guard every child route; server authorization remains mandatory |
| Query caches | Inline Handover worklist key; approval/preparation keys are separate | Open/Return/decision can leave register, preparation, Booking and Operations stale | Central query-key factories and explicit invalidation matrix |
| MSW/dev mode | Handover and approvals mostly use per-test handlers | New strict clients generate unhandled-request failures | Add complete stateful handlers or explicit fixture builders under strict MSW |
| Shared evidence controls | Demo alone uses `DamageMarker`, `SignaturePad`, `CameraCapture` | Production reuse exposes hardcoded English and data-URL assumptions | Add translated-label props and Blob/file outputs without forking components |
| Shell/mobile | Sticky app shell and capture footer both occupy viewport edges | Footer can overlap content/safe area | Use shell-aware offset, `env(safe-area-inset-bottom)` and viewport tests |

### 2.7 Rigorous critique findings and mandatory fixes

| ID | Severity | Plan defect/risk | Mandatory fix |
|---|---|---|---|
| HAPR-C01 | Blocking | Replacing `GET /v1/handovers` would break the current client during staged delivery. | Keep it as a compatibility alias/work-items endpoint through HAPR-07; add register/chain APIs first and remove only under a later deprecation decision. |
| HAPR-C02 | Blocking | Uploading photos/signatures before Open/Return can leave orphaned evidence; uploading after the command can create a false completed record. | Create staged evidence owned by organization/uploader with expiry and content hash. Open/Return atomically claim all refs; a scheduled cleanup deletes expired unclaimed objects/rows. Missing/unowned/claimed refs fail before state transition. |
| HAPR-C03 | Blocking | Existing command-ledger snapshots use the old `HandoverDto`; strict new clients may reject valid replay. | Add `schemaVersion` to command results and response schemas. Keep new fields additive/nullable, parse legacy v1 snapshots, and test Open replay before and after Return. Do not rewrite immutable result snapshots. |
| HAPR-C04 | Blocking | A broad immutability trigger could block the legitimate `Handover -> Returned` update or test cleanup. | Permit the single service transition when `OLD.phase='Handover'` and `NEW.phase='Returned'`; reject changes once `OLD.phase='Returned'`. Protect child evidence from update/delete with insert-only triggers/permissions. Document controlled test teardown. |
| HAPR-C05 | High | One materialized status becomes stale when a Fine, key recovery or review arrives in another domain. | Keep atomic source facts authoritative. Derive ordered display signals in the register query/read model. If a projection is later persisted, update it idempotently from outbox events and expose freshness; never make it custody truth. |
| HAPR-C06 | High | The plan did not define legacy-data backfill. Existing Handovers have JSON checklists, text signature refs, no locations and Returned rows. | Migration `0056` backfills inspection rows, wraps legacy refs as `LegacyReference`, derives key outcome from key log, leaves unknown locations/freshness nullable, and records `evidenceCompleteness='LegacyPartial'`. No historical facts are invented. |
| HAPR-C07 | High | Frontend marker coordinates are percentages `0..100`; API coordinates are normalized `0..1`. | Convert only in the feature adapter, clamp/validate both directions, preserve template version, and test all corners plus RTL. Never mirror the physical vehicle coordinate system in RTL. |
| HAPR-C08 | High | Demo counts PASS and FAIL as decided, but the plan did not say whether FAIL blocks release/return. | All five items must be decided. A FAIL requires a note and at least one linked evidence photo, creates `ReviewRequired`, and remains visible in receipt/register. Policy determines whether release is blocked; do not silently force every item to PASS. |
| HAPR-C09 | High | A Fleet Principal submits Open while the driver signs; treating the signer as the actor would be impersonation. | Persist `capturedByPersonId` (Fleet actor) separately from `signerPersonId` and signature evidence. Bind Open signer to Booking driver; bind Return signer to the configured party. Signature capture is witnessed evidence, not authentication or Booking consent. |
| HAPR-C10 | High | Current `SignaturePad` typed mode pre-fills the signer and therefore reports signed without an explicit action. | Typed mode starts unconfirmed and requires an explicit acknowledgement/interaction; draw mode requires strokes. Store mode, signer, captured-by, time, device ref and content hash. Never store raw canvas data in domain rows. |
| HAPR-C11 | High | `CameraCapture` and `DamageMarker` retain base64 data URLs in React state, which is unsafe for multiple mobile photos. | Change production pathway to Blob/File output, client-side dimension/size limits, staged upload and opaque refs. Revoke object URLs; cap count/size; preserve retry state. Data URLs remain demo/test-only. |
| HAPR-C12 | High | Evidence upload security/retention was underspecified. | Validate MIME by magic bytes, allowed image types, decoded size and dimensions; strip EXIF/geolocation; malware-scan where available; organization-prefix object keys; private access; UAE residency/config; retention and authorized download audit. |
| HAPR-C13 | High | `cursor` pagination cannot directly render mockup text `Page 1 of 3` without count/page semantics. | Use bounded `page`/`pageSize` plus total count for screen `26`, deterministic sort `(activityAt DESC, handoverId DESC)`, and URL search params. If cursor is later required, change the UI contract explicitly. |
| HAPR-C14 | High | Register may need multiple simultaneous statuses (late + damage + fine); a single undocumented priority hides facts. | Return `primaryStatus` plus ordered `signals[]`. Freeze priority: open custody, key review, damage review, reconciliation review, late, on-time; Fine is an independent signal/charge summary. Test every combination. |
| HAPR-C15 | High | Fines and charges do not share a transaction with Return and no general charge aggregate exists. | Keep Fines domain read-only linked by Booking. Show `NOT_AVAILABLE`/None for unsupported charges. Do not create liability or amount from fuel/damage flags. Register refresh reflects later Fines without rewriting Handover. |
| HAPR-C16 | Blocking | Approval verdicts are currently hardcoded, and naive replacement could expose HR/licence/signature/device data. | Build an explicit safe projection from consent record, Booking policy decisions and reservation state. Return stable reason codes/times/versions only; never raw signature, IP, device, HR document or policy internals. |
| HAPR-C17 | High | `Reports to you` is not always true for delegates or Fleet approvers. | Return `relationshipCode` derived for the current actor (`DIRECT_MANAGER`, `DELEGATE`, `WORKFLOW_ASSIGNEE`, etc.). Localize it; never hardcode relationship prose. |
| HAPR-C18 | High | Behavior counts, forecast and cost can create privacy/performance or fabricated-data problems. | Compute bounded privacy-safe YTD/no-show/late aggregates with indexes and actor authorization. Cost/forecast use provider status `AVAILABLE|NOT_CONFIGURED|UNAVAILABLE`; omit values when not governed. |
| HAPR-C19 | High | Route changes can discard a long evidence form or let users switch work items mid-capture. | Use React Router blocker plus `beforeunload`; persist only non-sensitive draft metadata locally or server-side; warn before mode/item/navigation change; clear staged evidence on confirmed discard. |
| HAPR-C20 | High | Query invalidation affects only the current browser and does not refresh another Fleet user. | Invalidate register/work-items/chain/receipt/preparation/Booking/Operations locally; refetch on focus and use bounded polling while worklists are open. Real-time push remains a separate capability. |
| HAPR-C21 | Medium | The demo file exports the same `HandoverPage` symbol as production, enabling silent wrong imports. | Rename it to `HandoverPageDemo`, keep it out of router/public barrels, and add an import-boundary lint/test rule. Delete/archive only after parity tests use it as reference. |
| HAPR-C22 | Medium | Shared evidence components hardcode English and DamageMarker keyboard input only drops a center pin. | Add translated labels and accessible error/description props. Provide a keyboard region selector or directional coordinate controls; announce pin/status changes. Keep physical coordinates LTR-stable under RTL. |
| HAPR-C23 | Medium | Sticky footer, camera, diagram and signature may fail at 320px or with mobile safe areas. | Define responsive dimensions/aspect ratios, scroll containment, touch targets, safe-area padding, reduced-motion behavior and actual mobile camera/signature tests. |
| HAPR-C24 | Medium | Booking/Dedicated tabs can distort screen `25`, while removing them breaks the unified approval journey. | Preserve tabs outside the Booking master-detail frame. Route/tab state lives in URL. Booking content inside the tab matches screen `25` exactly; Dedicated remains behaviorally unchanged. |
| HAPR-C25 | Medium | Approval reason can be lost when switching queue items. | Add dirty-state guard per selected task; retain draft reason by task ID until submit/discard; clear after successful decision or stale refresh. |
| HAPR-C26 | Medium | Current plan does not specify API UUID/filter validation and bounded query limits. | Zod-validate route/query values, whitelist filters/sorts, cap page size, use opaque not-found across organization boundaries, and test malformed IDs/cursors. |
| HAPR-C27 | Medium | Evidence counts can make Open/Return payload hashes order-sensitive and retries unstable. | Sort checklist/evidence refs/damage pins canonically before hashing and persistence; freeze client command after first send; retry the identical payload/key. |
| HAPR-C28 | Medium | General vehicle photos are shown in the demo but their mandatory status is unclear. | Keep general photos optional unless configured; new damage photos are mandatory. Server capabilities return required minimum/count/size so validation is not hardcoded in React. |
| HAPR-C29 | Medium | Handover and Return mode toggle could permit an impossible mode for the selected record. | Capture context returns capabilities. Handover mode only for Approved/no open Handover; Return only for Active/open Handover. Toggle disabled or navigates to a valid work item; server remains authoritative. |
| HAPR-C30 | Medium | The plan omitted observability and operational cleanup. | Add metrics for register latency, upload failures/orphans, Open/Return conflicts/replays, review backlog and amendment volume; structured logs use opaque refs and correlation IDs, never image/signature payloads. |
| HAPR-C31 | High | Copying every prior scratch into each new Handover duplicates damage and loses lineage/repaired state. | Add `carriedFromDamagePinId` (or equivalent immutable lineage) and lifecycle status `Open|Repaired|Closed`. Capture context returns only unresolved Vehicle marks; carrying creates a reference/snapshot, not an unrelated duplicate. Prior driver/Booking identity is not exposed. |
| HAPR-C32 | High | PostgreSQL cannot atomically commit an external object upload; “inside one transaction” would be a false claim. | Upload and verify the object before command execution, persist a staged DB row only after storage confirms durability, then atomically claim the row with Open/Return. Cleanup locks staged rows before deleting objects to avoid racing a claim. Reconciliation detects claimed rows with missing objects. |
| HAPR-C33 | High | Lost-key behavior does not define whether Booking completion waits for recovery. | Freeze behavior: vehicle-condition Return may complete the Booking, but key custody becomes `LostReviewRequired`, emits one idempotent review event and prevents a false `Returned` key log. Recovery/replacement is a later append-only command; liability is never automatic. |
| HAPR-C34 | High | Storing only mutable hierarchy node references can rewrite the apparent release/return location after an organization move/rename. | Persist event-time location node ID plus immutable code/name snapshot and effective hierarchy evidence. Current hierarchy controls authorization; historical receipt displays event-time snapshot. |
| HAPR-C35 | High | Mockup `Edit` for ON TRIP is ambiguous and could allow rewriting signed issue evidence. | `Edit` means append open-custody evidence/amendment only: add damage/photo/note or key review. Start odometer/fuel, original checklist, signer and key issue remain immutable after Open. Capabilities enumerate allowed commands. |
| HAPR-C36 | Medium | Direct Handover-to-Fines/Blob/Notification module imports can create circular dependencies and blur aggregate ownership. | Define narrow read/write ports owned by Handover (`ChargeSummaryReader`, `EvidenceStore`, `ReviewPublisher`) with adapters/providers in composition modules. Handover never mutates Fine or storage internals. Add dependency-cruiser rules/tests. |
| HAPR-C37 | Medium | Five checklist codes are fixed in the UI but evidence lacks a definition/version, making future wording changes ambiguous. | Persist `checklistDefinitionVersion`; validate the exact required code set per capture phase. Labels/descriptions remain localized client content keyed by stable codes. Version changes are additive and old receipts use their recorded version. |
| HAPR-C38 | Medium | Amendments preserve originals but the plan does not define how consumers see corrected effective values or concurrent amendments. | Chain returns original evidence plus ordered amendments and an explicitly derived `effectiveView`; amendment commands require current chain revision/idempotency. Concurrent amendments produce one winner/stale conflict. Original receipt remains downloadable. |
| HAPR-C39 | Medium | “YTD”, last 14 days, late/on-time and page dates are timezone-sensitive. | Use organization timezone (`Asia/Dubai` default) for reporting windows and display; store instants in UTC. Freeze inclusive/exclusive boundaries and test DST-independent UAE behavior plus configured non-default zones. |
| HAPR-C40 | Medium | Booking approval API is capped at 100 with no pagination; richer joins/counts can make the inbox slow and hide tasks. | Add bounded page/pageSize or cursor contract for approvals without changing decision identity; index assignee/current-step/due time and behavior-count predicates; test 10k Bookings and delegated queues. Preserve selected task by ID across refresh. |

## 3. Target Frontend Architecture

### Routes

- `/:lang/handover` - custody register matching screen `26`.
- `/:lang/handover/new?bookingId=...` - Handover-mode walkaround from the demo.
- `/:lang/handover/:handoverId` - append-only issue-to-return chain.
- `/:lang/handover/:handoverId/edit` - open-trip Handover evidence only.
- `/:lang/handover/:handoverId/return` - Return comparison/capture.
- `/:lang/handover/:handoverId/receipt` - locked completion receipt/export.
- `/:lang/approvals` - screen `25` Booking composition plus existing Dedicated tab.

Existing `/handover`, `/approvals` and `/booking-preparation` links remain valid. New child routes inherit Fleet guards individually. Unknown/unauthorized records use the existing opaque access behavior; route IDs and query parameters are validated before requests.

### Feature files

- Replace the live page with register composition, not a merged sidebar form.
- Rename the reference export to `HandoverPageDemo` and prohibit production imports from `handover-page-demo.tsx`.
- Promote the demo walkaround into production components:
  - `handover-register-page.tsx`
  - `handover-capture-page.tsx`
  - `handover-chain-page.tsx`
  - `handover-receipt.tsx`
  - `handover-checklist.tsx`
  - `handover-readings.tsx`
  - `handover-key-custody.tsx`
- Reuse, do not fork:
  - `DamageMarker`
  - `SignaturePad`
  - `CameraCapture`
  - `Segmented`, `Slider`, `StatusChip`, `Button`
- Split strict schemas/client/query hooks from page-local form state.
- Add one Handover query-key factory for register, work-items, context, chain, receipt and evidence; define mutation invalidation for preparation, Booking and Operations.
- Keep filter/page in URL search params; server state remains TanStack Query state.
- Protect dirty capture/approval state across row, tab, mode and route changes. Staged evidence is released only after confirmed discard or successful claim.
- Add all copy to both `en.json` and `ar.json`; use logical directional utilities and `<bdi>` for Booking/Vehicle/key/evidence references.
- Keep diagram coordinates physically stable in RTL; only surrounding layout mirrors.

## 4. Target Backend and Database Design

### Migration `0056_handover_evidence_and_register`

| Entity/change | Purpose | Constraints |
|---|---|---|
| `handover_inspection_item` | Separate Handover/Return checklist evidence | Handover ID + capture phase + item code unique; verdict `Pass|Fail`; append-only after command |
| `handover_evidence` | Staged/claimed general photos, damage photos and signature refs | Organization/uploader owner, opaque `handover-evidence/...` object key, content hash, MIME/size, evidence type, actor/signer, device/time, `Staged|Claimed|Expired`, expiry; immutable after claim |
| `handover_amendment` | Corrections without overwrite | Reason, prior/new evidence refs, author, timestamp; insert-only |
| `key_log` extension | Returned/Lost/Recovered/Replaced custody | Lost requires incident reason and review state; transition constraints; no false Returned event |
| `handover` extension | Release/return location, return condition code, telematics snapshot/freshness, key outcome, reconciliation status/provenance | Organization-consistent FKs; completed fields protected from update except amendment workflow |
| Indexes | Register/filter/detail performance | Organization + phase/time; vehicle/time; booking; review status |
| Immutability triggers | Enforce append-only completion evidence | Reject direct mutation/deletion of completed Handover evidence |
| Legacy backfill | Preserve pre-0056 Handovers | Convert JSON checklist to inspection rows, wrap signature/photo refs as `LegacyReference`, derive known key outcome, mark unknown fields `LegacyPartial`; invent nothing |

No base64 image or signature payload is stored in PostgreSQL. Development uses an application-owned manual upload adapter that accepts Blob/File data and returns an opaque object key; production can replace the adapter without changing domain contracts. Upload validation includes magic-byte MIME, dimensions, decoded size/count, EXIF stripping, private organization-bound access and retention. Expired unclaimed evidence is cleaned idempotently.

The immutability trigger permits only the service-owned `Handover -> Returned` transition. Once the old row is `Returned`, original custody fields and claimed evidence cannot be updated or deleted; corrections are amendment inserts.

### API contracts

1. `GET /v1/handovers/register?filter=&page=&pageSize=&sort=`
   - historical and open custody records;
   - `primaryStatus`, ordered `signals[]`, issued/returned times, distance, source-backed charge/damage/fine summary, edit capability;
   - total count and deterministic page metadata matching screen `26`.
2. `GET /v1/handovers/work-items`
   - Approved releases and Active custody only, separate from register history.
   - existing `GET /v1/handovers` remains a compatibility alias through HAPR-07.
3. `GET /v1/handovers/:id/chain`
   - immutable Handover baseline, Return evidence, damage, photos, keys, amendments, audit-safe references.
4. `GET /v1/handovers/capture-context?bookingId=`
   - Booking/Vehicle/driver/scope, consent and eligibility evidence, telematics reading/freshness, prior carried damage, keys and server capabilities.
5. `POST /v1/handover-evidence/uploads`
   - development/manual staged evidence upload; server binds organization/uploader/expiry/hash and returns opaque ref.
6. Extend Open/Return commands with canonically ordered inspection evidence, staged evidence refs, location, key outcome, expected Booking/Handover revisions and command schema version. The transaction claims refs before lifecycle transition.
7. `POST /v1/handovers/:id/amendments`
   - append-only correction with reason; never rewrites original evidence.
8. `GET /v1/handovers/:id/receipt`
   - persisted completion and reconciliation projection suitable for export.

All new request/query schemas are strict and bounded. Replay responses carry `schemaVersion`; legacy command snapshots remain readable and are never rewritten.

### Register status derivation

Server returns stable source-derived status codes, not display prose or one mutable custody status:

- `ON_TRIP`
- `ON_TIME`
- `LATE`
- `DAMAGE_REVIEW`
- `KEY_REVIEW`
- `FINE_ATTACHED`
- `RECONCILIATION_REVIEW`

The register returns a primary status plus all applicable signals. Priority is `ON_TRIP`, `KEY_REVIEW`, `DAMAGE_REVIEW`, `RECONCILIATION_REVIEW`, `LATE`, then `ON_TIME`; `FINE_ATTACHED` remains an independent signal. Fine data comes read-only from the Fines domain by Booking. Unsupported charges return provider state, not fabricated amounts. The UI localizes labels and formats amounts/times.

### Approval projection

Extend `BookingApprovalWorkItemDto` with:

- requester employee ID, manager relationship and privacy-safe YTD/no-show/late counts;
- destination and justification/purpose;
- duration and passenger composition;
- typed evidence items for eligibility, consent, reservation/conflict and forecast;
- each evidence item includes stable status/reason codes, evaluated/signed time and safe provenance/version;
- cost/forecast provider state: `AVAILABLE|NOT_CONFIGURED|UNAVAILABLE` plus value only when governed.

Remove hardcoded evidence constants from `BookingService.approvalWorklist()`. Preserve assignment/delegation, SoD, version checks, idempotency and stale-task handling.

`relationshipCode` is actor-relative and never assumes `Reports to you`. Safe behavior counts use bounded indexed queries. Raw licence/HR documents, consent signature/IP/device and policy internals remain excluded. Backend fields are introduced additively before the strict frontend consumes them; existing fields remain during the cutover.

## 5. Implementation Sequence

### HAPR-00 - Contract freeze and red tests

**Completed 2026-07-30.** Additive backend/frontend schemas freeze register, capture context, inspection verdicts, Return condition, key outcome, staged evidence, chain/receipt/amendment, legacy replay and privacy-safe approval evidence. The demo export is isolated from production routing. Implemented contract checks pass; 16 later-phase acceptance cases are registered as visible todo tests.

- Add response/request schemas and reason/status codes.
- Add failing contract, authorization and mockup-component tests.
- Freeze checklist codes, condition codes, evidence types and key outcomes.
- Freeze compatibility aliases, schema-version/replay behavior, status/signal priority, canonical payload ordering, evidence limits and actor-versus-signer semantics.
- Add import-boundary protection for the demo component.

**Exit evidence:** backend contracts `9/9`, frontend implemented contract/boundary checks `8/8` with `16` HAPR-02..06 todo cases, backend/frontend typecheck, 21-file contract manifest, current backend compatibility `73/73` and current frontend compatibility `9/9` all pass.

### HAPR-01 - Migration and repositories

**Completed 2026-07-30.** Migration `0056` adds versioned inspection evidence, staged/claimed evidence metadata, append-only amendments, damage lineage/lifecycle, key review fields, event-time location/reconciliation columns and immutability triggers. Existing rows backfill only known facts as `LegacyPartial`. Register/count and evidence/inspection/amendment repository foundations are implemented.

- Apply migration `0056`.
- Add register, chain, context, evidence and amendment repositories.
- Add immutability and organization-consistency tests.
- Backfill existing Handover/checklist/signature/key data as explicit legacy-partial evidence.
- Add staged-evidence ownership/expiry indexes, register/count indexes and cleanup repository.

**Exit evidence:** forward/second-run migration gate passes; PostgreSQL repository/immutability `3/3`; existing atomic Handover integration `3/3`; local legacy row backfilled to five known inspections and one legacy signature ref; typecheck/lint/build/contracts/organization guard pass.

### HAPR-02 - Handover domain/API

**Completed 2026-07-30.** Historical register/work-items, capture context, chain and receipt reads are live. Raw private evidence staging validates image bytes/metadata and uses an application-owned store port. V2 Open/Return atomically claim caller-owned evidence, persist five-item inspection evidence, separate Fleet actor from signer, snapshot locations, support Lost-key review and preserve legacy replay. Append-only amendments are revision/idempotency bound. Hourly cleanup expires unclaimed metadata and retries private-object deletion.

- Separate work-items from register.
- Implement capture context, evidence upload refs, enhanced Open/Return, lost key, amendments, receipt.
- Preserve existing atomic Booking transitions and command replay.
- Preserve `GET /handovers` compatibility while new clients adopt `/register` and `/work-items`.
- Validate/claim staged refs atomically, persist actor and signer separately, canonicalize replay payloads, and add orphan cleanup metrics.
- Derive register signals from custody plus read-only Fine/review sources; do not update original Handover rows when external signals change.

**Exit evidence:** Handover service `14/14`; HAPR PostgreSQL register/evidence/V2 lifecycle/amendment `4/4`; combined legacy/HTTP/V2 integration `9/9`; migration forward/second-run no-op; backend typecheck/lint/build/contracts/organization guard pass. The PostgreSQL V2 journey proves evidence claims, ten inspection rows, `Approved -> Active -> Completed`, Lost-key event/key log, immutable Open/Return replay after revision changes, and evidence-backed amendment replay.

### HAPR-03 - Register frontend

**Completed 2026-07-30.** `/handover` now follows screen `26` as a historical custody register rather than the replacement master-detail capture page. Filters/page are URL-backed, register and work-items use separate query keys, header actions resolve real capture candidates, completed rows are locked, open custody exposes Edit/Return, View expands the append-only issue/return summary, and Fleet preparation deep-links to capture without breaking the established route.

- Rebuild `/handover` exactly from screen `26`.
- Implement filters, derived statuses, actions, pagination, locked completed rows and chain expansion/view.
- Add locale-aware launch actions from Booking preparation, URL-backed filter/page state and query invalidation/refetch rules.

**Exit evidence:** focused register `3/3`; Handover/preparation/router regression `22/22` with `7` later HAPR todos; frontend typecheck/build pass; strict client schemas parse the live API; live EN/AR/RTL at `320` and `1440` have no page overflow (table scrolling remains locally contained); light/dark screenshots confirm screen-26 composition. A real PostgreSQL computed-timestamp mismatch found during browser validation was repaired at the read-model boundary and Handover unit remains `14/14`.

### HAPR-04 - Walkaround and Return frontend

**Completed 2026-07-30.** The production capture route now uses the demo composition with persisted capture-context data and V2 commands. Five independent PASS/FAIL inspections, failed-item note/photo gates, telematics/manual readings, fuel gauge, explicit key outcome, standardized Return condition, carried/new DamageMarker pins, general photos, witnessed draw/type SignaturePad and readiness footer are wired. Camera capture uses Blob/File staging and opaque refs; typed signer names no longer auto-confirm.

- Use the demo component as the JSX/layout source.
- Replace sample constants with capture-context data and i18n keys.
- Wire PASS/FAIL, DamageMarker, CameraCapture, SignaturePad, readings, key state, condition and readiness footer.
- Build Return as baseline-versus-capture comparison.
- Convert marker percentage coordinates to normalized API coordinates in one tested adapter.
- Use Blob/File staged uploads, explicit signer confirmation, FAIL evidence rules, dirty-navigation protection and server capabilities for mode availability.

**Exit evidence:** focused capture `4/4`, coordinate/strict-contract `4/4`, shared DamageMarker/SignaturePad `3/3`, HAPR acceptance leaves only two HAPR-05 todos; full Handover/router/preparation regression `24/24`; frontend typecheck/build and backend contract/org/type/build pass. Live Return uses real Booking/Vehicle/driver/consent/telematics/carried damage and renders EN/AR RTL at `320`/`1440` without page overflow. New damage and failed inspections cannot submit without staged photo evidence and notes.

### HAPR-05 - Receipt, chain and amendments

**Completed 2026-07-30.** Register View now opens a guarded append-only chain route. The page renders versioned Handover/Return inspection evidence, key history, completeness state, locked completion receipt when Returned, and optimistic append-only amendments. Legacy rows remain visibly `LegacyPartial` and do not fabricate missing Return evidence.

- Implement complete issue-to-return chain, reconciliation evidence, key/damage review, export and append-only amendments.

**Exit evidence:** chain/receipt/amendment `2/2`; register navigation plus HAPR acceptance `6/6`; frontend typecheck/lint pass. Live legacy chain shows five immutable Handover inspections, no invented Return evidence, key history and amendment form. Backend PostgreSQL V2 amendment replay and immutability remain `4/4`.

### HAPR-06 - Approval realignment

**Completed 2026-07-30.** Booking approval work items now project actor-relative requester identity/relationship, bounded behavior counts, destination/duration/justification, and typed eligibility/consent/reservation/forecast evidence from persisted facts. Cost and forecast stay visibly `NOT_CONFIGURED` rather than fabricated. The frontend matches screen `25` with requester summary, four-fact strip, stacked evidence banners, justification, SoD and sticky actions while retaining per-task reasons and the unchanged Dedicated tab.

- Extend safe approval API projection.
- Rebuild detail area to screen `25`: requester evidence, fact strip, stacked verdicts, justification and sticky actions.
- Keep unavailable cost/forecast sections visible with honest server status.
- Introduce the DTO backend-first, derive relationship/evidence/counts safely, preserve Dedicated tab behavior and retain per-task unsaved decision reasons.

**Exit evidence:** Booking backend service/controller `67/67`; Booking/Handover PostgreSQL+HTTP `19/19`; Booking/Dedicated approval frontend `5/5`; combined approvals/Handover/router frontend `36/36`; backend/frontend type/lint/build/contracts/organization guards pass. Deterministic screen-25 contract visual inspected in EN/AR RTL at `320`/`1440` with no page overflow; raw licence/signature/device/IP evidence remains excluded.

### HAPR-07 - Two-round critique and closure

**Completed 2026-07-30.** Independent backend/data/security and frontend/fidelity/accessibility reviews were run after implementation, genuine dirty-navigation/upload-recovery/mobile-safe-area findings were repaired, and both reviewers found no unresolved Blocking/High issue on re-review. Closure record: [HAPR-07 Two-Round Closure Critique](reviews/HAPR-07-two-round-closure-critique.md).

- Round 1: BE/data security, atomicity, evidence immutability and replay.
- Round 2: FE mockup fidelity, accessibility, EN/AR/RTL and responsive inspection.
- Repair all Blocking/High findings and rerun full neighboring suites.

**Exit evidence:** backend units/contracts `86/86`; PostgreSQL/HTTP `26/26`; frontend Handover/Approval/shared controls `40/40`; migration forward/idempotency, contract/org/type/lint/build and diff gates pass; live EN/AR screen `26`, Return capture, chain and deterministic screen `25` verified at desktop/mobile without page overflow.

## 6. Required Tests

### Backend

- Register filters, pagination, historical retention and status priority.
- Same-org/hierarchy authorization for register/context/chain/evidence/amendments.
- Five-item Handover and Return PASS/FAIL persistence.
- Carried damage immutable; new damage requires note and photo.
- Evidence MIME/size/object-key validation and upload-failure recovery.
- Staged evidence wrong-org/wrong-uploader/expired/already-claimed denial and orphan cleanup.
- Drawn/typed signature metadata and designated-signer binding.
- Key Returned/Lost/Recovered state machine and outbox review event.
- Telematics fresh/stale/missing and manual-reading reconciliation provenance.
- Open/Return rollback, contention and payload-bound replay.
- Completed immutability and amendment-only correction.
- Legacy backfill and v1 command-replay compatibility after migration.
- Register multi-signal priority, deterministic total/page behavior and late Fine attachment without Handover mutation.
- Approval evidence derived from actual persisted facts; no sensitive transport/signature data.
- Approval behavior-count authorization/index plans and actor-relative relationship codes.

### Frontend

- Screen `26` table, filters, pagination, View/Edit/Locked.
- Demo parity: all five PASS/FAIL rows, counter, fuel gauge, key, DamageMarker, photos, SignaturePad and readiness bar.
- Return comparison and required condition/key/damage evidence.
- Receipt flags and chain/amendments.
- Approval screen requester/facts/verdicts/justification/actions.
- Strict MSW unhandled requests, keyboard interaction and accessible labels.
- Preparation-to-Handover deep link, route guards, cache invalidation/refetch-on-focus and compatibility redirects.
- Dirty form/reason navigation guards, upload retry/discard cleanup and duplicate-submit payload stability.
- Keyboard-accessible damage placement, non-mirrored RTL coordinates, mobile Blob upload and signature interaction.
- EN/AR and RTL at 320, 768, 1024 and 1440 pixels with no overlap/overflow.

### Integration journey

`Approved Booking -> register -> Handover walkaround -> Active/on-trip register -> Return comparison -> Completed/locked register -> chain/receipt -> amendment`, followed by Booking approval decision regression.

Also verify neighboring effects: preparation item removal, Operations active/availability counts, Vehicle telematics non-overwrite, later Fine signal appearance, Dedicated approval tab unchanged, and old `/v1/handovers` client compatibility.

## 7. Acceptance Rules

- The register and walkaround composition visibly match supplied mockups; no replacement master-detail design is accepted.
- No element present in `handover-page-demo.tsx` is silently omitted.
- Demo constants never become production facts.
- Every user-visible string is translated EN/AR.
- Every persisted authority/evidence value is server-derived or explicitly captured and validated.
- Completed custody evidence is append-only.
- Photo/signature storage failure cannot falsely activate or complete a Booking.
- Staged evidence cannot be claimed across organizations/users and is cleaned after expiry.
- Cost, forecast, fine and charge facts are shown only from governed sources; unavailable states remain visible.
- External Fine/review signals never rewrite original completed custody evidence.
- Existing clients and immutable replay snapshots remain valid during staged deployment.
- Existing atomicity, scope, SoD, replay and rollback guarantees do not regress.

## 8. Deployment, Compatibility and Rollback

1. Deploy migration/backfill and backend additive contracts first; old UI continues using `GET /v1/handovers`.
2. Activate staged-evidence adapter and cleanup worker with metrics before enabling capture uploads.
3. Deploy new register/chain/context pages behind the same Fleet role guards; keep compatibility alias and old DTO fields.
4. Deploy approval additive projection before the strict frontend schema update.
5. Enable new capture commands only after Open/Return legacy replay, rollback and evidence-claim tests pass.
6. Observe register latency, evidence failures/orphans, command conflicts/replays, review backlog and amendment volume.
7. Rollback is forward-safe: disable new UI routes/commands, retain additive tables/evidence, and continue old work-items/API behavior. Never drop evidence or reverse completed custody state.
8. Remove compatibility fields/alias only in a later explicitly approved version after usage telemetry shows zero old clients.

## 9. Critique Outcome and Current Decision

The pre-implementation critique identified 40 issues and drove HAPR-00..06. HAPR-07 then performed two independent post-implementation rounds. Stale findings were disproved from current source/tests; genuine dirty-navigation, evidence-retry and safe-area findings were repaired. Final re-review found no unresolved Blocking/High issue. No recommendation to materialize a single mutable register status is accepted because Fine/key/review signals can arrive after Return; source facts plus a derived read projection are authoritative.

BOOKING-05 and CORE-4 are verified for the HAPR scope: atomic lifecycle/replay, complete evidence contracts, screen-26 register, demo-parity Handover/Return, append-only chain/receipt/amendments and screen-25 approval projection. INT-1 may now consume these stable contracts.
