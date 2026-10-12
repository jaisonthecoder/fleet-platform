# Design Note — Internal Quote Pricing in the Portal

| | |
|---|---|
| **What this is** | A design for letting a Noatum pricing user price a customer's quote request **inside the portal**, with the result written back to CargoWise. CargoWise stays the system of record; the portal becomes a second front door to one CargoWise step |
| **Requested by** | The business, after PRD v2.1 was written |
| **Status** | **v4.1, 17.09.2026: still Phase 1, but now an optional capability behind the `quotations.portal_pricing` switch, off by default.** See §1b. The v4 promotion below stands as history; the confirmations in §12 remain open |
| **Aligned to** | PRD FG-3.1, §5 · LLD v3 · ADR-004 |
| **Written** | 09.09.2026 |

---

## 1. Why this needs a decision, not just a ticket

PRD v2.1's first program-level non-goal says the platform is "the customer layer, never the system of record for operations" and must not replace CW1 operational workflows. Pricing a quote is an operational workflow.

This design does **not** replace anything — CW1 keeps the record and stays authoritative — but it does put an operational task on a portal screen for the first time. That is a change of principle, so the PRD needs a sentence added rather than the code quietly contradicting the document. **Sponsor sign-off required (§12, item 6).**

## 1a. What changed in v4

| Change | Detail |
|---|---|
| **Promoted to Phase 1** | No rate management exists; all quoting is manual today, largely outside CargoWise in email and spreadsheets. Standardising it is the Phase 1 value |
| **Branch scoping added** | Internal users carry a branch. One branch must not see another's internal quotes. An explicit permission grants cross-branch visibility. **Cross-branch requests** — one branch asking another for local charges — are a recognised future use of the same queue and must not be precluded |
| **Drafted customer email** | Owned by another team and consumed through an interface. The draft is editable, sending requires human action, and a template fallback applies if the service is unavailable. We build none of it |
| **Pricing in CargoWise stays fully supported** | A quote priced in CargoWise flows in as already priced. Neither route is mandatory; both are configured per region or branch |
| **Quote linkage corrected** | A quote is linked to a booking by quote number, one-to-many. Nothing in this design assumes conversion |

## 1b. What changed on 17.09.2026 — read this before building anything below

The director capped the quotation module:

> *"To date we have NO established rate database, NO centralized rate storage, NO standardized
> format, and even more important: NO standardized quoting processes across the organization
> … We will have to come up with a very LIGHT quoting module."* — Christian, 17.09.2026

**Everything in this note survives as design. Most of it is not built in the first release.**

| This design says | Now |
| --- | --- |
| Internal pricing is *the* Phase 1 quotation feature | It is an **optional capability behind `quotations.portal_pricing`, off by default**. Consuming a quote priced elsewhere comes first |
| A pricing queue with claim and release, branch-scoped | **Split, 17.09.2026.** **Claim and release are built** in phase Q1, always on, with no CargoWise dependency and **not** behind `quotations.portal_pricing` — ownership must be visible on both paths. The **queue screen** and its branch scoping are deferred until volume justifies them |
| Charge-line entry against charge codes | **Loosened.** One or more priced options, or an attached document, or both, plus free text. Optional free-form lines. There is no standard format to validate against |
| An approval threshold and an approver role | **Not built.** Nullable `approvedBy` / `approvedAt` seams only, until OQ-11 is answered |
| `PendingSync` until CargoWise confirms — principle 2 | **Conditional.** See the correction to principle 2 below |
| The drafted customer email through the other team's service | **Deferred.** Template fallback only |

**Why, not just what.** An organisation with no standardised quoting process cannot fill in a
queue, a charge-code schema or an approval chain — there is nothing to standardise against
yet. Building that machinery now means building it twice. The seams stay so that when the
organisation's landscape redesign lands, the defaults flip rather than the code being
rewritten.

Build sequence: `../cargowise-and-quotation/README.md` (newest) and `../plans/Quotation-Module-Phase-Plan.md`.
Integration seam: `CW1-Integration-Surface-and-Quotation-Paths.md`.

## 2. Principles

