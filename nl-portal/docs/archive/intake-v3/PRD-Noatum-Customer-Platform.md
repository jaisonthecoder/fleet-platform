# PRD — Noatum Logistics Customer Information Platform

## Full Platform (Air & Sea) — All Feature Groups

| | |
|---|---|
| **Document owner** | Mohamed (Sponsor) |
| **Version** | 2.1 — Full-platform draft, aligned to the Noatum Logistics Design System |
| **Date** | 02.09.2026 |
| **Status** | For build |
| **Primary backend TMS** | CargoWise One (CW1) — platform designed TMS-agnostic |
| **Sources** | Noatum Logistics Customer Information Platform — Strategic Requirements (Feature Groups 1–10); Noatum Logistics Design System (`noatum-designsystem.md`) |

---

## 1. Problem Statement

Noatum Logistics operates in 25+ countries with 100+ offices, but its customer-facing digital landscape is fragmented across siloed systems — CargoWise One (CW1) for Air & Sea operations, PVPO for purchase order management, and standalone visibility tools. Customers have no single place to track shipments, request quotes, book, receive documents and invoices, raise claims, or analyze their logistics data. The result is heavy email/phone traffic into operations, inconsistent customer experience, and a competitive disadvantage against digital-first forwarders.

This PRD defines the **Logistics Customer Information Platform**: one portal delivering end-to-end visibility, self-service quotation and booking, proactive alerting, claims, analytics, and administration — with CW1 as the primary operational system of record, a TMS-agnostic integration architecture, and a user interface built on the official **Noatum Logistics Design System**.

## 2. Goals

1. **Single digital front door**: one login for tracking, quoting, booking, documents, invoices, alerts, claims, and reporting across Air & Sea.
2. **Real-time, predictive visibility**: all shipment hierarchy levels (Shipment, Consol, Container, Customer Reference, Vessel/Flight) with milestones published ≤ 3h of occurrence (Air, Cargo IQ compliant) and AI-driven predictive ETA/ETD.
3. **Digitize commercial flows**: 100% of quotes and bookings visible in the portal regardless of origin (portal or CW1); instant quotes < 30 s where rates exist; zero rekeying for portal-originated transactions.
4. **Shift service left**: configurable alerts, self-service reporting, self-service user administration, and an AI chatbot deflect routine inquiries from operations teams.
5. **Foundation for scale**: multi-tenant customer-group model with row-level security, TMS-agnostic ingestion, and API-first design so new modes, TMSs, and modules are configuration + adapters, not rebuilds.
6. **One brand, everywhere**: every surface — public tools, portal, PDFs, emails — is rendered from the Noatum design-system tokens so the platform is unmistakably Noatum from the first pixel.

**Program-level non-goals** (v1 across all phases):

- Replacing CW1/TMS operational workflows — the platform is the customer layer, never the system of record for operations.
- Rate procurement/management — rates live in CW1 or the designated rate engine.
- Full PO management workflows — PO *visibility* is in scope; PO lifecycle management stays in the dedicated OM platform with deep links (per FG 2).
- Carrier contract management, WMS, road/rail modes (architecture must not preclude them).
- Redesigning the Noatum brand — the platform consumes the design system as-is; token changes flow from the brand team, not from this project.

## 3. Users & Personas

| Persona | Description | Key needs |
|---|---|---|
| **Public visitor** | Anonymous user with a reference | Basic track & trace, CO2 calculator, sailing schedules |
| **Customer Standard User** | Shipper/consignee employee | Track, documents, alerts, subscribed notifications |
| **Customer Quoting/Booking User** | Commercial/logistics staff | Quotes, bookings, templates, address book, sailing selection |
| **Customer Finance User** | AP/finance | Invoice & credit-note visibility, financial tables, spend reports |
| **Customer Analyst** | Supply-chain analyst | Self-service reports, Power BI dashboards, BYOBI feeds |
| **Customer Admin** | Manages the org in the portal | Users, roles, address book, notification rules, report sharing |
| **Noatum Ops/Pricing (internal)** | Operates in CW1 | Elevated visibility, portal reflects CW1 work automatically |
| **Noatum Customer Success (internal)** | Onboards & supports customers | Customer setup, impersonation, news publishing, training analytics |
| **Noatum Platform Admin (internal)** | Governs the platform | Feature flags, role definitions, integrations, API management, usage analytics |

