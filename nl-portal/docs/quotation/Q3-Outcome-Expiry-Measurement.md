# Q3 — Outcome, expiry and measurement

| | |
| --- | --- |
| Goal | Close the customer loop, and start producing the evidence the organisation lacks |
| Size | Medium |
| Depends on | Q1 · remediation package **R4** for the scheduler |
| Needs CargoWise | No |
| Needs a mockup | **Yes.** The customer quotation listing and the staff listing both land here |

At the end of this phase the light module is complete: a customer asks, a person answers,
the customer accepts, and somebody can see how long it took.

---

## API

| Route | Permission | Transition |
| --- | --- | --- |
| `POST /quotes/:id/submit` | `quotes.submit` | `draft` → `submitted` |
| `POST /quotes/:id/accept` | `quotes.accept` | `quoted` → `accepted` |
| `POST /quotes/:id/decline` | `quotes.accept` | `quoted` → `rejected`, mandatory reason |
| `POST /quotes/:id/withdraw` | `quotes.cancel` | per the table |

**Decline reuses `quotes.accept` deliberately.** A customer who may accept may decline. Do
not invent a second permission code.

**Accept names an option.** Since Q1 a quote carries one or more options, so the accept body
carries the chosen `optionId` and the service writes it to `quote.acceptedOptionId`. The id
must belong to that quote. Once accepted, the option set is immutable — `accepted_immutability`
is a protected capability, not a preference.

All four permission codes already exist and are seeded. Every transition goes through
`quote.status.ts`. Every one emits `AuditEvent` and `AnalyticsEvent`.

---

## Expiry

Implement the existing `quote-expiry.handler.ts` stub and give it a schedule. Expiry moves
`quoted` → `expired` past `validUntil`.

**It must be idempotent** — it will run repeatedly over the same rows.

> **Dependency.** The scheduler comes from remediation package **R4**. If R4 has not
> landed, say so and stop. Do not build a second scheduling mechanism.

---

## Notification

The customer is told when a price arrives. **As a job, enqueued in the same transaction as
the write. Never inline in the HTTP request.**

`JobsService.enqueue()` currently has zero production callers, so this is likely the first
one in the codebase. Follow the pattern in the integration module; do not invent a second
queueing mechanism.

---

## Measurement — the value argument, and nearly free

| Add | Where |
| --- | --- |
| `submittedAt`, `quotedAt`, `decidedAt` | Columns on `quote` |
| A derived response time, and request age on open requests | Computed, not stored |
| Counts and median response time by month, mode and lane | An internal endpoint |
| Analytics events for submit, price, accept, decline | Emitted per action |

**Why this is in scope and is not a nicety.** The organisation is redesigning its quoting
processes and has no data about them. Request and response timestamps give it volumes,
response times, lane demand and conversion. The portal becomes the instrument that measures
the process they are trying to standardise. That is the module's value argument.

> **Known gap.** `AnalyticsEvent` is emitted to the logger and there is **no
> `analytics_event` table**, so nothing is queryable today. The timestamp columns above
> carry most of the measurement without it. Flag the gap; do not quietly build the table as
> part of this phase.

---

## UI — stop here and ask

Two surfaces land in this phase and both have mockups pending:

- **The customer quotation listing** — a customer's own requests and their state
- **The staff quotation listing** — open requests awaiting an answer

Use the shared `DataView` / `AdminListing` components. Server-side pagination, under 2 s at
100k rows per group. Loading, empty and error states. EN and ES. `DD.MM.YYYY`.

**This is not the pricing queue screen.** No assignment, no SLA timers, no branch scoping —
it is a list with filters. See [00-Shared-Rules §4](00-Shared-Rules.md).

---

## Tests to write, and leave unrun

- Each of the four routes: allowed transition, forbidden transition, 403 without permission
- Decline without a reason is refused
- Expiry is idempotent across repeated runs
- Expiry does not touch `accepted` or `rejected` quotes
- The measurement endpoint is internal-only
- Tenant isolation on the listing

---

## Done when

A customer submits, is answered, and accepts — and an internal user can see how long that
took across all requests.
