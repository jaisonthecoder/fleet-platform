# Meeting Notes — Questions and Concerns Before We Proceed

| | |
|---|---|
| **Meeting** | Sponsor (Mohamed) + CargoWise team |
| **Purpose** | Confirm scope and approach, and unblock the integration |
| **Prepared** | 04.09.2026 |
| **How to use** | Section 1 is the one-minute framing. Section 2 is the four things that decide whether we can start. Sections 3–6 are the detailed lists by owner. Section 7 is what to leave the room with. |

---

## 1. One-minute framing (say this first)

We are building the customer-facing portal from PRD v2.1: customers log in to track, quote, book, download documents, see invoices and get alerts. CargoWise stays the system operations work in — the portal reads from it and passes customer requests into it. We start with one customer, one branch, quotes first.

The screens are the quick part and follow the existing mockup. Three things must be right from the first version because they cannot be retrofitted: keeping each customer's data separate, the connection to CargoWise, and how a customer and its users are set up.

---

## 2. The four blockers — if we resolve nothing else, resolve these

| # | Question | Owner | Why it blocks |
|---|---|---|---|
| **B1** | **Is eAdapter licensed and enabled?** On which instances, and who administers it? | CargoWise team | The entire integration design assumes it. PRD §12 lists it as an *assumption*, OQ-2 asks for confirmation. If the answer is no, the transport changes (extracts, files, another API) and we need that conversation now, not in two months. |
| **B2** | **Which XML element identifies each party on a shipment** — local client, shipper, consignee, notify party, agent — and which one Noatum treats as "the customer" for invoicing? | CargoWise team | This single rule decides which customer sees which cargo. Guessing it wrong means one company sees another's shipments. |
| **B3** | **Where do instant quote prices come from** — CargoWise rate management or a separate rate engine? (OQ-1) | Sponsor + Pricing | Determines whether the quote flow is a REST call or another CargoWise message. We build behind an adapter either way, but the pilot needs a real answer before quotes go live. |
| **B4** | **Which customer, which offices, which branch for the pilot** — and do that branch's main lanes have rates? | Sponsor | Without rates on the pilot lanes, every quote takes the slow manual route and the demo does not show the value. |

---

## 3. For the CargoWise team

### 3a. Needed now — about half a day of their time, unblocks months of ours

| # | Ask | Why we need it |
|---|---|---|
| 1 | A named contact and a backup who can answer message-format questions within a working day | Every integration step raises small questions |
| 2 | Sample XML, anonymised: UniversalShipment for one sea FCL and one air job, UniversalEvent, UniversalTransaction (invoice), an eDoc message, and a quote message if one exists | We build our adapter and the test stand-in against real shapes, not the public schema alone |
| 3 | **(B2)** Which element and code identifies each party, and which is "the customer" | Decides visibility |
| 4 | An export of the organisation list: code, name, country, city, branch, status, and any parent or related-organisation link. CSV to start, plus how we get it on a schedule | Feeds the search Noatum uses to onboard a customer |
| 5 | Event and milestone codes for air and sea, with descriptions, marking which are internal and must never reach a customer | Maps CargoWise codes to customer-facing milestone names |
| 6 | Charge codes and document types in use, with descriptions | Mapping tables for quotes, invoices, document tagging |
| 7 | Status values for quotes, bookings and shipments as CargoWise sends them | Status mapping |

### 3b. Needed before the first real connection

| # | Ask |
|---|---|
| 8 | **(B1)** Is eAdapter licensed and enabled, on which instances (TEST, UAT, PROD), and who administers it |
| 9 | Which message types are enabled outbound (shipment, event, transaction, eDoc, quote) and which are accepted inbound (quote request, booking) |
| 10 | How outbound messages are triggered — pushed on save, scheduled, or polled — and the delivery method (HTTPS post, SFTP, queue) |
| 11 | **Can outbound be filtered by branch or department, or is it instance-wide?** If instance-wide, we receive every branch's traffic from day one — which is workable, but we need to know |
| 12 | Authentication in both directions: certificates, credentials, IP allow-listing |
| 13 | A TEST instance with seeded data we may send messages into, and a way to see the result in the CargoWise screens |
| 14 | Where we can store our portal reference on a CargoWise record (AdditionalReference, custom field, note) so replies can be matched |
| 15 | **(B3)** Whether CargoWise rate management can serve instant quotes, and if so how rates are queried in real time |
| 16 | Daily volumes: shipments, events, documents, invoices per day, and peak hours |
| 17 | Message size limits, particularly for documents sent as base64 attachments |

### 3c. Before the pilot goes live

| # | Ask |
|---|---|
| 18 | Organisation codes of the pilot customer, all their offices, and the owning Noatum branch |
| 19 | Historical data: can we receive a one-time load of open shipments for the pilot customer, or do we start from the connection date |
| 20 | Change-control process: how we are told when fields, codes or triggers change |
| 21 | Behaviour when our endpoint is unavailable — does CargoWise retry, queue, or drop |
| 22 | Who signs off that a portal-created quote or booking is acceptable to operations (field completeness, branch routing) |
| 23 | Is there an organisation category that distinguishes clients from carriers and agents? It would let us filter the onboarding search |

---

## 4. For the sponsor — scope and approach

