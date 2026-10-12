# Noatum Customer Portal — complete workflows and information exchange with CargoWise

| | |
| --- | --- |
| Version / date | 2.0 / 16.09.2026 |
| From | Noatum Customer Information Platform team |
| For | CargoWise and integration team |
| Companion | `CargoWise-Integration-Requirements.md` — the message-level shopping list that sits beneath this document |

---

## How to read this document

This is the **whole Customer Portal**, not one release. It sets out every capability we
intend to build, the workflow behind each one, and — for each exchange with CargoWise — the
five things that should decide the integration mechanism:

1. **What** information is exchanged
2. **Which system owns** it
3. The **direction** of flow
4. The expected **volume and frequency**
5. Whether it is **transactional, operational or analytical**

The mechanism is then a consequence of those answers. Where we name a preferred mechanism it
is a proposal, to be confirmed against what CargoWise offers under Noatum's licensing.

---

## 1. How the portal is built, and why it matters to this discussion

The portal is a **customer window onto CargoWise, plus a channel for customer requests back
into CargoWise**. CargoWise remains the system of record and wins every conflict.

Three properties matter to the integration discussion:

- **The portal never queries CargoWise on a customer keystroke.** It serves every screen
  from its own synchronised projection. "Show me all shipments for the last year" is a read
  of our database, not a call into CargoWise.
- **Every external system sits behind an adapter interface.** Business logic calls the
  interface, never CargoWise. If the right mechanism for a flow turns out to be a scheduled
  extract or a replicated dataset rather than a message, that changes one adapter and no
  business logic.
- **Everything outbound runs as a queued job** enqueued in the same database transaction as
  the business write, with retry, backoff and a failed-message store. A CargoWise outage
  delays a request; it never loses one.

---

## 2. What we are building — every capability

This is the whole product, not one release.

| Group | Capabilities |
| --- | --- |
| **Visibility** | Public track and trace · logged-in search with grid, detail and card views · milestones and events for Air (Cargo IQ) and Sea · documents, approved types only · invoices and credit notes · predictive ETA and disruption intelligence · purchase-order visibility |
| **Commercial** | Quote request wizard for Air, Sea FCL and Sea LCL · internal pricing in the portal, with claim, price and approve · write-back to CargoWise · accept, reject, versions and branded PDF · booking from a quote or directly · templates and address book |
| **Communication** | In-app alerts and a notification centre · delay detection computed from ETA variance · per-shipment subscriptions · news, banners and pop-ups · self-service email notification rules · AI assistant |
| **Service** | Claims and incidents through Dynamics 365 · interactive training and onboarding walkthroughs |
| **Insight** | Standard reports with report assignment · self-service report builder · embedded Power BI · governed customer data feed · platform analytics for Noatum |
| **Administration** | Customer onboarding and organisation linking · users, roles and permissions · feature entitlements per customer · reference data and CargoWise code mapping · audit and read-only impersonation · integration health and message replay |
| **Public and standalone** | Sailing schedule · CO2 calculator · platform API |

**Scope boundaries, stated once.** The portal is not a replacement for CargoWise operational
workflows; the single exception is pricing a quote that has no automatic rate, and even then
CargoWise receives the result and remains the record. The portal is not a rate-management
system — **no rate management exists today and none is assumed**. It is not a purchase-order
management system; PO visibility and deep links only.

---

## 3. Who uses it

| Persona | Type | What they do in the portal |
| --- | --- | --- |
| Public visitor | External, no account | Track by reference, sailing schedule, CO2 estimate |
| Customer Standard | External | Track, documents, alerts, own notifications |
| Customer Quoting and Booking | External | Quote requests, bookings, templates, address book |
| Customer Finance | External | Invoices, credit notes, spend reporting |
| Customer Analyst | External | Reports, self-service reporting, dashboards |
| Customer Claims | External | Raise and comment on claims |
| Customer Admin | External | Their own users, roles, report access, notification recipients |
| Noatum Customer Success | Internal | Onboard customers, link organisations, invite administrators, publish news, impersonate |
| Noatum Pricing | Internal | Pricing queue, charge lines, submission |
| Noatum Pricing Approver | Internal | Approve priced quotes above a threshold |
| Noatum Operations | Internal | Elevated read visibility; no operational editing |
| Noatum Platform Admin | Internal | Roles, entitlements, mapping tables, integration health, usage analytics |

