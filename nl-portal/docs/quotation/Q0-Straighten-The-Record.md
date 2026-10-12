# Q0 — Straighten the record

| | |
| --- | --- |
| Goal | The quote table honestly holds what the customer submitted, the reference is safe under load, and a quote cannot be filed against another company's account |
| Size | Small |
| Depends on | Nothing |
| Needs CargoWise | No |
| Needs a mockup | No — this phase has no UI |

No new capability. This makes the existing record true and safe, so that everything built
on it afterwards is not building on sand.

---

## The four defects being fixed

| # | Defect | Where |
| --- | --- | --- |
| 1 | **`create()` validates more than it persists.** `volumeM3` is computed into `chargeableKg` then discarded. `currency`, `packages`, `incoterm` and `notes` are parsed and dropped | `quotes.service.ts` `create()` |
| 2 | **`accountId` is accepted from the client and never checked.** A customer can file a quote against another company's account | `quotes.service.ts` `create()` |
| 3 | **Reference allocation races.** `nextReference()` is `count(*) + 1`. Two concurrent creates collide, and a deleted quote reuses a reference | `quotes.service.ts` `nextReference()` |
| 4 | **There are no status rules anywhere.** No transition table, no tests | Nothing exists |

Defect 2 is a live tenancy defect. It is the reason this phase is first.

---

## Database

Add to `quote`, all nullable:

`incoterm` varchar(11) · `readyDate` timestamptz · `customerReference` varchar(60) ·
`serviceLevel` varchar(40) · `volumeM3` decimal(12,3) · `notes` text

Add to the `quote_status` enum: `submitted`, `quoted`, `pending_sync`, `withdrawn`.

**Do not remove `rated` or `rate_failed`.** Enum value removal is not reversible in place,
and the instant path keeps its seam. Mark them deprecated in a code comment only.

Replace the reference counter with a Postgres sequence per customer group, or a counter row
taken with `SELECT ... FOR UPDATE`. The unique index stays as the backstop.

> **Two migrations, not one.** `ALTER TYPE ... ADD VALUE` cannot be used in the transaction
> that adds it. Add the values in the first migration and use them in the second. Both need
> a `down.sql`.

---

## Contracts

- `createQuoteSchema` gains the new fields.
- **Every field the schema accepts must be persisted.** Add a test that iterates the schema
  keys and asserts each one is stored — silent field loss is the defect being fixed, and
  it will come back otherwise.
- New `src/modules/quotes/quote.status.ts` holding the transition table and nothing else.

---

## API

- `create()` persists everything validated, including `volumeM3`.
- `create()` resolves `accountId` **server-side**: if supplied it must belong to the
  caller's customer group, otherwise reject. Never trust it from the client.
- **No new routes in this phase.**
- **Do not touch `POST /quotes/:id/rate`.**

---

## The transition table

Referenced by every later phase. Put it in `quote.status.ts` exactly as below.

```
draft        → submitted, withdrawn
submitted    → quoted, pending_sync, withdrawn, expired
pending_sync → quoted, submitted          (submitted = sync failed, back to the queue)
quoted       → accepted, rejected, expired, submitted   (submitted = re-priced)
accepted     → (terminal)
rejected     → (terminal)
expired      → (terminal)
withdrawn    → (terminal)
```

---

## Tests to write, and leave unrun

- One per allowed transition, one per forbidden transition
- Every schema field is persisted
- A foreign `accountId` is rejected
- Concurrent reference allocation yields two distinct references
- One tenant-isolation test on `quote`

---

## Done when

A quote created through the API contains every field the customer sent. A quote cannot be
created against another group's account. Two simultaneous creates get two references.

---

## Files you will touch

```
apps/noatum-customer-portal-api/prisma/schema.prisma            (+ two migrations, each with down.sql)
apps/noatum-customer-portal-api/src/contracts/schemas/quote.schema.ts
apps/noatum-customer-portal-api/src/modules/quotes/quote.status.ts          (new)
apps/noatum-customer-portal-api/src/modules/quotes/quotes.service.ts
apps/noatum-customer-portal-api/src/modules/quotes/quotes.service.spec.ts   (new)
```
