# Mockup Review - Fleet Operations Screen Set

| Field | Value |
|---|---|
| Status | `APPROVED FOR PHASED IMPLEMENTATION` |
| Source date | 2026-07-20 |
| Review date | 2026-07-21 |
| Source evidence | PNG files `01`-`28`, `vehicle-overview-tab.png`, and [mockup implementation spec](mockup-implementation-spec.md) |
| User approval | **Mockups approved - proceed**, 2026-07-21. Existing shell only; no role switcher; approved English layouts must provide complete Arabic/RTL parity. |

## 1. Implementation Direction

Adopt the supplied screen information architecture, density, fields, tables, workflows, status placement and interaction behavior. Render only the page content through the existing application shell, tokens and shared components.

This means:

- preserve the mockup content hierarchy and page composition;
- do not redesign, replace or duplicate the existing shell, sidebar, header, navigation or role handling;
- treat every shell, role switcher, prototype toolbar and product label visible in the mockups as framing context rather than feature-page scope;
- omit prototype editor chrome (`100%`, Comment, Tweaks, Edit, Present, Share and its top avatar);
- use `common.appName` rather than hardcoding Helm or Wayfinder in feature code;
- use shared components and tokens; do not recreate controls with one-off CSS;
- localize every visible string in English and Arabic and use logical RTL layout;
- derive responsive layouts at 320, 768, 1024 and 1440 from the approved desktop composition without changing business behavior.

## 2. Source Reconciliation

The folder contains **29 PNG files** representing **28 unique content screens**. Files `27` and `28` are alternate Handover walkaround captures (scrolling and no-scroll). `vehicle-overview-tab.png` is the approved full-page Vehicle Overview tab and complements, rather than replaces, quick-view drawer `15`.

The mockups are visually compatible with [the current design system](../../../../app-ui/developer-docs/design-system.md). Feature implementation copies only approved content composition and behavior; the current shell remains untouched.

## 3. Phase Review

| Phase | Supplied screens | Review disposition | Missing or deferred before full phase completion |
|---|---|---|---|
| S1 Vendor master/onboarding | `01`, `04`-`08` | Approved content baseline; later delivery stream | Oracle Fusion, Finance AP, OCR automation and vendor portal are displayed as future options until integrations are delivered; manual workflow remains authoritative |
| S2 Lease contracts | `02` | List/KPI baseline supplied; later delivery stream | Contract create/edit/detail/version/renewal and invoice-resolution flow |
| S3 Scorecard/off-hire | `01`, `03` | Summary/progress baseline supplied; later delivery stream | Off-hire initiation/actions, condition, penalty, acknowledgement, dispute and completion |
| V1 Vehicle onboarding | `10`-`14` | **Approved as the first UI slice** | Import/migrate remains separate; use the existing upload/dialog pattern with manual confirmation and future OCR status |
| V2 Vehicle registry/detail | `09`, `15`-`20`, `vehicle-overview-tab.png` | **Approved** | Implement both list-row quick view and full-page Overview tab |
| V3 Lifecycle/transfer/maintenance | `19`, `20` plus controls referenced elsewhere | Partial | Transfer and lifecycle action dialogs, booking-pool state changes and maintenance create/update flows are not supplied |
| V4 Documents/compliance/telematics/custody | `17`, `18` plus Handover evidence | Partial | Document upload/OCR/version viewer, device pairing and standalone custody/key detail flows are not supplied |
| B1-B2 Basic booking | `21`, `23` | Approved supplied screens; missing states authorized for business-derived design | Derive eligibility, inline consent sheet, confirmation/booking number, loading/empty/error/denial/conflict from Phase B1-B2 and the current design system |
| B3 Approval operations | `25` | Approved supplied screen; outcomes authorized for derivation | Derive approve/request-change/decline/delegation outcomes from Phase B3 |
| B4 My Bookings/change lifecycle | Business-derived design authorized | Approved for design and implementation from Phase B4 | Build list/detail, modify/re-consent, extend/cancel/early-return/complete states in the same visual language |
| B5 Advanced booking | `24` covers emergency only | Blocked by scope decisions | Emergency confirmation/post-review plus waitlist, recurring, cross-node and no-show screens |
| D1 Dedicated request | `22` | Approved supplied screen; results authorized for derivation | Show specific safe remediation reasons from Phase D1 |
| D2 Dedicated decision/allocation/BSD | Business-derived design authorized | Approved for design and implementation from Phase D2 | Derive approval, consent, allocation, BSD calendar, utilization and lifecycle screens |
| H1 Handover/return | `26`-`28` plus business-derived Return design | Approved for complete H1 implementation | Derive Return as a comparison/reconciliation flow; include record detail, completion/receipt, lost-key and degraded/retry states |
| X1 Operations/reports | Business-derived design authorized when phase begins | Not part of the immediate Vehicle slice | Derive only from approved Phase X1 requirements, never from shell placeholders |