## 4. Scope & Requirements by Feature Group

Priorities: **P0** = must-have for the module's go-live · P1 = fast-follow · P2 = future/designed-for.

---

### FG-1 · Shipment Visibility & Track & Trace (Air & Sea)

**1.1 Public vs. logged-in experience**
- **P0 Public T&T**: search by customer reference or Noatum references (HBL, HAWB, container, booking ref). Shows critical-path milestones only (configurable set), Noatum office/agent contact — **no** documents, party addresses, financials, predictive data, or analytics. Rate-limited and bot-protected.
- **P0 Logged-in T&T**: full feature set below by default, restrictable per customer configuration.

**1.2 Search & result views (P0)**
- Unified search across milestones/events, container & shipment numbers, Noatum refs, customer refs, PO refs, document types, invoice numbers. Type-ahead, recent searches, saved filters.
- Switchable, saveable result views: **Grid / Detail / Card**; column chooser; export of result grid.

**1.3 Milestones & events**
- **P0 Air**: IATA Cargo IQ milestone/event framework; mandatory critical-path milestones published ≤ 3 h of actual occurrence; Cargo IQ naming; custom events supported.
- **P0 Sea**: FCL, LCL, buyers/sellers consols, bulk, import-only. Container events from carrier/3rd-party APIs, augmented by AI data-quality tooling (dedupe, conflict resolution, gap-filling).
- **P0 Visibility setup**: admins hide "internal" events at global or customer level; internal Noatum users see everything except content flagged financial/restricted.
- **P0 TMS-agnostic critical path**: canonical event model with mapping tables per source system (CW1 first; TMS2/TMS3 later) producing unified event codes, names, and critical milestone paths.

**1.4 Predictive ETA/ETD & AI data quality**
- **P1 Predictive ETA/ETD** per leg from historical carrier performance, congestion, port/terminal metrics, vessel/flight telemetry — displayed alongside carrier ETA with confidence indicator and delta vs. original.
- **P1 Congestion & disruption intelligence**: proactive notices for congestion/strikes/weather affecting in-progress shipments; market-wide disruption feed; alternative-routing suggestions where available (P2).
- **P1 Carrier/trade-lane benchmarking**: on-time performance comparisons; scheduled vs. actual transit reports.
- **P1 CO2 visibility**: predicted (in-progress) and final (closed) kg CO2e per shipment in detail view; dedicated grid column; filter by emission band (low/med/high).

**1.5 Documents (P0)**
- All TMS-provided + manually uploaded documents visible unless the document type is tagged **internal-only** (internal invoices/correspondence, rated B/L, etc. — tag taxonomy admin-managed).
- Single download and **mass download** (zip package per shipment).
- Financial documents: invoices/credit notes visible **only** where the user's company entity is the addressee.

**1.6 Financial visibility (P0)**
- On-screen table of invoices & credit notes incl. charge lines and totals (no download needed), permission-gated (Finance role), same addressee rule as 1.5.

**1.7 Visibility configuration (P0)**
- Per customer/customer-group feature flags for documents, financials, predictive data, market insights, and other premium features.

**Acceptance highlights**: public search never leaks addresses/documents/financials even via API; event latency SLO measurable in monitoring; a CW1 event mapped as internal is invisible to customer users at every surface (grid, detail, alerts, exports, chatbot).

---

### FG-2 · Purchase Order Management Integration

- **P1 PO data on shipment (config-gated)**: when enabled for a customer group, shipment detail shows a simplified PO panel — POs linked to the shipment, PO lines, order references — ingested via API (or equivalent) from the OM platform/PVPO successor.
- **P1 Deep link/handover** to the OM platform for advanced order management (SSO-passed context).
- **P1 Search** by SKU, PO, and line details (customer + internal users) when enabled.
- **P1 OM reporting integration**: OM-customer reports accessible from the T&T page.
- **P0 (architecture)**: enable/disable per customer group; PO entities in the canonical data model from day one so linking is a data feed, not a schema change.

---

### FG-3 · Quotation & Booking Management

A booking = (a) started in the portal, or (b) created in the TMS (e.g., CW1). **All** quotes and bookings must be visible to the customer.