Internal users use the portal for administration, support and pricing only. All other
operational work stays in CargoWise. **Portal roles are entirely independent of CargoWise
roles** — agreed explicitly on 09.09.2026 and reinforced by the possibility that CargoWise
is one day replaced.

---

## 4. How we classify an exchange

Four classes, and the question that decides which one applies.

| Class | The test | Correct mechanism | Wrong mechanism |
| --- | --- | --- | --- |
| **Transactional** | One business act by one person, which must not be lost or duplicated and needs an acknowledgement. Low volume | Request and response, or an inbound message with an idempotency key | A nightly file |
| **Operational stream** | High volume, continuous, freshness matters in minutes, read-only for us | Event-driven push, with polling or an extract as fallback | A synchronous call on every page view |
| **Analytical and bulk** | A large historical set. Freshness in hours is acceptable; no operational decision depends on the latest row | Scheduled extract, or a replicated dataset such as your Snowflake feed | Replaying a message stream from the beginning |
| **Reference** | Code lists and master data. Small, and changes rarely | Periodic extract, maintained in the portal thereafter | A lookup on every request |

Your existing Snowflake extraction is, on this reading, the natural answer for the
**analytical and bulk** class, and very possibly for the **initial backfill** of the
operational class. It is not an answer for the transactional class, and on its own it is
unlikely to meet the freshness target for milestone visibility.

---

## 5. The rule everything depends on — tenant resolution

Before any workflow below can deliver a single row to a customer, the portal has to decide
**which customer an inbound CargoWise record belongs to**. This is the highest-risk area of
the whole platform, and the reason organisation master data is our first ask.

An inbound CargoWise record reaches a customer only by passing four gates, every one of them
enforced on the server:

1. **Eligible.** One of the party organisation codes on the record matches a customer account
   that a Noatum user deliberately linked. A record matching nothing is stored, visible to
   nobody, and listed for Customer Success as evidence of an un-onboarded customer.
2. **Live.** The customer's status is active. A draft or suspended customer grants nothing,
   whatever is linked to it.
3. **Visible.** Row-level security in the database, plus any restriction of that user to a
   single office.
4. **Allowed.** The user holds the permission, and the feature is switched on for that
   customer.

Three rules behind those gates are worth stating explicitly, because they constrain what we
need from CargoWise:

- **Only a deliberately linked organisation code grants visibility.** Nothing else does — not
  a name match, not a country, not a CargoWise controlling-customer pointer.
- **One organisation code belongs to exactly one customer**, enforced by a unique index on
  the normalised code. This is why a code cannot be shared between two portal customers.
- **Linking is at organisation level only.** Addresses beneath an organisation are never
  linked individually.

Which is exactly why **question 1 in section 9 — whether a party on a transaction carries the
organisation code or the address code — is the single most valuable thing you can answer.**

---

## 6. The workflow catalogue

Each workflow below carries the five answers, plus the mechanism we propose and what we have
already built.

---

### 6.1 Organisation master data

**Business narrative.** Noatum's Customer Success team creates a customer in the portal and
links it to the CargoWise organisations that represent that customer's legal entities. Until
that happens, nothing about that customer can be shown to anybody.

| | |
| --- | --- |
| **Information** | Organisation code, name, legal name, category, country, city, state, postcode, active flag, controlling branch, controlling customer, role flags. Addresses beneath each organisation: address code, address type, primary flag, address lines, related port, email, phone. Registration identifiers: code type, value, country, country-default flag |
| **Owner** | CargoWise |
| **Direction** | CargoWise → Portal |
| **Volume and frequency** | Whole directory; size to be confirmed. Daily refresh, or on change if push is available |
| **Nature** | Reference / master data |
| **Freshness needed** | 24 hours is acceptable |
| **Proposed mechanism** | Scheduled extract. A change push would be better, is not required. **A Snowflake table would serve equally well** |
| **Portal status** | **Built and working** |

