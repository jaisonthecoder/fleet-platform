# PRD — Noatum Logistics Customer Information Platform

## Full Platform (Air & Sea) — All Feature Groups

| | |
|---|---|
| **Document owner** | Mohamed (Sponsor) |
| **Version** | **4.0** — supersedes v3.0 and v2.1 |
| **Date** | 09.09.2026 |
| **Status** | For build |
| **Primary backend TMS** | CargoWise One (CW1) — platform designed TMS-agnostic |
| **Sources** | PRD v2.1 and v3.0 · Noatum Logistics Design System (`noatum-designsystem.md`) · design and review notes (see §14) · **KT session with the CargoWise and Noatum operations teams, 09.09.2026** (minutes and Q&A log in the document set) |

### What changed in v4.0 — from the KT session of 09.09.2026

The governing principle of this version: **nothing established is thrown away.** Where the KT session revealed a different way of working, that way is added as an **additional supported option**, and the previously designed path is retained as capability. The platform supports both and is configured per region, branch or customer.

| # | Change | Where |
|---|---|---|
| 1 | **No rate management exists today.** Confirmed by the business. The instant-quote path is therefore **retained as designed capability but has no configured source**, and is not a Phase 1 commitment. The manual path is the operating reality | §2, FG-3.1, §10, OQ-1 |
| 2 | **Structured manual quotation becomes the Phase 1 quotation feature.** Internal pricing in the portal (FG-3.3) moves from a later addition into Phase 1, because it is what standardises the work that actually happens today | FG-3.1, FG-3.3, §9 |
| 3 | **Quote-drafted customer email is consumed as a service, not built.** A separate team owns the AI email drafting; the platform integrates with it through an interface and treats the draft as editable content requiring human action to send | FG-3.3, §5 |
| 4 | **Quote, booking and shipment are three distinct entities in CW1.** A quote is *linked* to a booking by quote number, one-to-many; a booking is separately converted into a shipment. **Both linkage styles are supported**: the portal's convert-from-quote journey is retained for the customer, and it is implemented by carrying the quote number in the payload | FG-3.2, §6 |
| 5 | **Critical milestones confirmed**: picked up, departed, ETA, arrived, delivered — with loaded-at-export and unloaded-at-import as the sea equivalents | FG-1.1, FG-1.3 |
| 6 | **Visibility policy differs by content type.** Events: show all, exclude a short flagged list. Documents: **allow-list only**, because document typing is manual and unvalidated and a mistagged rated bill of lading must never reach a customer | FG-1.3, FG-1.5 |
| 7 | **Carrier data arrives through CW1's own carrier integrations.** A separate visibility provider is no longer a Phase 2 dependency; it stays as an optional enrichment | FG-1.3, §5, OQ-4 |
| 8 | **Delay detection is ours to build.** Carriers do not reliably send a revised ETA and detection is manual today. Simple ETA-variance detection moves into the alerting scope rather than waiting for the predictive phase | FG-4.1, FG-1.4 |
| 9 | **Branch scoping added for internal users.** One branch must not see another branch's internal quotes. Cross-branch internal quoting is a recognised future use of the same mechanism | FG-3.3, FG-8.4, §4a.5 |
| 10 | **Organisation model confirmed and clarified.** One CW1 organisation per legal entity with many addresses beneath it, each with its own code; no hierarchy in CW1. Portal grouping is at **organisation level only**, created manually, with Noatum's MDM programme as a possible future source | §4a.3, FG-8.1, §6 |
| 11 | **Booking cancellation gate confirmed**: blocked once cargo is picked up or delivered off-site, with a hard stop at the Shipped event | FG-3.2, OQ-6 closed |
| 12 | **Pilot definition updated**: one customer and one region to start, chosen from the top customers by CW1 transaction volume. **The foundation must support any region and any branch without rework** | §9, §12 |
| 13 | **Portal roles are independent of CW1 roles** — explicitly agreed, and unchanged from v3.0 | §4a.5 |
| 14 | Open questions closed by the session are retired; new ones raised are added | §11 |

### What changed in v3.0

| # | Change | Where |
|---|---|---|
| 1 | **Identity and access rewritten.** Microsoft Entra handles all authentication for both internal staff and external customers, including customer federation and email-password accounts with MFA. The platform writes no login, password, MFA or session code | §4a (new), FG-10, §8 |
| 2 | **User onboarding specified end to end** for internal and external users: invitation-only, no self-registration, first admin invited by Noatum, colleagues invited by the customer | §4a (new), FG-8.2 |
| 3 | **Tenancy model made explicit.** Single-owner tables carry a customer column; the shipment family uses a visibility link table, because one shipment can legitimately be visible to two customers | §6, §7 |
| 4 | **Customer-to-CW1 linking specified.** Visibility is granted only through CW1 organisation codes deliberately linked by Noatum. Nothing else grants access | §4a, §5 |
| 5 | **Internal quote pricing in the portal added** as a new capability (FG-3.3), with CW1 remaining the system of record. This narrows the "no operational workflows" non-goal — see §2 | FG-3.3 (new), §2 |
| 6 | **Runtime simplified.** One deployable, PostgreSQL only, jobs in the database, no cache server, no message broker. The v2.1 stack list was a recommendation; deviations are recorded | §8, §13 |
| 7 | **CW1 simulator is now optional.** If the integration team can supply API or test access early, the simulator is skipped or reduced. It is a contingency, not a deliverable | §5, §12 |
| 8 | **CO2 features deprioritised.** FG-1.4 CO2 visibility, FG-3.2 predicted CO2 and FG-9.1 the public calculator move to a later phase and are out of scope for planning purposes until reinstated | FG-1.4, FG-9.1, §9 |
| 9 | **Report access, restricted-content flag, observability and API foundation** added as explicit P0 items that were implied but unstated in v2.1 | FG-7.1, FG-1.5, FG-1.6, FG-9.3, FG-10 |
| 10 | Two-level customer hierarchy (parent → children) stated explicitly; deeper nesting removed | FG-8.1, §6 |

---

## 1. Problem Statement

Noatum Logistics operates in 25+ countries with 100+ offices, but its customer-facing digital landscape is fragmented across siloed systems — CargoWise One (CW1) for Air & Sea operations, PVPO for purchase order management, and standalone visibility tools. Customers have no single place to track shipments, request quotes, book, receive documents and invoices, raise claims, or analyze their logistics data. The result is heavy email and phone traffic into operations, inconsistent customer experience, and a competitive disadvantage against digital-first forwarders.

This PRD defines the **Logistics Customer Information Platform**: one portal delivering end-to-end visibility, self-service quotation and booking, proactive alerting, claims, analytics, and administration — with CW1 as the primary operational system of record, a TMS-agnostic integration architecture, and a user interface built on the official **Noatum Logistics Design System**.

## 2. Goals

1. **Single digital front door**: one login for tracking, quoting, booking, documents, invoices, alerts, claims, and reporting across Air & Sea.
2. **Real-time visibility**: all shipment hierarchy levels (Shipment, Consol, Container, Customer Reference, Vessel/Flight) with milestones published ≤ 3 h of occurrence (Air, Cargo IQ compliant).
3. **Digitize commercial flows**: 100% of quotes and bookings visible in the portal regardless of origin (portal or CW1); zero rekeying for portal-originated transactions; a **standardised quotation process** replacing email, spreadsheets and paper. **Instant quoting remains designed-for capability** and is enabled per region or customer if and when a rate source exists — it is not a Phase 1 commitment (v4.0, OQ-1).
4. **Shift service left**: configurable alerts, self-service reporting and self-service user administration deflect routine inquiries from operations teams.
5. **Foundation for scale**: multi-tenant customer-group model with row-level security, TMS-agnostic ingestion, and API-first design so new modes, TMSs and modules are configuration plus adapters, not rebuilds.
6. **One brand, everywhere**: every surface — public tools, portal, PDFs, emails — is rendered from the Noatum design-system tokens.
7. **No credential handling of our own**: authentication is delegated entirely to Microsoft Entra, for internal and external users alike.
8. **One foundation, any region** (v4.0): the pilot is one customer in one region, but identity, tenancy, organisation linking, branch scoping, mapping tables and integration must accommodate any region, branch or customer by configuration. Adding the second region must require no rework of these parts.
9. **Both ways of working supported** (v4.0): where regions or branches operate differently, the platform offers the alternatives side by side and is configured per region, branch or customer rather than forcing a single process.