**3.1 Quotations (P0)**
- **Request wizard** per MoT (Air / Sea FCL / Sea LCL): mode & service, incoterm, direction; route (UN/LOCODE / IATA + optional door addresses from address book); cargo lines with live chargeable weight (Air 1:6000) & CBM, FCL container picker, commodity/HS, DG (UN no. + class mandatory if flagged), temp-control; additional services (customs O/D, insurance, pickup, delivery, packing); references & remarks; review & submit. Draft autosave.
- **Instant + manual paths**: submit → rate/quote engine call (CW1 rate mgmt or designated engine — OQ-1). Rates found → status **Quoted** with options; otherwise → **In Progress**, CW1 quote record created and routed to owning branch; CW1 completion flows back automatically. Statuses: Requested / In Progress / Quoted (+ Accepted, Rejected, Expired, Cancelled).
- **Quote presentation**: option cards (carrier/service disclosure configurable), charge-line tables (charge, basis, qty, rate, currency, amount), totals per currency, validity, transit estimate, branded PDF (design-system template — see §8a), activity timeline, version history.
- **Confirm/Reject**: Accept (within validity, server-enforced) → **Accepted — ready to book**, frozen content, CW1 notified. Reject & request changes (reason codes + text) → new version in Requested, prior versions read-only.
- **Quote actions**: templates (create from any quote), copy quote → new quote, copy quote → template, cancel un-booked quotes.
- **P0 Quote engine integration**: real-time, synchronous pricing for instant quotes; fully integrated (no swivel-chair).

**3.2 Booking (P0)**
- **Path 1 — convert quote**: "Book" from My Quotes converts an accepted quote into a booking, pre-filled.
- **Path 2 — direct booking**: start without a quote; if instant pricing possible, show quote inline → accept → continue; else create a manual quote request and hold the booking as *started/incomplete*.
- Booking captures everything needed for execution: locations, addresses, shipment/cargo data, customer references, documents.
- **Document upload** (packing lists, commercial invoices, certificates): stored in central DMS, transferred to CW1 at submission.
- **Sailing-schedule integration (P1)**: for Sea bookings/conversions, select FCL/LCL sailing options inline (see FG-9.2).
- **Predictive CO2 at booking (P1)**: once shipment + locations entered, show predicted CO2 with disclaimer (informational only).
- **Post-confirmation**: display Noatum shipment reference deep-linking to Track & Trace.
- **Booking actions**: templates, copy booking → template / → new booking, cancel until a configurable milestone (default: prior to origin receipt — OQ-5).
- **Shared tooling (P0)**: Template Manager (quotes + bookings: add/edit/delete/share org-wide) and **Address Manager** (CRUD, CSV/XLSX import with mapping + row-level validation report, XLSX export).

**Acceptance highlights**: CW1-created quotes/bookings for mapped org codes appear in the portal ≤ 60 s (push) with correct status mapping; a booking converted from a quote carries the quote's commercial terms immutably; cancelled bookings past the milestone gate are blocked server-side with a clear message.

---

### FG-4 · Alerts, Notifications & Communication

- **4.1 Standard in-app alerts (P0)** — on by default, per-user deactivatable: crisis events affecting in-progress shipments (strike/war/weather), potential delay (updated vs. original ETA), congestion warning, ETD-close-but-info-missing (definition OQ-6), customs hold. Notification center (bell + banner), deep links to shipment/group, mark single/all as read.
- **4.2 Advanced in-app alerts (P1)** — off by default, activatable by user or by Noatum per customer tier (SME/large/VIP): departed-but-documents-missing, arrived-not-cleared in X days, delivery delay; extensible rule catalog.
- **4.3 Email notification rules (P1)**: self-service **rule builder** (per account & transport mode) from configuration blocks: trigger (event/status/reference change/document posted) + scope (all shipments / filtered) + recipients (validated against customer domain) + frequency (immediate/digest). Customer Admin owns recipient management (liability shift). Email templates rendered from the design system (§8a).
- **4.4 Per-shipment subscriptions (P0)**: from T&T, subscribe to predefined events for one shipment/container (departed, arrived, customs cleared, loaded on board; extensible).
- **4.5 News & information (P0)**: internal authoring tool (role-gated) for pop-ups (every login / once) and banners; categorization global/country/region; validity from–to; display kinds warning/info/hint; used for downtime, regional alerts, release notes, marketing. Content follows the brand voice rules (§8a): sentence-case headlines, `DD.MM.YYYY` dates, "Read more…" links, no emoji or exclamation marks.
- **4.6 AI agent & chatbot (P1)**: conversational assistant grounded on T&T data, guidelines & regulations, DG rules, shipping-document knowledge, and self-service guides; can initiate bookings and quote requests (handing into the wizards); **hard tenant isolation** — retrieval strictly scoped to the authenticated user's customer group; escalation to human creates/updates a Dynamics 365 case with the conversation transcript attached. Bot copy adheres to the brand voice (confident, service-led, no emoji).

