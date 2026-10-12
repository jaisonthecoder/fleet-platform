# Implementation Plan — Noatum Logistics Customer Information Platform

| | |
|---|---|
| **Based on** | PRD v2.1 (02.09.2026, owner Mohamed, status "for build") · Noatum Logistics Design System |
| **Stack** | React + TypeScript (portal, Vite) · NestJS (API with in-process jobs) · PostgreSQL (data + pg-boss jobs) · Azure Blob (files) · Entra External ID / Entra ID · Azure hosting — v3: no Redis, no message broker, no own auth code (ADR-004, Simplification-Register). **Background work re-confirmed on pg-boss, 17.09.2026 — see [ADR-008](adr/ADR-008-background-work-queue.md)** |
| **Written** | 03.09.2026 · **v2 04.09.2026** (Review-Report C1, C2, C3, P4, P3) |
| **Audience** | Development team — written in simple English for people new to freight forwarding |
| **Purpose** | End-to-end plan: what to build, in which order, why, and how each part fits |

---

## Part A — Understanding before building

### A.1 What the business does (60-second version)

Noatum Logistics is a **freight forwarder**. A freight forwarder does not own ships or planes. It is a travel agent for cargo: a customer (a "shipper") says "move 20 pallets from Shanghai to Jebel Ali", and Noatum books space with a shipping line or airline, arranges trucks at both ends, handles customs paperwork, and sends the customer an invoice.

Key words you will meet every day:

| Word | Simple meaning |
|---|---|
| **Shipment** | One customer job: cargo moving from A to B |
| **Consol** | Several shipments packed together in one container or flight to save cost |
| **FCL / LCL** | Sea freight: Full Container Load (you get the whole box) / Less than Container Load (you share a box) |
| **HBL / HAWB** | House Bill of Lading / House Air Waybill — the document Noatum issues to the customer for the shipment |
| **MBL / MAWB** | Master B/L / Master AWB — the document the shipping line or airline issues to Noatum |
| **POL / POD** | Port of Loading / Port of Discharge |
| **ETD / ETA / ATD / ATA** | Estimated / Actual time of Departure / Arrival |
| **Milestone / event** | A step in the journey: "booked", "departed", "arrived", "customs cleared", "delivered" |
| **Incoterm** | A three-letter code (FOB, CIF, DAP…) saying who pays for which part of the journey |
| **Chargeable weight** | Air freight is priced on the higher of actual weight and volume weight (1 CBM = 166.67 kg, the "1:6000" rule) |
| **Quote** | A price offer to the customer, valid for a period |
| **Booking** | The customer saying "yes, move it" — the start of a shipment |
| **CargoWise One (CW1)** | The operational software Noatum staff use every day. It is the system of record for everything |
| **eAdapter** | CW1's integration door — it sends and receives XML messages (UniversalShipment, UniversalEvent, UniversalTransaction) |

### A.2 What the platform is — and is not

**It is:** one website where a customer logs in and can track shipments, ask for quotes, book, download documents, see invoices, get alerts, raise claims and run reports.

**It is not:** a replacement for CW1. Noatum staff keep working in CW1. Our platform is a customer-facing window onto CW1, plus a way for customers to send requests into CW1. We keep a **copy** of CW1 data in our own database so screens are fast, but CW1 stays the truth.

Program-level non-goals (never build these): replacing CW1 workflows · rate management (rates live in CW1 or the designated rate engine) · full PO management (visibility + deep link only) · WMS / road / rail · redesigning the brand.

### A.3 The six foundation decisions

The PRD says all Phase 1 architecture choices are foundational. These six decide whether later phases are additions or rewrites.

| # | Decision | What it means in code |
|---|---|---|
| 1 | **Multi-tenancy by CustomerGroup** | Single-owner rows (quotes, bookings, users, invoices…) carry `customer_group_id`. The shipment family is visible to several customers at once, so it uses a `shipment_visibility` link table instead of a column. A request-scoped tenant context + a base repository that always adds the filter. Postgres RLS policies as a second lock. Never filter in React. The worker decides ownership only from the CW1 org-code mapping (`KB-CW1-Integration-Multi-Tenant.md`). |
| 2 | **Canonical model + adapters** | We store *our* shapes (Shipment, Quote, Booking…), never CW1 shapes. Five adapter interfaces: `TmsTrackingAdapter`, `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`. CW1 is the first implementation; a second TMS is a new adapter + mapping rows. |
| 3 | **Roles = named permission sets** | Permission strings like `quote.create`, `quote.submit`, `booking.cancel`, `finance.view`. One NestJS guard checks them on every endpoint. Sub-permissions come free. |
| 4 | **Feature flags per CustomerGroup** | `feature_flags` JSON on CustomerGroup, read by API and UI. Rollout is per customer, never big-bang. |
| 5 | **Mapping tables, never hard-coded codes** | CW1 status codes, event codes, document types, charge codes all live in DB tables an admin can edit. |
| 6 | **Design-system tokens as the only source of style** | `packages/design-system` exports tokens.css and core components. No colour, font or radius is written anywhere else. |

