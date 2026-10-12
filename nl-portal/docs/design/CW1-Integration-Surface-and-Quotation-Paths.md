# CargoWise integration surface, and the two quotation paths

| | |
| --- | --- |
| Version / date | 1.3 / 17.09.2026 |
| Status | **Direction set by the product owner and confirmed at director level, 17.09.2026.** The integration mechanism is deliberately undecided; this note specifies the seam so the decision can be made late without rework. §1.2 caps the scope of the quotation module |
| Governs | What we build on our side of the CargoWise boundary, and how portal pricing relates to CargoWise pricing |
| Related | [ADR-008](../adr/ADR-008-background-work-queue.md) · [CargoWise and quotation plan](../cargowise-and-quotation/README.md) **(newest, wins)** · [Quotation module phase plan](../plans/Quotation-Module-Phase-Plan.md) · [Remediation plan](../plans/Remediation-Plan-Foundation-Gaps.md) R3 · [CargoWise workflow document](../integration/Customer-Portal-Workflows-and-CargoWise-Information-Exchange.md) |

---

## 1. The direction

### 1.1 The product owner, on where pricing happens

> The integration with CargoWise is still under discussion. However it is done, **CargoWise
> will be the main source of truth.** The portal keeps the option to price a quote and respond,
> if a user claims the request in our portal. Otherwise, whenever a quote request arrives we
> send a copy to CargoWise in whatever data model they want, and keep a copy in the portal.
> When their team prices it in their system, we receive it back through some form of
> integration. **Claiming a quote request in the portal is a managed feature**, switched on or
> off by a Portal Admin. When the quotation module is built, both paths must be considered.
> Prepare every plausible mechanism on our side.

Three consequences follow, and they shape everything below.

1. **We are indifferent to where pricing happens.** It is an operational choice. We do not
   police it, and we do not model it.
2. **The mechanism is late-binding.** Payload shape, protocol, authentication and endpoint
   URLs are all still open. Our design must not assume any of them.
3. **Portal pricing is an option, not the default.** It is switched on per deployment by a
   Portal Admin, and it is off until someone asks for it.

### 1.2 The director, on what may be built at all

Chris Hall, 17.09.2026, on the end-to-end quotation session:

> To date we have **NO established rate database, NO centralized rate storage, NO standardized
> format**, and even more important: **NO standardized quoting processes across the
> organization.** This makes it almost impossible right now to create an end-to-end quoting
> process that actually creates value and generates revenue.
>
> The organization is in the process of re-designing the system landscape as well as the
> overall processes and drafting standards. However, we are in no position right now to
> provide any complete automatic quote to a customer at this moment.
>
> **We will have to come up with a very LIGHT quoting module.**

**This is a scope ceiling, not a preference.** It is also the first director-level confirmation
of v4 rule 1, and it goes further than that rule did: it says the *process* is unstandardised,
not only the rates. Four things follow.

1. **Nothing we build may depend on a rate source, a rate store, or a standard format**,
   because none of the three exists. This retires the instant-rate path as a Phase 1 concern
   entirely — the seam stays, the switch stays off, and no work is spent on it.
2. **Nothing we build may assume a standard process.** No fixed approval chain, no mandatory
   routing, no assumption about who prices or in which system. The module must tolerate a
   different answer in every branch, because today it gets one.
3. **The pricing answer is an opaque human output.** A number, or a document, or both, with
   free text. We capture it; we do not model how it was reached.
4. **The landscape is being redesigned, so the pricing half is temporary and the request half
   is durable.** Build the half that survives.

**The strategic reading.** The organisation cannot standardise a process it cannot see. A light
module that captures every request in one structured shape, timestamps what happens to it, and
records the answer, produces exactly the evidence the redesign needs — response times, volumes,
win rates, which lanes are asked for. That is the value and the revenue argument for a light
module, and it costs us almost nothing because the analytics events already exist. **The portal
becomes the instrument that measures the process they are trying to standardise.**