---

### FG-5 · Claims & Incidents (P1)

- Structured submission form: incident type, affected shipment(s), description, attachments.
- Auto case creation in **Dynamics 365 CRM** with all portal data + attachments; assignment to responsible team by mode and station.
- Real-time status (open / in-progress / resolved / closed), two-way comments triggering follow-ups for Noatum staff, full history per claim.
- Resolution notification via email + in-app.

---

### FG-6 · Dashboard & Logistics Overview (P0)

Widget-based landing page; widgets configurable in size, placement, show/hide (per-user persisted). v1 widget set: last 5 active bookings · shipments with potential delays · last 5 crisis/awareness notifications · last 5 active quotations · last 5 tracking searches · last 5–10 opened shipments/containers · **map of active shipments** · trade-lane overview · top 5 published reports · top 5 own self-service reports · "Did you know" · Noatum News section (rendered as design-system NewsCards) · standalone-app links. Widget framework is a platform capability (new widgets = registration, not release). Headline metrics use the design-system **StatCounter** pattern (red thin-line icon, red stat figure, red divider).

---

### FG-7 · Reporting & Advanced Analytics

- **7.1 Standard in-app reports (P0)**: pre-built, centrally maintained (Shipment Status & Detail, Volume, Spend, SOP Validations), combinable standard filters, export XLSX/PDF/CSV (PDF exports on the branded template, §8a), **scheduling** to own email or same-domain/same-customer-group addresses. No customer modification.
- **7.2 Self-service report builder (P1)**: field picker, filter picker, free column order, aggregations, export + scheduling as above; personal and org-shared reports.
- **7.3 Embedded Power BI (P1)**: pre-built dashboards (transit-time performance, carrier reliability, SLA adherence) embedded with full drill-down, **no customer license required** (app-owns-data embedding); Noatum admin interface to assign report visibility per customer. Power BI theme JSON derived from the design-system palette so embedded content matches the portal.
- **7.4 BYOBI (P2)**: governed data API/feed for large customers to pull their own data into their BI/ERP; admin controls users, permissions, call quotas.
- **RLS everywhere (P0)**: every tier — in-app, scheduled exports, Power BI (dataset RLS), BYOBI — filters by customer group; verified by automated cross-tenant tests.

---

### FG-8 · Platform Administration, User Management & Training

- **8.1 Customer administration (P0)**: create/deactivate/maintain organizations; group CW1 org codes into customer groups; **customer hierarchies** (parent → children) driving visibility & role targeting; customer tier & premium feature flags; report assignment; appoint Customer Admins; role presets; impersonation with audit trail.
- **8.2 Customer self-service admin (P0)**: Customer Admin creates/deactivates users, assigns predefined roles (booking, quoting, T&T, claims, address book, finance) and report access. Invitation flow with expiring links (branded email template).
- **8.3 News administration (P0)**: see FG-4.5.
- **8.4 Role management (P0)**: internal role/permission designer — roles as named permission sets; **sub-permissions** (e.g., submit-but-not-modify booking, create-but-not-submit quote templates, manage-address-book-without-delete). Permission checks enforced server-side on every endpoint.
- **8.5 Interactive training & onboarding (P1)**: native or integrated third-party walkthroughs (e.g., first booking, first quote, how to track, manage profile, create org users); completion tracked. Walkthrough styling themed to the design system where the tool allows.
- **8.6 Platform analytics for Noatum (P1)**: customer/profile stats, active vs. inactive users, features enabled vs. used, quotes/bookings created vs. converted (per customer + global), user stats (last login, registration date, internal/external), module usage & clicks, onboarding drop-off points, least-used features, features driving support load. Built on a product-analytics event stream instrumented from day one (P0 instrumentation).