### A.4 Human-in-the-loop rule

Any figure produced by automation or AI (predictive ETA, data-quality merge, CO2, chatbot answers, AI translation) must carry **provenance** (where it came from), and must be **overridable by a human with a reason**, with the original kept. AI output is never read-only.

---

## Part B — Architecture blueprint

### B.1 Three layers

```
┌────────────────────────────────────────────────────────────┐
│ apps/noatum-customer-portal-ui  (React + TS)                              │
│ public pages: T&T · CO2 calc · sailing schedule            │
│ logged-in: dashboard · quotes · bookings · tracking · docs │
│            invoices · alerts · claims · reports · admin    │
├────────────────────────────────────────────────────────────┤
│ apps/platform-api  (NestJS, REST + OpenAPI)                │
│ identity · tenancy · authz · quotes (+ sync rate-engine   │
│ client) · bookings · shipments · documents · finance      │
│ notifications · news · claims                             │
│ reports · dashboard · admin · api-management · audit      │
├────────────────────────────────────────────────────────────┤
│ integration module  (job consumers, in the API process)   │
│ CW1 adapter (in/out) · tenant resolution · carrier events  │
│ D365 claims · PDF render · email · report scheduler        │
│ emissions · predictive-ETA client                          │
└────────────────────────────────────────────────────────────┘
       ↕ pg-boss jobs (same DB)  ↕ eAdapter XML          ↕ REST
   Postgres · Blob (files)        CargoWise One      Rate engine · D365 · carriers · Power BI
```

### B.2 Repository layout (monorepo — Nx or Turborepo)

```
apps/
  noatum-customer-portal-ui/            React + Vite SPA (ADR-002), MSAL, TanStack Query, react-hook-form + zod, i18next, MapLibre
  noatum-customer-portal-api/                   NestJS REST API + job consumers (pg-boss) in one process; src/integration/cw1/ holds the XML code
  cw1-simulator/         Fake CW1 for local dev and tests (see B.5)
packages/
  design-system/         tokens.css, fonts, Button, SectionHeading, StatCounter, Input, Select, Tabs, NewsCard, Header, Footer
  shared-types/          DTOs, zod schemas, permission constants, canonical enums, TIER_DEFAULT_FLAGS
infra/
  bicep/ or terraform/   Azure resources per environment
  docker-compose.yml     Postgres, simulator
```

### B.3 Backend module map (NestJS)

| Module | Owns | Phase |
|---|---|---|
| `identity` | OIDC (Entra External ID for customers, Entra ID for staff), local MFA accounts, session | P1 |
| `tenancy` | CustomerGroup (hierarchy, tier, feature flags), CustomerAccount (CW1 org code) | P1 |
| `authz` | Role, Permission, PermissionGuard, impersonation with audit | P1 |
| `users` | User CRUD, invitations, locale, notification prefs | P1 |
| `quotes` | Quote, QuoteVersion, QuoteOption, ChargeLine, status machine | P1 |
| `templates` | Quote + booking templates | P1 |
| `address-book` | Entries, CSV/XLSX import with validation report | P1 |
| `news` | NewsItem authoring, targeting, validity | P1 |
| `dashboard` | Widget registry, WidgetLayout per user | P1 (shell) |
| `integration` | IntegrationMessage log, adapter interfaces, mapping tables, DLQ, replay | P1 |
| `audit` | AuditEvent, AnalyticsEvent stream | P1 |
| `api-management` | ApiClient, scopes, quotas (foundation) | P1 |
| `shipments` | Shipment, Consol, ContainerUnit, TransportLeg, MilestoneEvent | P2 |
| `documents` | Document, DMS refs, internal-only taxonomy, zip download | P2 |
| `finance` | FinancialTransaction, addressee rule | P2 |
| `notifications` | Notification, Subscription, AlertRule, rule engine | P2 (standard) / P3 (advanced + email rules) |
| `reports` | ReportDefinition, ReportSchedule, exports | P2 (standard) / P4 (self-service, Power BI) |
| `bookings` | Booking, milestone gate, doc upload → CW1 | P3 |
| `sailing-schedule` | Schedule search, ranking | P3 |
| `claims` | Claim, D365 case sync, thread | P3 |
| `emissions` | EmissionFactor, EmissionRecord, EmissionsAdapter | P4 |
| `intelligence` | Predictive ETA, disruption feed, benchmarking | P4 |
| `assistant` | Chatbot with tenant-scoped RAG, tool calls | P4 |
| `po-links` | POLink, OM platform feed | P5 |

