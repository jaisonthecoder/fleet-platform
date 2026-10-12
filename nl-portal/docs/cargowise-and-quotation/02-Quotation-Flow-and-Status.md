# The portal quotation flow — status, claiming, manual pricing, publishing

| | |
| --- | --- |
| Version / date | 1.1 / 19.09.2026 |
| Covers | Slices C3, C4, C5, C8 |
| Parent | [README](README.md) |
| Aligned to | `REFERENCE/MOCKUP - Fright Forwarder Customer Portal/` — `Noatum Internal Workspace.dc.html` (staff pricing, queue, approvals, settings) and `Noatum Quote Request One Page.dc.html` (customer request) |

> **v1.1 — aligned to the mockups, 19.09.2026.** The screens are the specification for
> anything they show. Where this document guessed, it now follows them: the five stage names,
> a **4-hour** claim expiry rather than 24, publication mode, the approval threshold, and
> — the important one — **these are scoped settings, not global switches.** §6 has the detail.

---

## 1. The flow, end to end

```
customer                    staff                                   customer
--------                    -----                                   --------
fills in      →  REQUESTED  →  claims it      →  CLAIMED
                                 (name shown, 4 h)
                              types options   →  PRICED            (not visible yet)
                              [approves]      →  APPROVED          (only above the threshold)
                              publishes       →  PUBLISHED    →    sees the options
                                                                   accepts or declines
```

The five words in that column are the five stages the staff screen's stepper shows, in the same
order and with the same names.

Everything above **can** happen without CargoWise. A copy goes out at submit and at publish. Whether
publishing *waits* for CargoWise is the `pubMode` setting (§4) — `cw1` globally, `direct` where a
branch has overridden it, which is how the pilot branch runs.

---

## 2. C3 — Status, and who is working on it

### The status list

The five stage names are the staff screen's stepper, so the API and the screen say the same
words. The customer never sees the middle three.

| Status | Stepper label | Meaning | Set by |
| --- | --- | --- | --- |
| `draft` | — | The customer is still filling it in | Customer |
| `requested` | **Requested** · customer portal | In, and nobody has picked it up | Customer, on submit |
| `claimed` | **Claimed** · pricing, branch | **Claimed.** Someone owns it, and the screen names them | Staff, by claiming |
| `priced` | **Priced** · options and charge lines | Options typed. **Not visible to the customer** | Staff |
| `approved` | **Approved** · or "not required" | Checked by a second person, when the threshold demands it | Staff |
| `published` | **Published** · directly to customer | The customer can see the options | Staff, deliberately |
| `accepted` / `rejected` | — | The customer's answer | Customer |
| `expired` | — | Passed its validity | Scheduler |
| `withdrawn` | — | Pulled back | Either |

**`requested`, not `submitted`; `claimed`, not `in_progress`.** The stepper, the queue and the
customer's "what happens next" panel all use the first word of each pair. A second word for the
same state is how a screen and an API drift apart.

### What the database has today, and what C3 must change

`quote_status` in `schema.prisma` currently reads:

```
draft · submitted · quoted · pending_sync · rated · rate_failed
expired · accepted · rejected · withdrawn
```

So the whole staff half of the machine is missing. **C3 owns this migration**, and it is not a
rename in the Prisma file — a Postgres enum needs values added, rows moved, and the old values
retired in a second step.

| Change | How |
| --- | --- |
| Add `claimed`, `priced`, `approved`, `published` | `ALTER TYPE quote_status ADD VALUE` — **outside a transaction**, so these go in their own migration ahead of the data move |
| `submitted` → `requested` | Add `requested`, `UPDATE quote SET status='requested' WHERE status='submitted'`, then stop writing `submitted` |
| `quoted` | **Becomes `published`, not `priced`.** `quoted` already meant *the customer can see an answer*. Mapping it to `priced` would make every existing quote invisible to the customer who was already looking at it — a silent retraction, and the one genuinely dangerous row in this table |
| `pending_sync` | Retired. Sync state belongs to `integration_message`, not to the quote — a quote is not in a different *business* state because a message is queued |
| `rated`, `rate_failed` | Kept, unused, behind `quotations.instant_rate`. They are the seam for an engine that has no configured source |

