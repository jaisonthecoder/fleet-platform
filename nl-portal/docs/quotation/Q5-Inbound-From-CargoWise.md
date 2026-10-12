# Q5 — A priced quote comes back from CargoWise

| | |
| --- | --- |
| Goal | A quote priced in CargoWise reaches the customer through the portal |
| Size | Medium |
| Depends on | **Q1** (for `recordPrice`), **Q4**, and **R1**, **R3**, **R4** |
| Needs CargoWise | Yes |
| Needs a mockup | No, beyond a provenance marker on the existing screens |

This is the **normal** path. CargoWise is the main source of truth; portal pricing is the
option. Read [Q4](Q4-Outbound-To-CargoWise.md) first — the same dependency check and the
same late-binding principle apply.

---

## The flow

1. The message arrives at the **universal inbound door**,
   `POST /api/integration/cw1/messages`.
2. It is archived to `integration_message` **before anything else happens**, and a job is
   enqueued.
3. **Return 202 immediately.** Never do business work in the request.
4. The job maps the message to canonical shape and calls **`recordPrice(...)` from Q1**
   with `priceSource: 'cw1'`.

**Do not write a second pricing path.** One code path, two sources. If you find yourself
copying Q1's logic, Q1 was built wrong and that is the thing to fix.

---

## CargoWise wins on collision

If CargoWise prices a quote that was already priced in the portal:

- CargoWise's values are **stored**
- The portal draft is **kept in history**, never discarded
- The portal user is **notified**
- Any **claim on the quote is released**, and its holder is among those notified

**A claim never blocks this path.** The Q1 claim check lives at the portal controller, not
inside `recordPrice()`, precisely so that an inbound CargoWise price cannot be held up by a
colleague who happens to hold the file. If you find yourself adding a claim check to the job
handler, Q1 was built wrong — re-read its "one design decision that matters".

The human-in-the-loop rule still applies: the stored value carries its provenance and a
person can override it with a mandatory reason, keeping the original.

---

## The confirmation gate — OQ-27, still open

| `quotations.cw1_request_sync` | Behaviour |
| --- | --- |
| **On** | A portal-priced quote sits at `pending_sync` until CargoWise confirms. The customer sees it only then. CargoWise remains the record |
| **Off** | The portal is the record for that quote. The price is released directly, marked with its provenance, and flagged for later reconciliation if CargoWise is connected afterwards |

**Build it as a switch. Do not hard-code the gate.**

The earlier design made confirmation absolute. That is a real design error, corrected on
17.09.2026: a branch that prices in a spreadsheet, with no settled CargoWise quoting route,
would be unable to answer its customer at all. The gate would not protect the record; it
would stop the module working.

Default to the behaviour that works everywhere until the director answers.

---

## Tests to write, and leave unrun

- The inbound door returns 202 and does no business work in the request
- A duplicate `sourceMessageId` is archived once and processed once
- An unparseable message is archived and marked failed, never silently dropped
- CargoWise-wins: the portal price moves to history, the CargoWise price is live, the user
  is notified, **and a claim held on that quote is released**
- An inbound price succeeds against a quote claimed by someone else — no 409 on this path
- The gate on and off, both producing a correct customer-visible outcome
- A message for an unknown quote reference fails closed, and never creates a quote

---

## Done when

A quote priced in CargoWise reaches the right customer, with the right provenance, without
a second pricing code path — and a portal-priced quote behaves correctly with the gate in
either position.