### B.4 Cross-cutting technical rules

- **API**: REST, OpenAPI generated from NestJS decorators, versioned `/v1`. Every endpoint has `@RequirePermission()` and runs inside tenant context.
- **Database**: PostgreSQL. Migrations (Prisma or TypeORM — pick one, stay with it). Every tenant table has `customer_group_id NOT NULL` + index. RLS policies enabled on those tables.
- **Jobs**: pg-boss in Postgres, enqueued in the same transaction as the business write. Every job idempotent — dedupe key = source message ID + portal ID. Retry with backoff; failed jobs stay in pg-boss's failed table (our DLQ). Raw CW1 payload kept in `integration_message.payload` with a 13-month retention delete. `JobQueue` interface allows a move to Service Bus when volume demands (ADR-004).
- **Adapter location**: all adapters run in `integration-worker` except `RateEngineAdapter`, which runs inside `platform-api` and is called synchronously (25 s timeout, circuit breaker) because instant quotes must answer in under 30 s.
- **Caching**: none in Phase 1. Postgres serves master data and permissions directly. Add a cache inside the owning service when a measured p95 requires it.
- **Observability**: structured JSON logs and Azure Application Insights, with a correlation ID that travels portal → API → job → CW1 message. Event-latency and failed-job counts as metrics.
- **Security**: server-side permission checks only; tenant-isolation test suite runs in CI (user of group A must get 404/403 for every entity of group B); secrets in Key Vault; public endpoints (Phase 2) behind WAF, rate-limited and bot-protected. Identity is Entra's job: the SPA signs in with MSAL, the API validates tokens — we write no login, session, password or MFA code.
- **i18n**: i18next, EN (US) + ES from the first slice; business-language catalog table for event names and charge names.
- **Brand**: `DD.MM.YYYY` dates; no emoji, no exclamation marks in any customer-facing text (UI, email, PDF, chatbot).
- **Environments**: Dev → Test → UAT → Prod, IaC, CI/CD, per-customer feature flags.

### B.5 The CW1 simulator — build it first in the integration lane

Real CW1 access depends on OQ-2 (open). Do not wait. Build `apps/cw1-simulator`: a small NestJS app that
1. accepts eAdapter-style inbound XML (quote, booking) at an endpoint,
2. writes it to a log,
3. after a configurable delay, posts an outbound message back to the platform (priced quote, booking confirmation, shipment events on a timer).

Also mock the **rate engine** (OQ-1 open): returns rates for 3–4 seeded lanes, "no rate" for the rest. This lets you test the instant and the manual quote path from day one. When real CW1 is available, only the adapter's endpoint configuration changes.

---

## Part C — Phase-by-phase plan

Each phase lists: goal · features (with PRD reference and priority) · backend · frontend · integration · open questions · exit criteria · tests.

---

## Phase 1 — Foundation + Quotation

**Goal**: a pilot customer can log in, see a branded dashboard, and get a quote that round-trips through CW1 (or the simulator). Admin onboarding is configuration only.

### Features