**What we already consume.** Three CSV files over HTTP with basic authentication:
`organisations.csv`, `organisation_addresses.csv`, `organisation_registrations.csv`. The
importer detects change by hash, records what changed, and deactivates organisations absent
from a declared complete snapshot. It **refuses to deactivate** when a snapshot arrives
carrying fewer than half the organisations it held before, or none at all, because a
truncated export and a genuine removal are indistinguishable and the cost of being wrong is
revoking a customer's access. **The transport is negotiable; the field contract is what we
care about.**

---

### 6.2 Customer onboarding and access management

No CargoWise exchange of its own, but it is the consumer of 6.1 and the producer of the
links every other workflow resolves against. Built and working.

1. The organisation directory is imported from CargoWise.
2. Customer Success creates the customer — name, country, email domains, tier.
3. They link the CargoWise organisations belonging to that customer, recording a
   justification. Fully audited.
4. They choose the servicing Noatum office.
5. They invite the first Customer Admin.
6. Going live is a guarded transition. It is refused, naming exactly what is missing, until
   at least one organisation is linked and one administrator invited.
7. The Customer Admin then invites colleagues, assigns roles, and may restrict a user to a
   single office.

**The moment step 3 happens, existing shipments, invoices and CargoWise quotes carrying those
codes become visible to that customer — before anybody logs in.**

---

### 6.3 Quotation — customer request, internal pricing, write-back

**This is the first capability we deliver end to end, and the only place the portal writes
commercial content into CargoWise.**

**Business narrative.** Today a quotation is priced by a person, largely outside any system,
in email and spreadsheets — **no rate management exists**. The portal standardises that
work. The customer's request arrives complete and structured. A Noatum pricing user prices
it in one screen with the request and its history beside them. The result is written to
CargoWise, and only once CargoWise has confirmed it does the customer see a price.

Pricing in CargoWise remains fully supported. A quote priced there flows into the portal as
already priced. **Neither route is mandatory and nobody has to change how they work.**

**The flow, step by step**

1. The customer submits a structured request — mode and service, route, cargo lines,
   dangerous goods, additional services, references. **The organisation code is resolved
   server-side and is never supplied by the client.**
2. The portal creates the quote request in CargoWise, idempotent on the portal reference.
3. The request enters the pricing queue, scoped to the owning branch.
4. A pricing user claims it. Ownership is single, visible, and expires automatically.
5. They price it — charge lines, totals per currency, validity, carrier, service, transit,
   remarks.
6. Above a configurable value threshold a different person approves it. Below the threshold
   it proceeds directly. A rejection carries a mandatory reason.
7. The portal writes the priced quote to CargoWise, idempotent on quote and version.
8. **Only once CargoWise confirms does the customer see a price.** A failed write is visible
   to internal users only and raises an operations alert; the customer never sees an error.
9. The customer accepts within validity, or rejects with a reason code. Either decision is
   sent to CargoWise.

If the quote is priced in CargoWise instead, it flows into the portal as already priced.
Neither route is mandatory.

**Quote statuses**, in order: Draft · Requested · In progress · Awaiting approval · Pending
sync · Quoted · Accepted · Rejected · Expired · Cancelled. Pending sync is the state the
customer cannot see. If CargoWise refuses or is unreachable the quote stays there, operations
are alerted, and the write is retried.

**Drafted customer email.** A separate Noatum team provides an AI drafting service. The
portal calls it through an interface, presents the draft as editable content, and requires
explicit human action to send. If the service is unavailable, a template is used. The portal
never sends unattended customer correspondence.

**The four exchanges inside this workflow**

| # | Exchange | Owner | Direction | Volume and frequency | Nature | Freshness |
| --- | --- | --- | --- | --- | --- | --- |
| a | Quote request | Request originates in the portal; the quote is CargoWise's | Portal → CargoWise | Low. Tens per day in pilot, to be confirmed | Transactional | 60 seconds |
| b | Priced quote written back | CargoWise once accepted | Portal → CargoWise | Low; one write per priced quote plus retries | Transactional | 60 seconds |
| c | Quote created or priced in CargoWise | CargoWise | CargoWise → Portal | Low | Transactional | 60 seconds of save or status change |
| d | Accept, reject, cancel | Decision is the customer's | Portal → CargoWise | Low | Transactional | 60 seconds |