---

### FG-9 · Standalone Applications & Integrations

- **9.1 CO2 emission calculator**: **public** (no login) predictive CO2 for entered shipment details, ideally comparing modes and flagging the most CO2-efficient; "convert to quote/booking" requires login. Same engine powers FG-1.4/FG-3.2 CO2 figures. (P1)
- **9.2 FCL/LCL sailing schedule**: public with restricted visibility; search services/departures; ranking by fastest / most reliable carrier / least disruptions / best CO2; convert result to quote/booking (login required); embedded in the booking flow. (P1)
- **9.3 Full platform API (P0 foundation)**: internal API layer connecting internal systems/data sources; external API surface for customers (feeds BYOBI); **API management module** for keys, scopes, quotas, and monitoring.
- Public standalone apps share the portal's design-system header/footer (red top bar, red footer) so they read as one Noatum property.

---

### FG-10 · Preconditions & Assumptions (P0, cross-cutting)

- **TMS/ERP agnostic**: generic ingestion; canonical models + per-source mapping (CW1 adapter first).
- **Identity**: SSO and Active Directory/Entra ID supported; local accounts with MFA; extensible IdP methods; **row-level security** on all data paths.
- **Scalability**: high volumes of shipment/container/event/OM data; event-driven, queue-backed ingestion; horizontal scaling.
- **Multi-language**: full i18n; AI-supported/on-the-fly translation governed by a controlled business-language catalog (event names, charge names). English (US) + Español at launch, mirroring the brand's site languages.
- **Logging & monitoring**: structured logs, distributed tracing with correlation IDs across portal ↔ integration ↔ CW1, SLO dashboards, alerting (incl. integration DLQ depth and event-latency SLOs).

## 5. CargoWise One Integration Architecture (P0)

CW1 is the primary system of record for shipments, consols, containers, events, documents, invoices, organizations, quotes, and bookings. The platform maintains a synchronized read projection plus write flows for quotes/bookings.

| Flow | Direction | Mechanism |
|---|---|---|
| Shipments/consols/containers + milestones | CW1 → Platform | eAdapter outbound **UniversalShipment / UniversalEvent** XML, event-triggered push to platform endpoint (queue-polling fallback) |
| Documents (eDocs) | CW1 → Platform | eAdapter outbound with document payload/reference; stored in platform DMS with type tags (internal-only taxonomy applied on ingest) |
| Invoices / credit notes | CW1 → Platform | eAdapter outbound **UniversalTransaction** (AR); addressee entity captured for visibility rule |
| Quote request / accept / reject / cancel | Platform → CW1 | eAdapter inbound Native/Universal quote messages; portal ID as AdditionalReference |
| Quote priced / staff-created quotes | CW1 → Platform | eAdapter outbound on quote save/status trigger |
| Booking create/update/cancel + uploaded docs | Platform → CW1 | eAdapter inbound UniversalShipment (booking) + eDoc attach |
| Booking confirmations & refs | CW1 → Platform | eAdapter outbound |
| Instant rates | Platform ↔ rate engine | Synchronous REST (CW1 rate mgmt or external engine — OQ-1) |
| Master data (org codes, charge codes, UNLOCO, currencies, vessels) | CW1 → Platform | Scheduled extracts / reference API, cached with daily refresh |
| Carrier events enrichment | Carriers/3rd parties → Platform | Carrier APIs / visibility providers (OQ-3), merged with CW1 events by AI data-quality layer |
| Claims | Platform ↔ Dynamics 365 | Dataverse API (cases, comments, attachments) |

**Integration service requirements**: single owner of all CW1 traffic; schema versioning; idempotency (CW1 message ID + portal ID dedupe); retry with backoff + DLQ; raw message archive (13-month retention); configurable status/event **mapping tables** (never hard-coded); correlation model that also adopts CW1-originated quotes/bookings for mapped org codes; latency SLOs — CW1 event visible in portal ≤ 60 s (push) / ≤ 5 min (fallback); portal-originated writes visible in CW1 ≤ 60 s. Failures never surface as customer errors; entities hold last consistent state with ops alerting.

