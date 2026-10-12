# Q1 — A person claims a request and records a price

| | |
| --- | --- |
| Goal | Someone at Noatum takes ownership of a quote request and answers it |
| Size | Medium |
| Depends on | Q0 |
| Needs CargoWise | No |
| Needs a mockup | **Yes, for the screen.** Build the API first and stop before the panel |

The most valuable phase in the module. Today there is no way for a person to record a
price and no way for CargoWise to deliver one, so a quote request cannot be answered at
all.

---

## Two capabilities, gated differently — read this twice

| | Claiming | Pricing in the portal |
| --- | --- | --- |
| Question it answers | Who is dealing with this request | What is the price |
| Feature switch | **None. Always on** | `quotations.portal_pricing`, default **off** |
| Useful when CargoWise does the pricing | **Yes — this is when it matters most** | Not used on that path |
| Permission | `quotes.claim` | `quotes.price` |

**Decision, 17.09.2026, product owner: "keep the claim even [if] CW is there or not".**

If claiming were gated by `quotations.portal_pricing`, switching portal pricing off would
also remove the only shared record of who is handling a request — exactly on the CargoWise
path, where two people can otherwise open the same request and price it twice in the TMS.
The portal is the shared inbox for both paths, so ownership must work on both.

**If you put the claim routes behind the pricing switch, the requirement is broken.**

---

## The one design decision that matters

Write **one** service method:

```ts
recordPrice(quoteId, input, provenance)
```

**Q5 calls this same method** when CargoWise delivers a price. Two entry points, one code
path. If a second copy of this logic gets written for CargoWise later, Q1 was built wrong.

The **claim check belongs at the portal controller**, not inside `recordPrice()`. Put it
inside and the CargoWise path can be blocked by a claim, which it must never be.

---

## Claiming

### Permissions

- `QUOTES_CLAIM: 'quotes.claim'` — claim, and release your own
- `QUOTES_CLAIM_OVERRIDE: 'quotes.claim.override'` — take over or release someone else's

Internal presets only. Never a customer preset.

### Database — on `quote`

| Column | Type | Why |
| --- | --- | --- |
| `claimedById` | uuid, nullable, FK user | Who holds it |
| `claimedAt` | timestamptz, nullable | Since when, and the input to the staleness rule |

Release clears both. History lives in `AuditEvent` — **no second table**, because no
reporting requirement needs one yet.

### API

- `POST /v1/quotes/:id/claim` — `@RequirePermission(QUOTES_CLAIM)`
- `POST /v1/quotes/:id/release` — same for your own; `QUOTES_CLAIM_OVERRIDE` for another's

**Neither route is behind a feature switch.**

### Race safety — the part to get right

One conditional update, then check the affected row count:

```sql
UPDATE quote SET claimed_by_user_id = $1, claimed_at = now()
WHERE id = $2 AND (claimed_by_user_id IS NULL OR claimed_at < now() - $3::interval)
```

Zero rows affected means someone else won — return **409** naming the holder. **Do not
read-then-write.** That is the same defect class as the `nextReference()` race Q0 fixes.

### Rules

1. **Pricing an unclaimed quote claims it implicitly.** No one clicks twice to do one job.
2. **A quote claimed by someone else cannot be priced in the portal** without
   `quotes.claim.override`. Return 409 naming the holder, not a bare 403 — "someone has
   this" and "you may not do this" are different answers.
3. **A claim never blocks an inbound CargoWise price.** Q5 calls `recordPrice()` with
   provenance `cw1` and bypasses the claim entirely. CargoWise wins. The claim is released
   on the same write and the holder is notified.
4. **Stale claims expire without an administrator.** Config constant
   The `claimExpiry` **setting**, default **4 hours**, used in the `WHERE` clause above. Evaluated on read
   and write — **no scheduler, no dependency on remediation R4.**
5. **Released automatically** on reaching `quoted`, `withdrawn` or `expired`.
6. **Internal-only.** `claimedById` and `claimedAt` never appear in a customer-facing DTO,
   list, export, notification or API response. Leaking them leaks our staffing.

---

## Pricing

## Feature switch

Add to `FEATURE_SWITCHES` under the existing `quotations` category:

| Key | Default | Requires approval | Gates |
| --- | --- | --- | --- |
| `quotations.portal_pricing` | **true** | No | The price-recording route and its screen. **Not the claim routes** |
| `quotations.multi_option` | **true** | No | Whether a quote may carry **more than one** option, in the API and the UI |

**`quotations.multi_option` — how it must behave.** Default on, because the mockups treat
several options as normal. With it **off**:

- the API **refuses a price body containing more than one option** — 400 from the service,
  not a silent truncation, because silently dropping an option a person typed is worse than
  rejecting it;
- the screen shows a single-option form with no "Add option" control;
- customer surfaces show one price.

**The schema never changes.** There is always a `quote_option` row, one or many. Turning the
switch off caps what can be *created*; it never migrates, hides or deletes data.
**Quotes already priced with several options keep showing all of them** — a customer was
given those options, and a switch must not retract what we already said.

Portal pricing is path B, not the normal case. CargoWise pricing is the normal case. With
the switch off the portal is a window: requests go out and priced quotes come back.

---

## Permission

Add `QUOTES_PRICE: 'quotes.price'` to `PERMISSIONS`. Seed it to **internal presets only**.
Never to a customer preset. (`quotes.claim` and `quotes.claim.override` are above.)

The other codes this module needs — `quotes.read`, `quotes.create`, `quotes.submit`,
`quotes.accept`, `quotes.cancel` — already exist and are seeded. Do not add duplicates.

---

## Database

**Decision 17.09.2026: a quote carries one or more priced options.** A person types each
one; nothing derives them. New table `quote_option`, Pattern A tenancy
(`customer_group_id NOT NULL`, indexed, RLS enabled and forced):

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

`quote.totalMinorUnits`, `currency` and `validUntil` stay, redefined as **the headline
figures of the recommended option**, written by `recordPrice()` in the same transaction.
One writer, so they cannot drift, and the list endpoint needs no join.

**`priceLines` lives on `quote_option` only — never on `quote`** (decided 17.09.2026). Each
option has its own breakdown, so a quote-level copy would have to be kept in step with
whichever option is recommended, and would drift the first time someone re-prices. The
headline figures above are the one deliberate exception, and they are safe only because a
single method writes them. Do not add a second.

`priceLines` is deliberately free-form. **No charge codes, no mapping table, no validation
beyond shape.** There is no standard format in the organisation to validate against, and
inventing one makes the module unusable in every branch that does not yet have one — which
today is all of them.

---

## API

- `POST /v1/quotes/:id/price` — guarded by **both** `@RequirePermission(QUOTES_PRICE)` and
  the feature guard on `quotations.portal_pricing`.
- Body: `{ options: [...], recommendedIndex?, messageToCustomer? }`. At least one option.
- Transition `submitted` → `quoted`, through `quote.status.ts`.
- Re-pricing replaces the option set and keeps the previous one in audit.
- Emits `AuditEvent` and `AnalyticsEvent`.
- `POST /quotes/:id/rate` stays untouched, unused, behind `quotations.instant_rate`.

---

## UI — stop here and ask

The plan calls for a claim indicator, Claim / Release actions and a "Record price" panel on
the internal quote detail screen. **That screen does not exist.** `src/features/quotes/` is
an empty `.gitkeep`, so this is a build rather than an addition, and it is the first
quotation surface in the product.

**Do not design it. Request the mockups, then build to them.** Design-system components
only, EN and ES strings, `DD.MM.YYYY`, loading / empty / error states, WCAG 2.1 AA.

One behaviour to specify in the mockup request: when someone else holds the claim, the
screen **says who and since when**. It does not disable the panel silently — an unexplained
disabled control is how a colleague ends up pricing it in CargoWise instead.

---

## Tests to write, and leave unrun

**Claiming**

- The claim and release routes work **with `quotations.portal_pricing` off**
- Two concurrent claims — one 200, one 409 naming the holder
- Pricing a quote claimed by another user is refused without `quotes.claim.override`
- An inbound `cw1` price succeeds against a claimed quote, and releases the claim
- A claim older than the resolved `claimExpiry` can be taken by someone else
- A customer-facing response never contains `claimedById` or `claimedAt`

**Pricing**

- 403 when the switch is off — **from the guard**, not from a hidden button
- 403 for a customer token, on every route in this phase
- The `submitted` → `quoted` transition, and a forbidden one
- Provenance is stored
- A customer-facing response never returns cost or internal fields

---

## Done when

An internal user claims a request and a colleague sees it is taken — **with the pricing
switch off and no CargoWise connection in existence**. With the switch on, that user also
records a price and the customer sees it.

---

## Do not build in this phase

The pricing queue **screen** — a branch-scoped worklist with filters, assignment or SLA
timers — or an approval flow. Q1 puts claim, release and price on the quote itself.
See [00-Shared-Rules §4](00-Shared-Rules.md).

Multiple options are in scope, but **nothing that derives them**: no rate lookup, no carrier
catalogue, no automatic comparison or ranking. `carrierName` is free text a person types.