| # | Question | Our proposal |
|---|---|---|
| 1 | **(B4)** Pilot customer, which of their offices, which branch | A customer with active volume on lanes where we hold rates |
| 2 | Is the first release quotes only, or quotes plus tracking? | Quotes first; tracking is Phase 2 in the PRD |
| 3 | Does "one region" mean one branch, as we have assumed? | Yes — there is no region object; the branch appears only as a code on organisation records |
| 4 | Is growth expected to be configuration only — link more offices, add customers, switch features on? | Yes, provided three global rules are agreed once (see question 5) |
| 5 | Confirm the three rules that make scaling configuration: which party roles make a company "the customer"; that only records linked by Noatum grant visibility; that invoices are visible only to the office addressed | As stated |
| 6 | No customer self-registration — Noatum invites the first admin, who invites colleagues. Correct? | Correct per PRD FG-8.2; no sign-up page exists |
| 7 | Login: Microsoft Entra External ID handles company accounts, federation to a customer's own sign-on, and email-password accounts with MFA. We write no login code. Acceptable? | Yes — removes an entire subsystem |
| 8 | Should linking a customer to its CargoWise records need a second person to approve? | One person with a confirm dialog and full audit; the column for a second approver is ready if wanted |
| 9 | Confirm the six customer roles: Standard, Quoting and Booking, Finance, Analyst, Claims, Customer Admin | As listed in the PRD |
| 10 | Customer tiers — what do SME, Large and VIP mean, and which features does each get? (OQ-10) | Three tiers with default feature sets, editable per customer |
| 11 | May a customer admin invite someone outside their company email domain (agent, consultant)? | No by default; Noatum can override |
| 12 | Carrier names shown on quotes, or hidden? (OQ-9) | Feature flag per customer, default hidden until Commercial decides |
| 13 | Is "Customer Success" a real team at Noatum, and who holds that role for the pilot? | The PRD names it as a persona; we need the actual people |
| 14 | Who are the two or three people who will act as Noatum administrators in the portal? | Named individuals before go-live |
| 15 | Should the screens follow your mockup closely, or is it a starting point we may adapt? | Follow closely for Phase 1 |
| 16 | Who provides the official logo files and brand font? (OQ-13) | Brand team |
| 17 | Confirm the phase order: set-up and quotes → tracking → booking and claims → insight → open up | As in the PRD roadmap |

---

## 5. For the sponsor — approach and ways of working

| # | Point | What we are asking |
|---|---|---|
| 1 | We build the foundation properly before any screen — customer set-up, roles, data separation, the CargoWise connection. Rushing it makes scaling much harder later. We will review the design with Sreedev and Linoy before locking it | Agreement, and their time |
| 2 | We build one feature at a time, end to end, and show it before moving on | Agreement, and a regular slot to review |
| 3 | We build a stand-in for CargoWise so development and demos are not blocked by access | Agreement; and support in chasing B1 |
| 4 | Every feature ships switched off and is turned on per customer | Agreement |
| 5 | We keep the design deliberately small: one service, one database, no cache server, no message broker, no login code of our own. Everything removed has a documented way back | Awareness — this is a deviation from the PRD's suggested stack, recorded in ADR-004 |
| 6 | Where the PRD is silent we will not guess; we bring the question with a proposal | Agreement |

---

## 6. For IT, Azure and Brand — flag in the meeting, follow up separately

| Owner | Needed |
|---|---|
| IT / identity | Entra External ID tenant for customer logins, configured invitation-only; app registrations for each environment; email sending domain with SPF and DKIM |
| Azure / DevOps | Subscription and four environments; PostgreSQL, storage, key vault, app insights; a Test environment before the pilot |
| Legal | Privacy notice and terms of use text; whether acceptance must be recorded at first login; retention period for deactivated users |
| Brand | Logo files, brand font, approved email wording in English and Spanish |

---

## 7. What to leave the room with

- A **named CargoWise contact** and a date for items 1–7.
- A yes or no on **eAdapter** (B1), even if provisional.
- The **pilot customer, offices and branch** (B4), even if provisional.
- A decision or an owner and date for **OQ-1** (B3).
- Agreement on the **three global visibility rules** (section 4, question 5).
- Confirmation that **no self-registration** and **Entra handles login** are correct (questions 6 and 7).

Anything not answered becomes a line in `gaps.md` with an owner and a date, not an assumption in the code.

---

## 8. Concerns worth stating plainly

| Concern | Why it matters | What we are doing about it |
|---|---|---|
| eAdapter availability is an assumption, not a fact | The whole integration design rests on it | Building behind adapter interfaces and against a simulator, so a different transport changes one layer |
| The party-role rule is unconfirmed | Getting it wrong is a data-leak class of error | Blocking question B2; tests cover shared and unmapped shipments |
| Rate source undecided | Instant quotes are the pilot's visible value | Adapter with a mock; decision needed before the quote slice completes |
| "It looks like a simple application" | The invisible three-quarters is tenancy, integration and onboarding | This meeting; the visual briefing explains it without jargon |
| Pilot lanes may have no rates | Every quote would take the manual route and the demo falls flat | Choose the pilot customer on rate coverage, not only on relationship |
| CargoWise codes differ per installation | Hard-coding them would break on the first change | Mapping tables an administrator can edit, never constants in code |