**TMS-agnostic layer**: all flows behind adapter interfaces (`TmsTrackingAdapter`, `TmsQuoteAdapter`, `TmsBookingAdapter`, `TmsFinanceAdapter`, `TmsDocumentAdapter`). Phase scope implements only CW1 adapters; adding TMS2 = new adapter + mapping config.

## 6. Data Model (canonical core)

- **CustomerGroup** (hierarchy, tier, feature flags) → **CustomerAccount** (CW1 org code, branch, country).
- **User** (roles[], permissions, notification prefs, locale) · **Role/Permission** framework.
- **Shipment** (mode, direction, refs, parties, critical path) → **Consol**, **ContainerUnit**, **TransportLeg** (vessel/flight, ports, ETD/ETA/ATD/ATA, predictive ETA + confidence), **MilestoneEvent** (canonical code, source, internal flag, timestamps), **Document** (type tag, internal flag, DMS ref), **FinancialTransaction** (invoice/credit note, addressee entity, charge lines), **POLink** (PO, line, SKU refs), **EmissionRecord** (predicted/final kg CO2e, band).
- **Quote** (version chain, status, options with charge lines, validity, source portal|cw1) · **Booking** (status, milestone gate, quote link, uploaded docs) · **Template** · **AddressBookEntry**.
- **AlertRule** / **Subscription** / **Notification** · **NewsItem** · **Claim** (D365 case ref, thread) · **ReportDefinition** / **ReportSchedule** · **WidgetLayout** · **ApiClient** (scopes, quotas) · **IntegrationMessage** · **AuditEvent** · **AnalyticsEvent**.

RLS: every read path scoped by customerGroup in the data-access layer (not UI); internal users bypass per elevated-visibility rules except financial/restricted flags.

## 7. Non-Functional Requirements

- **Security**: OIDC; SSO (Entra ID/SAML) + local MFA accounts; server-side permission checks on every endpoint; tenant-isolation test suite in CI; secrets vaulted; encryption in transit/at rest; public endpoints rate-limited + bot-protected; chatbot retrieval tenant-scoped by construction.
- **Performance**: shipment/quote lists < 2 s at 100k rows/group; search < 1.5 s; wizard steps < 300 ms; instant quote < 30 s; dashboards < 3 s.
- **Scale**: event ingestion sized for millions of milestone events/month; stateless app tier; queue-backed ingestion & notifications.
- **Availability**: 99.5% v1 → 99.9% target; graceful degradation when CW1/carrier APIs are down (serve projection, queue writes).
- **Compliance**: GDPR-aligned PII handling; retention policies per artifact class; full audit for admin actions & impersonation.
- **i18n**: EN (US) + ES at launch; controlled business-language catalog; AI-assisted translation pipeline (P1); brand date format `DD.MM.YYYY` across locales unless a locale rule overrides.
- **Accessibility**: WCAG 2.1 AA. Note: brand red `#AA272F` on white passes AA for normal text (≈ 6.9:1); verify contrast wherever red text sits on gray `#F5F5F3` surfaces and for muted gray `#A7A7A6` text (fails AA for body copy — muted gray is decorative/meta only).
- **Observability**: per FG-10 — logs, traces, SLO dashboards, synthetic public-T&T checks.

## 8. Technical Stack (recommendation)

- **Frontend**: React + TypeScript (Next.js); **UI built on the Noatum Logistics Design System** (§8a) — its CSS tokens are the single source of truth for color, type, spacing, and radii; components implemented per the design-system recipes (Button, SectionHeading, StatCounter, Input/Select, Tabs, NewsCard, Header, Footer) and extended for app patterns (tables, badges, wizards, timelines) under the same rules. TanStack Query, react-hook-form + zod, i18next, map component (MapLibre/Azure Maps) for shipment maps.
- **Backend**: modular monolith → services on .NET 8 or NestJS; REST + OpenAPI; async workers (integration, notifications, report scheduling); event bus (Azure Service Bus).
- **Data**: PostgreSQL/Azure SQL (OLTP, RLS at repository layer); Redis; blob storage (DMS + message archive); analytics store (Synapse/Fabric) feeding Power BI + BYOBI; product analytics event pipeline.
- **AI**: predictive ETA models + data-quality services (managed ML); chatbot on an LLM with tenant-scoped RAG over the platform DB + approved content, tool-calls into quote/booking wizards; guardrails + evaluation harness.
- **Identity**: Microsoft Entra External ID (customers) + Entra ID (internal); fits Dynamics 365 & Power BI estate.
- **Hosting**: Azure, IaC (Bicep/Terraform), CI/CD Dev→Test→UAT→Prod; WAF/CDN on public apps.

