# Quotation module — phase-by-phase build plan

| | |
| --- | --- |
| Version / date | 1.3 / 17.09.2026 |
| Status | **Authoritative build sequence for quotations.** Supersedes slices S1.08–S1.10 and SP.01–SP.06 for Phase 1, and replaces the body of kick-off stage F1.08 |
| Why it exists | The director capped the quotation scope on 17.09.2026. The existing slice plan describes a module built around an automatic rate engine that has no source and, on current evidence, will not have one soon |
| Governed by | PRD amendment 17.09.2026 · [CW1 integration surface](../design/CW1-Integration-Surface-and-Quotation-Paths.md) · [Internal quote pricing §1b](../design/Internal-Quote-Pricing-in-Portal.md) |
| Depends on | [Remediation plan](Remediation-Plan-Foundation-Gaps.md) R1, R3, R4 for phases Q4 and Q5 only |
| Working files | **[docs/quotation/](../quotation/README.md)** — one short file per phase, for hand-over. This document stays the reasoning; those are the build sheets |

---

## 0. Which document wins — read this before editing anything

Several people and agents work on this module at once. Documents drifted apart because none of
them said which was authoritative. This section fixes that. **It applies to quotations only.**

| Rank | Document | Owns | Does not own |
| --- | --- | --- | --- |
| **0** | **`docs/cargowise-and-quotation/`** — the plan of 18.09.2026 | **The CargoWise communication surface and the portal quote flow**: the status machine, claiming, manual pricing, publishing, and every adapter operation. Newest direction, so it wins outright | The scope cap, which still holds |
| **1** | **`docs/quotation/Q0…Q5.md`** — the build sheets | **How.** Tables, columns, routes, request bodies, screen behaviour, anything driven by a UI mockup | Sequence, scope, whether something is built at all |
| **2** | **This document** | **What and whether.** The phase order, the scope cap, what is deliberately excluded and where each seam lives | Field-level detail |
| **3** | `docs/design/CW1-Integration-Surface…` · `Internal-Quote-Pricing…` | The reasoning behind a capability, and the CargoWise contract | Build instructions |
| **4** | PRD FG-3 · `01-Vertical-Slice-Implementation-Plan` S1.08–S1.10, SP.01–SP.06 · kick-off F1.08 | **Superseded for Phase 1.** Retained as the fuller design for when a standard process exists | Anything being built now |
| — | `docs/plans/Remediation-Plan-Foundation-Gaps.md` | The foundation the phases depend on — adapters, queue, integration spine | **Quotations. It explicitly does not own them** |

**Changed on 18.09.2026 by the product owner.** The portal now carries the standard quote flow
and CargoWise is connected later; portal pricing is **on** by default, publishing is a separate
step, and the customer no longer waits for CargoWise. See
[`docs/cargowise-and-quotation/README.md`](../cargowise-and-quotation/README.md) §3 for exactly
which earlier statements that replaces.

**The two rules that keep this true.**

1. **The build sheet wins on detail; the phase plan wins on scope.** If a build sheet adds a
   field, a table or a screen behaviour, it is right — but it must not widen the scope in §7.
2. **Fix the disagreement in the same change, in both files.** Never leave two documents
   describing the same thing differently. That is what caused this section to be written.

**Richer detail is not scope creep.** Multiple priced options, carrier name, transit days and a
recommended option all came from the UI mockups after this plan was first written. They are
**in**, because a person types every one of them and nothing derives them. What stays out is
anything that *computes* a price. §7 is the boundary, not the field count.

---

## 1. Why this plan exists

Two pieces of direction landed on the same day, from different levels, and together they
change what gets built first.

**The product owner, on where pricing happens.** CargoWise is the main source of truth. A quote
request is always copied to CargoWise. Pricing in the portal stays available, but as a managed
feature that a Portal Admin switches on. Both paths must be carried; the integration mechanism
is deliberately still undecided.

**The director, on what may be built at all.**

> To date we have **NO established rate database, NO centralized rate storage, NO standardized
> format**, and even more important: **NO standardized quoting processes across the
> organization.** This makes it almost impossible right now to create an end-to-end quoting
> process that actually creates value and generates revenue. The organization is in the process
> of re-designing the system landscape as well as the overall processes and drafting standards.
> However, we are in no position right now to provide any complete automatic quote to a
> customer at this moment. **We will have to come up with a very LIGHT quoting module.**
>
> — Christian, 17.09.2026

**Read together, they say: the portal must not depend on anything the organisation does not
yet have.** No rate source, no standard format, no standard process, and a TMS that may itself
be replaced in the landscape redesign.

**Nothing designed is deleted.** v4 rule 4 holds throughout. Every deferred capability keeps
its seam — an interface, a nullable column, or a switch — and the defaults flip the day a rate
source or a standard process exists. §7 lists each one and where its seam lives.

---

## 2. The rule that decides every question below

> **If the business has not decided it, do not model it. Store it loosely, keep a seam, and
> move on.**

Applied to this module that means: no rate tables, no charge-code schema, no approval chain,
no margin, no pricing queue **screen**. A quote response is **one or more priced options, or an
attached document, or both, plus free text** — recorded by a person or received from CargoWise.

**Two exceptions, both decided 17.09.2026, both inside the cap.**

- **Claiming a request is built now.** It is not pricing and does not depend on a standard
  process — it answers "who is dealing with this", which the business already asks today. See Q1.
- **A quote carries several options**, from the UI mockups. A person types every one; nothing
  derives, compares or ranks them. The cap forbids *computing* a price, not offering a choice.

There is a second rule behind the sequencing:

> **Build the half that survives the landscape redesign first.** Request capture, the portal
> record and the customer-facing response outlive any pricing system. Anything shaped to a
> specific TMS does not.

That is why Q0–Q3 need nothing from CargoWise and nothing from the process redesign, and why
they come first.

---

## 3. Where the code actually is today

Verified against the source on 17.09.2026, not against the design documents.