**Do not drop the old values.** Postgres cannot remove an enum value without recreating the type,
and a `quote` row written before the migration must still read. They stop being written; they do
not stop existing. The status machine refuses them as *sources* of any transition except the ones
above, which is what actually retires them.

### Allowed moves

```
draft      → requested, withdrawn
requested  → claimed, withdrawn, expired
claimed    → priced, requested (released), withdrawn, expired
priced     → approved, published, claimed (reopened), withdrawn, expired
approved   → published, priced (sent back), withdrawn
published  → accepted, rejected, expired, claimed (re-priced)
accepted · rejected · expired · withdrawn → terminal
```

`priced → published` skips `approved` when approval is off **or when the quote is under the
threshold** — which is why the stepper renders that stage as "not required" rather than hiding it.

### Who is working on it

`claimedById` and `claimedAt` on the quote, released automatically on `published`, `withdrawn` or
`expired`.

- **Claiming is always available** — no switch. It answers "who is dealing with this", which is
  useful whether or not CargoWise exists.
- Claim with **one conditional update and a row-count check**, returning **409** naming the holder.
  Never read-then-write.
- **A claim expires after 4 hours, not 24.** The screen states it to the person claiming —
  *"Claiming locks it for you; the claim expires after 4 hours if nothing is submitted"* — and the
  customer is told the same on the request page. It is the `claimExpiry` setting (§6), so the value
  is read per branch, never hard-coded. The expiry is applied in the same `WHERE` clause as the
  claim, so a forgotten claim frees itself with no scheduler and no administrator.
- **Force-release is a named capability**, not a generic override. The `releaseBy` setting decides
  whether pricing approvers or only administrators may take someone else's claim, and every
  force-release is audited. The screen offers **Release claim** to the holder, and force-release to
  whoever `releaseBy` allows.
- Pricing an unclaimed quote **claims it implicitly**. One click, not two.
- **Internal only.** The holder's name never reaches a customer response, export or notification.

### What each side sees

| | Staff | Customer |
| --- | --- | --- |
| `requested` | "Unclaimed" in the queue | "We have your request" |
| `claimed` | "**Maria Lopez** since 14:20", expires in 4 h | "A specialist is working on it" |
| `priced` / `approved` | Full options, charge lines, margin | **Still "we are working on it"** |
| `published` | Sent 19.09.2026 | The options, and a decision to make |

The customer is never shown a name or an internal state. A half-finished answer is invisible to them
by construction, not by a screen hiding it.

### The customer's own vocabulary — two presentations, one status

**The customer screens do not reuse the staff words, and must not be made to.** They show the same
`status` column twice over, at two grains, and neither grain is the internal one.

**A coarse badge**, on the quote list:

| Internal status | Customer badge | Tone |
| --- | --- | --- |
| `requested` | Requested | neutral |
| `claimed` · `priced` · `approved` | **In progress** | info |
| `published` | **Quoted** | success |
| `accepted` · `rejected` · `expired` · `withdrawn` | The plain word | per outcome |

Three internal states collapse into *In progress*. That collapse **is** the confidentiality
control: the customer cannot tell a priced-but-unpublished quote from an unpriced one, so a
half-finished price cannot leak through a badge.

**A five-step stepper**, on the quote detail — and its last two steps are *not* the staff stepper's:

| # | Customer sees | Staff equivalent |
| --- | --- | --- |
| 1 | Requested · *you, via portal* | `requested` |
| 2 | Claimed · *pricing specialist* | `claimed` |
| 3 | Priced · *options prepared* | `priced` |
| 4 | **Confirmed · *in our operating system*** | **The CargoWise confirmation, not the internal approval** |
| 5 | **Ready for you · *compare and accept*** | `published` |

