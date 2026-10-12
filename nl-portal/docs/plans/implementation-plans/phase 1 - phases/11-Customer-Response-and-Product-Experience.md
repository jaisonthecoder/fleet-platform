# P1.11 - Customer response and product experience

Status: planned; mockups will refine screen composition. Version 1.0, 11.09.2026. Follow the [shared procedure](README.md).

## Outcome and dependencies

The customer compares real published options, accepts/rejects, accesses immutable quote output and receives appropriate notifications. The portal's initial dashboard and news are useful without invented future-module data.

Depends on P1.08-P1.10. Gates: D-18 selected-option mapping, direct-only response handling and lifecycle; D-10 financial rounding, date/time and branded outputs; approved cancellation rules and rejection-reason reconciliation with lookup plan. Do not infer booking execution from acceptance.

Trace: FR-QTE-009/018/019/020, FR-TOL-001, FR-NTF-001, FR-NEW-001, FR-DSH-001, FR-RPT-005, FR-INT-006 events, FR-BKG-005 foundation; NFR-REL-005, NFR-PER-004, NFR-SEC-006, NFR-UX and NFR-SAF-003.

## Vertical slices

### P1.11-A - Published option comparison and customer decisions

- API/UI: published customer-safe request/options, charge descriptions/totals by currency, service/transit, validity/terms, configured carrier disclosure and version/activity history. Do not return hidden cost fields then hide them in React.
- Accept transaction: current permissions/entitlement/ownership, published version/selected option and server-time validity; freeze exact commercial snapshot and audit. Concurrency with expiry/cancel/republication must have one valid outcome.
- Reject transaction: approved configured reason plus permitted text; preserve previous version read-only and create the specified next request version under explicit lifecycle rules. Revalidate retired lookup reason selections.
- Integration: notify CW1 only where applicable confirmed mapping exists. Direct-only response stays local with no invented reference or implicit source quote creation; initial-request-only CW1 cases follow signed D-18 rules.
- Tests/demo: both publication paths; expired/unpublished/stale/wrong-option/foreign quote denied; repeated accept/reject and concurrent accept/cancel/expiry safe; approved history preserved. Accepting creates no booking or shipment.

### P1.11-B - Branded PDF, copy and cancellation

- PDF job: render authorised selected version from immutable customer-safe snapshot into private Blob storage; record version/locale/reference using existing fields where suitable. Download rechecks current scope, no public permanent URL.
- Historical rule: price, labels and approved terms match the selected published version; later lookup/template/policy edits cannot rewrite it. Internal costs/lines remain absent; test configured carrier disclosure, locale and permitted output policy.
- Actions: copy quote to independent draft, copy/use template, cancel only eligible unbooked quotation under signed lifecycle; source notification follows applicable mapping, not an unconditional create/write.
- UI: option/version-aware PDF download and pending/failure state, copy/template destination and cancellation confirmation. Display an available source reference only when real.
- Tests/demo: repeated PDF job, private download, source outage, stale permission, both locales, long terms, multiple currencies, unsafe output fields, independent copy and rejected ineligible cancellation.

### P1.11-C - Quote notification centre

- DB/API: user-owned notification records/read state, paginated centre/bell, mark one/all read within current user scope. Reuse event/job infrastructure and deduplicate by logical event/recipient/version.
- Delivery: publication and relevant quote lifecycle notifications use approved deterministic templates; not an automatic send of AI-drafted correspondence. Resolve recipients and recheck eligibility at scheduled delivery.
- UI: unread count, list, empty/error/loading, accessible read actions and deep links that re-authorise the quote. No count or title leak after user/tenant changes.
- Tests/demo: correct recipient only, duplicate event, mark-all isolation, deactivation/suspension before delivery, revoked deep-link access and failed email retry.

### P1.11-D - News authoring and initial dashboard

- News: authorised authoring/edit/publication for warning/info/hint, banner/pop-up presentation, global/country/customer scope and validity; show-once receipts where required. No new region-targeting subsystem or arbitrary unsafe HTML.
- Dashboard: persist own widget visibility, size and placement using existing user layout storage. Deliver active quotes, news, approved standalone links and permission-gated pricing queue widgets.
- Availability: only released/authorised widgets query data. Future Tracking/Documents/Invoices/Bookings/Claims menus remain appropriately visible, but their missing data yields no fake counts or requests. No Power BI or advanced analytics UI.
- UI: news list/editor/preview and dashboard edit/reset controls with loading/empty/error, accessible keyboard layout alternative and responsive containment. Reset affects own layout only.
- Analytics: instrument onboarding, admin changes, claim/approval/publication and customer quote funnel according to approved event catalogue; privacy-safe event collection now, broader reporting/training views later.
- Tests/demo: scope/validity boundaries, one-time pop-up under concurrent tabs, sanitised content, user-specific saved layout, pricing permission removal and dashboard usable in <3 s under approved NFR profile.

## File boundaries and handoff

Use quote actions/status/version, notification/news/user-preference modules, PDF/email integration jobs, generated contracts and feature-local EN/ES. Do not recreate old rendered_document, widget_layout or quote_status_history tables where columns/audit satisfy the approved design.

Deliver a customer-to-staff-to-customer demo covering response/PDF and initial product experience. Customer notification, staff-authored email, CW1 status and portal publication remain distinct in audit and UI.

Next: [P1.12](12-Hardening-UAT-and-Pilot-Release.md).