| Area | State |
| --- | --- |
| `quote` table | Exists. `mode`, `originCode`, `destinationCode`, `payload` Json, `grossWeightKg`, `chargeableKg`, `totalMinorUnits` BigInt, `currency`, `validUntil`, `reference` unique per group. A sound skeleton |
| `QuoteStatus` enum | `draft`, `rated`, `rate_failed`, `expired`, `accepted`, `rejected`. Machine-shaped — `rated` is a rate-engine word |
| Endpoints | `GET /quotes`, `GET /quotes/:id`, `POST /quotes`, `POST /quotes/:id/rate`. All permission-guarded |
| `create()` | Validates more than it persists. `volumeM3` is used to compute chargeable weight and then discarded. No incoterm, ready date or customer reference |
| `accountId` | Accepted from the client and **never checked against the caller's group**. Security defect |
| Reference allocation | Read-then-write in `nextReference()`. Concurrent creates collide and surface as an error, not a retry |
| Pricing | Only `rate()`, a synchronous call to `RateEngineAdapter`, which has no configured source. **There is no way for a person to record a price, and no way for CargoWise to deliver one** |
| Status rules | None. No `quote.status.ts`, no allowed-transition table, no tests |
| `accepted` / `rejected` / `expired` | Exist in the enum. No route reaches any of them |
| Expiry | `quote-expiry.handler.ts` exists as a stub. Nothing schedules it |
| Queue | pg-boss runs. `JobsService.enqueue()` has **zero callers** anywhere in the codebase |
| Documents | No link between a quote and a document |
| Feature switches | Catalogue and `feature_switch` table exist. `quotations.instant_rate` is the only quotation entry |
| Audit / analytics | Audit rows are written without the customer group. Analytics events are never persisted |

**Summary: roughly a third of the target exists, and the module points the wrong way.** It is
built around a machine answering; it needs to be built around a person answering.

---

## 4. The target, in the words used with the director

- Captures a quote request from the customer in one structured form — lane, mode, incoterm, cargo, dates, references
- Keeps a portal record with a reference, so the customer and our team see the same thing
- Sends a copy to CargoWise where that is configured, so whoever prices it can see it
- Accepts the answer from either direction: returned from CargoWise, or typed into the portal by the person who worked it out
- Shows the customer an amount, a validity date, an attached document, or any combination — no fixed format, because there is not one to follow
- Records accept, decline and expiry, with a full audit trail

---

## 5. The phases

| Phase | Delivers | Size | Needs CargoWise | Needs remediation | Needs a mockup |
| --- | --- | --- | --- | --- | --- |
| **Q0** | The record made true and safe | Small | No | No | No — no UI |
| **Q1** | A person claims a request and records a price | Medium | No | No | **Yes**, for the screen |
| **Q2** | A document is the answer | Small | No | No | Upload / download controls only |
| **Q3** | Submit, accept, decline, expire — and the measurement | Medium | No | R4 for the scheduler | **Yes**, both listings |
| **Q4** | The request copy goes out to CargoWise | Medium | Yes | R1, R3, R4 | Sync indicator only |
| **Q5** | A priced quote comes back from CargoWise | Medium | Yes | R1, R3, R4 | Provenance marker only |

**Q0–Q3 can start now and are useful on their own.** At the end of Q3 a customer can ask for a
quote, a Noatum user can answer it, and the customer can accept it — with no CargoWise
connection in existence. That is the light module. Q4 and Q5 connect it.

**Standing instruction: stop before building any quotation screen.** `src/features/quotes/` is
an empty `.gitkeep`, and mockups exist for the customer and staff pages and the quotation
listing. Build the API, then stop and ask for them. Do not design a quotation screen yourself.

---

### Q0 — Straighten the record

**Goal:** the quote table honestly holds what the customer submitted, the reference is safe
under load, and a quote cannot be filed against another company's account.

**Database**

- Add to `quote`: `incoterm` (varchar 11, nullable), `readyDate` (timestamptz, nullable),
  `customerReference` (varchar 60, nullable), `serviceLevel` (varchar 40, nullable),
  `volumeM3` (decimal 12,3, nullable), `notes` (text, nullable).
- Add enum values to `quote_status`: `submitted`, `quoted`, `pending_sync`, `withdrawn`.
  **Do not remove** `rated` or `rate_failed` — enum value removal is not reversible in place,
  and the instant path keeps its seam. Treat them as deprecated in code.
- Replace `nextReference()` with allocation from a Postgres sequence per customer group, or a
  counter row taken with `SELECT … FOR UPDATE`. The unique index stays as the backstop.

**Contracts**

- `createQuoteSchema` gains the new fields. Every field the schema accepts must be persisted —
  add a test that asserts this, because silent field loss is the defect being fixed.
- New `quote.status.ts` holding the allowed transitions and nothing else.

**API**

- `create()` persists everything validated, including `volumeM3`.
- `create()` resolves `accountId` server-side: if supplied, it must belong to the caller's
  customer group, otherwise reject. **Never trust it from the client.**
- No new routes.

**Allowed transitions** — the whole machine, for reference in every later phase:

```
draft      → submitted, withdrawn
submitted  → quoted, pending_sync, withdrawn, expired
pending_sync → quoted, submitted        (submitted = sync failed, back to the queue)
quoted     → accepted, rejected, expired, submitted   (submitted = re-priced)
accepted   → (terminal)
rejected   → (terminal)
expired    → (terminal)
withdrawn  → (terminal)
```

**Tests to prepare** — one per allowed transition, one per forbidden transition, one asserting
every schema field is persisted, one asserting a foreign `accountId` is rejected, one
concurrency test on reference allocation, one tenant-isolation test.

**Done when:** a quote created through the API contains every field the customer sent; a quote
cannot be created against another group's account; two simultaneous creates get two references.

---

### Q1 — A person claims a request and records a price

**Goal:** the single most valuable phase. Someone at Noatum takes ownership of a quote request
and answers it.

Two capabilities ship together here, and they are deliberately **not** gated the same way.

| | Claiming | Pricing in the portal |
| --- | --- | --- |
| Question it answers | Who is dealing with this request | What is the price |
| Feature switch | **None. Always on** | `quotations.portal_pricing`, default **off** |
| Useful when CargoWise does the pricing | **Yes — this is when it matters most** | Not used on that path |
| Permission | `quotes.claim` | `quotes.price` |