---

## 2. The one principle that makes a late decision safe

> **The portal owns its own shape. Translation happens once, at the edge. Everything inward
> of that edge is unaware of how CargoWise is reached.**

Which gives us three layers, and only the outermost one changes when the mechanism is decided:

| Layer | Knows about | Changes when the mechanism is decided |
| --- | --- | --- |
| **Business modules** | Canonical quote, booking, shipment | Never |
| **Ports** — `src/contracts/adapters` | Canonical types and intent: *submit this priced quote* | Never |
| **Transports** — `src/integration/cw1` | HTTP, SOAP, XML, files, polling, middleware | **Only this** |

So the question "do they have a POST endpoint, or do we drop a file, or do we read a
dataset" becomes a question about one class, not about the platform.

---

## 3. Quotation — the two paths, and the switch between them

### 3.1 Both paths, always

```
Customer submits a structured request in the portal
        │
        ├─► ALWAYS: a copy is stored in the portal          (our record, our screens)
        │
        └─► ALWAYS: a copy is sent to CargoWise             (so whoever prices it can see it)
                    in their data model, by whatever
                    mechanism is agreed

Then, either:

  (A) CARGOWISE PATH  — the normal case
      Their team prices it in CargoWise, as they do today.
      The priced quote returns to the portal by integration.
      The customer sees it.
      Nothing in the portal needs to be claimed or touched.

  (B) PORTAL PATH — only when the feature is switched on
      A Noatum user records the price in the portal.
      Where CargoWise sync is configured, the result is written to CargoWise.
      Whether the customer must wait for CargoWise to confirm is a
      configured gate, NOT a fixed rule — see 3.1a.
```

**Neither path is compulsory, and a branch may use both.** If CargoWise prices a request that
somebody has already priced in the portal, **CargoWise wins**: its values are stored, the
portal user keeps their draft in the pricing history, and they are notified.

### 3.1a The confirmation gate — corrected 17.09.2026

The earlier design made this an absolute rule: *a portal-priced quote stays `pending sync`
until CargoWise confirms, and only then does the customer see it.* **That rule cannot be
absolute.** The director's note of 17.09.2026 says there is no standardised quoting process
across the organisation, so a branch that prices in a spreadsheet, with no settled CargoWise
quoting route, would be unable to answer a customer at all. The gate would not protect the
record; it would stop the module working.

| `quotations.cw1_request_sync` | Behaviour |
| --- | --- |
| **On** | The original rule holds. Price goes to CargoWise, quote sits at `pending sync`, the customer sees it once CargoWise confirms. CargoWise remains the record |
| **Off** | The portal is the record for that quote. The price is released to the customer directly, marked with its provenance, and the quote is flagged for later reconciliation if CargoWise is connected afterwards |

**This is the single open question with Christian** — see §9.

### 3.2 The new feature switch

Portal pricing becomes a catalogue entry in `src/contracts/feature-switches.ts`, state held in
the `feature_switch` table, managed on the existing Feature management screen.

| Key | Default | Requires approval | What it gates |
| --- | --- | --- | --- |
| `quotations.portal_pricing` | **OFF** | No | The pricing screen and the price-recording route. **Not the claim action** — see below. With it off, the portal is a window: requests go to CargoWise and priced quotes come back |
| `quotations.cw1_request_sync` | **ON** | No | Sending the request copy to CargoWise. Off only for a deployment with no CargoWise connection at all |
| `quotations.instant_rate` | OFF | Yes | Already in the catalogue. No rate source exists |

**Claiming is not behind any switch (17.09.2026, product owner).** Taking ownership of a
request answers "who is dealing with this", not "what is the price". It is most valuable on
the CargoWise path, where the portal is the only shared record and two people can otherwise
price the same request twice in the TMS. So `POST /v1/quotes/:id/claim` and `/release` are
always available, carry their own permission `quotes.claim`, and **a claim never blocks an
inbound CargoWise price** — the collision rule in §3.1a is unaffected. Detail in
[Quotation module phase plan, Q1](../process/Quotation-Module-Phase-Plan.md).