**What we need from you here:** which CargoWise object we should create or update — you
referred to OneOffQuotes, which matches our reading — and **what constitutes business
acceptance as distinct from receipt**, because the customer is not shown a price until
CargoWise has confirmed it.

**Two design rules that reduce what we ask of you.** Cost and margin, if captured at all, are
internal-only and stripped in a single output mapper; they never appear on a customer
surface. And the instant-rate path exists as an interface, stub-tested, with **no source
configured** — so no commitment depends on it.

---

### 6.4 Booking

**Business narrative.** A customer books from an accepted quote, or directly without one.
CargoWise does not convert a quote into a booking, so we carry the quote number and let
CargoWise establish the link.

**Three entities, not a chain.** The portal models **quote, booking and shipment as three
separate entities**. A booking is *linked* to a quote by quote number, one-to-many; a booking
is separately converted into a shipment in CargoWise. There is no conversion call, and the
model does not assume a one-to-one chain. A booking may exist with its shipment reference
arriving later, or never.

**The flow, step by step**

1. The customer either books from an accepted quote — the commercial terms are copied as a
   snapshot for their own record, with CargoWise remaining the authority — or starts a
   booking with no quote at all.
2. They supply locations, addresses, cargo, customer references and documents. Uploads are
   size-limited and virus-scanned before any transfer.
3. The portal creates the booking in CargoWise, **carrying the quote number** so CargoWise
   establishes the link.
4. CargoWise returns the booking confirmation, and the shipment reference when it exists.
5. The customer gets a deep link into track and trace.
6. Change and cancellation are blocked once cargo has been picked up or delivered to an
   off-site location, with a **hard stop at the Shipped event**. Enforced on the server, and
   configurable.

| | |
| --- | --- |
| **Information** | Booking content and documents outbound; booking confirmations and shipment references inbound |
| **Owner** | CargoWise |
| **Direction** | Both |
| **Volume and frequency** | Low to medium |
| **Nature** | Transactional |
| **Freshness** | 60 seconds each way |

---

### 6.5 Shipment visibility — the split that matters most

**Business narrative.** A customer opens the portal and expects to see everything moving for
them, and everything that has moved. This is the capability your shipment example addressed,
and it is genuinely two exchanges, not one.

**Exchange A — historical backfill, once per customer at onboarding.** Everything that
already exists for that customer's organisation codes: shipments, consols, containers, legs,
events, documents, invoices. Bulk loaded into the portal projection.

**Exchange B — ongoing change, continuously from then on.** A CargoWise change is pushed to
the portal, deduplicated on the source message identifier plus our own reference, mapped
through the mapping tables, resolved to a customer from the party organisation codes, and
applied to the projection.

| | Historical backfill | Ongoing change |
| --- | --- | --- |
| **Information** | Shipments, consols, containers, transport legs, parties with roles, references | The same, as it changes |
| **Owner** | CargoWise | CargoWise |
| **Direction** | CargoWise → Portal | CargoWise → Portal |
| **Volume and frequency** | Large, one-off per customer | Continuous |
| **Nature** | **Analytical / bulk** | **Operational stream** |
| **Freshness** | Irrelevant | 60 seconds on push, 5 minutes on a fallback |
| **Proposed mechanism** | Scheduled extract or the **Snowflake dataset** | Event-driven push |

Design target for the resulting screens: list and search performance at **100,000 rows per
customer**, list under two seconds, search under one and a half.

---

### 6.6 Milestone events

**Business narrative.** The shipment timeline is the single most-used screen in a forwarding
portal, and the one that removes the most "where is my shipment" phone calls.