1. **CargoWise remains the system of record.** Every portal-priced quote must exist in CW1.
2. **Where CargoWise holds the quote, the portal is not finished until CargoWise has it.** A
   quote priced in the portal is `pending sync` until CargoWise confirms; only then is it
   presented to the customer. **Corrected 17.09.2026:** this is conditional on
   `quotations.cw1_request_sync` being on. Where a branch prices outside any system and no
   CargoWise quoting route is settled, an absolute gate would stop the branch answering its
   customer at all. With sync off, the portal is the record for that quote, the price is
   released with its provenance, and the quote is flagged for reconciliation if CargoWise is
   connected later. **Awaiting the director's written answer — PRD OQ-27.**
3. **CW1 wins every conflict.** If CW1 returns different values, CW1's version is stored and the pricing user is told.
4. **No rate management.** The portal records what the person enters. Looking rates up stays wherever it happens today.
5. **Cost never leaves the building.** If pricing captures buy rates or margin, those are invisible on every customer surface.
6. **One owner at a time.** A request is claimed before it can be priced, so two people in two systems cannot price it twice.

## 3. Roles and permissions

New internal permission codes, added to the existing list — no new machinery, because roles are permission lists:

| Code | Meaning |
|---|---|
| `quote.price.queue` | See the internal pricing queue |
| `quote.price.claim` | Claim a request and release it |
| `quote.price.edit` | Enter and edit charge lines, validity, carrier, service |
| `quote.price.submit` | Submit a priced quote (for approval, or straight to sync if below threshold) |
| `quote.price.approve` | Approve or reject a submitted quote — cannot be the submitter |
| `quote.cost.view` | See cost and margin lines |
| `quote.price.crossbranch` | See and claim requests belonging to other branches |

Two new internal preset roles:

- **Pricing** — `quote.price.queue`, `.claim`, `.edit`, `.submit`, plus `quote.cost.view` if cost is in scope
- **Pricing Approver** — `quote.price.queue`, `.approve`, `quote.cost.view`

Both are internal only (`is_internal = true`), so a Customer Admin can never assign them. Customer-facing roles are untouched.

## 4. State machine

The existing customer-facing states are unchanged. Four internal states are inserted into the manual path only.

```
Draft ──submit──► Requested
                     │
        rate found ──┴── no rate
             │             │
          Quoted      InProgress ──claim──► Pricing
                                              │ submit
                                              ▼
                                    ┌── below threshold ──► PendingSync
                                    │
                              PendingApproval ──approve──► PendingSync
                                    │ reject
                                    └──────────► Pricing (with reason)
                                                     │
                          PendingSync ──CW1 confirms──► Quoted ──► customer sees it
                                    │
                                    └── CW1 rejects / times out ──► SyncFailed (ops alert)
```

Rules:

- `InProgress → Pricing` requires a claim. Releasing or claim expiry returns it to `InProgress`.
- `Pricing → PendingApproval` when the total exceeds `PRICING_APPROVAL_THRESHOLD`, otherwise straight to `PendingSync`.
- Approver ≠ submitter, enforced in the service and by a check constraint.
- `PendingSync` is invisible to the customer. The customer sees `InProgress` until `Quoted`.
- `SyncFailed` is retried by the job; after N attempts it raises an ops alert and stays visible to the pricing user, never to the customer.
- Every transition writes an `audit_event` with actor, before and after.

## 5. Data model

Additive only. No existing table changes shape.

**`quote` — new columns**

| Column | Notes |
|---|---|
| `claimed_by` uuid NULL | internal user holding the request |
| `claimed_at` timestamptz NULL | |
| `claim_expires_at` timestamptz NULL | claim released automatically after this |
| `priced_by` uuid NULL | who entered the price |
| `approved_by` uuid NULL | NULL when below threshold |
| `sync_state` enum | `not_required · pending · confirmed · failed` |
| `sync_attempts` int | |
| `cw1_quote_ref` varchar NULL | CW1's own reference once confirmed |
| `origin` enum | `portal_instant · portal_internal · cw1` — tells us where the price came from |

**`quote_charge_line` — new columns** (internal only)

| Column | Notes |
|---|---|
| `is_internal` boolean NOT NULL DEFAULT false | cost or margin line; never returned to a customer |
| `cost_amount` numeric NULL | only populated if cost is in scope (§12 item 3) |