**Program-level non-goals** (v1 across all phases):

- Replacing CW1/TMS operational workflows. **Narrowed in v3.0:** one operational task — pricing a quote that has no automatic rate — may be performed in the portal (FG-3.3), on the strict condition that CW1 receives the result and remains the system of record. No other operational workflow moves into the portal.
- Rate procurement or management. **v4.0:** no rate management system exists today; rates are held locally in spreadsheets and shared drives, with only carrier contract rates partly centralised. The portal records what a pricing user enters and never stores or manages rate tables. A rate source, when one exists, is connected through the existing interface.
- Full PO management workflows — PO *visibility* is in scope; PO lifecycle management stays in the dedicated OM platform with deep links (FG-2).
- Carrier contract management, WMS, road and rail modes (architecture must not preclude them).
- Redesigning the Noatum brand — the platform consumes the design system as-is.
- Building any authentication mechanism. Passwords, MFA, lockout, password reset, federation and session management are Entra's responsibility.
- **Building the AI email drafting service (v4.0).** A separate team owns it. The platform consumes it through an interface, presents the draft as editable content, and requires explicit human action before anything is sent.

## 3. Users & Personas

| Persona | Type | Description | Key needs |
|---|---|---|---|
| **Public visitor** | External, no account | Anonymous user with a reference | Basic track & trace, sailing schedules |
| **Customer Standard User** | External | Shipper/consignee employee | Track, documents, alerts, subscribed notifications |
| **Customer Quoting/Booking User** | External | Commercial/logistics staff | Quotes, bookings, templates, address book, sailing selection |
| **Customer Finance User** | External | AP/finance | Invoice & credit-note visibility, financial tables, spend reports |
| **Customer Analyst** | External | Supply-chain analyst | Self-service reports, Power BI dashboards, BYOBI feeds |
| **Customer Admin** | External | Manages the org in the portal | Users, roles, report access, address book, notification rules |
| **Noatum Customer Success** | Internal | Onboards and supports customers | Customer setup, org-code linking, invitations, news publishing, impersonation |
| **Noatum Pricing** | Internal | Prices quote requests without an automatic rate | Pricing queue, charge-line entry, submission (FG-3.3) |
| **Noatum Pricing Approver** | Internal | Approves priced quotes above a threshold | Approval queue (FG-3.3) |
| **Noatum Ops** | Internal | Operates in CW1 | Elevated read visibility in the portal; no operational editing except FG-3.3 |
| **Noatum Platform Admin** | Internal | Governs the platform | Roles, feature flags, mapping tables, integrations, API management, usage analytics |

**Persona boundary.** Internal users use the portal for administration, support and FG-3.3 pricing only. All other operational work stays in CW1.

---

## 4a. Identity, Access and User Onboarding (P0) — NEW IN v3.0

This section replaces the identity statements scattered through v2.1 (FG-8.2, FG-10, §8).

### 4a.1 Authentication — delegated to Microsoft Entra

| Audience | Directory | Sign-in options |
|---|---|---|
| **Internal Noatum staff** | Entra ID (corporate tenant) | Corporate SSO — the same account as their email, under existing conditional-access policy |
| **External customer users** | **Entra External ID** (separate tenant, invitation-only, self sign-up disabled) | (a) their company Microsoft account · (b) federation to the customer's own identity provider, configured in Entra · (c) an email-and-password account with multi-factor, created and managed by Entra |

Requirements:

- The platform **must not implement** login endpoints, password storage, MFA enrolment, lockout, password reset, home-realm discovery, sessions or refresh-token rotation.
- The browser application signs in with MSAL (authorization code with PKCE). The API is a resource server that validates the Entra access token, accepting exactly two issuers.
- The platform stores only an identity pointer (issuer plus subject) against each user record. Users are matched by that pointer, never by email address alone after first link.
- An authenticated Entra identity with no corresponding portal user and no pending invitation is refused. Possession of a Microsoft account grants nothing.
- Conditional access, MFA policy and device compliance are Entra policies, applied without a platform release.

### 4a.2 Account creation — invitation only

- **No self-registration exists.** There is no public sign-up page. (An optional public "request access" form that creates a ticket only is a candidate addition; not in scope.)
- **Noatum invites the first Customer Admin** of each customer, by name and company email address.
- **That Customer Admin invites all other users** at their company and assigns them roles. Noatum is not involved in the customer's subsequent user management.
- Invitations are single-use, expire (default 7 days, configurable), are stored only as a hash, and are bound to the invited email address. The identity used to accept must present the same email.
- The email domain must be one recorded for that customer. Only internal users may override, for agents or consultants.
- Resend is limited; revoke is immediate; expired and used links are refused with a clear message.
- **Internal users** are created the same way, by an existing Platform Admin, against the corporate tenant. The first Platform Admin is created by configuration.

### 4a.3 Customer onboarding — end to end

Ordered as it happens in the application. Steps 1 and 2 occur once; the rest repeat per customer.

| # | Actor | Step |
|---|---|---|
| 1 | Platform Admin | Platform readiness: internal roles seeded, CW1 organisation list imported (daily), mapping tables loaded, customer role presets seeded |
| 2 | Noatum, largely outside the portal | Branch readiness: CW1 messages reaching the platform, rates available for that branch's lanes, pricing and operations teams informed. **There is no "region" entity in the platform**; a region means one Noatum branch, and the branch appears only as a code on organisation records |
| 3 | Customer Success | Create the customer: search the imported CW1 organisation list, name and country pre-filled, then add tier, company email domains and feature flags. Status `Onboarding` |
| 4 | Customer Success | **Link the customer's CW1 organisation records.** Search the synced organisation list, select the organisations belonging to this customer, record a justification, confirm. Fully audited. **v4.0: linking is at organisation level only** — addresses beneath an organisation are not linked individually. *Optional control, subject to sponsor decision: a second internal person approves* |
| — | Platform | Automatic: existing shipments, invoices and CW1-created quotes carrying those organisation codes become visible to the customer, before any user logs in. Entities whose codes are unlinked are stored and visible to nobody |
| 5 | Customer Success | Invite the first Customer Admin |
| 6 | Customer Admin | Accept the invitation and sign in through Entra. Customer status becomes `Active` once at least one office is linked and one admin has accepted |
| 7 | Customer Admin | Invite colleagues, assign roles, optionally tie a user to a single office |
| 8 | Customer users | Address book, templates, notification preferences, first quote request |

**Growth is configuration, not development.** Adding an organisation, a customer, a branch, a region, a parent company, or switching a feature on are all administrative actions. **v4.0 requirement:** the pilot runs one customer in one region, but no part of identity, tenancy, organisation linking, branch scoping, mapping or integration may assume a single region or branch. The second region must cost configuration only. Three rules are set once, globally, to make that true: which CW1 party roles grant visibility; that only deliberately linked organisation codes grant visibility; and that a financial document is visible only to the office it is addressed to.

### 4a.4 Authorisation — three layers, all enforced server-side

| Layer | Mechanism |
|---|---|
| **Which customer's data** | Every request runs in a tenant context (the user's customer plus its children). Enforced twice: a filter in the data-access layer, and PostgreSQL row-level security as a second lock. Never in the UI |
| **Which actions** | A role is a named list of permission codes; a user may hold several and receives the union. Every endpoint declares the one permission it requires. Sub-permissions therefore exist by construction — for example create without submit |
| **Which features** | Per-customer feature flags, checked in the API and hidden in the UI |

Additional rule: a user may optionally be tied to one CustomerAccount (office). If set, that user sees only financial documents addressed to that office.

### 4a.5 Roles

