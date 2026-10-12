# Staff pricing assistant — research and plan

> Version 1.0 — 22.09.2026. **Plan only, nothing built.**
> Starts after the customer-side intake work in
> [02-Build-Status.md](02-Build-Status.md) is finished.

## 1. The short answer

Of the four capabilities proposed, **one fits today, one fits with a small
addition, and two cannot be built at all yet** — not because they are hard, but
because the data they learn from does not exist.

| Proposed | Verdict |
| --- | --- |
| 4. Automated customer correspondence | **Build it.** Already designed for — a setting exists and is waiting for it. |
| 2. Predictive charge-line mapping | **Half.** The *structure* of a lane's charge lines, yes. The *rates*, no. Needs a charge-code lookup first. |
| 1. Route and carrier scenario generation | **Blocked.** No schedule source, no carrier API, no transit data. |
| 3. Dynamic margin optimisation | **Blocked, and contested.** No cost history, and it runs against a recorded director-level position. |

The rest of this document is the evidence, then what to do about it.

## 2. What the research found

Measured against the live development database and the code on 22.09.2026.

### 2.1 There is no history to learn from

```
quotes                 0
options                0
charge_lines           0
costs_recorded         0
published              0
accepted               0
```

Every proposal that relies on "historical lane data", "historical line-item
models", "historical close rates" or a "running monthly average for that lane"
has **zero** rows behind it. Not sparse — empty.

This is not a temporary state that will fix itself in a week either, because the
portal has not yet carried a real quote.

### 2.2 There is no rate or schedule source

- No `CW1_TRANSPORT_*` is configured, so nothing flows from CargoWise.
- `RateEngineAdapter` is implemented and stub-tested with **no configured
  source** — v4 rule 1 is explicit that no price returns automatically.
- There is no carrier schedule integration of any kind, so "next departures"
  cannot be looked up. The field `quote_option.next_departures` is a free-text
  `varchar(120)` a pricer types.

### 2.3 Cost capture is off by default, deliberately

`quotations.costCapture` defaults to **false**, and the reason is written into the
catalogue:

> *"The organisation has no rate or cost store and no standard quoting process
> (director, 17.09.2026), so recording cost is something a branch opts into, not
> something the platform assumes."*

So for most branches there will be no cost figure at all, and therefore no margin
to optimise.

### 2.4 But the drafting capability is already designed

`quotations.draftSvc` exists, **defaults to true**, and is gated on the switch
`communication.ai_drafting`:

> *"Pre-draft the customer message. Humans always review and send."*

This is v4 rule 8 anticipated in the settings catalogue. Item 4 of the proposal
is not a new idea to the platform — it is a hole shaped exactly like it.

### 2.5 What reference data does exist

| Data | State |
| --- | --- |
| `carrier` lookup | **24 items**, real SCAC and IATA codes, with `metadata.modes` |
| `charge_basis` lookup | exists; `CHARGE_BASES` lists nine real bases |
| **charge code lookup** | **does not exist.** `quote_charge_line.code` is free text `varchar(40)` |
| `container_type` | exists with capacity and payload metadata |

The missing charge-code catalogue is the single most useful thing to add, and
§6 covers it.

## 3. Build now

### 3.1 Draft the customer message — the strongest item

`quote.messageToCustomer` already exists. The pricer types the options; the
assistant drafts the covering note; the pricer edits and a human publishes.

- **Multilingual.** Draft in the customer's own locale, EN or ES, which the
  platform already knows.
- **Context callouts from deterministic checks**, not from the model's judgement:
  free time stated, validity short, dangerous goods declared but not mentioned,
  origin left as unverified free text.
- Gated by the existing switch and setting. Nothing new to invent.

### 3.2 Draft the quotation terms

`termsIncluded`, `termsExcluded`, `termsPayment`, `termsSubjectTo` already exist
on `quote_option` and are boilerplate a pricer retypes on every quote. Drafting
them from the request and the chosen scope is re-expression, carries no
commercial judgement, and saves real minutes.

### 3.3 Pricing brief

Turn the request into "what am I being asked for": the lane, the equipment, and
the awkward parts — dangerous goods class, reefer set point, out-of-gauge pieces,
free-time expectation. Pure summarisation of data we already hold.

### 3.4 The validation checks — and these are not AI

The `system_validation_checks` block in the proposed payload is the best idea in
it, and almost none of it needs a model:

| Check | How |
| --- | --- |
| margin inside branch band | arithmetic against `quotations.threshold` — partly exists |
| validity gives the customer room | `validUntil` against today |
| rates in date | `validUntil` against the ready date |
| free time matches the request | `freeTimeDays` against what the customer asked |
| origin free text unconfirmed | the request's origin never matched a lookup |
| dangerous goods not mentioned in the message | the quote has DG rows, the draft text does not mention them |

Deterministic, explainable, testable. **Build these first** — they are cheap, they
never hallucinate, and they make the assistant look sharper than a model would.

