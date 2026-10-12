# The CargoWise communication surface — every line open, the last mile held

| | |
| --- | --- |
| Version / date | 1.0 / 18.09.2026 |
| Covers | Slices C1, C2, C6, C7 |
| Parent | [README](README.md) |

---

## 1. The shape

```
business code  →  port (contracts/adapters)  →  transport (integration/cw1)  →  CargoWise
                        every verb exists          HOLDING STUB today            not yet agreed
```

Three layers, and only the third is unknown.

| Layer | Knows about | Changes when CargoWise is agreed |
| --- | --- | --- |
| Business modules | Our own quote, booking, shipment | Never |
| **Ports** — `src/contracts/adapters` | Our types and the intent of the call | Never |
| **Transports** — `src/integration/cw1` | HTTP, SOAP, XML, files, polling, a middleware | **Only this** |

---

## 2. C1 — The outbound store, and what "hold" means

"Hold it for now" must not mean "drop it". Every message we would have sent is **built, stored and
queued**, and simply not delivered.

### The table

One table serves both directions. Inbound rows are archived on arrival; outbound rows are recorded
on creation.

| Column | Why |
| --- | --- |
| `direction` | `inbound` \| `outbound` |
| `sourceSystem`, `sourceInstance` | Which CargoWise, for the day there is more than one |
| `operation` | `quote.request.create`, `shipment.fetch`, … — the port method that produced it |
| `portalRef` | Our reference, e.g. `Q-000042` |
| `idempotencyKey` | `<ref>:v<n>` — stable across retries, new on a re-price |
| `payload` | The canonical message. **Not** a CargoWise shape — that is the transport's job |
| `status` | `pending` \| `sending` \| `sent` \| `acknowledged` \| `failed` \| `skipped` |
| `attempts`, `lastError`, `nextAttemptAt` | Retry with backoff |
| `externalReference` | CargoWise's own reference, once it gives one |
| `customerGroupId` | Nullable. Set where the message belongs to one customer, for staff visibility |

Internal-only table, with an internal access policy. Reversible migration.

### The rule that makes this safe

> The outbound row is written **in the same database transaction** as the business change that
> caused it.

A quote and its outbound copy either both exist or neither does. There is no window where we have
answered a customer but lost the instruction to tell CargoWise.

### The relay

A background worker picks up `pending` rows. **Today it finds the transport unconfigured, marks
nothing, and leaves the row pending** — which is exactly the holding behaviour asked for. When a
transport exists, the same worker starts delivering. Not one line of business code changes.

---

## 3. C2 — Every operation, as a call

The principle: **if we will ever need to ask CargoWise something, the method exists now** and
answers honestly that it is not configured.

`isConfigured()` returns false on every port today. Callers record intent and carry on.

### Quotes — `TmsQuoteAdapter`

| Operation | Direction | Purpose |
| --- | --- | --- |
| `createRequest` | out | The customer's request, copied over |
| `updateRequest` | out | The customer amended it before it was answered |
| `cancelRequest` | out | Withdrawn |
| `submitPricedQuote` | out | A price typed in the portal, written back |
| `recordDecision` | out | Accepted, declined or withdrawn |
| **`getQuoteStatus`** | in | **What has CargoWise done with it.** Answers the GET you asked for |
| `fetchQuote` | in | Pull a quote priced in CargoWise |
| `listQuotesChangedSince` | in | Catch-up poll, for a transport with no push |

### Shipments and tracking — `TmsTrackingAdapter`

`fetchShipment` · `listShipments` · `listEventsChangedSince` · `fetchMilestones` ·
`getShipmentStatus`

### Bookings — `TmsBookingAdapter`

`createBooking` · `updateBooking` · `cancelBooking` · `getBookingStatus` · `fetchBooking`

### Documents — `TmsDocumentAdapter`

`listDocuments` · `fetchDocument` · `pushDocument` · `getDocumentStatus`

### Finance — `TmsFinanceAdapter`