**External presets** (Noatum defines, Customer Admin assigns):

| Role | Capability |
|---|---|
| Standard | Track & trace, documents, own profile and notifications |
| Quoting & Booking | Standard + quotes, bookings, templates, address book |
| Finance | Standard + invoices and credit notes, spend reports |
| Analyst | Standard + reports, self-service reports, scheduling |
| Claims | Standard + raise and comment on claims |
| Customer Admin | Standard + user management, role assignment, **report access assignment**, notification recipients, own audit, address-book delete |

**Internal presets**: Customer Success · Pricing (FG-3.3) · Pricing Approver (FG-3.3) · Ops (read across customers) · Platform Admin.

**Internal users carry a branch (v4.0).** Branch is an attribute of the internal user, used to scope the pricing queue and internal quote visibility, with an explicit permission for cross-branch access. Track and trace is not branch-scoped — internal visibility is open, as agreed. The portal's role model remains entirely independent of CW1's.

Rules: a Customer Admin may assign only external presets and only within their own customer; the last active Customer Admin of an active customer cannot be demoted or deactivated; role changes take effect on the next request without re-authentication; every change is audited with before and after.

### 4a.6 Impersonation, lifecycle, audit

- **Impersonation** requires `platform.impersonate`, a mandatory reason, is time-boxed (default 60 minutes), is **read-only**, shows a persistent banner, and records both identities on every audited action.
- **Deactivation** blocks the next request, revokes pending invitations, retains data and audit.
- **Suspension of a customer** blocks all its users; ingestion continues; data is retained.
- **Erasure** (later phase): personal data anonymised in the user record and in audit payloads; the row is retained for referential integrity. Retention period to be set by Legal.
- **Audit** covers every administrative action. Email addresses are stored hashed with the domain retained.

### 4a.7 Acceptance highlights

A user of customer A receives 404 for every entity of customer B, verified by an automated cross-tenant suite in CI · an invitation token cannot be reused, survives expiry, or be accepted by a different email · an Entra identity without an invitation cannot obtain access · a role change is effective on the next request · the last Customer Admin cannot be removed · no endpoint exists without a declared permission (enforced by a build-time test) · impersonation cannot write.

---

## 4. Scope & Requirements by Feature Group

Priorities: **P0** = must-have for the module's go-live · P1 = fast-follow · P2 = future/designed-for · **P3 (new in v3.0)** = deferred, out of current planning scope.

---

### FG-1 · Shipment Visibility & Track & Trace (Air & Sea)

**1.1 Public vs. logged-in experience**
- **P0 Public T&T**: search by customer reference or Noatum references (HBL, HAWB, container, booking ref). Shows critical-path milestones only — **confirmed set (v4.0): picked up, departed, ETA, arrived, delivered**, with loaded-at-export and unloaded-at-import as the sea equivalents of departed and arrived; the set remains configurable and Noatum office contact — **no** documents, party addresses, financials or analytics. Rate-limited and bot-protected. **v3.0:** when a reference matches shipments of more than one customer, the response shape and content are identical to a single match; the number of matches and the parties are never revealed. Implemented through a dedicated read path that cannot reach customer-scoped data.
- **P0 Logged-in T&T**: full feature set below by default, restrictable per customer configuration.

**1.2 Search & result views (P0)**
- Unified search across milestones/events, container & shipment numbers, Noatum refs, customer refs, PO refs, document types, invoice numbers. Type-ahead, recent searches, saved filters. **v3.0:** customer-reference fields are indexed from the outset so PO and SKU search (FG-2) is a data feed, not a search rebuild.
- Switchable, saveable result views: **Grid / Detail / Card**; column chooser; export of result grid.

**1.3 Milestones & events**
- **P0 Air**: IATA Cargo IQ milestone/event framework; mandatory critical-path milestones published ≤ 3 h of actual occurrence; Cargo IQ naming; custom events supported.
- **P0 Sea**: FCL, LCL, buyers/sellers consols, bulk, import-only. **v4.0:** carrier events arrive through **CW1's own carrier integrations** (EDI or API) where cargo is booked through CW1 or a carrier connection, so no separate visibility provider is required to deliver this scope. A third-party provider remains an optional enrichment behind the same adapter (OQ-4).
- **P0 Visibility setup**: admins hide internal events at global or customer level. Internal users see everything **except** content flagged restricted (see 1.5, 1.6).
- **P0 Event visibility policy (v4.0)**: CW1 holds roughly 664 generic events, neither categorised by mode nor flagged internal or customer-facing. Policy for **events** is **show all, exclude a flagged list** — transparency by default, with a short exclusion list (intercompany and internal invoices, the internal steps of customs clearance where only the final outcome is shown). A categorised critical-path list per mode is supplied by operations and loaded into the mapping tables. **Note the deliberate asymmetry with documents (1.5), which use an allow-list.**
- **P0 TMS-agnostic critical path**: canonical event model with mapping tables per source system (CW1 first) producing unified event codes, names and critical milestone paths.
- **P1 Data-quality augmentation**: dedupe, conflict resolution and gap-filling across CW1 and carrier sources. Every derived or merged value carries provenance and is overridable by a human with a recorded reason.

**1.4 Predictive and market intelligence**
- **P0 (moved earlier in v4.0) Simple delay detection**: carriers do not reliably send a revised ETA, and today detection is manual. The platform therefore computes ETA variance against the original and last-known values and raises the potential-delay alert itself (FG-4.1). This is arithmetic and rules, not a model, and is required for the alerting scope to have value.
- **P1 Predictive ETA/ETD** per leg from historical carrier performance, congestion and port metrics — displayed alongside carrier ETA with a confidence indicator and delta. Builds on the P0 variance detection above.
- **P1 Congestion & disruption intelligence**: proactive notices; market-wide disruption feed; alternative routing (P2).
- **P1 Carrier/trade-lane benchmarking**: on-time performance, scheduled versus actual transit.
- **P3 CO2 visibility** (was P1): predicted and final kg CO2e per shipment, grid column and emission-band filter. **Deferred in v3.0**; see FG-9.1.

**1.5 Documents (P0)**
- **Document visibility uses an allow-list (v4.0)**: only document types explicitly mapped and approved as customer-facing are visible. Anything unmapped, newly introduced, or of unknown type is hidden until classified. Rationale: document type is assigned manually by the uploading user in CW1 with no validation, and a mistagged **rated bill of lading** exposes freight rates to the customer. Confirmed never-visible types include intercompany invoices, other internal documents and rated bills of lading; the full type list with categories is supplied by operations.
- Approved document types on a standard shipment (v4.0, confirmed): packing list, commercial invoice, arrival notice, shipping notice, house bill of lading or house air waybill, master bill of lading or master air waybill, plus certificates (sanitary, origin) and dangerous-goods certificates where relevant.
- **v3.0 addition:** a separate **restricted** flag limits visibility for *internal* users too — restricted content requires an explicit internal permission. This implements the v2.1 statement that internal users see everything except content flagged financial or restricted.
- Single download and mass download (zip package per shipment).
- Financial documents visible only where the user's company entity is the addressee; where a user is tied to one office, only that office's documents.
- **v3.0 addition:** customer uploads are size-limited and virus-scanned before any onward transfer.

**1.6 Financial visibility (P0)**
- On-screen table of invoices and credit notes including charge lines and totals, permission-gated (Finance role), addressee rule as 1.5, restricted flag as 1.5.
- **v4.0 confirmations:** who is billed depends on Incoterms and the commercial agreement, with no single fixed rule; **two parties on one shipment can each receive their own invoice** (for example a supplier billed for pre-carriage and a consignee billed for the main leg); and **cross-trade billing exists**, where a third party such as the notify party is the paying customer. The platform therefore resolves financial visibility from the **addressee organisation on the transaction only**, never from the shipment's parties. Charge codes carry plain-language descriptions in CW1, which the platform surfaces; per-customer invoice description or format requirements are noted as a later consideration.

**1.7 Visibility configuration (P0)**
- Per customer feature flags for documents, financials, predictive data, market insights and other premium features.