**Why a switch and not a setting.** The four-way boundary in the feature-management design
holds: environment configuration owns *where CargoWise is* and *how we reach it*; a platform
feature switch owns *whether a capability exists at all*. Portal pricing is a capability.
Transport is configuration. They must not be conflated.

**One rule to enforce in code:** with `quotations.portal_pricing` off, the pricing routes must
return 403 from the `FeatureGuard`, not merely be hidden in the UI.

### 3.3 What "light" means — a proposed definition

"Light" is a word, not a specification, so here is the specification. It is proposed, and
§9 asks for it back in writing before the module is built.

**The module is light because it depends on nothing that does not exist.** That is the test to
apply to every field, screen and rule below.

**In scope — the durable half**

| # | Capability | Why it survives the landscape redesign |
| --- | --- | --- |
| L1 | **Structured request capture** — lane, mode, incoterm, cargo, dates, references | Our screen, our shape. Independent of any pricing system |
| L2 | **One portal record per request**, with a stable portal reference | The customer's audit trail |
| L3 | **A copy to CargoWise** when `quotations.cw1_request_sync` is on | Whoever prices it can see it |
| L4 | **A response captured from either direction** — typed by a person in the portal, or received back from CargoWise | Tolerates both, and any future third system |
| L5 | **Customer-facing response surface** — amount, currency, validity date, optional attached document, free-text notes | What the customer actually needs |
| L6 | **Accept, decline, expire**, with audit and provenance | The commercial outcome |
| L7 | **Timestamps on every transition**, surfaced as age and response time | The evidence the redesign needs |

**Explicitly out of scope — do not build**

| Not building | Seam kept |
| --- | --- |
| Rate database, rate storage, tariff or contract tables | None needed. There is nothing to store |
| Instant automatic pricing | `RateEngineAdapter` interface and `quotations.instant_rate`, off |
| Cost, margin or profitability modelling | Nullable columns only if asked; no machinery |
| Approval chains and thresholds (OQ-11) | Nullable `approved_by` / `approved_at`. No workflow |
| Multi-round negotiation, versioned offers, **automatic** carrier comparison or ranking | A revision number; one active response set |
| Charge-line schema with mapped charge codes | Optional free-form lines. Description is text |
| Any assumption that a price will arrive automatically | v4 rule 1, now director-confirmed |

**The response shape, deliberately loose.** A response is valid with *either* **one or more
priced options** *or* an attached document, or both. Charge lines are optional and their
descriptions are free text, because there is no standard format to validate against. Forcing a
schema here would make the module unusable in every branch that does not yet have one — which
today is all of them.

**Several options are in scope; deriving them is not** (17.09.2026, from the UI mockups). A
person types each option — label, carrier name, service routing, transit days, total, validity —
and marks one recommended. Nothing looks a price up, compares carriers or ranks them. The line
that matters is not how many options there are, it is whether the portal *computes* any of
them. It does not. Detail in
[Quotation module phase plan, Q1](../plans/Quotation-Module-Phase-Plan.md).

**Superseded in part on 18.09.2026** by
[`docs/cargowise-and-quotation/`](../cargowise-and-quotation/README.md): the portal now carries
the standard quote flow and the customer no longer waits for CargoWise.

**Minimal status set.** ~~`draft` → `submitted` → `pending sync` → `quoted` →
`accepted` | `declined` | `expired` | `withdrawn`~~ — **replaced 18.09.2026.** `pending sync`
conflated what the customer sees with whether a message left the building; the two are now
separate fields. The current list is in
[02-Quotation-Flow-and-Status.md](../cargowise-and-quotation/02-Quotation-Flow-and-Status.md) §2.
Each transition still gets a unit test in `quote.status.ts`.

