# Noatum Logistics Customer Information Platform

**Internal briefing · 04.09.2026 · v3**

---

## One portal where our customers see and do everything.

Track, quote, book, download, pay and get alerts — in one login, in the Noatum brand. The portal connects to the system our operations teams already use, so nothing is typed twice.

| Today | With the portal |
|---|---|
| Customer emails or calls to ask where cargo is | Customer sees every shipment and milestone live |
| Quotes prepared by hand and sent as attachments | Instant price where rates exist, or a request routed to the branch |
| Documents and invoices requested one by one | Downloads documents and views invoices themselves |
| Several disconnected tools with separate logins | One login, one Noatum brand, in every country |

**Customer first** — fewer "where is my shipment" calls, faster quotes, one login.
**CargoWise stays the truth** — we never replace how operations work; we connect to it.
**Small steps, live early** — every feature is finished, tested and demonstrable before it is handed over.

---

## What the portal does

Everything a customer needs from us, in one place.

| | | |
|---|---|---|
| **Track** — shipments, containers, flights, live milestones | **Quote** — instant price or branch-priced request | **Book** — from a quote or directly, with documents |
| **Documents** — download singly or as a package | **Invoices** — see charges and credit notes | **Alerts** — delays, customs holds, disruptions |
| **Claims** — raise and follow incidents | **Reports** — standard and self-service | **Own users** — customer manages its own people |
| **CO2 and insight** — emissions per shipment, predictive ETA | | |

### What it is not

- **Not an operations system** — our operations teams keep working in their existing system
- **Not a pricing system** — the portal shows prices; it does not set them
- **Not a purchase-order tool** — visibility and deep links only
- **Not a brand redesign** — the Noatum design system is used as it is

| 10 | 5 | 1 | 1 |
|---|---|---|---|
| Feature groups | Delivery phases | System of record | Login |
| from tracking to analytics | each live for pilot customers first | CargoWise One | for everything a customer needs |

---

## How the platform works

Five layers. The customer works on the top one. Shipment updates come in and quote requests go out only through the bottom one.

| Layer | What it is | What lives there |
|---|---|---|
| **Customer screens** | Where the customer tracks, quotes and books | Track a shipment · request a quote · make a booking · download documents · view invoices · manage users |
| **Business rules** | Decides what each customer may see and do | Which shipments belong to this customer · who may book or see invoices · when a quote can still be accepted · when to raise a delay alert |
| **Shipment data** | Kept in the portal so screens open instantly | Shipments and milestones · containers, vessels, flights · quotes and bookings · documents and invoices · customers and users |
| **Integration** | The single connection to systems outside the portal, inside the same service | Receives milestones, documents, invoices · sends quote requests and bookings · looks up rates · sends emails and PDFs · opens claims |
| **Outside systems** | Run by other teams | Operations system (CargoWise One) · rate system · claims system (Dynamics 365) · shipping line and airline data |

**Screens never decide.** Whether a customer may see a shipment or accept a quote is decided in the business-rules layer and checked again there, whatever the screen shows.

**Fast because the data is already here.** Shipment lists and timelines open instantly because the portal holds its own copy. New milestones from operations refresh that copy as they happen.

**One connection point, many adapters.** Each outside system has its own adapter in the integration layer, and they all run inside one service. A new carrier feed or a different operations system later means a new adapter, not a new portal.

---

## Phase by phase — for your confirmation

We start with one pilot customer in one region and add features in the order below. Each phase is complete and usable on its own. Please confirm the phases you agree with and mark anything you want changed.

### Phase 1 — Set-up and quotes
**The customer can** log in with their own users and roles · request a quote for air, sea FCL or sea LCL · get an instant price where we have rates, otherwise a priced quote from our team · accept the quote and download it as a PDF.
**Behind it:** customer set-up, data separation, connection to the operations system, Noatum brand.
**Done when** the pilot customer is quoting live.

### Phase 2 — Tracking
**The customer can** see every shipment, container and flight with live milestones · download documents · view invoices and credit notes · receive alerts for delays and customs holds · run standard reports.
**Behind it:** shipment data flowing in from the operations system; public track and trace page.
**Done when** the pilot customer tracks and downloads in the portal.

### Phase 3 — Booking and claims
**The customer can** book from an accepted quote or book directly · upload their shipping documents · pick a sailing · raise a claim and follow it · set their own email alert rules.
**Behind it:** bookings created in the operations system; claims in Dynamics 365.
**Done when** a portal booking runs end to end.