`listInvoices` · `fetchInvoice` · `fetchStatement` · `getInvoiceStatus`

### Organisations — `TmsOrganisationAdapter` *(new port)*

`listOrganisations` · `fetchOrganisation` · `listOrganisationsChangedSince`

Today the organisation import reads a file export directly. Putting it behind a port makes the
directory refresh work the same way as everything else.

### What every outbound method returns

```
{ outcome: 'recorded' | 'received' | 'accepted' | 'rejected',
  messageId, idempotencyKey, externalReference | null, detail? }
```

`recorded` is the honest answer while the transport is held: **we have it safely, we have not sent
it.** A port that claimed `accepted` would be lying, and the lie would surface as a customer
believing CargoWise had their quote.

### What every inbound method returns

`{ data, retrievedAt, source: 'cw1' | 'cache' | 'unavailable' }` — so a caller can always tell a
real answer from an absent one, and never renders "no shipments" when the truth is "we could not
ask".

---

## 4. C6 — The request copy

On submit, in one transaction:

1. The quote moves to `submitted`.
2. An outbound row is written for `quote.request.create`, status `pending`.
3. A job is queued.

The job calls `TmsQuoteAdapter.createRequest(...)`. Today that returns `recorded` and the row stays
`pending`. **The customer is told nothing about any of this** and nothing about their experience
depends on it.

Behind the switch `quotations.cw1_request_sync` (default **true**). With it off, the row is written
`skipped` — so we still have the record that we chose not to send, which a missing row would not
give us.

---

## 5. C7 — Asking what happened

### For staff, on a quote

`GET /v1/quotes/:id/sync` → the CargoWise copy's state:

```
{ status: 'pending', operation: 'quote.request.create',
  attempts: 0, lastError: null, sentAt: null, externalReference: null,
  transport: 'not-configured' }
```

`transport: 'not-configured'` is the plain truth today, and it stops anyone reading `pending` as a
fault.

### For operations, across everything

| Route | Permission | Purpose |
| --- | --- | --- |
| `GET /v1/integration/messages` | `admin.integration.read` | Filter by direction, status, operation, reference |
| `GET /v1/integration/messages/:id` | `admin.integration.read` | One message and its full history |
| `POST /v1/integration/messages/:id/replay` | `admin.integration.manage` | Re-queue it. Idempotency key unchanged |
| `GET /v1/integration/health` | `admin.integration.read` | Counts by status, oldest pending, transport state |

### The universal inbound door

`POST /api/integration/cw1/messages` — archive first, queue a job, **return 202 immediately**. Never
do business work inside the request. Unique on `(sourceSystem, sourceInstance, sourceMessageId)`, so
a message delivered twice is processed once.

This one endpoint serves every inbound message type, so CargoWise needs one address regardless of
what they eventually send.

---

## 6. Configuration

| Key | Values | Default |
| --- | --- | --- |
| `CW1_TRANSPORT_QUOTE` | `none` \| `http` \| `soap` \| `file` \| `middleware` | `none` |
| `CW1_TRANSPORT_SHIPMENT` | same | `none` |
| `CW1_TRANSPORT_DOCUMENT` | same | `none` |
| `CW1_TRANSPORT_FINANCE` | same | `none` |
| `CW1_TRANSPORT_ORGANISATION` | same | `file` (the export we already read) |

**`none` is a first-class value, not a broken state.** The whole platform must be fully usable with
every one of these set to `none` — that is the definition of done for this phase.

---

## 7. Tests to write, and leave unrun

- An outbound row is written in the same transaction as the quote, and rolls back with it
- With the transport held, the row stays `pending` and the customer path is unaffected
- A retry reuses the idempotency key; a re-price allocates a new one
- The inbound door returns 202 and does no business work in the request
- A duplicate inbound message is archived once and processed once
- An inbound message for an unknown organisation code **fails closed and creates nothing**
- Every port answers `isConfigured() === false` without throwing
- The sync endpoint is refused to a customer token
- With `cw1_request_sync` off, the row is `skipped` and the quote is still created