---

## 4. Our integration surface — every mechanism, prepared

This is the answer to "prepare all the possible mechanisms". Each direction has one port and
several interchangeable transports, plus the endpoints we expose so their side has something
to call.

### 4.1 Inbound — CargoWise to the portal

**Five plausible mechanisms, one landing point.**

| # | Mechanism | What we need to build | Likelihood |
| --- | --- | --- | --- |
| I1 | **They push to our HTTP endpoint** | An inbound controller, authenticated, that archives and acknowledges | High |
| I2 | **We poll a read API** | A scheduled job calling their endpoint, with a cursor or high-water mark | Medium |
| I3 | **We fetch a scheduled file or extract** | Already proven — the organisation import does exactly this | Medium |
| I4 | **We read a replicated dataset**, for example Snowflake | A reader that maps rows into the same envelope | Medium, for bulk and history |
| I5 | **Middleware pushes to us** | Same as I1, different caller and credentials | Medium |

**Everything lands in the same place.** Whichever mechanism is chosen, the message is turned
into one envelope and written to `integration_message` before anything else happens. That is
what keeps the mechanism swappable.

**Endpoints we expose**

| Method and path | Purpose | Auth | Notes |
| --- | --- | --- | --- |
| `POST /api/integration/cw1/messages` | **The universal inbound door.** Accepts any message type in a generic envelope | Shared secret or mutual TLS or signed token — decided with them | Archive, log, enqueue, **return 202 immediately**. Never do business work in the request |
| `POST /api/integration/cw1/quotes` | Optional typed convenience route for quote messages | Same | Thin wrapper over the universal door. Offer it only if their side prefers a per-type URL |
| `GET /api/integration/health` | So their side can prove we are reachable | Same | Returns liveness only, no data |

**Internal operations endpoints**, permission `admin.integration.read` / a new
`admin.integration.replay`:

| Method and path | Purpose |
| --- | --- |
| `GET /api/admin/integration/messages` | List with filters: type, status, date, correlation id |
| `GET /api/admin/integration/messages/:id` | One message with its raw payload. Internal only, never customer-facing |
| `POST /api/admin/integration/messages/:id/replay` | Re-run a message through processing. Audited, reason required |
| `GET /api/admin/integration/health` | Queue depth, oldest job, failure count, last inbound and outbound timestamps per message type |

**Scheduled jobs**, to cover the non-push mechanisms:

| Job | Covers | Notes |
| --- | --- | --- |
| `cw1.poll` | I2 | Cursor stored per message type. Off unless configured |
| `cw1.extract.fetch` | I3, I4 | The organisation import generalised |

### 4.2 Outbound — the portal to CargoWise

**Five plausible mechanisms, one port.**

| # | Mechanism | Notes |
| --- | --- | --- |
| O1 | **Synchronous call to their endpoint** — REST or SOAP | Most likely. Response may be receipt only, not business acceptance |
| O2 | **Submit now, acknowledge later** | We mark the quote `pending sync` and wait for an inbound confirmation. Our state machine already needs this state |
| O3 | **File drop** to SFTP, Blob or a share | Their side or middleware collects |
| O4 | **Message to their middleware** | Same shape as O1 with a different address |
| O5 | **Operator-assisted export** | The honest fallback if no interface is available: a generated file an operator uploads. Ugly, but it keeps the portal usable |

**One port covers all five:**

```
TmsQuoteAdapter
  createRequest(canonicalQuoteRequest)        → submission receipt
  submitPricedQuote(canonicalPricedQuote)     → submission receipt
  recordDecision(accept | reject | cancel)    → submission receipt
```

A `submission receipt` deliberately says only **received**, **accepted** or **rejected**, plus
an optional external reference. It does not assume a synchronous answer, because under O2 and
O3 there is not one.