**Why claiming is not behind the pricing switch (decision, 17.09.2026).** If claiming were
gated by `quotations.portal_pricing`, switching portal pricing off would also remove the only
shared record of who is handling a request — exactly on the CargoWise path, where two people
can otherwise open the same request and price it twice in the TMS. The portal is the shared
inbox for both paths, so ownership must work on both. **Claim is not pricing and carries no
dependency on CargoWise being connected, configured, or reachable.**

#### Claiming

**Permission** — add `QUOTES_CLAIM: 'quotes.claim'` (claim and release your own) and
`QUOTES_CLAIM_OVERRIDE: 'quotes.claim.override'` (take over or release someone else's) to
`PERMISSIONS`. Internal presets only; never a customer preset.

**Database** — add to `quote`: `claimedById` (uuid, nullable, FK to user) and `claimedAt`
(timestamptz, nullable). Release clears both. History lives in `AuditEvent`, not in a second
table — there is no reporting requirement yet that needs one.

**API**

- `POST /v1/quotes/:id/claim` — `@RequirePermission(PERMISSIONS.QUOTES_CLAIM)`.
- `POST /v1/quotes/:id/release` — same permission for your own claim,
  `QUOTES_CLAIM_OVERRIDE` for someone else's.

**Race safety — this is the part to get right.** Claim with a single conditional update, and
check the affected row count:

```sql
UPDATE quote SET claimed_by_user_id = $1, claimed_at = now()
WHERE id = $2 AND (claimed_by_user_id IS NULL OR claimed_at < now() - $3::interval)
```

Zero rows affected means someone else won — return **409** with the holder's name. **Do not
read-then-write**; that is the same defect class as the `nextReference()` race Q0 fixes.

**Rules**

1. **Pricing an unclaimed quote claims it implicitly.** No one should have to click twice to do
   one job.
2. **A quote claimed by someone else cannot be priced in the portal** unless the caller holds
   `quotes.claim.override`. Returns 409 naming the holder, not a bare 403.
3. **A claim never blocks an inbound CargoWise price.** Q5 calls `recordPrice` with provenance
   `cw1` and bypasses the claim check entirely — CargoWise wins, as §3.1a of the integration
   surface note requires. The claim is released on the same write and the holder is notified.
4. **Stale claims expire without an administrator.** Config constant
   The `claimExpiry` **setting**, default **4 hours** (the staff screen states it to the person
   claiming), applied in the `WHERE` clause above. Evaluated on
   read and write, so **no scheduler and no dependency on R4**.
5. **The claim is released automatically** when the quote reaches `quoted`, `withdrawn` or
   `expired`.
6. **Claim fields are internal-only.** `claimedById` and `claimedAt` never appear in a
   customer-facing DTO, export, notification or API response. The customer has no interest in
   which of our colleagues holds the file, and it leaks our staffing.

**Not built here:** the queue *screen* — a branch-scoped worklist with filters, assignment and
SLA timers. Q1 puts claim and release on the quote itself. See §7.

#### Pricing

**Feature switch** — add to `FEATURE_SWITCHES` under the existing `quotations` category:

| Key | Default | Requires approval | Gates |
| --- | --- | --- | --- |
| `quotations.portal_pricing` | **false** | No | The price-recording route and its screen. **Not the claim routes** |
| `quotations.multi_option` | **true** | No | Whether a quote may carry **more than one** option, in the API and the UI |

**`quotations.multi_option`.** Default on, because the mockups treat several options as
normal. With it off the API refuses a body carrying more than one option — 400 from the
service, never a silent truncation — the screen offers no "Add option" control, and customer
surfaces show one price. **The schema is identical either way**: there is always a
`quote_option` row, one or many. The switch caps what can be *created*; quotes already priced
with several options keep showing all of them, because a switch must not retract what we have
already told a customer.

**Permission** — add `QUOTES_PRICE: 'quotes.price'` to `PERMISSIONS`, seeded to internal
presets only. Never to a customer preset.

**Database — a quote carries one or more priced options** (decision 17.09.2026, from the UI
mockups). A person types each one; nothing derives them. New table `quote_option`, Pattern A
tenancy — `customer_group_id NOT NULL`, indexed, RLS enabled and forced:

| Column | Type | Why |
| --- | --- | --- |
| `quote_id` | FK | Its quote |
| `sequence` | int | Display order, unique per quote |
| `label` | varchar(80), nullable | e.g. "Weekly direct". Free text |
| `carrierName` | varchar(120), nullable | **Free text.** No carrier catalogue, no lookup |
| `serviceRouting` | varchar(160), nullable | Free text |
| `transitDaysMin` / `transitDaysMax` | int, nullable | Indicative |
| `totalMinorUnits` | bigint, nullable | Minor units. Never a float |
| `currency` | char(3), nullable | |
| `validUntil` | timestamptz, nullable | Per option, not per quote |
| `isRecommended` | boolean | At most one true per quote |
| `priceLines` | Json, default `[]` | **Free-form**: `{ description, amount, currency }` |
| `notes` | text, nullable | What the customer reads for this option |

And on `quote`:

| Column | Type | Why |
| --- | --- | --- |
| `priceSource` | enum `portal` \| `cw1` \| `import`, nullable | Provenance. Human-in-the-loop rule |
| `pricedById`, `pricedAt` | nullable | Who answered, and when |
| `messageToCustomer` | text, nullable | Covers all options |
| `acceptedOptionId` | uuid, nullable FK | **Which option the customer took.** Q3 sets it |
| `approvedById`, `approvedAt` | nullable | **Seams only. No workflow reads them** |

`quote.totalMinorUnits`, `currency` and `validUntil` stay, redefined as **the headline figures
of the recommended option**, written by `recordPrice()` in the same transaction. One writer, so
they cannot drift, and the list endpoint needs no join.

**`priceLines` lives on `quote_option` only — never on `quote`** (decided 17.09.2026). Each
option carries its own breakdown, so a quote-level copy would have to be kept in step with
whichever option is recommended and would drift on the first re-price. The headline figures
above are the one deliberate duplication, and they are safe only because a single method writes
them. Do not add a second.

`priceLines` is deliberately free-form. **No charge codes, no mapping table, no validation
beyond shape.** There is no standard format in the organisation to validate against, and
inventing one makes the module unusable in every branch that does not yet have one — which
today is all of them.

**Options are not a rate engine.** Nothing derives them: no rate lookup, no carrier catalogue,
no automatic comparison or ranking. `carrierName` is free text a person types. That is what
keeps multiple options inside the director's cap.

**API**

- `POST /v1/quotes/:id/price` — `@RequirePermission(PERMISSIONS.QUOTES_PRICE)` **and** the
  feature guard on `quotations.portal_pricing`.
- Body: `{ options: [...], recommendedIndex?, messageToCustomer? }`. At least one option.
- One service method, `recordPrice(quoteId, input, provenance)`. **Q5 must call this same
  method** when CargoWise delivers a price — that is the whole point of writing it this way.
  The claim check lives at the portal entry point, **not inside `recordPrice`**, so the
  CargoWise path cannot be blocked by it.
- Re-pricing **replaces the option set** and keeps the previous one in audit.
- Transition `submitted` → `quoted`. Emits `AuditEvent` and `AnalyticsEvent`.
- `POST /quotes/:id/rate` stays, untouched, unused, behind `quotations.instant_rate`.

**UI — stop here and ask.** The internal quote detail screen **does not exist**;
`src/features/quotes/` is an empty `.gitkeep`. Mockups are pending for it. Build the API, then
stop before the panel. When the mockups arrive it needs a claim indicator showing the holder
and since when, Claim / Release actions, and a "Record price" panel supporting several options.
When someone else holds the claim, say who rather than disabling the panel silently.
Design-system components only, EN and ES strings, `DD.MM.YYYY`, loading / empty / error states.

**Tests to prepare** — 403 when the pricing switch is off (from the guard, not the UI); **claim
routes still work with that switch off**; 403 for a customer token; two concurrent claims
produce one 200 and one 409; pricing a quote claimed by another user is refused without the
override permission; an inbound `cw1` price succeeds against a claimed quote and releases the
claim; a stale claim can be taken; at most one recommended option per quote; the headline
figures match the recommended option; the status transition; provenance is stored; no
customer-facing response contains claim, cost or internal fields.

**Done when:** an internal user claims a request and a colleague sees it is taken — with the
pricing switch off and no CargoWise connection. With the switch on, that user also records one
or more options and the customer sees them.

---

### Q2 — A document can be the answer

**Goal:** a branch that produces a PDF quote in its own template can still use the portal.

**Database** — `quote_document` linking `quote_id` to a blob reference, with `uploadedById`,
`uploadedAt`, `filename`, `contentType`, `sizeBytes`, and `customerVisible` (boolean, default
true). Pattern A tenancy: `customer_group_id NOT NULL`, indexed, RLS.

**Rule:** a quote may move to `quoted` with an amount, **or** with at least one
customer-visible document, **or** both. Never with neither. That single validation is the
entire "no fixed format" decision, expressed in code.

**API** — upload behind `quotes.price`; download behind `quotes.read` plus a check that the
document is customer-visible and belongs to the caller's group. Files to Azure Blob, never to
the database.

**Security** — validate content type and size on the server. Never serve a blob by a
client-supplied path. Documents marked not customer-visible must be absent from every customer
surface: list, detail, export, notification.

**Done when:** a quote with a document and no amount reaches the customer correctly.

---

### Q3 — Outcome, expiry and measurement

**Goal:** close the loop, and start producing the evidence the organisation lacks.

**API**

- `POST /quotes/:id/submit` — `draft` → `submitted`, permission `quotes.submit`
- `POST /quotes/:id/accept` — `quoted` → `accepted`, permission `quotes.accept`
- `POST /quotes/:id/decline` — `quoted` → `rejected`, with a reason. Reuses `quotes.accept`;
  a customer who may accept may decline. **Do not invent a second permission**
- `POST /quotes/:id/withdraw` — permission `quotes.cancel`
- Every transition through `quote.status.ts`. Every one emits audit and analytics

**Accept names an option.** Since Q1 a quote carries one or more options, so the accept body
carries the chosen `optionId` and the service writes it to `quote.acceptedOptionId`. The id must
belong to that quote. Once accepted, **the option set is immutable** — `accepted_immutability`
is a protected capability, not a preference.

**Expiry** — implement the existing `quote.expiry` handler and give it a schedule. This
requires the scheduler from remediation package R4. Expiry moves `quoted` → `expired` past
`validUntil`, and must be idempotent.

**Notification** — the customer is told when a price arrives. **As a job, never inline in the
HTTP request.** This is likely to be the first real producer on the queue; if R4 has not landed,
this phase creates the first `enqueue()` caller in the codebase.

**Measurement — the value argument, and it is nearly free**

- `submittedAt`, `quotedAt`, `decidedAt` on the quote
- A derived `responseHours`, and request age on open requests
- An internal endpoint returning counts and median response time by month, mode and lane
- Analytics events for submit, price, accept, decline

This is what turns "a light module" into something that helps the landscape redesign: volumes,
response times, which lanes customers ask for, and how many requests convert.

**Done when:** a customer submits, is answered, accepts — and an internal user can see how long
that took across all requests.

---

### Q4 — The request copy goes to CargoWise

**Blocked on remediation R1 (ports), R3 (integration spine) and R4 (queue wiring). Do not
start before those land** — building it first means hand-rolling the message archive and the
idempotency store that R3 provides.

**Switch:** `quotations.cw1_request_sync`, default **true**, gating the outbound copy.

**Port:** `TmsQuoteAdapter.createRequest(canonicalQuote)` in
`src/contracts/adapters`, implemented in `src/integration/cw1`. Business code calls the port
and nothing else.

**Mechanism:** enqueue in the **same database transaction** as the quote insert. The API must
never call CargoWise inline.

**Idempotency:** the outbound key is `<reference>:v<version>`, for example `Q-000042:v1` —
stable across retries, new on a re-price. Inbound is unique on
`(sourceSystem, sourceInstance, sourceMessageId)`.

**Failure:** never reaches the customer as an error. The quote keeps its last consistent state,
internal users see the sync status, ops are alerted.

**Transport is undecided and must stay so.** `CW1_TRANSPORT_QUOTE=none` is a first-class value
and the module must be fully usable with it set.

---

### Q5 — A priced quote comes back from CargoWise

**Blocked on the same three packages.**

- Inbound message arrives at the universal door, is archived, and enqueues a job
- The job maps it to canonical shape and calls **`recordPrice(...)` from Q1** with
  `priceSource: 'cw1'`. One code path, two sources
- **CargoWise wins on collision.** If CargoWise prices a quote already priced in the portal,
  CargoWise's values are stored, the portal draft is kept in history, and the portal user is
  notified
- **The confirmation gate (PRD OQ-27).** With `quotations.cw1_request_sync` on, a
  portal-priced quote sits at `pending_sync` until CargoWise confirms. With it off, the price
  is released directly with its provenance. **Build the gate as a switch, defaulting to the
  behaviour that works everywhere, until the director answers**

---

## 6. Cross-cutting requirements for every phase

Non-negotiable, from the foundation rules:

1. **Tenancy in the data layer.** Every new table is Pattern A — `customer_group_id NOT NULL`,
   indexed, RLS enabled and forced. Never filter tenants in React. Never accept
   `customer_group_id` from the client.
2. **`@RequirePermission()` on every route**, with the code seeded.
3. **Feature-switched routes fail closed** — 403 from the guard, not a hidden button.
4. **Provenance on anything not typed by the user in front of you**, overridable by a human
   with a reason, keeping the original.
5. **No external call inline.** Jobs only, enqueued in the business transaction.
6. **Design tokens only.** No hex colour, `font-family` or `border-radius` outside the design
   system.
7. **EN and ES strings, `DD.MM.YYYY`, no emoji, no exclamation marks.**
8. **Loading, empty and error states on every data view. WCAG 2.1 AA.**
9. **Audit on every significant write, analytics on every user action.**
10. **Server-side pagination.** List under 2 s at 100k rows per group.

---

## 7. What we deliberately do not build, and where its seam lives

| Not built | Seam kept | Reinstated when |
| --- | --- | --- |
| Rate or tariff tables, rate storage | None needed | A rate source exists. Nothing to migrate |
| Automatic instant pricing | `RateEngineAdapter` + `quotations.instant_rate`, off | A source is configured. No code change |
| Pricing queue **screen** — branch-scoped worklist, filters, assignment, SLA timers | Claim and release exist on the quote itself (Q1); internal users already carry a branch | Volume justifies a dedicated worklist |
| Charge codes and a charge-line schema | `priceLines` Json, free-form | A standard format is published |
| Approval workflow and threshold | **Answered by the mockup.** `approval` on, `threshold` EUR 10,000 global / 15,000 Iberia, as scoped settings | — |
| Cost and margin | **Answered by the mockup.** Charge-line cost and margin behind the `costCapture` setting, default **off**, plus `quotes.cost.view` | — |
| AI-drafted customer email | Interface, with a template fallback | The other team ships it (OQ-25) |
| Multi-round negotiation, and **automatic** carrier comparison or ranking | A revision number on the quote; options are typed by a person | A standard process exists |

**If you are about to build something in this table, stop and ask.** It was excluded on
director-level evidence, not by oversight.

**Claim and release are no longer in this table.** They moved into Q1 on 17.09.2026 on the
product owner's instruction: ownership of a request must be visible whether or not CargoWise
is connected. What stays deferred is the queue *screen* around them.

---

## 8. Open questions

| # | Question | Owner | Blocks |
| --- | --- | --- | --- |
| **OQ-27** | Where a branch prices outside any system, may the price be released to the customer without passing through CargoWise | Director | **Answered by the mockup** as the `pubMode` setting — `cw1` globally, `direct` where a branch overrides. Confirm the wording, not the mechanism |
| OQ-11 | Whether cost and margin are captured; the approval threshold | Sponsor + Head of Pricing | **Answered by the mockup**: `costCapture` (off) and `threshold` (EUR 10,000), both scoped settings. Confirm the numbers |
| OQ-12 | Written confirmation that the operational non-goal is narrowed | Sponsor | Nothing in Q0–Q3 |
| — | Which integration mechanism, and CargoWise's data model | CargoWise team | Q4 and Q5 transports only |

**Retired 17.09.2026:** "what proportion of quotes are priced inside CargoWise". The director's
note answers it — there is no standardised process, so there is no stable proportion.

---

## 9. Agent prompts

One prompt per phase. Each is self-contained. **Hand over one phase at a time.**

### 9.0 Shared preamble — paste at the top of every phase prompt

```text
You are implementing one phase of the quotation module for the Noatum Logistics Customer
Information Platform.

BEFORE WRITING ANY CODE, READ:
  - CLAUDE.md at the repository root, in full. The six foundation rules and the v4 rules
    are binding.
  - docs/plans/Quotation-Module-Phase-Plan.md, sections 1, 2, 3, 6 and 7.
  - docs/design/CW1-Integration-Surface-and-Quotation-Paths.md, sections 1 and 3.
  - The existing code you are changing. Read it; do not infer it from the documents. The
    documents describe intent and the code has drifted from it in places.

CONTEXT YOU MUST NOT FORGET:
  The organisation has no rate database, no rate storage, no standard format and no
  standardised quoting process. This was confirmed at director level on 17.09.2026. The
  module must depend on none of them. If a design choice requires a standard that does not
  exist, the choice is wrong.

WORKING METHOD:
  1. Start in PLAN MODE. List the files you will create or change, the schema changes, the
     new permission and switch keys, and the tests you will write. WAIT FOR APPROVAL.
  2. Build in the order: migration -> contracts -> API + tests -> OpenAPI -> UI.
     Do not start with the screen.
  3. Keep strictly inside the phase. Work you discover outside it goes to docs/gaps.md or
     becomes a proposed phase. Do not do it silently.
  4. Small commits, messages prefixed with the phase, for example "Q1: record a price".
  5. A commit spans two repositories. Commit and push inside apps/<app>, then
     `git add apps/<app>` and commit the moved pointer in the parent.

VERIFICATION POLICY - READ CAREFULLY:
  Do NOT run tests, typechecking, linting, formatters or verification-only builds unless
  the user explicitly instructs you to in that turn. Finishing the phase is not permission.
  Do not route these through subagents or scripts either.
  WRITE the tests alongside the code. LEAVE them unrun.
  Report "implemented; verification pending", listing the deferred checks and known risks.
  Never claim an unrun check passed.

NON-NEGOTIABLE RULES FOR EVERY FILE YOU TOUCH:
  - New tables: customer_group_id NOT NULL, indexed, RLS enabled AND forced. Reversible
    migration. Never accept customer_group_id from the client. Never filter tenants in React.
  - Every route: @RequirePermission('<code>'), code seeded. No role checks in code.
  - Feature-gated routes must return 403 from the guard. Hiding a button is not a control.
  - No external system is called inline. Jobs only, enqueued in the business transaction.
  - No hex colours, font-family or border-radius outside src/design-system.
  - Every string through i18next with EN and ES. Dates DD.MM.YYYY. No emoji. No exclamation
    marks. Money shows a currency code, never a bare symbol.
  - Loading, empty and error states on every data view. WCAG 2.1 AA.
  - AuditEvent on significant writes, AnalyticsEvent on user actions.
  - Regenerate OpenAPI; the SPA client is generated, never hand-written.

DO NOT BUILD, under any circumstances, without asking first:
  rate tables, rate storage, tariffs, charge-code mapping for quotes, an approval workflow,
  cost or margin modelling, a pricing queue SCREEN (a branch-scoped worklist with filters,
  assignment and SLA timers), carrier comparison, or anything that assumes a price arrives
  automatically.
  Section 7 of the phase plan explains why each was excluded.
  NOTE: claim and release themselves ARE in scope, in phase Q1. Only the queue screen
  around them is deferred.
```

### 9.1 Phase Q0 prompt

```text
[Paste the shared preamble, then:]

PHASE Q0 - STRAIGHTEN THE RECORD.
Deliver section "Q0" of docs/plans/Quotation-Module-Phase-Plan.md. No new capability;
this makes the existing record true and safe.

FILES YOU WILL TOUCH:
  apps/noatum-customer-portal-api/prisma/schema.prisma          (+ a new migration)
  apps/noatum-customer-portal-api/src/contracts/dto/quote.dto.ts
  apps/noatum-customer-portal-api/src/modules/quotes/quote.status.ts        (new)
  apps/noatum-customer-portal-api/src/modules/quotes/quotes.service.ts
  apps/noatum-customer-portal-api/src/modules/quotes/quotes.service.spec.ts (new)

FOUR DEFECTS TO FIX, each with a test:
  1. create() validates more than it persists - volumeM3 is computed into chargeableKg and
     then discarded. Persist every field the schema accepts. Add a test that iterates the
     schema keys and asserts each one is stored, so this cannot regress silently.
  2. accountId arrives from the client and is never checked. A customer can file a quote
     against another company's account. Resolve it server-side against the caller's group
     and reject anything else.
  3. nextReference() reads the last reference and adds one. Two concurrent creates collide.
     Replace with a Postgres sequence per customer group, or a counter row taken with
     SELECT ... FOR UPDATE. Keep the unique index as the backstop.
  4. There are no status rules anywhere. Create quote.status.ts holding the transition table
     in section Q0 of the plan, and a unit test per allowed and per forbidden transition.

SCHEMA ADDITIONS: incoterm, readyDate, customerReference, serviceLevel, volumeM3, notes -
all nullable. Enum additions to quote_status: submitted, quoted, pending_sync, withdrawn.

DO NOT remove the enum values 'rated' or 'rate_failed'. Enum removal is not reversible in
place and the instant-rate path keeps its seam. Mark them deprecated in code comments only.
DO NOT touch POST /quotes/:id/rate.
DO NOT add routes in this phase.
```

### 9.2 Phase Q1 prompt

```text
[Paste the shared preamble, then:]

PHASE Q1 - A PERSON CLAIMS A REQUEST AND RECORDS A PRICE.
Deliver section "Q1" of docs/plans/Quotation-Module-Phase-Plan.md. Depends on Q0.
This is the phase that makes the module useful.

TWO CAPABILITIES, GATED DIFFERENTLY. Read this twice before you start:
  - CLAIMING is ALWAYS ON. No feature switch. No CargoWise dependency.
  - PRICING is behind the feature switch 'quotations.portal_pricing', default FALSE.
  If you put the claim routes behind the pricing switch you have broken the requirement.
  Turning portal pricing off must NOT remove the record of who is handling a request -
  that record matters most on the CargoWise path, where two people can otherwise price the
  same request twice in the TMS.

THE ONE DESIGN DECISION THAT MATTERS:
  Write ONE service method, recordPrice(quoteId, input, provenance). Phase Q5 will call the
  same method when CargoWise delivers a price. Two entry points, one code path. If you find
  yourself writing a second copy of this logic for CargoWise later, Q1 was built wrong.
  The claim check belongs at the portal CONTROLLER/entry point, NOT inside recordPrice, so
  the CargoWise path can never be blocked by a claim.

DELIVER - CLAIMING:
  - Permissions QUOTES_CLAIM: 'quotes.claim' and QUOTES_CLAIM_OVERRIDE: 'quotes.claim.override'
    in src/contracts/permissions.ts, seeded to internal presets only.
  - Schema: claimedById (uuid, nullable, FK user), claimedAt (timestamptz, nullable).
  - POST /v1/quotes/:id/claim and POST /v1/quotes/:id/release.
  - Claim MUST be a single conditional UPDATE with a row-count check:
      WHERE id = $2 AND (claimed_by_user_id IS NULL OR claimed_at < now() - $3::interval)
    Zero rows affected => 409 naming the current holder. DO NOT read-then-write; that is the
    same defect class as the nextReference() race you fixed in Q0.
  - The claimExpiry setting, default 4 hours, used in that WHERE clause. Evaluated
    on read and write, so NO scheduler and NO dependency on remediation R4.
  - Pricing an UNCLAIMED quote claims it implicitly. One click, not two.
  - Pricing a quote claimed by SOMEONE ELSE is refused with 409 naming the holder, unless the
    caller holds quotes.claim.override.
  - The claim is released automatically on reaching quoted, withdrawn or expired.
  - claimedById and claimedAt are INTERNAL-ONLY. They must never appear in a customer-facing
    DTO, list, export, notification or API response. Leaking them leaks our staffing.

DELIVER - PRICING:
  - Feature switch 'quotations.portal_pricing' in src/contracts/feature-switches.ts,
    category 'quotations', defaultEnabled FALSE, requiresApproval false. It gates the PRICE
    route only.
  - Feature switch 'quotations.multi_option', category 'quotations', defaultEnabled TRUE,
    requiresApproval false. It gates whether a quote may carry MORE THAN ONE option.
    With it OFF the service refuses a body with several options (400 - never silently drop
    one a person typed), the screen offers no "Add option" control, and customer surfaces
    show one price. THE SCHEMA IS THE SAME EITHER WAY - always a quote_option row, one or
    many. Never create a table or column conditionally. Quotes already priced with several
    options must keep showing all of them; a switch must not retract what we already told a
    customer.
  - Permission QUOTES_PRICE: 'quotes.price' in src/contracts/permissions.ts, seeded to
    internal presets only. Never to a customer preset.
  - A QUOTE CARRIES ONE OR MORE PRICED OPTIONS (from the UI mockups). New table quote_option,
    Pattern A tenancy: quote_id, sequence, label, carrierName, serviceRouting,
    transitDaysMin/Max, totalMinorUnits (bigint minor units, never a float), currency,
    validUntil, isRecommended, priceLines Json default [], notes.
  - On quote: priceSource enum (portal|cw1|import), pricedById, pricedAt, messageToCustomer,
    acceptedOptionId (Q3 sets it), plus approvedById and approvedAt as UNUSED nullable seams.
  - quote.totalMinorUnits / currency / validUntil are REDEFINED as the headline figures of the
    recommended option, written by recordPrice() in the same transaction. One writer, so they
    cannot drift and the list endpoint needs no join.
  - POST /v1/quotes/:id/price, guarded by BOTH the permission and the feature switch.
    Body: { options: [...], recommendedIndex?, messageToCustomer? }. At least one option.
  - Re-pricing REPLACES the option set and keeps the previous one in audit.
  - Transition submitted -> quoted, through quote.status.ts. AuditEvent + AnalyticsEvent.

OPTIONS ARE NOT A RATE ENGINE. Nothing derives them: no rate lookup, no carrier catalogue, no
automatic comparison or ranking. carrierName is free text a person types. That is what keeps
multiple options inside the director's scope cap.

DELIVER - UI: STOP AND ASK.
  src/features/quotes/ is an empty .gitkeep - there is no quote screen of any kind, and
  mockups are pending. BUILD THE API AND STOP BEFORE THE PANEL. Do not design the screen
  yourself. When the mockups arrive it needs a claim indicator showing the holder and since
  when, Claim / Release actions, and a "Record price" panel supporting several options. When
  someone else holds the claim, SAY WHO rather than disabling the panel silently.

priceLines IS DELIBERATELY FREE-FORM: { description, amount, currency }. No charge codes.
No mapping table. No validation beyond shape. There is no standard format in the
organisation to validate against, and inventing one makes the module unusable.

TESTS TO WRITE AND LEAVE UNRUN:
  403 from the guard when the pricing switch is off; the CLAIM routes still work with that
  switch off; 403 for a customer token on every route; two concurrent claims give one 200 and
  one 409; pricing a quote claimed by another user is refused without the override permission;
  an inbound 'cw1' price succeeds against a claimed quote and releases the claim; a stale
  claim past the TTL can be taken; at most one recommended option per quote; the headline
  figures on quote match the recommended option; the status transition; provenance is
  persisted; no customer-facing response contains claim, cost or internal fields.

DO NOT build the pricing queue SCREEN - a branch-scoped worklist with filters, assignment or
SLA timers - or an approval flow. Q1 puts claim, release and price on the quote itself.
Section 7 of the plan explains why.
```

### 9.3 Phase Q2 prompt

```text
[Paste the shared preamble, then:]

PHASE Q2 - A DOCUMENT CAN BE THE ANSWER.
Deliver section "Q2" of docs/plans/Quotation-Module-Phase-Plan.md. Depends on Q1.

WHY: some branches produce a quote as a PDF in their own template. There is no standard
format, so the portal must accept the document as the answer, with or without a number.

DELIVER:
  - Table quote_document: quote_id, customer_group_id NOT NULL + index + RLS, blob
    reference, filename, contentType, sizeBytes, uploadedById, uploadedAt,
    customerVisible boolean default true.
  - Upload behind 'quotes.price'. Download behind 'quotes.read' plus a check that the
    document is customer-visible and belongs to the caller's group.
  - Files go to Azure Blob. Never store file bytes in PostgreSQL.
  - THE VALIDATION THAT EXPRESSES THE WHOLE "no fixed format" DECISION: a quote may move to
    'quoted' with an amount, OR with at least one customer-visible document, OR both -
    never with neither. Put it in the service, with tests for all four combinations.

SECURITY - this phase handles file upload, so be deliberate:
  Validate content type and size SERVER-SIDE. Never serve a blob from a client-supplied
  path or filename. Generate the stored name yourself. A document with
  customerVisible = false must be absent from every customer surface: list, detail, export,
  notification, and any future API.
```

### 9.4 Phase Q3 prompt

```text
[Paste the shared preamble, then:]

PHASE Q3 - OUTCOME, EXPIRY AND MEASUREMENT.
Deliver section "Q3" of docs/plans/Quotation-Module-Phase-Plan.md. Depends on Q1.
This phase closes the customer loop and starts producing the evidence that justifies the
whole module to the business.

DELIVER:
  - POST /quotes/:id/submit   (quotes.submit)  draft -> submitted
  - POST /quotes/:id/accept   (quotes.accept)  quoted -> accepted
  - POST /quotes/:id/decline  (quotes.accept)  quoted -> rejected, mandatory reason
  - POST /quotes/:id/withdraw (quotes.cancel)
    Reuse quotes.accept for decline. A customer who may accept may decline. Do NOT invent
    a second permission code.
  - Every transition goes through quote.status.ts. Every one emits audit and analytics.
  - Implement the existing stub handler quote-expiry.handler.ts and schedule it. Expiry
    moves quoted -> expired past validUntil and MUST be idempotent - it will run repeatedly.
  - Customer notification when a price arrives: AS A JOB, enqueued in the same transaction
    as the write. Never inline in the HTTP request. NOTE: JobsService.enqueue() currently
    has zero callers in the codebase. You may be writing the first one. Follow the pattern
    in the integration module and do not invent a second queueing mechanism.
  - MEASUREMENT: submittedAt, quotedAt, decidedAt columns; a derived response time; request
    age on open requests; an internal endpoint giving counts and median response time by
    month, mode and lane.

WHY MEASUREMENT IS IN SCOPE AND IS NOT A NICETY: the organisation is redesigning its
quoting processes and has no data about them. Request and response timestamps give it
volumes, response times, lane demand and conversion. It is the module's value argument.

DEPENDENCY: the scheduler comes from remediation package R4. If it has not landed, say so
and stop rather than building a second scheduling mechanism.
```

### 9.5 Phase Q4 and Q5 prompt

```text
[Paste the shared preamble, then:]

PHASES Q4 AND Q5 - THE CARGOWISE ROUND TRIP.

STOP AND CHECK FIRST. These phases are blocked on remediation packages R1 (the adapter
layer), R3 (the integration spine) and R4 (queue wiring), described in
docs/plans/Remediation-Plan-Foundation-Gaps.md. Verify all three have landed. If they
have not, report that and stop. Building these first means hand-rolling the message archive
and the idempotency store that R3 provides, and it will be thrown away.

READ FIRST: docs/design/CW1-Integration-Surface-and-Quotation-Paths.md in full. It
specifies the envelope, every plausible transport, the endpoints we expose and the
configuration keys.

THE PRINCIPLE THAT GOVERNS BOTH PHASES:
  The mechanism is deliberately UNDECIDED. Protocol, payload shape, authentication and URLs
  are all still open with the CargoWise team. Your code must not assume any of them.
  Business modules call a port. Only the transport class knows about HTTP, SOAP, XML or
  files. CW1_TRANSPORT_QUOTE=none is a first-class value and the module must be fully
  usable with it set.

Q4 - OUTBOUND:
  - Switch 'quotations.cw1_request_sync', default TRUE.
  - Port TmsQuoteAdapter.createRequest() in src/contracts/adapters, implemented in
    src/integration/cw1. Business code calls the port and nothing else.
  - Enqueue in the SAME database transaction as the quote insert.
  - Idempotency key <reference>:v<version>, e.g. Q-000042:v1 - stable across retries, new
    on a re-price.
  - A failure never reaches the customer as an error. The quote keeps its last consistent
    state, internal users see the sync status, ops are alerted.

Q5 - INBOUND:
  - The message arrives at the universal inbound door, is archived to integration_message,
    and enqueues a job. Return 202 immediately. Never do business work in the request.
  - The job maps to canonical shape and calls recordPrice(...) FROM PHASE Q1 with
    priceSource 'cw1'. Do not write a second pricing path.
  - CargoWise wins on collision: its values are stored, the portal draft is kept in history,
    the portal user is notified, and any claim on the quote is released.
  - A CLAIM MUST NEVER BLOCK THIS PATH. The Q1 claim check lives at the portal controller,
    not inside recordPrice(). If you are adding a claim check to this job handler, stop -
    Q1 was built wrong and that is the bug to fix.
  - THE CONFIRMATION GATE IS OPEN (PRD OQ-27). With cw1_request_sync on, a portal-priced
    quote sits at pending_sync until CargoWise confirms. With it off, the price is released
    directly with its provenance. Build it as a switch. Do NOT hard-code the gate - an
    absolute gate stops every branch that prices outside a system from answering its
    customer at all.
```

---

## 10. History

| Date | Change |
| --- | --- |
| 17.09.2026 | Written. Supersedes slices S1.08–S1.10 and SP.01–SP.06 for Phase 1, and replaces the body of kick-off stage F1.08 |
| 17.09.2026 | **v1.1 — claim and release moved from §7 (deferred) into Q1, on the product owner's instruction: "keep the claim even [if] CW is there or not". Claim is deliberately NOT behind `quotations.portal_pricing` and has no CargoWise dependency — it is most useful on the CargoWise path, where the portal is the only shared record of who is handling a request. A claim never blocks an inbound CargoWise price. The queue *screen* remains deferred** |
| 17.09.2026 | **v1.2 — alignment pass after several agents edited different documents in parallel.** Added §0, the precedence table, because nothing said which document won and that is what let them drift. Raised this plan to the richer model already in the `quotation/` build sheets: the `quote_option` table, `messageToCustomer`, `acceptedOptionId`, the `{ options, recommendedIndex, messageToCustomer }` body, re-price replaces the set, headline figures derive from the recommended option, and Q3 accept names an option. Added the "needs a mockup" column and the standing instruction to stop before any quotation screen. **Nothing was removed** — the mockup-driven detail is in, because a person types every option and nothing derives them |
| 17.09.2026 | **v1.3 — two open items closed rather than left for someone to trip over.** (1) The confirmation-gate question was numbered **OQ-26, which PRD §11 had already given to the master-data hierarchy question**. The gate is now **OQ-27**, added to the PRD register, and every citation renumbered — the incumbent keeps its number because it is the one already published. (2) **`priceLines` sits on `quote_option` only, never on `quote`**; the headline figures are the single deliberate duplication and are safe only because one method writes them |

**Why this plan exists rather than the slice plan.** The slice plan is not wrong. It was
written against PRD v4.0, which put structured internal pricing at the centre of the Phase 1
quotation feature. Two pieces of direction on 17.09.2026 changed the ground beneath it: the
product owner made portal pricing a managed option with CargoWise as the source of truth, and
the director confirmed that the organisation has no rate database, no rate storage, no
standard format and **no standardised quoting process**, while its system landscape is being
redesigned.

Building a pricing queue, a charge-code schema and an approval chain into that would mean
building them twice. This plan keeps every one of them as a seam and builds the half that
survives. If the organisation's redesign lands and a standard arrives, return to the slice
plan — it is still the fuller specification, and nothing in it was deleted.