### Phase 4 — Insight
**The customer can** see predicted arrival times · see CO2 per shipment and use the public CO2 calculator · build their own reports and use Power BI dashboards · ask the AI assistant.
**Behind it:** prediction models, emissions engine, analytics store. Every automated figure can be checked and corrected by a person.
**Done when** predictions and analytics are live for pilot customers.

### Phase 5 — Open up
**The customer can** see purchase orders against shipments · pull their data into their own systems · use the portal in more languages.
**Behind it:** public API, data feeds, more regions and customers, a second operations system if ever needed.
**Done when** a customer consumes our data directly.

**Start small** — Phase 1 is one customer, one region, one flow: quotes. Nothing else is switched on for them until it is ready.
**Foundation first** — customer set-up, data separation and the connection to the operations system are built in Phase 1 and never rebuilt. Every later phase adds screens on top.
**Switch on per customer** — every feature ships switched off and is turned on customer by customer. Adding the second customer or region is configuration, not a new project.

### How we build each feature

**Data** (tables and rules) → **Shared contract** (one definition for all) → **Logic** (with tests) → **Screen** (in Noatum brand)

One feature at a time, in this order, finished and shown before it is handed over.

---

## How a customer is onboarded

Nobody signs up on their own. Our team sets up the company; the company then sets up its own people.

| # | Who | Step |
|---|---|---|
| 1 | Noatum team | **Create the customer** — company name, country, and which features are switched on |
| 2 | Noatum team | **Connect the customer's records** — choose which of our existing records belong to this company; a second colleague confirms (proposed) |
| 3 | Noatum team | **Invite the customer's admin** — a branded email with a secure link |
| 4 | Customer admin | **Accept and log in** — with their company login or a secure account with two-step verification |
| 5 | Customer admin | **Invite colleagues** — assign roles: Standard, Quoting and Booking, Finance, Analyst, Claims, Admin |
| 6 | Customer users | **Ready to work** — address book, saved templates, alert preferences. Their shipments are already there |

After step 3 our team steps back. Adding and removing users belongs to the customer. Every action is recorded.

---

## The CargoWise simulator

The portal needs to talk to our operations system, CargoWise One. Access to a test copy of it depends on another team. So we build a small stand-in first, develop and demo against it, and switch to the real system by changing a setting.

| It does | It is not | It gives us |
|---|---|---|
| Accepts our quote and booking messages and replies with prices and confirmations | A copy of the operations system — no business logic | End-to-end demos before real access |
| Pushes fake shipments, milestones, documents and invoices | A second source of truth — switched off in production | Realistic tests for customer data separation |
| Holds a small test world of organisations, lanes and shared shipments | Final until real sample messages are confirmed | A permanent automated test environment |

---

## Application architecture

For the technical team. The portal is deliberately small: one web app, one service, one database. Microsoft Entra handles sign-in, so we write no login code. Background work runs as jobs inside the same service, queued in the same database, so there is no separate worker and no message broker to operate.

```
   Customer user ─┐
   Public visitor ─┼──HTTPS──► apps/noatum-customer-portal-ui (React + Vite)
   Noatum staff ──┘             public pages · customer portal · customer admin · Noatum admin
                                          │  MSAL sign-in
                                          ▼
                    Microsoft Entra External ID (customers) · Entra ID (staff)
                    sign-in, passwords, multi-factor, federation — none of this is our code
                                          │  token validated on every request
                                          ▼
                       apps/noatum-customer-portal-api — NestJS · one deployable
   ┌──────────────────────────────────────────────────────────────────────┐
   │ REQUEST PATH   identity · tenancy · authz │ users · invitations      │
   │                quotes · templates         │ bookings                 │
   │                shipments · documents      │ finance · reports        │
   │                notifications · news       │ admin · audit · claims   │
   │ ─────────────────────────────────────────────────────────────────────│
   │ ON EVERY REQUEST  Entra token checked · tenant context · permission   │
   │ guard · feature flags · tenant set in the transaction · audit written │
   │ ─────────────────────────────────────────────────────────────────────│
   │ JOBS (same process, queued in PostgreSQL)                             │
   │   CargoWise adapter · tenant resolver · email and PDF                 │
   │   carrier feeds · CRM client · master data import                     │
   └──────────────────────────────────────────────────────────────────────┘
        │ SQL + RLS            │ files                │ telemetry
        ▼                      ▼                      ▼
   PostgreSQL              Blob storage        Application Insights
   canonical model · row-level security · mapping tables · audit
   raw CargoWise messages · job queue lives here too, no broker
        │
        ▼  eAdapter XML in and out · REST synchronous for instant quotes · Dataverse · provider API · SMTP
   CargoWise One · Rate engine · Dynamics 365 · Carrier APIs · Email service
                    ▲
   apps/cw1-simulator (dashed) — stands in for CargoWise, development and tests only
```

