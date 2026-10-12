# CargoWise communication and the portal quotation flow — build plan

| | |
| --- | --- |
| Version / date | 1.0 / 18.09.2026 |
| Status | **Authoritative for the CargoWise communication surface and the portal quotation flow.** Supersedes the parts of earlier documents listed in §3 |
| Written from | Product owner's direction of 18.09.2026, recorded verbatim in §1 |
| Governed by | PRD amendment 17.09.2026 · the director's scope cap of 17.09.2026 |

---

## 1. The direction, in the product owner's words

> - For CargoWise, you know it is not in our hands. So what we have to do is just open all the
>   lines to communicate with CargoWise for us — anyway it's an API call. Provision this for now
>   for all the CargoWise-related stuff. What I mean: provide API calls or any communication line
>   to push and pull, or communicate from and to the adapters.
> - For the quotation module — anyway they don't have a proper system. Just focus on our portal.
>   We will build a standard flow for them through our portal connecting to CargoWise; we should
>   have that provision, the complete integration will do later. Whatever they do in CargoWise for
>   creating and approving quotes, in our portal also should have that option. I mean, I should be
>   able to enter price manually in our portal like I am entering in the Excel sheet — no need to
>   link with any pricing mechanism.
> - Whenever a customer requests a quote it should send one copy to the CargoWise adapters. From
>   the adapters to CargoWise, hold it for now. From our backend, all the things we need, we send
>   to the adapters; then from the adapters we will decide later.
> - After any of the staff claim the request and enter the pricing with different options, there
>   should be an option to publish this to the customer. At the same time, the copy we send to CW —
>   we need a GET API to understand the status of that quote; it should stay pending.
> - The quote should have a proper status mechanism. When any of the staff claim the request it
>   should show the proper status and who is working on it.
> - Related to the communication to CW from our side — each operation, fetching or sending or
>   updating or deleting, whatever it is, provision it as an API call to the corresponding adapter.

---

## 2. What this means, stated as design

**The portal becomes complete on its own, and CargoWise becomes a plug.**

1. **Every CargoWise interaction exists as a named operation on an adapter**, in both directions and
   for every verb — create, read, update, cancel, and status. Business code calls the operation and
   never knows what is behind it.
2. **The transport is held, not the work.** Our side builds the message, stores it, and hands it to
   the adapter. The adapter records it as **pending** rather than calling CargoWise. When the
   mechanism is agreed we write one transport class and release the stored messages. **No business
   code changes.**
3. **The portal carries the whole quote life**, including the internal step CargoWise calls
   approval. Manual typing only — free text and an amount, exactly like the spreadsheet it replaces.
4. **Publishing is a deliberate act**, separate from pricing.
5. **A quote has two statuses**: its own, and the CargoWise copy's. They never block each other.

### 2.1 The one structural correction

The earlier design had a single status list containing `pending_sync`, which meant "waiting for
CargoWise". That conflated **what the customer sees** with **whether a message left the building**,
and it is what made the old "the customer waits for CargoWise" rule unavoidable.

They are now two independent fields. A CargoWise outage can no longer stop us answering a customer,
and the sync state is still visible to staff and queryable through an endpoint.

---

## 3. What this supersedes

| Document | What still stands | What this replaces |
| --- | --- | --- |
| `plans/Quotation-Module-Phase-Plan.md` | The scope cap (§7), the precedence rule (§0), phases Q0–Q3 as work | Q4/Q5 sequencing, and the `pending_sync` quote status |
| `quotation/Q1-Record-A-Price.md` | The option model, claiming, the race-safe claim | `quotations.portal_pricing` default — now **true** |
| `design/CW1-Integration-Surface-and-Quotation-Paths.md` | Every transport option, the envelope, the late-binding principle | "CargoWise is the normal path, the portal is path B" — reversed |
| PRD amendment A2 | Portal pricing is a managed capability | "off by default" — now on by default |
| PRD OQ-27 | **Answered by the staff mockup** as the `pubMode` setting | `cw1` globally, `direct` where a branch overrides. A scoped setting, not a switch — see `02-Quotation-Flow-and-Status.md` §6 |

**Nothing is deleted.** Reversing any of it is a switch default, not a rebuild.

---

## 4. The build, in order

Each slice is independently useful and leaves the system working.

| # | Slice | Depends on | Delivers |
| --- | --- | --- | --- |
| **C1** | The outbound message store and the hold | R3 spine | **Built and verified 18.09.2026.** `integration_message` (both directions), `IntegrationMessageService`, the relay job, and `CW1_TRANSPORT_*` per family defaulting to `none` |
| **C2** | The full adapter operation surface | C1 | Every CargoWise verb exists as a call; all return "recorded, pending" |
| **C3** | Quote status machine and claiming | Q0 | Proper statuses, and who is working on it |
| **C4** | Manual pricing with several options | C3 | Type a price like a spreadsheet |
| **C5** | Publish to the customer | C4 | A deliberate release step, and the customer sees it |
| **C6** | The request copy goes to the adapter | C2, C3 | Every submitted request is handed over and held |
| **C7** | Sync status endpoints | C1, C6 | Ask what happened to any message; see pending on the quote |
| **C8** | Internal approval step | C4 | Optional second pair of eyes, behind a switch |
| **Later** | The transport | Agreement with the CargoWise team | One class. Release the stored messages |

Detail for C1, C2, C6 and C7 is in
[01-CargoWise-Communication-Surface.md](01-CargoWise-Communication-Surface.md).
Detail for C3, C4, C5 and C8 is in
[02-Quotation-Flow-and-Status.md](02-Quotation-Flow-and-Status.md).

---

## 5. Rules that hold across every slice

1. **Business code never names CargoWise.** It calls a port. Only the transport layer knows about
   HTTP, XML, files or polling.
2. **Nothing is sent inline.** Every outbound message is written in the same database transaction as
   the business change it belongs to, then handed over by a background worker.
3. **A CargoWise failure is never a customer-facing error.** The quote keeps its last good state,
   staff see the sync status, operations are alerted.
4. **Every optional behaviour is a switch** — registered in the catalogue, enforced by the API,
   read by the screen. See foundation rule 4.
5. **Manual means manual.** No rate lookup, no charge-code validation, no carrier catalogue, no
   ranking. A person types every figure.
6. **Tenancy is never relaxed for integration.** Inbound messages resolve their customer from the
   organisation code; an unknown code fails closed and creates nothing.
7. **Verification is user-scheduled.** Write the tests, leave them unrun, and say so.