**What happens to each event.** It arrives at the portal inbound endpoint, which archives,
logs and acknowledges immediately. A source message identifier already seen is ignored. The
event code is mapped through the mapping table; **an unmapped code is stored but not
displayed**, and raised for an administrator to classify. A mapped code on the internal
exclusion list is shown to internal users only. Everything else becomes a canonical milestone
on the customer timeline, feeds public track and trace when it is on the critical path for
that mode, and is checked for ETA variance against the original and last-known values, which
is what raises the potential-delay alert.

| | |
| --- | --- |
| **Information** | Event code, timestamp, place, source, internal flag |
| **Owner** | CargoWise |
| **Direction** | CargoWise → Portal |
| **Volume and frequency** | The highest-volume flow in the platform. Sized for millions of events per month |
| **Nature** | Operational stream |
| **Freshness** | **Air milestones published within 3 hours of actual occurrence** for the Cargo IQ commitment. Our internal target is 60 seconds from CargoWise |

**Policy, not mechanism.** Events use an **exclude-list**: show everything except a short
flagged set — intercompany and internal invoicing, and the internal steps of customs
clearance where only the outcome is shown. We have already loaded the **664 CargoWise event
codes**. What is still owed, by Noatum operations rather than by you, is the categorised
critical-path list per mode and the confirmed exclusions.

---

### 6.7 Documents

**The rule.** A document is visible to a customer only when its type is in our mapping table
**and** approved as customer-facing. Anything unmapped is hidden and queued for
classification. A type flagged internal-only or restricted reaches internal users holding an
explicit permission, and nobody else. A financial document is visible only where the user's
organisation is the addressee.

**Why an allow-list and not an exclude-list.** Document type in CargoWise is assigned
manually by the uploading user and is not validated. A mistagged **rated bill of lading**
would expose freight rates to a customer. So anything unmapped, newly introduced or of
unknown type is hidden until somebody classifies it.

| | |
| --- | --- |
| **Information** | Document type, metadata, and the file or a reference to it |
| **Owner** | CargoWise |
| **Direction** | CargoWise → Portal |
| **Volume and frequency** | Medium and continuous, with a bulk element at backfill |
| **Nature** | Operational, plus bulk |
| **Proposed mechanism** | Metadata on the event stream; payload either carried or fetched on demand. **We would prefer a stable identifier and a retrieval call over embedded base64** for large files |
| **Portal status** | The **510-row, 479-code document-type catalogue** is already loaded. The approved customer-facing list is owed by Noatum operations |

Customer uploads travel the other way at booking: size-limited and virus-scanned before any
transfer to CargoWise.

---

### 6.8 Invoices and credit notes

**The rule: visibility resolves from the addressee organisation on the transaction, never
from the shipment's parties.** If the addressee matches a linked customer account, the
document is visible to users of that customer who hold the finance permission — and, where a
user is restricted to one office, only that office's documents.

This was confirmed in the session of 09.09.2026. Who is billed depends on Incoterms and the
commercial agreement, with no single fixed rule; two parties on one shipment can each receive
their own invoice; and cross-trade billing means a third party such as the notify party can
be the paying customer.

| | |
| --- | --- |
| **Information** | Transaction header, charge lines with plain-language descriptions, totals, **and the addressee organisation** |
| **Owner** | CargoWise |
| **Direction** | CargoWise → Portal |
| **Volume and frequency** | Medium, with a bulk element at backfill |
| **Nature** | Operational, plus bulk |
| **Freshness** | Minutes is fine; hours is probably acceptable |

**The addressee field is load-bearing for us.** We need it populated and identified the same
way every time.

---

### 6.9 Alerts, notifications and news

**Most alerting is ours to compute, not yours to send.** The portal reads milestone events,
ETA values, customs-hold events and status gaps, and raises: potential delay from ETA
variance · customs hold surfaced automatically · crisis events affecting shipments in
progress · ETD close with information missing · arrived but not cleared within a set number of
days. These reach the customer through an in-app notification centre with deep links, through
email by self-service rules whose recipients are validated against the customer's own
domains, and through per-shipment subscriptions. Noatum news and banners, scoped globally, by
country or by customer, use the same delivery.