**Deliberately small** — one web app, one service, one database, plus file storage. No cache server, no message broker, no separate worker, and no login code of our own. Fewer moving parts means fewer things to operate and fewer places to fail.

**Still flexible** — every outside system sits behind an adapter, jobs sit behind a queue interface, and the customer's login method is a setting. A cache, a broker, a separate worker or a second transport system can be added later without touching the data model.

**Safety is not simplified** — customer separation is enforced twice: by the data-access layer and by the database itself. Every request carries a permission check. Every automated value carries where it came from and can be corrected by a person.

Monorepo: `apps/noatum-customer-portal-ui` · `apps/noatum-customer-portal-api` · `apps/cw1-simulator` · `packages/design-system` · `packages/shared-types` — three runtimes in total: the web app, the service, and PostgreSQL.

---

## What we need from other teams

None of this is code, and none of it can be done by the development team alone. We can progress a long way on the simulator; after that these become blockers.

| Owner | Urgency | Needed |
|---|---|---|
| **CargoWise team** | Now | Named contact · sample messages · how customers are identified · organisation list · code lists · later, a test instance with integration enabled |
| **IT and identity** | Next | Entra External ID tenant · app registrations per environment · email sending service · password and two-factor policy |
| **Azure and DevOps** | Next | Subscription and environments · database, storage, key vault · Test environment before the pilot |
| **Business** | Now, one meeting | Customer tier definitions · confirm the six roles · who approves code links · email-domain rule · pilot customers |
| **Brand and legal** | Before pilot | Logo files and brand font · email wording EN and ES · privacy notice and terms · retention periods |

---

## Requests to the CargoWise team

Written to be forwarded as is. The first seven items take about half a day and unblock a long stretch of work.

**Purpose.** We are building a customer portal that reads shipment, document and invoice data from CargoWise One and sends customer quote requests and bookings back into it. We need the items below to build against an accurate test stand-in first, and connect to a real test instance later.

### A. Needed now — about half a day

1. **A named contact and a backup** who can answer message-format questions within one working day.
2. **Sample XML messages, anonymised** — UniversalShipment (sea FCL and air), UniversalEvent, UniversalTransaction (invoice), eDoc, and a quote message if one exists.
3. **Which element identifies each party on a shipment** — local client, shipper, consignee, notify party, agent — and which one is "the customer" for invoicing. This decides who may see a shipment.
4. **Export of the organisation list** — code, name, country, branch, status, parent or related link. CSV to start; a scheduled feed later.
5. **Event and milestone codes** for air and sea, with descriptions, marking internal-only codes.
6. **Charge codes and document types** in use, with descriptions.
7. **Status values** for quotes, bookings and shipments as CargoWise sends them.

### B. Needed next — before the first real connection

8. **Is eAdapter licensed and enabled**, on which instances (TEST, UAT, PROD), and who administers it.
9. **Message types enabled** — outbound: shipment, event, transaction, eDoc, quote. Inbound: quote request, booking.
10. **How outbound messages are triggered** — pushed on save, scheduled, or polled; delivery method (HTTPS, SFTP, queue).
11. **Can outbound be filtered by branch or department**, or is it instance-wide.
12. **Authentication for both directions** — certificates, credentials, IP allow-listing.
13. **A TEST instance with seeded data** we may send messages into, and a way to see the result in the CargoWise screens.
14. **Where our portal reference can be stored** — AdditionalReference, custom field or note, so replies can be matched.
15. **Source of instant quote prices** — CargoWise rate management or an external engine; if CargoWise, how rates are queried in real time.
16. **Daily volumes** — shipments, events, documents, invoices per day and peak hours.

### C. Needed before the pilot goes live

17. **Pilot customers' organisation codes** — all offices and the owning Noatum branch.
18. **Historical data** — one-time load of open shipments for pilot customers, or start from the connection date.
19. **Change-control process** — how we are told when fields, codes or triggers change.
20. **Behaviour when our endpoint is unavailable** — retry, queue or drop.
21. **Who signs off** that a portal-created quote or booking is acceptable to operations.

---

*Noatum Logistics · AD Ports Group · Internal document, not for external distribution.*
*Sponsor: Mohamed · Development: Jaison · #EnablingTrade*