### 8a. Design System & Brand Requirements (P0)

The platform implements the **Noatum Logistics Design System** (`noatum-designsystem.md`, authoritative). Engineering requirements:

- **Tokens**: import the design-system CSS tokens verbatim as the theme layer (Tailwind config / CSS variables). Core values — brand red `#AA272F` (primary, hover `#8E2027`), logo navy `#002C5F` (logo & dark hero use only), charcoal `#333333` headings, gray `#58595B` body, hairline `#E5E5E5`, section gray `#F5F5F3`; buttons/inputs 4px radius; **cards square-cornered** with shadow `0 2px 14px rgba(0,0,0,.10)`; ~1170px container; 64–96px section padding.
- **Typography**: single humanist sans; **Mulish** as the substitute until the proprietary brand font files are provided (OQ-13); weights 700–800 for headings/nav, 400 body; no serifs; ALL-CAPS only for eyebrows and footer column headings.
- **Signature motif**: 40×3px red rule under section headings, alignment following the heading.
- **Chrome**: red utility top bar; white logo band; white main nav (bold charcoal links, hairline bottom border); solid brand-red footer with white ALL-CAPS column headings and `›` markers.
- **Components**: primary buttons solid red / outline variant only (per recipe); folder-style Tabs; NewsCard patterns for FG-4.5/FG-6; StatCounter for dashboard KPIs; thin-stroke red line icons (Lucide stroke 1.5 in `--color-primary` until original SVG set is supplied).
- **Status color extension** (app-specific, brand-governed): because brand red is the primary action color, statuses must not compete with it — define a semantic set as design-system extension tokens: success `#2E7D32`-class green, warning amber, informational **navy `#002C5F`**, neutral grays; destructive/error states reuse brand red sparingly. This extension is documented and submitted back to the brand team for ratification (OQ-14).
- **Logo**: never redrawn; use provided assets (`Noatum-Logistics-RGB.svg` / white variant) — plain type placeholder until originals are supplied.
- **Voice & content**: confident, service-led B2B ("we" Noatum / "you" client); benefit-first copy with concrete operational nouns; sentence-case headlines; dates `DD.MM.YYYY`; "Read more…" link pattern; hashtag **#EnablingTrade** where marketing-appropriate; **no emoji, no exclamation marks** — applies to UI microcopy, notifications, emails, chatbot, and PDFs.
- **Branded outputs**: quote/booking PDFs, scheduled report emails, notification emails, and invitation emails all render from design-system templates (red header band, Mulish, red heading rule, red footer).
- **No** gradients (outside photography), no rounded feature cards, no blur/transparency effects, no scale/bounce animations — plain fast fades only.
- **Governance**: design tokens versioned as a shared package; visual regression tests on core components; deviations require brand-team sign-off.

## 9. Delivery Roadmap (phased)

| Phase | Scope (feature groups) | Exit criteria |
|---|---|---|
| **P1 — Foundation + Quotation (≈ wks 1–18)** | Platform core: identity, customer/group model, roles (8.1/8.2/8.4), **design-system implementation (§8a: tokens, chrome, core components)**, dashboard framework (FG-6 minimal), CW1 integration layer, API foundation (9.3). **FG-3.1 Quotations end-to-end** (instant + manual), templates, address book, quote notifications (4.4 subset), news tool (4.5). | Pilot customers quoting live against CW1; admin onboarding = configuration only; brand review sign-off on the UI |
| **P2 — Visibility (≈ wks 12–30, overlapping)** | **FG-1**: logged-in T&T (search, views, milestones Air Cargo IQ + Sea, documents, financial visibility, config), public T&T, standard alerts (4.1) + per-shipment subscriptions (4.4), full dashboard widgets, standard reports (7.1) with RLS. | Event-latency SLO met; pilot customers tracking + documents + invoices in portal |
| **P3 — Booking + Claims (≈ wks 26–42)** | **FG-3.2 Booking** (both paths, doc upload → CW1, cancel gates), sailing schedule integrated + standalone (9.2), **FG-5 Claims** with D365, advanced alerts (4.2) + email rule builder (4.3). | Portal bookings executing in CW1; claims round-trip with D365 |
| **P4 — Intelligence & Analytics (≈ wks 38–56)** | Predictive ETA/ETD, disruption intelligence, benchmarking, CO2 (1.4 + 9.1 public calculator), self-service reporting (7.2), embedded Power BI (7.3, branded theme), chatbot (4.6), training walkthroughs (8.5), platform analytics (8.6). | Predictive accuracy baseline published; chatbot tenant-isolation certified |
| **P5 — Ecosystem (≈ wks 52+)** | PO management integration (FG-2), BYOBI (7.4), external API GA + API mgmt module, additional TMS adapter, additional languages. | First external customer consuming APIs/BYOBI |

