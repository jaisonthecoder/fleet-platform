# P1.08 - Customer quotation and shared tools

Status: planned; mode-specific fields and commercial rules require source approval. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md).

## Outcome and dependencies

A permitted customer maintains addresses/templates, drafts a complete Air, Sea FCL or Sea LCL request and submits it into the correct employee queue without a rate source. Submitted request data remains distinct from later employee offers.

Depends on P1.04/P1.06/P1.07. Gates: D-03 quote source contract, D-09 first-upload/CSV-XLSX controls, D-10 units/rounding/timezone, D-18 request ownership and effective policy. Review [quotation research](../../06-Freight-Forwarding-and-Quotation-Research.md) as proposals, not an approved field expansion. No universal mandatory-field count is assumed.

Trace: FR-QTE-001 through FR-QTE-009, FR-TOL-001/002, FR-BKG-005 foundation, FR-CFG-008 consumer, FR-SYS-001/002; NFR-PER-001/002/003/005/009, NFR-REL-003/005, NFR-SEC-010/012, NFR-UX.

## Vertical slices

### P1.08-A - Customer address book

- DB: customer-owned address entries with approved components/contact/default flags and retirement semantics, indexed/RLS protected. Keep operational addresses distinct from source legal/billing masters.
- API: scoped list/search/create/update/delete according to manage/delete grants; country-specific validation, no globally mandatory US-style state/ZIP assumption.
- UI: list, create/edit, search and default shipper/consignee selectors; labels/provenance distinguish source references from portal-maintained entries. No implicit source-address copy/edit-back feature.
- Tests/demo: two customers maintain addresses; foreign ID, missing grant, inactive lookup and invalid country fail. Used addresses retire safely without rewriting quote snapshots.

### P1.08-B - Address import/export and templates

- Import: CSV/XLSX upload, field mapping, preview/row-level validation and approved commit policy; no silent partial import. Bound rows/files and handle formulas/malicious spreadsheet content safely. Use established synchronous small-file pattern unless approved measured need changes it.
- First-upload gate: approved type/size limits, scanning/quarantine and failure behaviour before any upload is available; no parser/process/downstream transfer of quarantined content. Provider selection remains D-09.
- Templates: customer-scoped quote template create/update/share/use/delete; permission-aware ownership and copy-from-quote. Booking template kind may remain an extension point, not an active booking workflow.
- UI: import mapping/report/commit, permitted export, template manager and use-template entry. Revalidate retired addresses/lookups and omit old offer/acceptance/source-execution identifiers on reuse.
- Tests/demo: valid/invalid import rows, replay/double commit, formula injection, unsafe file, other-customer export and private/shared template rules. A template creates a new independent draft.

### P1.08-C - Draft list, wizard and calculation

- DB: canonical quote/request versions, mode/route/cargo/equipment, office, branch, references, source and lifecycle; preserve separate quote/booking/shipment identities. Prefer appropriate JSON/version fields over duplicating history tables.
- Contracts/API: per-step draft validation and explicit complete-submit schema; autosave concurrency, list/filter/detail, approved saved Grid/Detail/Card views. Customer group derived from context.
- Wizard: mode/service/incoterm/direction, route and optional doors, cargo/equipment, additional services, references/remarks and review. Exact step count/presentation follows mockups, not historical six-step wording.
- Cargo: approved optional commodity/HS and temperature capture; dangerous goods requires UN/class with correct cargo associations. Additional dangerous-goods fields from research require approval before becoming mandatory.
- Calculations: API owns CBM/chargeable weight, quantity/rate amounts and agreed rounding. Air uses the specified 1:6000 basis; do not independently approximate constants in the browser. FCL equipment counts are not TEU totals unless explicitly required.
- Autosave: show saving/saved/failed, restore last acknowledged version after reload, prevent out-of-order responses overwriting newer input. Large location lists use searched API options; dependent choices revalidate.
- Attachments: implement only confirmed quotation attachment scope, with D-09 gating and per-record download authorisation; staff full-request view receives only accessible attachments. Do not invent extra document workflows.
- Tests/demo: all three modes, DG invalid/valid, optional fields, quantity/unit/rounding fixtures, delayed calculation responses, autosave race, invalid template/lookup and two-tenant saved-view access.

### P1.08-D - Manual submission and policy capture

- Resolve selected authorised office name/ID to source organisation server-side. Never trust client CW1 code, customer group or branch ownership. Multi-branch routing follows approved configuration, not postcode guessing.
- Transaction: revalidate complete draft, office/source eligibility, feature/permission, calculations and effective policy; record request/version/policy and owning branch; enter manual queue; enqueue initial CW1 request only if configured.
- Rate interface: retain stub contract and 25-second timeout/manual fallback; no configured live source and no fabricated price. Tests do not turn simulator lanes into production price promises.
- State: use explicit implemented lifecycle transitions; idempotent submit key/version and exclusive state checks prevent duplicates. Customer sees accurate last consistent state without integration diagnostics.
- Tests/demo: submit Air/FCL/LCL with no rate engine; source timeout/manual fallback; double submit; stale policy at creation boundary; invalid office/missing branch/entitlement; rollback leaves no job; request-sync on/off behaves independently.

## Files, UI and handoff

Proposed surfaces: API address-book/template/quotes modules, contracts/calculation service, integration request jobs, Prisma/RLS, portal corresponding feature folders, DataView and generated hooks. No cross-app shared calculation code.

Screen inventory: customer quote list; draft wizard/review; address list/editor/import; template list/editor; request detail/status. All require EN/ES, loading/empty/error and save/submit pending/denied states. Compare mockup fields against the approved register before adding optional research proposals.

Exit evidence: valid customer request is persisted, recoverable and routed to the proper branch; complete submitted request and attachments are available read-only to authorised pricing staff. List <2 s at 100k/group, search <1.5 s and wizard transition <300 ms under the approved NFR measurement profile; do not treat UI-only mock numbers as evidence.

Next: [P1.09](09-Employee-Pricing-and-Approval.md).