**Carriers do not reliably send a revised ETA, and detection is manual today.** So the portal
computes ETA variance itself. This is arithmetic and rules, not a model. **Customs holds
already reach CargoWise through its customs integrations and today trigger an email to an
operator who then telephones the customer** — surfacing that hold automatically is a direct
removal of manual work.

**No new CargoWise exchange is required for any of this.** It consumes 6.5 and 6.6.

---

### 6.10 Claims and incidents

**This runs through Dynamics 365, not CargoWise.** The customer raises a claim in the portal
— incident type, affected shipments, description, attachments. The portal creates a case in
Dynamics with that data, and it is assigned by mode and station. The handler updates,
comments and resolves in Dynamics; status and comments flow back to the portal, where the
customer sees real-time status, two-way comments, full history and a resolution notice.

| | |
| --- | --- |
| **Owner** | Dynamics 365 |
| **Direction** | Both, with Dynamics |
| **Nature** | Transactional |
| **CargoWise involvement** | Shipment context only, already held in the portal projection |

What we still need is business input, not a CargoWise interface: **how a customer raises a
claim today, and where staff re-key between systems.**

---

### 6.11 Reporting and analytics

Four tiers, all reading the portal projection:

| Tier | What it is |
| --- | --- |
| 1 | Standard reports — shipment status and detail, volume, spend, SOP validation. Export to XLSX, PDF and CSV, with scheduled delivery |
| 2 | Self-service report builder — fields, filters, aggregations; personal and shared reports |
| 3 | Embedded Power BI — app owns the data, so no customer licence is needed |
| 4 | Governed customer data feed for large customers |

**Customer isolation applies at every tier** — in-app, scheduled export, the Power BI dataset
and the feed — and is verified by automated cross-tenant tests. Separately, platform analytics
for Noatum cover adoption, features enabled against features used, quote-to-booking
conversion, queue age and time to price.

**Noatum assigns a report to a customer; the Customer Admin then grants individual users
access.** No additional CargoWise exchange is needed — reporting reads the projection.

---

### 6.12 Public and standalone surfaces

| Surface | What it shows | Constraint |
| --- | --- | --- |
| Public track and trace | Critical-path milestones only: **picked up, departed, ETA, arrived, delivered**, with loaded-at-export and unloaded-at-import as the sea equivalents, plus the Noatum office contact | **Never** addresses, documents, financials, predictive data, or anything revealing which customers exist. Rate-limited and bot-protected. A reference matching several customers returns exactly the same shape as a single match |
| Sailing schedule | Services and departures, ranked; convert to quote or booking on sign-in | Data provider not yet identified |
| CO2 calculator | Predictive emissions with mode comparison | Deferred until methodology, provider and disclaimer are decided |
| Platform API | OpenAPI published, scoped client model | External issuance deferred to the ecosystem phase |

---

### 6.13 Purchase order visibility

| | |
| --- | --- |
| **Information** | POs linked to a shipment, PO lines, order references |
| **Owner** | The order-management platform, not CargoWise |
| **Direction** | OM → Portal, plus deep link with single sign-on context |
| **Nature** | Operational |
| **Note** | PO entities are present in our model from the outset, so enabling this is a data feed rather than a schema change. **PO lifecycle management stays in the OM platform** |

---

### 6.14 Reference and code lists

| | |
| --- | --- |
| **Information** | Charge codes, event codes, document types, UN/LOCODE, currencies, vessels, branch codes, address types |
| **Owner** | CargoWise |
| **Direction** | CargoWise → Portal |
| **Volume and frequency** | Small; monthly or on request |
| **Nature** | Reference |
| **Portal status** | Document types and event codes already loaded from the workbooks supplied on 11.09.2026 and maintainable in the portal. **Never hard-coded in our code** — a new or changed code is configuration, not a release |

---

## 7. The consolidated information-exchange matrix