> **The trap.** Both steppers have five steps, so they look like the same list. They are not.
> Step 4 for staff is `approved` — our own four-eyes check. Step 4 for the customer is CargoWise
> confirming. **The internal approval is invisible to the customer at every grain**, which is
> correct: whether two Noatum people checked a price is not the customer's business, and showing it
> would invite the question "who was the second person".
>
> A single shared stepper component driven by `status` would therefore be a privacy defect, not a
> tidy-up.

When `pubMode = direct`, step 4 has nothing behind it. It is still drawn, and it completes with
publication — the customer is not shown a branch's internal configuration by having a step vanish.

The detail page also carries an **activity log**: *"Claimed by pricing team · 09.09.2026 09:10 ·
Noatum Valencia"*. Note what it names and what it does not — **the branch, never the person.**

### Versions

`Q-2026-0187 · version 2`. The customer sees a version number, so re-pricing a published quote is
**not** a silent replacement.

- `version` is a column on `quote`, incremented when an already-`published` quote is re-priced.
- Re-pricing a quote that was never published edits version 1 in place. Nobody outside has seen it,
  so there is nothing to supersede.
- The previous option set stays in the audit record either way. The version number is what makes
  the change *visible*; the audit is what makes it *provable*.
- The customer's acceptance names a version. Accepting version 1 after version 2 was published is
  refused with 409, not quietly upgraded.

---

## 3. C4 — Manual pricing, like a spreadsheet

**The design instruction: it must feel like typing into Excel.** Anything that makes a person stop
and look up a code has failed.

### What a person types

A quote carries **one or more options**. Per option, every field optional except an amount or a
document somewhere on the quote:

| Field | Type |
| --- | --- |
| Option name | Free text — "Weekly direct", "Economy via Singapore" |
| Carrier name | **Free text.** No catalogue, no picker |
| Service / routing | Free text |
| Transit days, from–to | Numbers |
| Next departures | Free text — the screen shows "Tue, Fri" |
| Free time at destination | Number, days |
| Total and currency | A number and a code |
| Valid until | A date, pre-filled from the `validity` setting |
| Recommended to customer | A toggle. One option may be marked |
| **Charge lines** | See below |
| Notes | What the customer reads for this option |
| **Quotation terms** | Included · Excluded · Payment terms · Subject to — four free-text blocks per option |

Plus one `messageToCustomer` covering the whole answer, which the screen labels *"Draft · editable
· sent only when you confirm"*. It is never sent by the act of saving.

### Charge lines

The staff screen prices with a small grid, because that is how the job is actually done:

| Column | Type | Who sees it |
| --- | --- | --- |
| Code | **Free text.** A hint list, never a validated catalogue | Internal |
| Description | Free text | **Customer** |
| Basis | Free text with suggestions — per container, per shipment, per B/L | **Customer** |
| Qty · Rate · Currency · Amount | Numbers and a code. Amount = qty × rate, computed **by the API** | **Customer** |
| **Cost (internal)** | A number | Internal only |
| **Margin %** | Derived from sell and cost | Internal only |

The option total is the sum of its lines, computed server-side. The browser never owns a figure
that also appears on a PDF.

**Cost and margin are doubly closed.** They exist only when the `costCapture` setting is on
(§6, default **off**), and even then only for a user holding `quotes.cost.view`. They are absent
from the customer DTO as a matter of shape, not of filtering — the screen's own footnote says
*"Cost and margin are internal and never shown to the customer"*, and a field that is merely hidden
still ships in JSON.

### What is deliberately absent

No rate lookup. No tariff table. **No charge-code validation** — the code column is free text with
a hint list, which is what makes it feel like a spreadsheet. No automatic comparison or ranking. No
cost or margin unless a branch has deliberately turned capture on. No mandatory field beyond "there
must be an answer of some kind".

> **We are not allowed to work out a price. We are entirely allowed to record one a person typed,
> to arithmetic the lines they typed, and to offer a choice between several.**

### The rule that expresses "no fixed format"