**New table `quote_price_event`** — the pricing audit trail the pricing team will actually use:

```sql
CREATE TABLE app.quote_price_event (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          uuid NOT NULL REFERENCES app.quote(id),
  customer_group_id uuid NOT NULL,                 -- Pattern A, RLS as usual
  actor_user_id     uuid NOT NULL,
  action            varchar(30) NOT NULL,          -- claimed · released · priced · submitted · approved · rejected · synced · sync_failed
  reason            text,                          -- mandatory on reject
  snapshot          jsonb,                          -- charge lines at that moment
  occurred_at       timestamptz NOT NULL DEFAULT now()
);
```

`PRICING_APPROVAL_THRESHOLD`, `CLAIM_TTL_MINUTES` (default 60) and `SYNC_MAX_ATTEMPTS` are configuration, not code.

## 6. Sync rules with CargoWise

### Outbound — portal to CW1

On `PendingSync`, a job builds the priced-quote message and sends it, carrying the portal quote id in the reference field already used elsewhere. Idempotent on `(quote_id, version)` so a retry cannot create two CW1 quotes.

### Inbound — CW1 to portal

Three cases, all handled by the existing inbound handler:

| Case | Behaviour |
|---|---|
| Confirmation of our own priced quote | `sync_state = confirmed`, store `cw1_quote_ref`, state → `Quoted`, notify the customer |
| A quote priced in CW1 by someone who prefers CW1 | Adopted as today; appears in the portal queue already priced, `origin = cw1`. No duplicate work |
| CW1 sends different values after we priced | **CW1 wins.** Store CW1's charge lines, keep ours in `quote_price_event.snapshot`, set a `divergence` flag, notify the pricing user. The customer sees CW1's version |

Two guards carried over from the existing design: a reply whose organisation code no longer maps to the same customer is quarantined rather than applied; and every inbound message is deduplicated on the CW1 message id.

### The race that matters

Someone prices in CW1 while a portal user holds a claim. Handling: on inbound adoption, if the quote is in `Pricing` or `PendingApproval`, CW1's price is applied, the claim is released, and the pricing user gets a notification saying it was priced in CW1. No error, no lost work — their draft is in `quote_price_event`.

## 7. Claiming

- `POST /v1/internal/quotes/:id/claim` sets `claimed_by`, `claimed_at`, `claim_expires_at = now() + CLAIM_TTL`.
- The queue shows claimed items as taken, with who and since when. Claimed items are not hidden — visibility matters more than exclusivity.
- Release is explicit, or automatic at expiry via a scheduled job.
- `quote.price.edit` is refused unless the caller holds the claim. A supervisor with `quote.price.approve` can force-release, audited.

## 8. Cost and margin visibility

If §12 item 3 comes back as "cost is in scope", this becomes the most sensitive data in the platform. Rules:

1. `quote_charge_line.is_internal = true` lines and `cost_amount` are stripped in the **DTO mapper**, not in the query — one place, one test.
2. Customer-facing surfaces that must be covered: quote list, quote detail, quote PDF, grid export, report exports, notification emails, the external API, and the assistant in Phase 4.
3. A test asserts that a customer token receives no field named `cost_amount` and no line with `is_internal = true`, on every one of those surfaces.
4. Internal users without `quote.cost.view` are also refused — this is not only a customer rule.

## 9. Screens

**Internal pricing queue.** Columns: age, customer, mode, route, cargo summary, requested by, claimed by, branch. **Scoped to the user's branch** unless they hold `quote.price.crossbranch`. Filters: mode, unclaimed only, mine, and branch for cross-branch users. Sorted oldest first by default. The design must allow a request to be routed to another branch for its local charges later, without restructuring the queue.

**Pricing screen.** Left: the customer's request exactly as they submitted it, with attachments and their quote history — this is the thing CargoWise does not give them and the reason they might prefer the portal. Right: charge lines (code, description, basis, quantity, rate, currency, amount), totals per currency, validity date, carrier and service, transit estimate, remarks. Below: the **drafted customer email**, requested from the other team's service, shown as editable text with a template fallback; nothing is sent without an explicit action. Actions: save draft, submit, release.

**Approval screen.** The submitted quote read-only, with approve and reject-with-reason.