**Acceptance highlights**: public search never leaks addresses, documents, financials or the existence of other customers, even via the API · event latency measurable in monitoring · an event mapped as internal is invisible to customer users at every surface (grid, detail, alerts, exports, reports) · a shipment naming two Noatum customers is visible to both, with financial documents private to each.

---

### FG-2 · Purchase Order Management Integration

- **P1 PO data on shipment (config-gated)**: when enabled, shipment detail shows a simplified PO panel — POs linked to the shipment, PO lines, order references — ingested from the OM platform.
- **P1 Deep link/handover** to the OM platform with SSO-passed context.
- **P1 Search** by SKU, PO and line details when enabled.
- **P1 OM reporting integration** accessible from the T&T page.
- **P0 (architecture)**: enable/disable per customer; PO entities present in the canonical model from the outset, so linking is a data feed rather than a schema change.

---

### FG-3 · Quotation & Booking Management

A booking is either (a) started in the portal, or (b) created in the TMS. **All** quotes and bookings must be visible to the customer.

**3.1 Quotations (P0)**
- **Request wizard** per mode (Air / Sea FCL / Sea LCL): mode and service, incoterm, direction; route (UN/LOCODE or IATA plus optional door addresses from the address book); cargo lines with live chargeable weight (Air 1:6000) and CBM, FCL container picker, commodity and HS code, dangerous goods (UN number and class mandatory when flagged), temperature control; additional services; references and remarks; review and submit. Draft autosave.
- **Two paths, both supported, configured per region, branch or customer (v4.0):**
  - **Manual path — the operating reality today, and the Phase 1 commitment.** On submit the request enters the **internal pricing queue** (FG-3.3) and, where configured, is also created as a quote request in CW1 for the owning branch. An authorised internal user prices it; the customer sees a priced quote once CW1 has it.
  - **Instant path — retained capability, no configured source today.** Where a rate source is connected for a lane, region or customer, the platform requests a price synchronously and returns options immediately. The interface exists and is exercised in tests with a stub; it is switched on per configuration when a source exists. **No Phase 1 promise depends on it.**
- Statuses: Requested / In Progress / Quoted / Accepted / Rejected / Expired / Cancelled, with the internal pricing states of FG-3.3 inserted into the manual path.
- **Organisation code selection is server-side.** The customer never sees or supplies a CW1 organisation code; where a customer has several linked offices the user selects by office name and the platform resolves the code.
- **Quote presentation**: option cards (carrier disclosure configurable per customer), charge-line tables, totals per currency, validity, transit estimate, branded PDF, activity timeline, version history.
- **Confirm/Reject**: Accept within validity, server-enforced, freezing content and notifying CW1. Reject with reason codes creates a new version; prior versions read-only.
- **Quote actions**: templates, copy quote, copy to template, cancel un-booked quotes.

**3.2 Booking (P0)**
- **Path 1 — book from an accepted quote (retained, with corrected mechanics).** The customer journey is unchanged: a "Book" action on an accepted quote pre-fills the booking. **v4.0 correction to the mechanics:** CW1 does not convert a quote into a booking. A booking is a separate entity **linked** to the quote by quote number, and the relationship is **one-to-many** — several bookings and shipments may reference one quote. The platform therefore carries the quote number in the booking payload and lets CW1 establish the link; no conversion call exists. The portal still retains the quote's commercial terms as a snapshot on the booking for the customer's own record and for dispute handling, but it is a copy for display, not the authority.
- **Booking is not a shipment (v4.0).** In CW1 a booking is separately converted into a shipment before execution, and in practice operators often create the shipment or consol record directly and attach the booking reference afterwards. The platform models **three entities — quote, booking, shipment** — and does not assume a one-to-one chain. A portal booking is complete when CW1 acknowledges it; the shipment reference may arrive later and is linked when it does.
- **Path 2 — direct booking**: start without a quote; instant pricing inline where available, otherwise a manual quote request with the booking held incomplete.
- Booking captures everything needed for execution: locations, addresses, shipment and cargo data, customer references, documents. **v4.0:** CW1 imposes few hard requirements to start a shipment — principally the controlling customer — so the portal's validation is driven by what operations need in practice, not by CW1's minimum, and is maintained as configuration rather than code.
- **Document upload** stored in the platform DMS and transferred to CW1 at submission, after virus scanning.
- **Sailing-schedule integration (P1)** — data provider not yet identified (§11).
- **P3 Predicted CO2 at booking** (was P1) — deferred with FG-9.1.
- **Post-confirmation**: display the CW1 shipment reference, deep-linked to Track & Trace.
- **Booking actions**: templates, copy, cancel until the milestone gate, enforced server-side. **v4.0 confirmed gate:** cancellation and change are blocked once cargo has been picked up or delivered to an off-site location such as a packing facility, with a **hard stop at the Shipped event** after which no portal change is possible. Configurable, with these values as the default.
- **Shared tooling (P0)**: Template Manager and Address Manager (CRUD, CSV/XLSX import with mapping and row-level validation report, XLSX export).

**3.3 Internal quote pricing in the portal (P0 in v4.0 — was P1)**

An authorised internal user prices a customer's quote request **in the portal** instead of logging into CW1, with the result written back to CW1. This narrows the operational non-goal in §2.

**Promoted to P0 in v4.0.** Since no rate management exists, every quote is priced by a person today, largely outside CW1 in email and spreadsheets. Standardising that work is the quotation feature, not an addition to it. Pricing in CW1 remains fully supported — a quote priced there flows into the portal as already priced, and neither route is mandatory.

- **CW1 remains the system of record.** A quote priced in the portal is not presented to the customer until CW1 has accepted it. Sync states: pending, confirmed, failed. A failed sync is visible to internal users only and raises an operations alert.
- **CW1 wins every conflict.** If CW1 returns different values for a quote the portal priced, CW1's values are stored, the portal's version is retained in the pricing history, and the pricing user is notified.
- **Adoption unchanged**: a quote priced in CW1 by staff who prefer CW1 flows into the portal as already priced. Neither route is mandatory.
- **Single ownership**: a request must be claimed before it can be priced; claims are visible, expire after a configurable period, and can be force-released by an approver with an audit record. If CW1 prices a claimed request, CW1's price applies, the claim is released and the pricing user is notified without losing their draft.
- **Approval**: submission above a configurable value threshold requires approval by a different internal user. Below the threshold it proceeds directly.
- **Cost and margin**, if captured, are internal-only data. Internal charge lines and cost fields must be stripped in a single output mapper and must not appear on any customer surface: list, detail, PDF, grid export, report export, notification email, external API, or assistant. Internal users without an explicit cost permission are also refused.
- **No rate management.** The platform records what the pricing user enters. Rate lookup remains wherever it happens today.
- **Branch scoping (v4.0).** Internal users carry a branch. The pricing queue is scoped so that one branch does not see another branch's internal quotes, with an explicit permission for cross-branch visibility. **Cross-branch internal requests** — one branch asking another for its local charges — are a recognised future use of the same queue and must not be precluded by the design.
- **Drafted customer email (v4.0).** A separate team provides an AI drafting service. The platform calls it through an interface, presents the returned draft as **editable** content alongside the priced quote, and requires explicit human action to send. If the service is unavailable the flow continues with a template. The platform never generates or sends unattended customer correspondence.
- **Structured request in, standard output out.** The value is that the customer's request arrives complete and structured, the operator prices in one screen with the request and history beside them, and the customer receives a consistent branded quote — replacing email, spreadsheets and paper.
- **Full pricing history**: claim, price, submit, approve, reject with mandatory reason, sync — each with a snapshot of the charge lines at that moment.

**Acceptance highlights**: a priced quote reaches the customer only after CW1 confirmation · a second user cannot edit a claimed request · a submitter cannot approve their own quote · a customer token receives no cost or internal charge line on any surface · retrying the write to CW1 does not create a duplicate CW1 quote.

**Open**: whether cost and margin are captured at all; the approval threshold; the Head of Pricing's appetite and vision, being confirmed by the business (§11).