> A quote may become `priced` with **an amount**, or with **at least one customer-visible
> document**, or **both** — never with neither.

Some branches answer with their own PDF. That is a valid answer and the portal accepts it.

### Behaviour

- `POST /v1/quotes/:id/price` — body `{ options[], recommendedIndex?, messageToCustomer? }`
- Re-pricing **replaces** the option set; the previous set is kept in the audit record
- `quote.totalMinorUnits`, `currency`, `validUntil` mirror the recommended option, written by the
  same method, so they cannot drift
- Behind `quotations.portal_pricing`, **default true** — this is now the main path
- `quotations.multi_option`, default true. With it off, more than one option is **refused with 400**,
  never silently truncated. The database shape is identical either way, and quotes already priced
  with several options keep showing all of them

---

## 4. C5 — Publishing

A separate, deliberate action. `POST /v1/quotes/:id/publish`, permission `quotes.publish`.

### What it does, in one transaction

1. Status → `published`, `publishedById` and `publishedAt` recorded
2. The claim is released
3. A customer notification is **queued** — never sent inline
4. An outbound row is written for `quote.priced.submit`, status `pending`

### Guards

- Refused unless the quote is `priced`, or `approved` when approval applies
- Refused if there is neither an amount nor a customer-visible document
- Refused if the validity date has already passed — publishing something already expired helps
  nobody
- Emits an audit record and an analytics event

### Publication mode — the setting that decides whether we wait

The screen calls it **Publication mode**, and it has two values:

| `pubMode` | What publishing does |
| --- | --- |
| `cw1` | **CW1 confirmation required.** Submit the pricing to CargoWise and publish after business confirmation |
| `direct` | **Direct customer publication.** Publish the completed offer without waiting for CargoWise |

**This answers PRD OQ-27**, and it answers it as a *scoped setting* rather than a global flag,
which matters: the mockup's own settings log records
*"Publication mode · Branch ESVLC · CW1 confirmation → Direct to customer"* with the reason
*"CW1 quote write-back not yet live for ESVLC pilot"*. One branch goes direct while the rest of the
region waits. A single boolean cannot express that, which is why §6 exists.

The global default is `cw1`; the pilot branch overrides to `direct`. **Internal approval still
applies either way** — publication mode decides who else must agree, never whether we check
ourselves.

---

## 5. C8 — The approval step

CargoWise has an approval step, so the portal offers one. Two settings govern it, and both are
scoped (§6).

| Setting | Default | Meaning |
| --- | --- | --- |
| `approval` | on | A different authorised approver must approve submissions above the threshold |
| `threshold` | EUR 10,000 | Evaluated on the **highest option sell total**, converted to EUR at the daily rate |

The mockup sets the global threshold to EUR 10,000 and the Iberia region to EUR 15,000 — the same
key, a different answer per region. **This answers OQ-11**: there is a threshold, it is a number an
administrator sets, and it is not a value band or a routing rule.

- `POST /v1/quotes/:id/approve`, permission `quotes.approve`
- `POST /v1/quotes/:id/send-back`, with a mandatory reason, returning it to `priced`
- **The approver may not be the pricer.** The Approvals screen says so on its face:
  *"You cannot approve your own pricing."* There is no self-approval permission
- Under the threshold, `priced → published` is allowed directly and the stepper shows the approval
  stage as **"not required"** — the stage is never hidden, because a person needs to see that it was
  considered and skipped
- `approvedById` and `approvedAt` already exist as columns and finally get a reader

---

## 6. Settings, not switches

> Decided in [ADR-010 — Scoped settings, alongside platform switches](../adr/ADR-010-scoped-settings.md).
>
> **The correction this section exists to record.** These behaviours were first designed as entries
> in the global `feature_switch` catalogue. The settings screen shows that they are not: every one
> of them resolves through **four layers**, and a global on/off cannot express "CW1 write-back is
> live everywhere except the pilot branch". CLAUDE.md's own boundary decides it — *if it needs a
> scope, it is a setting, not a switch.*