| Ref | Feature | Priority |
|---|---|---|
| FG-8.1 | Customer administration: organisations, group CW1 org codes into CustomerGroups, hierarchies, tiers, feature flags, appoint Customer Admins, impersonation with audit | P0 |
| FG-8.2 | Customer self-service admin: create/deactivate users, assign predefined roles, invitation emails with expiring links | P0 |
| FG-8.4 | Role management: roles as permission sets, sub-permissions, server-side checks | P0 |
| §8a | Design-system implementation: tokens, chrome (red top bar, logo band, nav, red footer), core components | P0 |
| FG-6 | Dashboard framework: widget registry, per-user layout, minimal widget set (active quotes, news, standalone-app links) | P0 (minimal) |
| §5 | CW1 integration layer: message log, adapter interfaces, mapping tables, DLQ, archive | P0 |
| FG-9.3 | API foundation: OpenAPI, ApiClient table, key/scope model (no external GA yet) | P0 |
| FG-3.1 | **Quotation end-to-end**: wizard per mode, instant + manual path, statuses, option cards, charge lines, branded PDF, accept/reject, versions, copy, cancel | P0 |
| FG-3.2 (part) | Template Manager and Address Manager (shared tooling) | P0 |
| FG-4.4 (subset) | Quote status notifications (in-app, bell) | P0 |
| FG-4.5 | News & banners authoring tool | P0 |
| FG-8.6 (part) | Product-analytics event instrumentation (events emitted, no dashboards yet) | P0 |

### Backend

**Tables (≈ 20)**: customer_group, customer_account, user, user_invitation, role, permission, role_permission, user_role, impersonation_session, quote, quote_version, quote_option, quote_charge_line, quote_status_history, template, address_book_entry, address_import_job, news_item, notification, widget_layout, integration_message, mapping_status, mapping_charge_code, master_unloco, master_currency, api_client, audit_event, analytics_event.

**Quote status machine**: Draft → Requested → (Instant: Quoted | Manual: In Progress → Quoted) → Accepted | Rejected (→ new version in Requested) | Expired | Cancelled. Accept is validity-checked on the server. Accepted content is frozen.

**Chargeable weight**: Air = max(actual kg, CBM × 166.67). Sea LCL = max(CBM, tonnes) in "revenue tons". FCL = per container. Put this in `shared-types` so web and API use the same function.

### Frontend screens

Login · Dashboard · Quote list (Grid/Detail/Card) · Quote wizard (Mode & service → Route → Cargo → Additional services → References → Review) with draft autosave · Quote detail (options, charge lines, PDF, timeline, versions, Accept / Reject-with-reason) · Templates · Address book (CRUD, import wizard with row-level validation report, export) · Customer Admin (users, roles, invitations) · Noatum Admin (customer groups, org codes, feature flags, roles designer, news authoring, impersonation) · Notification bell · News pop-up/banner.

### Integration

- `TmsQuoteAdapter` (CW1): outbound quote request / accept / reject / cancel as eAdapter inbound messages, portal ID in AdditionalReference; inbound "quote priced" and "staff-created quote" adoption for mapped org codes.
- Rate engine: synchronous REST client behind `RateEngineAdapter` (mock until OQ-1 decided).
- Master data: scheduled import of UNLOCO, currencies, org codes, charge codes from CW1 extracts (or seed files until available).
- PDF renderer (worker): branded quote PDF from a design-system template.
- Email sender (worker): invitation and quote-status emails from branded templates.

### Open questions touching this phase

OQ-1 (rate engine — blocks the quote-submission slice), OQ-2 (CW1 eAdapter config — blocks integration build), OQ-9 (carrier name disclosure on quotes), OQ-13 (fonts/logo), OQ-14 (status colours).

### Exit criteria (from PRD)

Pilot customers quoting live against CW1 · admin onboarding = configuration only · brand review sign-off on the UI.

### Tests

Tenant-isolation suite (group A cannot read group B) · permission guard on every endpoint · quote status machine unit tests · idempotency test (same CW1 message twice = one record) · visual regression on core components · accessibility (WCAG 2.1 AA) on wizard and dashboard.

### Delivery order (Phase 1)

| Order | Deliverable |
|---|---|
| 1 | Monorepo, Docker Compose, CI, observability baseline, design-system package (tokens + 5 components), CW1 simulator skeleton |
| 2 | Tenancy + identity: tables, OIDC login, tenant context, RLS base repository, first protected endpoint with isolation test |
| 3 | Roles/permissions, guard, seed preset roles, Customer Admin user screens, invitation flow |
| 4 | App shell (Header/nav/footer), dashboard with widget registry and 2 widgets, news banner + authoring |
| 5 | Quote wizard (3 modes), autosave, validation, chargeable weight; quote list and detail |
| 6 | Integration module: message log, adapter interfaces, mapping tables, master-org import, tenant resolver, API foundation, simulator round-trip, rate-engine mock, instant vs manual |
| 7 | Accept/reject, versions, PDF, templates, address book, first end-to-end demo |
| 8 | Hardening, impersonation, analytics events, master-data imports, real CW1 connection once OQ-2 clears, pilot onboarding, brand review |