| # | Exchange | Owner | Direction | Volume / frequency | Nature | Freshness | Proposed mechanism |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Organisation master data | CargoWise | CW1 → Portal | Whole directory, daily | Reference | 24 h | Extract, or Snowflake |
| 2 | Reference and code lists | CargoWise | CW1 → Portal | Small, monthly | Reference | Days | Extract, one-off acceptable |
| 3 | Quote request | Portal request, CW1 quote | Portal → CW1 | Low | Transactional | 60 s | Message or API, idempotent |
| 4 | Priced quote write-back | CargoWise | Portal → CW1 | Low | Transactional | 60 s | Message, idempotent on quote + version, **needs business acknowledgement** |
| 5 | Quote created or priced in CW1 | CargoWise | CW1 → Portal | Low | Transactional | 60 s | Push on save or status change |
| 6 | Quote accept / reject / cancel | Customer decision | Portal → CW1 | Low | Transactional | 60 s | Message |
| 7 | Booking create / update / cancel with documents | CargoWise | Portal → CW1 | Low–medium | Transactional | 60 s | Message, carrying the quote number |
| 8 | Booking confirmation and shipment reference | CargoWise | CW1 → Portal | Low–medium | Transactional | 60 s | Push |
| 9 | Shipment historical backfill | CargoWise | CW1 → Portal | Large, once per customer | **Analytical** | Irrelevant | **Extract or Snowflake** |
| 10 | Shipment, consol, container ongoing change | CargoWise | CW1 → Portal | High, continuous | Operational | 60 s push, 5 min fallback | Event push |
| 11 | Milestone events | CargoWise | CW1 → Portal | Millions per month | Operational | **3 h Cargo IQ**, 60 s target | Event push |
| 12 | Documents | CargoWise | CW1 → Portal | Medium, plus bulk | Operational + bulk | Minutes | Metadata push, payload on demand |
| 13 | Invoices and credit notes | CargoWise | CW1 → Portal | Medium, plus bulk | Operational + bulk | Minutes to hours | Push |
| 14 | Customer document upload | Customer | Portal → CW1 | Low | Transactional | At booking | Attach with the booking, after scanning |
| 15 | Claims | Dynamics 365 | Portal ↔ D365 | Low | Transactional | Minutes | Dataverse |
| 16 | Purchase orders | OM platform | OM → Portal | Medium | Operational | Hours | Feed plus deep link |
| 17 | Instant rates | Rate source | Portal ↔ source | None today | Transactional | Under 30 s | Interface exists, **no source configured** |
| 18 | Drafted customer email | Other Noatum team | Portal ↔ service | Low | Transactional | Seconds | Interface, template fallback |

---

## 8. Delivery sequence

Sequence and dependency, not dates.

| Phase | What it delivers | What it needs from CargoWise |
| --- | --- | --- |
| **1 — Foundation and quotation** | Identity, tenancy, onboarding, organisation linking, design system, observability, the integration layer, quote request, internal pricing, write-back, accept, PDF, dashboard shell, news | Organisation extract · quote messages |
| **2 — Visibility** | Track and trace public and logged in, unified search, events, documents on an allow-list, invoices by addressee, standard alerts, subscriptions, full dashboard, standard reports | Shipment and event streams · historical backfill · documents · invoices. **Also needs, from Noatum operations: the critical-path event list and the document allow-list** |
| **3 — Booking and claims** | Booking by both routes, sailing schedule, claims with Dynamics, advanced alerts, email rule builder | Booking messages and confirmations |
| **4 — Intelligence and analytics** | Predictive ETA, disruption intelligence, benchmarking, self-service reports, embedded Power BI, assistant, training, platform analytics | Nothing new; builds on phase 2 data |
| **5 — Ecosystem** | Purchase orders, customer data feeds, external API, an additional transport system, more languages | Nothing new |
| **Deferred** | CO2 calculator, CO2 on shipments, CO2 at booking | Awaits the methodology, provider and disclaimer decision |

---

## 9. Questions that must be answered whichever mechanism we choose

These are independent of API against extract against dataset. They decide whether what we
receive can be assigned to the right customer at all.