Behind the port, one interchangeable transport, chosen by configuration:

```
Cw1QuoteHttpTransport   ·   Cw1QuoteFileTransport   ·   Cw1QuotePendingTransport
```

The same pattern repeats for `TmsBookingAdapter`, `TmsTrackingAdapter`, `TmsFinanceAdapter`
and `TmsDocumentAdapter`.

---

## 5. The envelope — what makes the mechanism late-binding

Every inbound message, regardless of how it arrives, is normalised to this before anything
touches it. It is the reason a change of mechanism is a change of one class.

| Field | Why it exists |
| --- | --- |
| `sourceSystem` | `cw1` today; a second TMS later |
| `sourceInstance` | Which CargoWise database. Open question ORG-D02 |
| `messageType` | `quote.priced`, `shipment.updated`, `invoice.issued` … our vocabulary, not theirs |
| `sourceMessageId` | **Their** identifier, whatever it turns out to be |
| `occurredAt` | When it happened at source |
| `receivedAt` | When we took it |
| `contentType` | `application/xml`, `application/json`, `text/csv` |
| `payload` | The raw body, verbatim, for audit and replay. 13-month retention |
| `correlationId` | Ties browser → API → job → message into one trace |
| `status` | `received` · `processed` · `failed` · `ignored` |

**Idempotency:** unique on `(sourceSystem, sourceInstance, sourceMessageId)`. A redelivery is
recognised and ignored rather than applied twice.

**If their side supplies no stable identifier**, we derive one from a hash of the payload plus
message type and record that we did so. That is a worse answer, and a reason to ask for a real
one — it is question 6 in the CargoWise document.

**Outbound idempotency** uses our own reference, stable across retries and different when the
content legitimately changes:

```
quote request     →  Q-000042
priced quote      →  Q-000042:v1      (retry sends Q-000042:v1 again, unchanged)
re-priced quote   →  Q-000042:v2      (genuinely new, must get through)
```

This mirrors what `JobsService.enqueue()` already does internally, so the discipline is
consistent on both sides of the boundary.

---

## 6. Configuration — what is set, not coded

Transport selection is environment configuration, never a database switch, and never in code.

```
CW1_TRANSPORT_QUOTE          = http | file | pending | none
CW1_TRANSPORT_TRACKING       = http | poll | extract | dataset | none
CW1_QUOTE_REQUEST_URL        =
CW1_QUOTE_SUBMIT_URL         =
CW1_AUTH_MODE                = basic | bearer | mtls | signature
CW1_INBOUND_SECRET           =              (Key Vault)
CW1_SOURCE_INSTANCE          =
CW1_POLL_INTERVAL_SECONDS    =
CW1_FILE_DROP_PATH           =
```

`none` is a first-class value. With it set, the port records the intent, marks the quote
`pending sync`, and the operations screen shows a queue of unsent messages. **The portal stays
usable with no CargoWise connection at all**, which is exactly the state we are in today.

---

## 7. What is decided now, and what stays open

**Decided now — build it:**

- The ports, and that business code touches nothing else
- The envelope, `integration_message`, and idempotency on both directions
- Our inbound endpoints, the operations screens and replay
- The queue as the carrier for everything outbound
- `quotations.portal_pricing` as a switch, off by default
- Both quotation paths in the data model, including the CargoWise-wins rule on collision

**Open, and deliberately so — do not guess:**

| # | Question | Owner |
| --- | --- | --- |
| 1 | Which mechanism per message type — push, poll, file, dataset | CargoWise team |
| 2 | Their data model for a quote request and a priced quote | CargoWise team |
| 3 | What constitutes business acceptance, as distinct from receipt | CargoWise team |
| 4 | Their stable message identifier | CargoWise team |
| 5 | Authentication and environments | CargoWise team and IT |
| 6 | ~~Proportion of pricing done inside CargoWise today~~ | **Retired 17.09.2026.** The director's note answers it: there is no standardised process, so there is no stable proportion to measure |
| 7 | **Where a branch prices outside any system, may the price be released to the customer without passing through CargoWise** | Director (Christian). **This is the one open answer that changes what we build** — see §3.1a |