**Sync status.** A small banner on the quote: pending, confirmed with the CW1 reference, or failed with a retry action. Only internal users see it.

Nothing on the customer side changes except that a manual quote now becomes `Quoted` faster.

## 10. Jobs

| Job | Trigger | Does |
|---|---|---|
| `quote.sync.push` | On `PendingSync` | Sends the priced quote to CW1; retry with backoff; `SyncFailed` after N attempts |
| `quote.claim.expire` | Scheduled | Releases claims past `claim_expires_at` |
| `quote.sync.alert` | On `SyncFailed` | Ops notification with the failure reason |

All three are pg-boss jobs in the same process, enqueued in the same transaction as the state change (ADR-004).

## 11. Tests

1. Claim then a second user attempts to edit → 403.
2. Claim expiry returns the quote to the queue and releases the claim.
3. Submitter cannot approve their own quote → 403, and the DB check blocks a direct update.
4. Below threshold skips approval; above threshold requires it.
5. `PendingSync` is never visible to a customer; the customer still sees `InProgress`.
6. CW1 confirmation moves the quote to `Quoted` and notifies the customer once, not twice.
7. Divergent CW1 values overwrite ours, keep our snapshot, flag divergence, notify the pricing user.
8. CW1 prices a quote while a portal claim is held → CW1 wins, claim released, user notified, draft preserved.
9. Retrying the push job twice does not create two CW1 quotes.
10. A customer token receives no cost or internal charge lines on list, detail, PDF, export and API.
11. An internal user without `quote.cost.view` receives no cost lines.
12. Every new route declares a permission (existing lint test covers it).
13. A reply whose organisation code no longer maps to the same customer is quarantined.
14. A pricing user sees only their own branch's queue unless they hold the cross-branch permission.
15. The drafted customer email is editable and is never sent without an explicit user action; the flow completes with the template when the drafting service is unavailable.

## 12. What the business must confirm before build

| # | Question | Our assumption |
|---|---|---|
| 1 | Must every portal-priced quote also exist in CW1? | Yes — this is the whole basis of the design |
| 2 | Is there an approval step, and a value threshold above which it is required? | Yes, threshold configurable |
| 3 | Does pricing capture cost and margin, or only the sell price? | Sell price only, unless told otherwise — cost adds real risk and work |
| 4 | Who owns a request: the branch that owns the customer, or a shared queue? | Shared queue, filterable by branch |
| 5 | Quotes only, or bookings and exceptions later? | Quotes only for now — but knowing changes how much we build at once |
| 6 | Sponsor agrees the PRD non-goal is amended to allow this one operational task in the portal | Needed in writing |
| 7 | Will the pricing team actually use it? | To be confirmed with two of them directly, not assumed |

Item 7 is not a formality. A workspace the pricing team does not use is wasted effort, and the honest answer usually comes from the people doing the work rather than from management.

## 13. Slice breakdown

Sequenced after the customer quote flow, because there is nothing to price until customers can request.

| Slice | Delivers |
|---|---|
| **SP.01** Internal queue and claim (Phase 1 stage F1.08) | `quote` columns, `quote_price_event`, permissions, two preset roles, queue screen, claim and release, expiry job. Tests 1, 2, 12 |
| **SP.02** Pricing screen | Charge-line entry, totals, validity, save draft, submit. Customer request panel with attachments and history. Tests 4, 10, 11 |
| **SP.03** Approval | Threshold rule, approve and reject with reason, approver ≠ submitter. Tests 3, 4 |
| **SP.04** Write-back to CW1 | `quote.sync.push`, `PendingSync` and `SyncFailed` handling, confirmation inbound, customer notification. Tests 5, 6, 9, 13 |
| **SP.05** Divergence and races | CW1-wins rule, divergence flag and notification, CW1-priced-while-claimed handling. Tests 7, 8 |
| **SP.06** Hardening | Cost-leak test suite across every surface, ops alerting, queue performance at volume |

Each slice follows the standard order: database, shared types, API with tests, then screen.

## 14. What this does not include

- Rate management or rate lookup on screen (PRD non-goal)
- Pricing of bookings, or handling exceptions in the portal
- Any change to how customers experience the instant-quote path
- Any change to CW1's own screens or workflows