| # | Question | Why it blocks us |
| --- | --- | --- |
| **1** | **On a shipment or an invoice, is a party stored as the organisation code or the address code?** The schema shows both are optional, so a party can arrive with neither | Our highest technical risk. Visibility resolves from the organisation code. If parties carry address codes we need the address-to-organisation relationship in the master data. **One real shipment message with a party block answers this completely** |
| **2** | Which party roles grant sight of a shipment — shipper, consignee, local client, and does notify party count? | Cross-trade billing means a notify party can be the paying customer. Our current policy excludes notify party, which would leave a cross-trade customer unable to see their own shipment |
| **3** | The `AddressType` values actually used on Noatum's shipment parties | We map these in a table, and an unmapped value fails closed, so parties cannot be displayed until the list is seeded |
| **4** | Is CargoWise's integration component licensed and enabled, on which instances, for which message sets, and **can outbound be filtered by branch or organisation?** | Decides whether push is available, and whether we receive only what we are entitled to |
| **5** | One CargoWise database or several? | Decides whether an organisation code is unique globally or per instance. Our key already carries the instance, so either answer works — we need to know which |
| **6** | For each message, the field that uniquely identifies it | We deduplicate on source message identifier plus our own reference. Without a stable identifier a redelivery becomes a duplicate |
| **7** | How does CargoWise confirm **business acceptance** as distinct from receipt, and how are failures reported? | The customer sees no price until CargoWise has confirmed it, so "confirmed" must mean something specific |
| **8** | Can the Snowflake extract serve as the source for **(a) organisation master data** and **(b) historical shipment, event, document and invoice backfill**? What is its refresh cadence and latency? | If yes, it removes load from operational CargoWise for exactly the two bulk cases, and we would rather consume it than build a second path |
| **9** | For documents, is there a stable identifier and a retrieval call, or is the payload always embedded? | Decides whether we stream large files or pull them on demand |
| **10** | Are carrier events already merged into the CargoWise event stream for all modes, or only where cargo is booked through CargoWise? | Decides whether a third-party visibility provider is needed as enrichment |

---

## 10. What we have already built

| Area | State |
| --- | --- |
| Organisation directory mirror and importer | **Built**, with provenance, change log, deactivation-by-absence and a truncated-snapshot brake |
| Customer records, organisation linking, lifecycle | **Built.** One organisation code belongs to exactly one customer, enforced by a unique index |
| Customer separation | **Built**, enforced by PostgreSQL row-level security rather than by application code |
| Roles and permissions | **Built.** 54 permissions, 11 role presets, independent of CargoWise roles |
| Reference data and mapping management | **Built**, including the 479 CargoWise document types and 664 event codes |
| Noatum operating structure, regions and branches | **Built**, including discovery of the controlling-branch codes seen on organisations |
| Adapter interfaces — tracking, quote, booking, finance, document, rate | **Built.** Only the quote adapter is implemented so far |
| Job queue with retry, backoff and a failed-message store | **Built** |
| CargoWise simulator | **Built.** Lets us develop and demonstrate without blocking on access. The portal cannot tell it from the real interface — that is configuration |
| Quote wizard, pricing queue, write-back, PDF | In build |
| Tracking, documents, invoices, bookings, claims, reports | Designed, not started |

---

## 11. What we need first, and what we propose next

**First, in this order:**

1. **One real shipment message containing a party block.** Redacted is fine. This closes
   questions 1 and 3 and unblocks more design than anything else on the list.
2. **The organisation extract**, in whatever shape CargoWise naturally produces, and how we
   receive it.
3. **The quote messages** — request, priced quote, confirmation, accept and reject — with one
   sample each.

Everything else can follow. Until they arrive we continue against our simulator, and
switching to the real connection is configuration.

**Proposed working session agenda**

| # | Topic | Minutes |
| --- | --- | --- |
| 1 | Walk the quotation workflow end to end and agree which CargoWise object each step touches | 30 |
| 2 | Party identification and visibility policy — questions 1 to 3 | 20 |
| 3 | Bulk against stream for tracking, documents and finance, including whether Snowflake serves the backfill — question 8 | 20 |
| 4 | Licensing, transport, authentication, environments — questions 4 to 7, 9, 10 | 20 |
| 5 | Actions, owners and dates | 10 |

We are happy to bring the portal to the session and show these flows on screen rather than
describe them.