**None of these block the seam.** All of them block the transport, which is one class.

---

## 8. What this changes in the remediation plan

| Package | Change |
| --- | --- |
| **R3 — integration spine** | Grows slightly: the envelope and `integration_message` as specified here, the universal inbound door, and the operations screens. Its priority **rises** — it is now the critical path for both quotation directions |
| **R4 — queue wiring** | Adds `cw1.poll` and `cw1.extract.fetch` as job shapes, off unless configured |
| **R7 — quotes module** | Must carry both paths from the start, plus the `pending sync` state and the CargoWise-wins collision rule |
| **R8 — write-back** | Reframed. It is no longer "the" quotation feature, it is **path B behind a feature switch**. Inbound consumption of a CargoWise-priced quote moves ahead of it |
| **New, small** | Add `quotations.portal_pricing` and `quotations.cw1_request_sync` to the feature-switch catalogue, and gate the pricing routes on the first |

**The build sequence that follows from all of this is in
[the quotation module phase plan](../process/Quotation-Module-Phase-Plan.md)**, which turns
§3.3 into phases Q0–Q5 with an agent prompt for each.

---

## 9. Still to confirm with the sponsor

This note follows v4 rule 4 — both ways of working stay supported — but it does change
emphasis. PRD v4.0 calls internal portal pricing "the Phase 1 quotation feature". On this
direction it becomes an optional capability, switched off by default, while the CargoWise
pricing path becomes the normal one.

That is a change of emphasis rather than of scope, and nothing designed is removed. It should
still be confirmed in writing, alongside OQ-11 and OQ-12, before the quotation module is
built.

**Open with the director, 17.09.2026.** Where a branch prices outside any system, may that
price be entered in the portal and released to the customer without passing through CargoWise?
His answer decides whether §3.1a's gate is built at all. Until it comes back, build the gate
as a switch defaulting to **off**, because that is the behaviour that works everywhere.

---

## 10. History

| Date | Version | Change |
| --- | --- | --- |
| 17.09.2026 | 1.0 | Written after the product owner set the direction quoted in §1.1: CargoWise is the main source of truth, the mechanism stays undecided, and claiming a quote request in the portal becomes a managed feature |
| 17.09.2026 | 1.1 | Christian's note on the end-to-end quotation session added as §1.2 — no rate database, no rate storage, no standard format, **no standardised quoting process**, and a "very LIGHT quoting module". Added §3.3 defining what light means. **Corrected §3.1a**: the CargoWise-confirmation gate becomes conditional rather than absolute, because an absolute gate would block every branch that prices outside a system. Retired open question 6 and raised question 7 |
| 17.09.2026 | 1.2 | **Corrected §3.2**: `quotations.portal_pricing` no longer gates the claim action. Product owner: *"keep the claim even [if] CW is there or not"*. Claiming answers who is handling a request, not what the price is, and is most valuable on the CargoWise path where the portal is the only shared record. Claim and release are always available, carry `quotes.claim`, and never block an inbound CargoWise price |
| 17.09.2026 | 1.3 | **Corrected §3.3**: the response shape said "an amount"; a quote carries **one or more priced options** (UI mockups). Several options are in scope, *deriving* them is not — the exclusion is now "automatic carrier comparison or ranking", not carrier comparison as such |

**Why this history matters.** If someone later finds a switch defaulting to off, or a
confirmation gate that can be bypassed, and wonders whether it was an oversight: it was not.
It is the direct consequence of a director-level statement that the organisation has no
standard quoting process and is redesigning its system landscape. Should that change — should
a rate source or a standard process arrive — the seams are all in place and the defaults flip.
Nothing designed here was deleted.