Each phase ships behind customer-level feature flags — rollout is per customer group, not big-bang.

## 10. Success Metrics

**Leading**: ≥ 60% of pilot quote requests via portal in 60 days; instant-quote median < 30 s; Air milestone latency ≤ 3 h compliance ≥ 95%; weekly active users / registered ≥ 50%; alert opt-in retention (not mass-disabled) ≥ 80%; wizard completion ≥ 80%.
**Lagging (quarterly)**: "where is my shipment" emails/calls per shipment −40%; quote→booking conversion vs. email baseline; internal handling minutes per quote/booking −50%; document-request tickets −60%; portal NPS ≥ +30; % CW1 quotes/bookings visible in portal = 100%; chatbot containment ≥ 40% of eligible queries (P4).

## 11. Open Questions

| # | Question | Owner | Blocking |
|---|---|---|---|
| OQ-1 | Instant-quote pricing source: CW1 rate management vs. external quote engine? | Pricing + IT | P1-M3 |
| OQ-2 | CW1 instance capabilities: eAdapter config, enabled message sets for quotes/bookings/eDocs/AR, outbound triggers, environments | CW1 team | P1 integration build |
| OQ-3 | Carrier visibility/enrichment provider(s) for Sea container events & predictive data (build vs. buy) | IT + Ops | P2/P4 |
| OQ-4 | Public T&T critical-milestone set ("TBD" in source) | Product + Ops | P2 |
| OQ-5 | Booking cancellation milestone gate ("TBD" in source) | Ops | P3 |
| OQ-6 | Definition of "ETD close but shipment information missing" alert | Ops | P2 |
| OQ-7 | PO/OM platform target (PVPO successor?) and its API surface | OM product owner | P5 |
| OQ-8 | Training/walkthrough tool: build vs. integrate (Pendo/WalkMe/Userpilot class) | Product | P4 |
| OQ-9 | Carrier name disclosure policy on quotes/schedules per customer | Commercial | No |
| OQ-10 | Customer tiers (SME/large/VIP) definition driving advanced-alert & premium-feature defaults | Commercial | P2 |
| OQ-11 | Emission methodology & factors source (GLEC-conformant engine?) incl. disclaimer text | Sustainability + Legal | P4 |
| OQ-12 | Languages beyond EN/ES at launch; business-language catalog ownership | Product | No |
| OQ-13 | Proprietary brand font files + original logo SVGs and icon set from the brand team (Mulish/Lucide substitutions until then) | Brand team | No (P1 polish) |
| OQ-14 | Ratification of the app status-color extension tokens (§8a) by the brand team | Brand team | No (P1 polish) |

## 12. Assumptions

- CW1 eAdapter licensed/enabled with TEST + PROD, reachable from platform network; Noatum CW1 team available for message-set configuration.
- Dynamics 365 CRM is the claims/case system; Power BI is the advanced-analytics tool; Azure is the target cloud.
- Noatum nominates pilot branches and 2–3 pilot customers per phase.
- Order management remains in a dedicated OM platform; the portal provides visibility + deep links only.
- Rate coverage exists for instant quoting on pilot trade lanes.
- The Noatum Logistics Design System (`noatum-designsystem.md` and, when available, its full folder with `styles.css`, `assets/`, `components/`) is the authoritative UI reference; brand team supplies original fonts, logos, and icons (OQ-13).
- All architecture choices in P1 (identity, org model, roles, canonical models, adapters, widget & notification frameworks, analytics events, design tokens) are foundational for FG-1–9 and reviewed as such.