**Acceptance highlights (FG-3 overall)**: CW1-created quotes and bookings for linked organisation codes appear in the portal ≤ 60 s (push) with correct status mapping · a booking converted from a quote carries the quote's commercial terms immutably · cancellations past the milestone gate are blocked server-side.

---

### FG-4 · Alerts, Notifications & Communication

- **4.1 Standard in-app alerts (P0)** — on by default, per-user deactivatable: crisis events affecting in-progress shipments, potential delay, congestion warning, ETD-close-but-information-missing, customs hold. Notification centre with deep links; mark single or all as read.
- **v4.0: the platform detects delays itself.** Carriers do not reliably issue a revised ETA and detection is manual today, so the potential-delay alert is computed from ETA variance against the original and last-known values (FG-1.4). **Customs holds** already reach CW1 through its customs integrations and today trigger an email to an operator who then contacts the customer by hand; the portal surfaces the hold to the customer automatically, which is a direct removal of manual work.
- **4.2 Advanced in-app alerts (P1)** — off by default, activatable by user or by Noatum per customer tier: departed-but-documents-missing, arrived-not-cleared in X days, delivery delay; extensible catalogue.
- **4.3 Email notification rules (P1)**: self-service rule builder from configuration blocks — trigger, scope, recipients (validated against the customer's domains), frequency. Customer Admin owns recipient management. Templates rendered from the design system.
- **4.4 Per-shipment subscriptions (P0)**: subscribe to predefined events for one shipment or container.
- **4.5 News & information (P0)**: internal authoring tool for pop-ups and banners; scope global, country or customer; validity window; kinds warning, info, hint. **v3.0:** region scope removed until a business need arises.
- **4.6 AI assistant (P1)**: conversational assistant grounded on T&T data, guidelines and self-service guides; can initiate bookings and quote requests; **hard tenant isolation** with retrieval scoped to the authenticated user's customer; escalation creates a Dynamics 365 case with transcript. Must respect internal-only and restricted flags and must never expose cost data (FG-3.3).

---

### FG-5 · Claims & Incidents (P1)

- Structured submission form: incident type, affected shipments, description, attachments.
- Automatic case creation in **Dynamics 365 CRM** with portal data and attachments; assignment by mode and station.
- Real-time status, two-way comments, full history per claim.
- Resolution notification by email and in-app.

---

### FG-6 · Dashboard & Logistics Overview (P0)

Widget-based landing page; widgets configurable in size, placement and visibility, persisted per user. v1 widget set: last 5 active bookings · shipments with potential delays · last 5 crisis notifications · last 5 active quotations · last 5 tracking searches · recently opened shipments · map of active shipments · trade-lane overview · top published reports · own self-service reports · "Did you know" · Noatum News · standalone-app links. Widget framework is a platform capability. **v3.0:** an internal pricing-queue widget is added for FG-3.3 roles.

---

### FG-7 · Reporting & Advanced Analytics

- **7.1 Standard in-app reports (P0)**: pre-built and centrally maintained (Shipment Status & Detail, Volume, Spend, SOP Validations), combinable filters, export XLSX/PDF/CSV, scheduling to own or same-customer addresses. **v3.0 addition:** an explicit **report assignment** model — Noatum assigns reports to a customer, and the Customer Admin grants individual users access (closing an unstated gap in v2.1 FG-8.2).
- **7.2 Self-service report builder (P1)**: field and filter pickers, column order, aggregations, export and scheduling; personal and shared reports.
- **7.3 Embedded Power BI (P1)**: pre-built dashboards embedded app-owns-data with no customer licence; admin assigns visibility per customer; theme derived from the design system.
- **7.4 BYOBI (P2)**: governed data API or feed for large customers; admin controls users, permissions and quotas.
- **RLS everywhere (P0)**: every tier — in-app, scheduled exports, Power BI dataset RLS, BYOBI — filters by customer, verified by automated cross-tenant tests.

---

### FG-8 · Platform Administration, User Management & Training

- **8.1 Customer administration (P0)**: create, suspend and maintain customers; link CW1 organisation codes with justification and audit; **two-level hierarchy (parent → children)** maintained in the portal, driving visibility; customer tier and premium feature flags; report assignment; appoint Customer Admins; role presets; impersonation with audit. An "unassigned" view lists entities whose organisation codes are not linked to any customer.
- **v4.0 organisation model, confirmed with operations.** CW1 has **no hierarchy function**. Each legal entity is one organisation, with many addresses beneath it — billing, delivery, pickup, bill-of-lading and others — each carrying its own code and stated purpose; large customers may have hundreds of addresses. Consequences: (a) grouping in the portal is **at organisation level only**, never address level; (b) the hierarchy is the portal's own construct, created and maintained **manually** by an internal user; (c) Noatum's master-data programme is expected to introduce financial and commercial hierarchies in future, and the portal must be able to adopt it as a source without redesign — the manual grouping is therefore a pluggable input, not a fixed process.
- **8.2 Customer self-service admin (P0)**: as specified in §4a.2 and §4a.5 — invitations with expiring single-use links, role assignment, report access, deactivation, optional office restriction.
- **8.3 News administration (P0)**: see FG-4.5.
- **8.4 Role management (P0)**: roles as named permission sets with sub-permissions by construction; server-side checks on every endpoint; presets seeded. A role-designer user interface is deferred; custom roles remain possible as data.
- **v4.0 confirmations.** The portal's role model is **independent of CW1's** — explicitly agreed, and reinforced by the possibility that CW1 is replaced in future. **Track and trace requires no special internal roles**: internal transparency is acceptable for visibility. **Internal quoting requires branch scoping** (FG-3.3). **Platform administration requires distinct roles**, for example administrator versus viewer, and a narrow role able to create a customer user or a report without wider edit rights.
- **8.5 Interactive training & onboarding (P1)**: walkthroughs, completion tracked.
- **8.6 Platform analytics for Noatum (P1)**: customer and user statistics, features enabled versus used, quotes and bookings created versus converted, onboarding drop-off, least-used features, support-driving features. Built on an event stream instrumented from the outset (P0 instrumentation). **v3.0:** adds FG-3.3 metrics — queue age, time to price, portal versus CW1 pricing split, approval rates.

---

### FG-9 · Standalone Applications & Integrations

- **9.1 CO2 emission calculator — P3, deferred.** Public predictive CO2 for entered shipment details with mode comparison. **Out of scope for current planning**, together with FG-1.4 CO2 visibility and FG-3.2 predicted CO2 at booking. The methodology, provider and disclaimer decision remains unresolved. Architecture must not preclude it: an emissions record entity stays in the canonical model.
- **9.2 FCL/LCL sailing schedule (P1)**: public with restricted visibility; search services and departures; ranking by fastest, most reliable or least disrupted; convert to quote or booking with login; embedded in the booking flow. **Data provider not yet identified** (§11).
- **9.3 Platform API (P0 foundation)**: internal API layer, OpenAPI published, API client model with scopes; external surface and key issuance deferred to the ecosystem phase. **v3.0:** stated explicitly as a P0 foundation slice, which v2.1 implied but did not schedule.
- Public standalone apps share the design-system header and footer.

---

### FG-10 · Preconditions & Assumptions (P0, cross-cutting)

- **TMS/ERP agnostic**: generic ingestion; canonical models plus per-source mapping (CW1 adapter first). All external systems sit behind adapter interfaces.
- **Identity**: as specified in §4a. Entra ID for staff, Entra External ID for customers, no platform-side credential handling, row-level security on all data paths.
- **Scalability**: high volumes of shipment, container, event and OM data; queue-backed ingestion; horizontal scaling of the stateless tier.
- **Multi-language**: full internationalisation, English (US) and Spanish at launch, governed by a controlled business-language catalogue for event and charge names.
- **Logging & monitoring (P0, explicit in v3.0)**: structured logs, a correlation identifier travelling browser → API → job → CW1 message, latency and failure metrics, dashboards and alerting on ingestion latency and failed-job depth. Delivered as a foundation slice, not retrofitted.
- **Accessibility (P0, explicit in v3.0)**: WCAG 2.1 AA verified in CI on every screen.
- **Performance budgets (P0, explicit in v3.0)**: enforced per slice — see §7.

---

## 5. CargoWise One Integration Architecture (P0)

CW1 is the primary system of record for shipments, consols, containers, events, documents, invoices, organisations, quotes and bookings. The platform maintains a synchronised read projection plus write flows for quotes and bookings.

| Flow | Direction | Mechanism |
|---|---|---|
| Shipments/consols/containers + milestones | CW1 → Platform | Event-triggered push of Universal shipment and event messages to a platform endpoint; polling fallback |
| Documents | CW1 → Platform | Outbound with document payload or reference; stored in the platform DMS with type tags applied on ingest |
| Invoices / credit notes | CW1 → Platform | Outbound transaction messages; addressee organisation captured for the visibility rule |
| Quote request / accept / reject / cancel | Platform → CW1 | Inbound quote messages; portal identifier carried as an additional reference |
| **Priced quote from the portal (FG-3.3)** | **Platform → CW1** | **Inbound quote message with charge lines; idempotent on quote and version; confirmation required before the customer sees the price** |
| **Drafted customer email (FG-3.3)** | Platform → drafting service → Platform | Interface call to the service owned by another team; the returned draft is editable and requires human action to send; a template fallback applies if unavailable |
| Quote priced or created in CW1 | CW1 → Platform | Outbound on quote save or status change |
| Booking create/update/cancel + documents | Platform → CW1 | Inbound booking message plus document attach, **carrying the quote number so CW1 links the booking to the quote (v4.0)**; the booking-to-shipment step remains a CW1 activity and the shipment reference is linked when it arrives |
| Booking confirmations & references | CW1 → Platform | Outbound |
| Instant rates | Platform ↔ rate source | Synchronous request within the customer's HTTP request, with a timeout falling through to the manual path. **v4.0: no source is configured today**; the interface is implemented and stub-tested, enabled per region or customer when a source exists |
| Master data (organisation codes, charge codes, UN/LOCODE, currencies, vessels) | CW1 → Platform | Scheduled extract or reference interface, refreshed daily |
| Carrier events enrichment | **CW1 → Platform (primary, v4.0)** · providers → Platform (optional) | Carrier data reaches CW1 through its own carrier EDI and API integrations and arrives with the event stream. A third-party provider remains optional behind the same adapter, merged with provenance retained |
| Claims | Platform ↔ Dynamics 365 | Dataverse interfaces (cases, comments, attachments) |

**Integration service requirements**: single owner of all CW1 traffic; schema versioning; idempotency (source message identifier plus portal identifier); retry with backoff and a failed-message store; raw message retention (13 months); configurable status and event **mapping tables**, never hard-coded; correlation model that also adopts CW1-originated quotes and bookings for linked organisation codes; latency objectives — a CW1 event visible in the portal ≤ 60 s on push, ≤ 5 min on fallback; portal-originated writes visible in CW1 ≤ 60 s. Integration failures never surface to customers as errors; entities retain the last consistent state with operations alerting.

**Tenant resolution (explicit in v3.0).** Inbound messages identify parties only by CW1 organisation code. The platform resolves ownership solely by matching those codes to the CustomerAccounts deliberately linked during onboarding, under a single global policy stating which party roles grant visibility. Entities with no matching code are stored and visible to nobody, and appear in the unassigned view. A reply whose organisation code no longer maps to the originating customer is quarantined rather than applied.

**Transport assumption.** v2.1 assumed CW1's eAdapter component is licensed and enabled. **This remains unconfirmed** (§11). All flows sit behind adapter interfaces, so a different transport — scheduled extracts, files, or another interface supplied by the integration team — changes one layer and no business logic.

**Test and development access (changed in v3.0).** v2.1 relied on a CW1 simulator built by the project. In v3.0 the simulator is **optional and contingent**: if the integration team can provide API access, a test instance or representative sample messages early, the simulator is reduced to a minimal message stub or skipped entirely. If access is delayed, a simulator is built to the extent needed to keep development and demonstrations moving. In either case the platform must be indifferent to which is connected — the only difference is configuration. Any simulator is never deployed to production.

**TMS-agnostic layer**: all flows behind adapter interfaces (tracking, quote, booking, finance, document, rate). Current scope implements CW1 only; a second TMS is a new adapter plus mapping configuration.

---

## 6. Data Model (canonical core)

- **CustomerGroup** (two-level hierarchy, tier, feature flags, email domains, identity mode) → **CustomerAccount** (CW1 organisation code, branch, country, status).
- **User** (customer, optional single-office restriction, identity pointer, roles, notification preferences, locale) · **Role / Permission** framework · **UserInvitation** · **ImpersonationSession**.
- **Shipment** (mode, direction, references, critical path) → **ShipmentParty** (role, organisation code), **Consol**, **ContainerUnit**, **TransportLeg**, **MilestoneEvent** (canonical code, source, internal flag, provenance), **Document** (type tag, internal flag, restricted flag), **FinancialTransaction** (addressee organisation, restricted flag, charge lines), **POLink**, **EmissionRecord** (retained for the deferred CO2 scope).
- **ShipmentVisibility** — the link table granting a customer sight of a shipment, with the party roles and organisation codes that produced the grant. **A shipment may be visible to more than one customer; a financial document to only one.**
- **Quote** (version chain, status, options, charge lines with internal flag, validity, source portal-instant / portal-internal / cw1, claim and pricing fields, branch, sync state) · **QuotePriceEvent** (pricing history) · **Booking** · **Shipment** · **Template** · **AddressBookEntry**.
- **Quote, booking and shipment are three separate entities (v4.0)** with a many-to-one relationship from booking to quote and from shipment to booking. The model must not assume a one-to-one chain, and a booking may exist with its shipment reference arriving later or never.
- **CustomerAccount is an organisation-level link (v4.0).** Addresses beneath a CW1 organisation carry their own codes; the platform links organisations only. Where a shipment or transaction references an address-level code, resolution maps it to its parent organisation — **subject to confirmation (OQ-3a)**.
- **AlertRule / Subscription / Notification** · **NewsItem** · **Claim** · **ReportDefinition / ReportAssignment / ReportSchedule** · **WidgetLayout** · **ApiClient** · **IntegrationMessage** · **AuditEvent** · **AnalyticsEvent** · **MappingTable** entities.

**Tenancy patterns.** Single-owner entities carry a customer identifier with an index and a row-level security policy. The shipment family carries none and is scoped through ShipmentVisibility, with child entities inheriting through their shipment. Internal users bypass the customer scope but not the internal-only or restricted flags.

---

## 7. Non-Functional Requirements

- **Security**: authentication delegated to Entra (§4a); server-side permission checks on every endpoint; tenancy enforced in the data layer and by row-level security; a cross-tenant isolation suite in CI; secrets vaulted; encryption in transit and at rest; public endpoints rate-limited and bot-protected; assistant retrieval tenant-scoped by construction; internal cost data stripped in a single output mapper with tests on every customer surface.
- **Performance** (enforced per slice): shipment and quote lists < 2 s at 100k rows per customer; search < 1.5 s; wizard steps < 300 ms; instant quote < 30 s; dashboards < 3 s.
- **Scale**: ingestion sized for millions of milestone events per month; stateless application tier; queue-backed ingestion and notification.
- **Availability**: 99.5% initially, 99.9% target; graceful degradation when CW1 or carrier interfaces are unavailable — serve the projection, queue the writes.
- **Compliance**: GDPR-aligned personal-data handling; retention policies per artefact class; full audit of administrative actions and impersonation.
- **Internationalisation**: English (US) and Spanish at launch; controlled business-language catalogue; date format `DD.MM.YYYY`.
- **Accessibility**: WCAG 2.1 AA, verified automatically in CI.
- **Observability**: structured logs, correlation identifier end to end, ingestion-latency and failed-job metrics, dashboards and alerting.

---

## 8. Technical Stack

**Changed in v3.0.** v2.1 listed a recommendation; v3.0 states the decisions taken and records the deviations. The principle applied throughout: keep the extension point, omit the machinery until a measured need appears.

- **Frontend**: React with TypeScript, built as a single-page application, on the Noatum Design System tokens as the single source of colour, type, spacing and radii; components implemented per the design-system recipes and extended for application patterns under the same rules. TanStack Query, react-hook-form with zod, i18next, a map component for shipment maps, MSAL for sign-in.
- **Backend**: a single NestJS service exposing REST with OpenAPI. **Background work runs as jobs inside the same service**, queued in PostgreSQL, enqueued in the same transaction as the business write, with retry, backoff and a failed-job store. A configuration switch can run the job consumers as a separate process when volume requires it. *Deviation from v2.1: no separate worker deployable and no message broker.*
- **Data**: PostgreSQL as the only database — canonical model, row-level security, mapping tables, audit, raw CW1 message retention and the job queue. Blob storage for documents and generated PDFs. **No cache server**; a cache may be introduced inside the owning service when a measured latency requires it. *Deviation from v2.1: Redis removed.*
- **Analytics**: an event stream instrumented from the outset; an analytics store and Power BI introduced with FG-7.3.
- **AI**: predictive models and the assistant introduced with FG-1.4 and FG-4.6, with tenant-scoped retrieval, guardrails and an evaluation harness. All automated output carries provenance and is human-overridable.
- **Identity**: Microsoft Entra External ID for customers, Entra ID for staff. No platform-side authentication code.
- **Hosting**: Azure with infrastructure as code and Dev → Test → UAT → Prod environments; a web application firewall in front of public surfaces from the phase in which they appear.
- **Observability**: structured logging and an application-monitoring service with correlation identifiers.

### 8a. Design System & Brand Requirements (P0)

Unchanged from v2.1 in substance. The platform implements the **Noatum Logistics Design System**, which is authoritative:

- **Tokens** imported verbatim as the theme layer — brand red `#AA272F` (hover `#8E2027`), logo navy `#002C5F` for logo and dark hero use only, charcoal `#333333` headings, gray `#58595B` body, hairline `#E5E5E5`, section gray `#F5F5F3`; 4px radius on buttons and inputs; square-cornered cards with a soft shadow; ~1170px container; generous section padding.
- **Typography**: a single humanist sans, weights 700–800 for headings and navigation, 400 for body; ALL-CAPS only for eyebrows and footer column headings; the substitute typeface stands until the brand team supplies the original files.
- **Signature motif**: the short red rule beneath section headings, following the heading's alignment.
- **Chrome**: red utility top bar, white logo band, white main navigation with a hairline border, solid brand-red footer.
- **Components**: primary and outline buttons only; folder-style tabs; news cards; stat counters for dashboard figures; thin-stroke red line icons.
- **Status colour extension**: because brand red is the primary action colour, statuses use a documented extension set (success green, warning amber, informational navy, neutral grays), submitted to the brand team for ratification.
- **Voice**: confident and service-led, "we" for Noatum and "you" for the customer; sentence-case headlines; dates `DD.MM.YYYY`; **no emoji and no exclamation marks** in any customer-facing surface including UI microcopy, notifications, emails, PDFs and the assistant.
- **Branded outputs**: quote and booking PDFs, report emails, notification emails and invitation emails all render from design-system templates.
- **Prohibited**: gradients outside photography, rounded feature cards, blur or transparency effects, scale or bounce animation.
- **Governance**: tokens versioned as a shared package; visual regression tests on core components; deviations require brand-team sign-off.

---

## 9. Delivery Roadmap (phased)

No dates. Phases are sequence and dependency, not schedule. Each phase ships behind per-customer feature flags; rollout is per customer, never all at once.

| Phase | Scope | Exit criteria |
|---|---|---|
| **P1 — Foundation + Quotation (customer and internal)** | Platform foundation: identity and access (§4a), customer and user onboarding at organisation level (FG-8.1, 8.2, 8.4) with branch-aware internal users, design-system implementation (§8a), observability and performance baseline (FG-10), API foundation (FG-9.3), dashboard framework (FG-6 minimal), CW1 integration layer with tenant resolution (§5). **FG-3.1 customer quote request** end to end plus **FG-3.3 internal pricing, approval and write-back** — the two halves of one feature. Templates, address book, quote notifications, news tool. Instant-quote interface implemented and stub-tested, no source configured | A pilot customer requests a quote, an internal user prices it in the portal, CW1 receives it, the customer accepts and downloads the PDF · onboarding a customer is configuration only · a second region would need configuration only · cross-tenant isolation suite green · brand sign-off |
| **P2 — Visibility** | **FG-1**: logged-in and public T&T with the five confirmed milestones, unified search, Air and Sea event mapping from the supplied categorised list, documents on an **allow-list** with internal and restricted flags, financial visibility resolved from the transaction addressee, per-customer visibility flags, standard alerts (4.1) including **platform-computed delay detection** and automatic customs-hold surfacing, subscriptions (4.4), full dashboard widgets, standard reports (7.1) with report assignment and RLS | Event-latency objective met and visible · pilot customers tracking, downloading and viewing invoices · public T&T leak tests green · no unmapped document type is ever visible |
| **P3 — Booking + Claims** | **FG-3.2** booking by both routes — from an accepted quote and directly — with quote-number linkage, three-entity handling, document transfer and the confirmed cancellation gate; sailing schedule (9.2); **FG-5** claims with Dynamics 365 once the current process is understood; advanced alerts (4.2); email rule builder (4.3) | Portal bookings reaching CW1 and linked to their quote · cancellation blocked at the Shipped event · claims round-trip |
| **P4 — Intelligence & Analytics** | Predictive ETA/ETD, disruption intelligence, benchmarking, data-quality augmentation with provenance, self-service reporting (7.2), embedded Power BI (7.3), assistant (4.6), training walkthroughs (8.5), platform analytics (8.6) | Predictive accuracy baseline published · assistant tenant isolation certified |
| **P5 — Ecosystem** | PO integration (FG-2), BYOBI (7.4), external API general availability, additional TMS adapter, additional languages | First external customer consuming the API or feed |
| **Deferred** | **CO2**: FG-9.1 public calculator, FG-1.4 CO2 visibility, FG-3.2 predicted CO2 | Reinstated only after the methodology, provider and disclaimer decision is taken |

**Build method.** Vertical slices: each feature is completed from database through shared contract and application logic to screen, with tests, and demonstrated before the next begins. Foundation before features: identity, tenancy and the design system are built once and not rebuilt.

---

## 10. Success Metrics

**Leading**: ≥ 60% of pilot quote requests submitted through the portal within the pilot period; **median time from customer request to priced quote** (the v4.0 replacement for the instant-quote timing metric, which no longer applies while no rate source exists); proportion of quotes priced in the portal rather than outside it; Air milestone latency compliance ≥ 95%; weekly active users against registered ≥ 50%; alert opt-in retention ≥ 80%; wizard completion ≥ 80%.

**Lagging (quarterly)**: quotation cycle time against the email and spreadsheet baseline; proportion of quotations following the standard process rather than email or paper; "where is my shipment" contacts per shipment −40%; quote-to-booking conversion against the email baseline; internal handling minutes per quote and booking −50%; document-request tickets −60%; portal NPS ≥ +30; proportion of CW1 quotes and bookings visible in the portal = 100%.

---

## 11. Open Questions

| # | Question | Owner | Blocking |
|---|---|---|---|
| **Closed by the KT session of 09.09.2026** | | | |
| ~~OQ-4~~ | Carrier visibility provider | — | **Closed:** carrier data arrives through CW1's own carrier integrations. A provider stays optional |
| ~~OQ-5~~ | Public critical-milestone set | — | **Closed:** picked up, departed, ETA, arrived, delivered (loaded-at-export / unloaded-at-import for sea) |
| ~~OQ-6~~ | Booking cancellation gate | — | **Closed:** blocked after pickup or off-site delivery; hard stop at the Shipped event |
| **Open** | | | |
| OQ-1 | **No rate management exists.** Where will rates come from, if anywhere, and for which lanes or regions first? Whether an assisted rate suggestion is feasible from any existing data | Business + Digital Products | Instant path only — the manual path does not depend on it |
| OQ-2 | Whether CW1's integration component is licensed and enabled, on which instances, which message sets, how outbound is triggered, whether it can be filtered by branch, and how authentication works | CW1 team | Real integration |
| OQ-2a | Whether the integration team can supply API or test access early, which would reduce or remove the simulator | Integration team | Simulator scope only |
| OQ-3 | Which party roles on a CW1 shipment grant customer visibility, and which party Noatum treats as "the customer" | Product + Ops | Tenant resolution — highest risk item |
| **OQ-3a** | **New in v4.0, and now the most urgent technical question.** Addresses beneath a CW1 organisation each carry their own code. On a shipment or an invoice, is the party stored as the **organisation** code or the **address** code? If addresses, the platform must resolve address code to parent organisation, which requires the address-to-organisation relationship in the master-data feed | CW1 team | Tenant resolution and financial visibility |
| **OQ-3b** | **New in v4.0.** Cross-trade billing means a **notify party** can be the paying customer. Should notify party therefore grant shipment visibility, or should the financial addressee alone grant it while the shipment stays hidden? | Product + Ops | Visibility policy |
| OQ-7 | Definition of the "ETD close but information missing" alert | Ops | P2 |
| OQ-8 | PO platform target and its interface | OM owner | P5 |
| OQ-9 | Carrier name disclosure policy per customer | Commercial | No |
| OQ-10 | Customer tier definitions driving default features and alerts | Commercial | Onboarding defaults |
| OQ-11 | **FG-3.3**: whether cost and margin are captured; the approval threshold; the Head of Pricing's appetite and vision | Sponsor + Head of Pricing | P1 |
| OQ-12 | **FG-3.3**: sponsor confirmation in writing that the operational non-goal is narrowed as stated in §2 | Sponsor | P1 |
| OQ-13 | Whether linking a customer to its CW1 organisation records requires a second internal approver | Sponsor | Onboarding |
| OQ-14 | Whether a Customer Admin may invite people outside the company's email domains | Sponsor | Onboarding |
| OQ-15 | Sailing-schedule data provider | IT + Commercial | P3 |
| OQ-16 | Retention period before a deactivated user's personal data is anonymised | Legal | Later |
| OQ-17 | Languages beyond English and Spanish; ownership of the business-language catalogue | Product | No |
| OQ-18 | Brand typeface files, logo assets and icon set | Brand team | Polish |
| OQ-19 | Ratification of the status-colour extension | Brand team | Polish |
| OQ-20 | CO2 methodology, provider and disclaimer — required before the deferred CO2 scope is reinstated | Sustainability + Legal | Deferred scope |
| **OQ-21** | **New in v4.0.** The categorised critical-path event list per mode, and the confirmed internal-only exclusions, from the roughly 664 generic CW1 events | Ops + Digital Products | Event mapping in P2 |
| **OQ-22** | **New in v4.0.** The document-type list with categories, and the confirmed customer-facing allow-list | Ops + Digital Products | Document visibility in P2 |
| **OQ-23** | **New in v4.0.** How a customer raises a claim today, and where staff re-key between systems | Digital Products | P3 claims scope |
| **OQ-24** | **New in v4.0.** Whether the standardised quotation process is introduced first in regions newly onboarding to CW1 rather than retrofitted to regions already working outside it | Ops + Product | Rollout order, not the build |
| **OQ-25** | **New in v4.0.** Interface contract and availability of the AI email drafting service owned by the other team | Digital Products | FG-3.3 polish; template fallback covers it |
| **OQ-26** | **New in v4.0.** Whether Noatum's master-data programme will supply organisation hierarchies, and when, so the manual grouping can be superseded | MDM programme | No — manual grouping works meanwhile |

## 12. Assumptions

- CW1 is reachable from the platform network and the CW1 team is available for message-set configuration. **Whether its integration component is licensed and enabled is an assumption, not a confirmed fact (OQ-2).**
- **Test access is uncertain.** Either the integration team supplies API or test access, or a simulator is built to the minimum extent needed. The platform is indifferent to which is connected.
- **No rate management exists** and none is assumed. Quotations are priced by people; the platform standardises that work.
- **The AI email drafting service is owned by another team** and consumed through an interface. A template fallback means its absence does not block the quotation feature.
- **Both ways of working are supported.** Where the KT session revealed a different practice, the previously designed path is retained as capability and the new one added, configured per region, branch or customer. Nothing established is removed.
- Microsoft Entra External ID is available for customer identities, configured invitation-only, and IT will configure federation for customers that request it.
- Dynamics 365 is the claims system; Power BI is the analytics tool; Azure is the target cloud.
- **Pilot scope (v4.0):** one customer in one region to begin with, selected from the top customers by CW1 transaction volume, in a region whose current way of working the platform matches. **The foundation supports any region and any branch by configuration**; the single-region pilot is a rollout decision, not an architectural one. The instant-quote path is not required for the pilot to succeed.
- Order management remains in a dedicated platform; the portal provides visibility and deep links only.
- The Noatum Logistics Design System is the authoritative user-interface reference; the brand team supplies original typefaces, logos and icons.
- All foundation choices in P1 — identity, customer model, roles, canonical models, adapters, widget and notification frameworks, analytics events, design tokens — are foundational for every later phase and are reviewed as such before implementation.

---

## 13. Deviations from the v2.1 recommended stack

Recorded so the document and the implementation do not contradict each other. Each removal keeps its extension point.

| v2.1 recommended | v3.0 decision | Rationale | Way back |
|---|---|---|---|
| Message broker for asynchronous work | Jobs in PostgreSQL, same transaction as the write | One runtime instead of three; transactional enqueue removes a class of lost-message bugs | A queue interface allows a broker later with the same message contracts |
| Separate integration worker deployable | Job consumers in the same service | One deployable, one log stream | A configuration switch runs them separately |
| Redis cache | No cache | Pilot volumes are served directly by the database; every cache is an invalidation risk | A cache inside the owning service, once measured |
| Platform-side local accounts with MFA | Entra External ID email-password accounts with MFA | Removes an entire authentication subsystem and its vulnerability class | The identity-mode field remains for future options |
| Platform-implemented customer SSO | Federation configured in Entra | No second sign-in path in our code | Same field |
| Blob archive of raw CW1 messages | Retained in the database with scheduled deletion | Simpler retrieval and replay at current volumes | A reference column can point to blob storage |
| Role-designer user interface | Presets seeded; custom roles as data | Sub-permissions already work through the permission list | The screen can be added without a data-model change |
| Region entity for news targeting | Global, country or customer scope | No stated business need | A region field can be added |
| Instant-quote path as a delivered feature | Interface implemented, stub-tested, **no source configured** | No rate management exists (v4.0) | Configure a source per region or customer; no code change |
| Quote-to-booking conversion | Booking **linked** by quote number, one-to-many; customer journey unchanged | CW1 has no conversion between the two (v4.0) | None needed; the model already allows several bookings per quote |
| Portal-built AI email drafting | Consumed from another team's service, with a template fallback | Ownership sits elsewhere (v4.0) | Interface already isolates it |

---

## 14. Documents behind this version

**Primary source for v4.0**: the minutes and question-and-answer log of the KT session with the CargoWise and Noatum operations teams, 09.09.2026, held in the document set alongside this PRD.

Design and review notes produced after v2.1, from which the earlier changes are drawn: the identity and access design · the organisation-management and customer-onboarding low-level design and its walkthrough · the CW1 integration and multi-tenancy note · the internal quote pricing design note · the simplification register and its decision record · the architecture decision records covering database access, frontend framework, tenancy controls and runtime simplification · the gaps and proposals register · the review report against v2.1.
