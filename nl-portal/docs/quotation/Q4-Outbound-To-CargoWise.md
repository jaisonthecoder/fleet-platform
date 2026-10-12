# Q4 — The request copy goes out to CargoWise

| | |
| --- | --- |
| Goal | Every quote request is copied to CargoWise, so whoever prices it can see it |
| Size | Medium |
| Depends on | **R1** (adapter ports), **R3** (integration spine), **R4** (queue wiring) |
| Needs CargoWise | Yes — but not a decided mechanism |
| Needs a mockup | No, beyond a sync-status indicator on the staff screen |

---

## Stop and check first

Verify that R1, R3 and R4 have landed. **If they have not, report that and stop.**

Building this first means hand-rolling the message archive and the idempotency store that
R3 provides, and it will be thrown away.

> As of 17.09.2026: R1 is code-complete except its structure tests, and the six ports
> including `TmsQuoteAdapter` exist. R3 and R4 have not started — there is no
> `integration_message` table and `JobsService.enqueue()` has no production callers.

Read [CW1-Integration-Surface-and-Quotation-Paths.md](../design/CW1-Integration-Surface-and-Quotation-Paths.md)
in full before writing anything. It specifies the envelope, every plausible transport, the
endpoints we expose and the configuration keys.

---

## The principle that governs Q4 and Q5

**The mechanism is deliberately undecided.** Protocol, payload shape, authentication and
URLs are all still open with the CargoWise team. The code must not assume any of them.

| Layer | Knows about | Changes when the mechanism is decided |
| --- | --- | --- |
| Business modules | Canonical quote | Never |
| Ports — `src/contracts/adapters` | Canonical types and intent | Never |
| Transports — `src/integration/cw1` | HTTP, SOAP, XML, files, polling, middleware | **Only this** |

`CW1_TRANSPORT_QUOTE=none` is a **first-class value**, and the module must be fully usable
with it set.

---

## Feature switch

| Key | Default | Gates |
| --- | --- | --- |
| `quotations.cw1_request_sync` | **true** | Sending the request copy. Off only for a deployment with no CargoWise connection at all |

---

## The port

`TmsQuoteAdapter.createRequest(canonicalQuoteRequest)` already exists in
`src/contracts/adapters/tms-quote.adapter.ts` from R1. Implement it in
`src/integration/cw1`. **Business code calls the port and nothing else.**

---

## Mechanism

- **Enqueue in the same database transaction as the quote insert.** The API must never call
  CargoWise inline.
- **Idempotency key `<reference>:v<version>`**, for example `Q-000042:v1` — stable across
  retries, new on a re-price.
- Inbound messages are unique on `(sourceSystem, sourceInstance, sourceMessageId)`.

---

## Failure

A failure **never reaches the customer as an error.** The quote keeps its last consistent
state, internal users see the sync status, and ops are alerted.

This is the difference between a portal that looks broken when CargoWise is down and one
that does not.

---

## Tests to write, and leave unrun

- The job is enqueued in the same transaction, and rolls back with the quote
- A retry reuses the idempotency key; a re-price allocates a new one
- With `cw1_request_sync` off, nothing is enqueued and the quote is still created
- With `CW1_TRANSPORT_QUOTE=none`, the module works end to end
- A transport failure leaves the quote in its prior state and raises an ops signal

---

## Done when

A quote request created in the portal appears in CargoWise through whichever transport is
configured, and the portal is unaffected when that transport is absent or failing.