### The layers

```
Global  →  Region  →  Branch  →  Customer
```

Most specific wins. A layer that says nothing inherits, and the screen shows **which layer supplied
the effective value** ("inherited from Global", "override at ESVLC") — so the API must return the
source alongside the value, not just the answer.

### The catalogue

| Key | Type | Global default | Governs |
| --- | --- | --- | --- |
| `pubMode` | enum `cw1` \| `direct` | `cw1` | How a priced offer reaches the customer (§4) |
| `sendReqCw1` | bool | on | Create the quote request record in CW1 when the customer submits |
| `fourEyes` | bool | on | Second-person confirmation of organisation links (D-13) |
| `approval` | bool | on | Internal approval required above the threshold |
| `threshold` | number, EUR | 10,000 | The approval threshold |
| `claimExpiry` | number, hours | **4** | An unsubmitted claim is released automatically after this |
| `releaseBy` | enum `approver` \| `admin` | `approver` | Who may force-release another user's claim |
| `costCapture` | bool | **off** | Staff may record internal cost per charge line |
| `disclose` | bool | off | Show the carrier name to the customer, else "disclosed on booking" |
| `validity` | number, days | 21 | Default quote validity, pre-filled per option |
| `draftSvc` | bool | on | Use the external drafting service for the customer message |
| `co2` | bool | off | CO₂ estimate on quote options, pending OQ-20 |

### Rules that hold for all of them

- **The catalogue is code; the values are data.** An administrator sets a value at a layer. Nobody
  invents a key.
- **The API is the control.** A setting that changes a *response* must make the service omit the
  data, not merely stop the screen drawing it. `costCapture` off means cost and margin are absent
  from every payload.
- **Every change is audited with a reason.** The settings log in the mockup records when, who, what,
  the before→after, and why. That log is the feature, not decoration.
- **A setting changes behaviour, never schema.** `costCapture` going off does not drop a column, and
  costs already recorded stay recorded.
- **`costCapture`, `disclose` and `co2` default off** because each needs a sign-off the business has
  not yet given.
- Permissions remain separate and stricter: `costCapture` says the organisation may record cost;
  `quotes.cost.view` says *this person* may see it. Both must be true.

---

## 7. Tests to write, and leave unrun

**Status and claiming**

- Every allowed move, and a forbidden one for each status
- Two simultaneous claims: one 200, one 409 naming the holder
- A claim past `claimExpiry` can be taken by someone else, and the value is read from the setting —
  a test that hard-codes 4 hours proves nothing about the resolver
- Force-release is refused to a user the `releaseBy` setting excludes, and audited when allowed
- A customer response never contains the holder's name or an internal status

**Pricing**

- A quote reaches `priced` with an amount only, a document only, both — and is refused with neither
- Re-pricing replaces the options and keeps the old set in audit
- The headline figures match the recommended option
- Charge-line amounts are computed server-side; a client-supplied amount that disagrees with
  qty × rate is ignored, not trusted
- **With `costCapture` off, cost and margin are absent from every payload** — asserted on the JSON,
  not on the screen
- With `costCapture` on but without `quotes.cost.view`, they are still absent
- With `multi_option` off, a second option is refused with 400

**Publishing and approval**

- A `priced` quote publishes; a `requested` one is refused
- With `pubMode = cw1`, publishing parks the quote until CargoWise confirms
- With `pubMode = direct`, publishing succeeds **while the CargoWise transport is held**, and the
  outbound row is `pending`
- A quote above `threshold` cannot publish without approval; one below publishes directly
- The pricer cannot approve their own quote
- The customer sees the options only after publishing
- The notification is queued, never sent inline

**Setting resolution**

- A branch override beats the region, which beats the global
- The resolved value reports **which layer supplied it**
- Changing a setting writes an audit row carrying the before, the after and the reason

**Permissions and tenancy**

- 403 for a customer token on claim, price, approve and publish
- One tenant-isolation test per new table
- One test per new switch, proving the API refuses from the guard when it is off