## 4. Existing Component Mapping

The current UI already provides the required base patterns:

- shell/sidebar/header and locale-aware routes;
- Button, Input, Select, Textarea, Segmented, Tabs, Sheet, Dialog, DataTable, Badge and StatusChip;
- StatCard, DetailDrawer, AvailabilityStrip, DamageMarker, CameraCapture, SignaturePad, skeleton and empty/error patterns;
- EN/AR URL locale, centralized RTL direction and Wayfinder design tokens.

Vehicle implementation should extend these shared patterns rather than introduce a parallel component library. Maps may use the approved project provider; screenshot map imagery is illustrative.

## 5. Required Adaptations and Guardrails

1. The role switcher is demo-only and must not be implemented. Current authenticated RBAC and role-derived navigation remain authoritative.
2. Status uses icon plus label, never color alone.
3. Money, dates, distances and counts use locale-aware `Intl` formatting and `.font-data` tabular figures.
4. Raw IDs, VINs and plates are isolated with `<bdi>` in RTL.
5. Cost, IBAN, employee and audit evidence remain server-masked by role; hiding UI alone is insufficient.
6. Mock data and prototype success behavior must not remain in production routes.
7. Missing business outcomes listed in this review are approved for derivation only from the corresponding phase document, API contract and existing design-system patterns. Agents may not invent new business capability.
8. External Procurement/Oracle Fusion, Finance AP, OCR automation, vendor portal and similar integrations render as disabled or `Future integration` options until a real adapter and environment evidence exist. Never show `LINKED`, `AUTO` or successful synchronization from fixture data as live truth.
9. Booking consent is an inline Sheet/Dialog tied to the authenticated driver. No booking number, reservation or approval workflow is created before consent commits. On-behalf drafts wait for driver consent; emergency booking bypasses approval only, never consent.
10. Use Leaflet through a provider adapter with OpenStreetMap tiles and visible attribution for Phase 1/simulator environments. Keep tile configuration replaceable for a later enterprise provider.

Detailed route/state/API behavior for approved derived screens is controlled by [derived-screen-contracts.md](derived-screen-contracts.md). If that contract names a missing backend prerequisite, backend delivery and executable proof precede the UI; the UI must not substitute fixtures.

## 6. First Implementation Boundary

Implement **V1 Vehicle Onboarding (`10`-`14`)** as the first frontend phase, with these boundaries:

- implement the five supplied steps and review/activation outcome inside the current Wayfinder shell;
- use actual backend contracts and server-side authorization;
- activation may create a blocked/non-bookable vehicle when mandatory evidence is incomplete, matching the approved business rule;
- do not include the separate Import/Migrate flow;
- derive loading, validation, backend error, permission-denied, keyboard, AR/RTL and responsive states from the current design system;
- use existing document-upload patterns only as an inline/modal supporting state; extraction is manually confirmed and OCR automation is labelled future; a full vault/version-history screen remains V4.

V2 follows with both quick-view drawer `15` and the supplied `vehicle-overview-tab.png` full-page Overview design.

## 7. Business-Derived Missing-Flow Decisions

These decisions govern screens not supplied as separate PNGs:

1. **Booking consent and confirmation:** inline consent sheet after vehicle selection; display policy version, driver, vehicle and window; commit consent before booking number/reservation; then show persisted status, next approver, handover guidance and My Bookings link.
2. **My Bookings:** required operational lifecycle, not deferred. Provide Upcoming/Active/Past views, state-aware details and server-authorized modify, re-consent, extend, cancel and early-return actions.
3. **Dedicated lifecycle:** implement D1 and D2 end to end. Eligibility shows specific safe remediation; approval follows pinned policy route; driver consent precedes exclusive allocation; BSD and return remain auditable.
4. **Handover Return:** mirror the inspection structure but compare against handover evidence. Capture final odometer/fuel, carried/new damage, key returned/lost, location, telematics freshness, late/early status and advisory reconciliation before append-only completion receipt.
5. **Vehicle activation wording:** follow the business state, not the prototype verb. If evidence is incomplete, the action creates a blocked/non-bookable vehicle record and says so; only a compliant record is activated into the booking pool.
6. **Responsive/Arabic states:** every approved English content screen must function at 320/768/1024/1440 and in Arabic RTL using the same feature behavior. Separate Arabic mockups are not required.

## 8. Approval Record

**User approval: Mockups approved - proceed.** Recorded 2026-07-21. Approval covers all currently supplied content screens, the new Vehicle Overview tab and the business-derived missing-flow decisions above. It does not authorize redesign of the existing shell or fake external integrations.