## 4. Blocked, and what each would need

| Capability | Needs |
| --- | --- |
| Scenario drafting with transit times | A schedule source. Either a carrier API, or CW1 wired and carrying sailing data. Neither exists. |
| Automated next-departure matching | The same. Until then this field is typed. |
| Pre-calculated surcharge rates | A rate store. v4 rule 1 says there is none, organisation-wide. |
| Margin optimisation, win probability | Cost history **and** outcome history. Today both are zero, and `costCapture` is off. Needs roughly a year of priced and decided quotes before a suggestion would mean anything. |
| Spot rate anomaly flags | A rate history per lane. Same blocker. |

**The seam that makes these possible later:** every quote priced through the
portal is one data point. The portal is already described in the plans as *the
instrument that measures the process the business is trying to standardise*. Build
the structure now and the data accrues; do not pretend the data is there.

## 5. Review of the proposed JSON blueprint

The shape is close to our model, which is a good sign. Five corrections, and the
first is important.

### 5.1 Cost must not sit beside sell — this one matters

The proposal puts `cost_internal` and `margin_percentage` inside each charge line,
and `total_internal_cost` inside `summary_totals`, next to the selling price.

Our schema deliberately does the opposite. `quote_charge_line_cost` is a
**separate table with an internal-only RLS policy**, because *PostgreSQL row-level
security is row level and cannot hide a column*. A cost column on a
customer-readable row is one forgotten `select` away from being published, and
margin is derived, never stored.

A payload that co-mingles them re-creates exactly the risk the split removed. The
blueprint needs two objects: the option as the customer could ever see it, and an
internal cost overlay that only a holder of `quotes.cost.view` receives.

### 5.2 Money is in minor units

`totalMinorUnits`, `rateMinorUnits` and `amountMinorUnits` are `BigInt` minor
units. The proposal uses `5765.00`. Decimal money in a payload is how a rounding
difference reaches a PDF. Keep minor units on the wire.

### 5.3 The message belongs to the quote, not the option

`messageToCustomer` is on `quote`, not `quote_option`. One note covers all the
options, which is also how the pricer writes it. `customer_correspondence` should
move up a level.

### 5.4 Transit is a range

We store `transitDaysMin` and `transitDaysMax`, because a sailing is honestly a
range. A single `transit_days: 30` loses that.

### 5.5 Charge codes have no catalogue

`FRT`, `THC`, `DOC`, `CUS`, `DLV` are real industry codes, but the portal has no
list of them — see §6.

## 6. The enabling gap: a charge-code lookup

The most useful thing to build before any of this, and it is not AI.

`quote_charge_line.code` is free text, so "THC", "T.H.C." and "Terminal handling"
are three charges as far as any report is concerned — the same defect the carrier
lookup already fixed for carrier names.

Proposed: a `charge_code` lookup, portal-owned, customer-visible, following the
`carrier` precedent exactly — a maintained list that the field offers but does not
enforce, so a pricer is never blocked at 17:40 waiting for an administrator.

With `metadata` carrying which modes and which leg each code belongs to (origin,
freight, destination, customs, delivery), §3 gains the ability to scaffold a
lane's charge lines with **blank rates** — the structure without the number. That
is most of the proposal's item 2, with no rate store and no invention.

## 7. Build order

| ID | Slice | Depends on |
| --- | --- | --- |
| SA-01 | `charge_code` lookup, seeded, wired into the charge-line editor | — |
| SA-02 | Deterministic validation checks and the warning strip (§3.4) | — |
| SA-03 | Pricing brief (§3.3) | the customer-side adapter |
| SA-04 | Draft the customer message, EN and ES (§3.1) | SA-02 for the callouts |
| SA-05 | Draft the quotation terms (§3.2) | SA-04 |
| SA-06 | Charge-line scaffolding with blank rates (§6) | SA-01 |

SA-01 and SA-02 need no model at all and are worth doing regardless of whether
the AI work proceeds.

## 8. Open questions

| ID | Question |
| --- | --- |
| **SA-D01** | Is there a rate or schedule source anywhere in the group we have not been told about? The whole of §4 turns on this. |
| **SA-D02** | Do we start recording cost now — `costCapture` on for pilot branches — purely to accumulate the history that §4 would later need? It is a business decision, not a technical one. |
| **SA-D03** | Does the charge-code catalogue come from CargoWise, or is it portal-owned like carriers? Affects SA-01's ownership field. |
| **SA-D04** | Margin suggestion is contested at director level. Is it in scope at all, or permanently out? |

## 9. What to say in a demo

The honest and still impressive version:

> The pricer types the numbers, because only a person knows what this lane is
> worth today. Everything around the numbers — the brief, the checks, the terms,
> the note to the customer in their own language — the assistant does. And as the
> portal carries more quotes, it starts to learn what we charged last time.

The last clause is a roadmap, not a claim. Keep it that way.
