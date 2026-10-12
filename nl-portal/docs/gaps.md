# Gaps and proposals register

Two lists. **A — Gaps**: things the platform needs that PRD v2.1 does not specify. **B — Proposals**: things we introduced beyond the PRD that need sponsor sign-off. Nothing here is built as "decided" until the Status column says so.

## A. Gaps in the PRD

| # | Gap | Where it surfaced | Interim decision | Owner | Status |
|---|---|---|---|---|---|
| 1 | Public T&T when a reference matches shipments of several customer groups | S2.03, KB-CW1 §8 | Identical minimal response regardless of match count; never reveal parties or count | Product | Open |
| 2 | Sailing-schedule data provider for FG-9.2 | S3.05 | None named; adapter interface only | IT + Ops | Open |
| 3 | Virus scanning and size limits for customer document uploads (FG-3.2) | S2.04, S3.03 | 25 MB limit, Defender for Storage scan before CW1 transfer | IT security | Open |
| 4 | Which CW1 party roles grant visibility (notify party?) | KB-CW1, LLD §7 | Global policy: local client, shipper, consignee | Product + Ops | Open |
| 5 | CW1 organisation code format (case, length, characters) and client/carrier category flag | LLD §3.2, §5.3 | Permissive regex, case-insensitive uniqueness | CW1 team (request items 3, 4) | Open |
| 6 | Human-in-the-loop for the AI data-quality merge in FG-1.3 | S2.10 | Provenance + override with reason (platform principle) | Product | Open |
| 7 | Rate-selection contract between the portal and the designated rate engine (OQ-1) | S1.09 | `RateEngineAdapter.price(request) → options[]`; portal stores what it receives | Pricing + IT | Open |
| 8 | Retention period for deactivated users and audit records | LLD §8.6 | 730 days, erasure job in Phase 2 | Legal | Open |
| 9 | Customer SSO federation | LLD v3 §8 | Configured in Entra External ID (federation), no code of ours in any phase | IT | Closed |
| 10 | Region master data for news targeting (FG-4.5 global/country/region) | S1.06 | Seeded region table, editable | Product | Open |
| 12 | Whether the integration team can supply API or test access early, which would reduce or remove the simulator (OQ-2a) | Integration team | Simulator scope only — platform is indifferent | Open |
| 11 | CO2 methodology, provider and disclaimer (OQ-11); re-verify provider landscape at Phase 4 start | KB-CO2 | Local GLEC factors labelled "estimate" | Sustainability + Legal | Open |

## B. Proposals beyond the PRD

| # | Proposal | Documents | Recommendation | Owner | Status |
|---|---|---|---|---|---|
| P1 | Second-person approval for org-code mapping | ADR-003, LLD v3 §6.2 | **v3: not built.** Linking is one audited action with a confirm dialog; `approved_by` column is the seam. Build the approve step only if Mohamed asks | Mohamed | Open |
| P2 | Impersonation read-only | ADR-003, LLD v3 §10 | **v3: always read-only**, no toggle | — | Accepted |
| P3 | Per-customer visibility policy overrides | KB-CW1 §5.2 (v1) | Deferred; global policy only | — | Deferred |
| P4 | Customer hierarchy deeper than two levels | Design v1 | Reduced to parent → children per PRD FG-8.1 | — | Closed |
| P5 | Bulk invitation by CSV | Design v1 | Deferred to Phase 2 backlog | Product | Deferred |
| P6 | GDPR erasure job | LLD §8.6 | Phase 2 (retention period pending Legal) | Legal | Deferred |
| P7 | Public "Request access" form | Design §5.7 | **UI built 16.09.2026** on the public landing page, posting to `POST /api/public/access-request`. No such route exists: an in-browser stand-in answers it. Still needs the endpoint and the decision on whether it raises a ticket | Mohamed | Open — see P12 |
| P8 | Nightly visibility consistency sweep | LLD §7 | Job skeleton, scheduled off until Phase 2 | — | Gated |
| P9 | Per-customer login slug / local MFA accounts | LLD v2 §8.5 | **v3: removed** — Entra External ID handles local accounts and MFA | — | Closed |
| P10 | Own CO2 factor table instead of a paid provider (Phase 4) | KB-CO2 §7 | Proposal; depends on OQ-11 | Sustainability | Open |
| P11 | Internal quote pricing inside the portal, with write-back to CargoWise | Design-Internal-Quote-Pricing-in-Portal.md | **New business request after PRD v2.1.** Changes the stated non-goal about operational workflows, so it needs sponsor sign-off in writing. Design proposes CargoWise remains the record and wins all conflicts. Seven confirmations open in §12 of that note | Mohamed | **Pending sign-off** |
| P12 | Public landing surfaces: track and trace, hero counters, CO2e estimate, access request | PRD FG-9, Security rules; `Noatum Landing Public.dc.html` | **UI built 16.09.2026 against four endpoints that do not exist** — `/api/public/landing`, `/api/public/tracking`, `/api/public/emissions/{reference,estimate}`, `/api/public/access-request`. The SPA calls them over HTTP; `src/api/public/mock` answers as a stand-in, enabled only by `VITE_PUBLIC_API_MOCK=true`, so no deployed build can show a sample shipment. Needs a slice: rate limiting, bot protection, and the rule that these responses reveal no addresses, documents, financials or which customer groups exist. Contracts are hand-written in `src/api/public/contracts.ts`, now parsed with zod at the transport, and must be replaced by generated types. **Copy decision open:** the design's rates panel reads "Indicative rates without an account / Search rates", which v4 rule 1 says cannot exist — the control now opens the access-request form, but the wording needs Product. **Security question ANSWERED 18.09.2026:** the tracking contract carries `eta`, `etaRevised` and `progressPct`. The product owner chose to carry **both** ETA sources and decide by configuration: `tracking.public_eta_carrier` (**on** — the carrier's own published figure) and `tracking.public_eta_predicted` (**off, requires approval** — anything we compute, including `etaRevised` and `progressPct`). Every ETA stores its source; the public surface filters on that field rather than guessing at render time; and when the computed switch is off the service **omits** the fields rather than hiding them. Full design in `plans/Remediation-Plan-Foundation-Gaps.md` §R9.1 | Product + Digital Products | **Open — the page is a prototype until the endpoints land** |

## C. Closed by the KT session of 09.09.2026

| # | Item | Outcome |
|---|---|---|
| 1 | Public critical-milestone set | Picked up, departed, ETA, arrived, delivered; loaded-at-export and unloaded-at-import for sea |
| 4 | Which party roles grant visibility — partly | Financial visibility resolves from the transaction addressee only. Shipment visibility policy still open, now including whether notify party counts (OQ-3b) |
| — | Carrier visibility provider | Not required: carrier data arrives through CargoWise's own carrier integrations. Provider stays optional |
| — | Booking cancellation gate | Blocked after pickup or off-site delivery; hard stop at the Shipped event |
| — | Portal roles versus CargoWise roles | Independent, explicitly agreed |

## D. New, from the KT session of 09.09.2026

| # | Item | Why it matters | Owner | Status |
|---|---|---|---|---|
| N1 | **Are shipment and invoice parties stored as organisation codes or address codes?** Addresses beneath an organisation each carry their own code | Tenant resolution matches organisation codes today. If parties carry address codes, resolution needs the address-to-organisation relationship in the master-data feed | CW1 team | **Open — highest technical risk.** 15.09.2026: the schema (doc 12 §2.8.1, ADR-007) shows **both codes are optional**, so a party may arrive with neither. One real shipment XML with a party block closes this and supplies the `AddressType` values to seed the mapping |
| N2 | Cross-trade billing means a notify party can be the paying customer. Should notify party grant shipment visibility, or only financial visibility through the addressee? | Current policy excludes notify party, so a cross-trade customer would not see their shipment | Product + Ops | Open |
| N3 | Categorised critical-path event list per mode, and the confirmed internal-only exclusions, from roughly 664 generic events | Event mapping in Phase 2 | Ops + Digital Products | Awaited |
| N4 | Document-type list with categories, and the confirmed customer-facing allow-list | Document visibility in Phase 2; typing is manual and unvalidated | Ops + Digital Products | Awaited |
| N5 | How a customer raises a claim today, and where staff re-key between systems | Phase 3 claims scope | Digital Products | Awaited |
| N6 | Head of Pricing appetite for pricing inside the portal; whether cost and margin are captured | Phase 1 stage F1.08 | Sponsor + Head of Pricing | Awaited |
| N7 | Whether the standardised quotation process starts with regions newly onboarding to CargoWise rather than retrofitting existing ones | Rollout order, not the build | Ops + Product | Open |
| N8 | Interface contract and availability of the AI email drafting service | Polish only; template fallback covers it | Digital Products | Awaited |
| N9 | Whether the master-data programme will supply organisation hierarchies, and when | Manual grouping is pluggable meanwhile | MDM programme | Open |
| N10 | Rate storage today, and whether an assisted rate suggestion is feasible from any existing source | Instant path only | Business + Digital Products | Open |
| N11 | The `AddressType` value list actually used on Noatum's shipment parties | ADR-007 puts these in `mapping_entry` under `cw1_address_type`. An unmapped value fails closed, so track and trace cannot display parties until the list is seeded | CW1 team | Open — arrives with the N1 sample |
| N12 | Is the **servicing office** meant to drive anything, or is it reference only? It blocks no transition and nothing routes off it today; the pricing queue is scoped by the *staff* user's branch, not the customer's | It is one of six onboarding checklist rows. A checklist item that blocks nothing trains people to ignore the checklist | Product + Ops | Open — raised 15.09.2026 |

## E. Implementation gaps found by code review, 17.09.2026

These are not gaps in the PRD. They are gaps between what our own documents claim and what
the code does, found by reading the source rather than the documents. The full register,
with evidence per row and severity, plus a prioritised plan and ready-to-paste task prompts,
is in [`plans/Remediation-Plan-Foundation-Gaps.md`](plans/Remediation-Plan-Foundation-Gaps.md).

| Area | Headline finding | Severity |
| --- | --- | --- |
| Adapters | Six of the eight ports named in foundation rule 2 do not exist; `RateEngineAdapter` is in the wrong module; `Cw1ShipmentAdapter` has no port above it | Breaks a foundation rule |
| Quote write-back | **No code exists** for writing a priced quote to CargoWise — the Phase 1 commitment | Claim untrue |
| Job queue | `enqueue()` has no callers; no scheduler; the organisation import runs inline from an HTTP request | Breaks a foundation rule |
| Integration | ~~No `integration_message` table~~ **closed 18.09.2026 (C1)** — the table, the recording service and the relay exist. The inbound HTTP door and replay are still to come (C7) | Partly closed |
| Quotes | `create()` discards validated fields; `accountId` accepted without an ownership check; reference allocation races; no status machine | Tenancy and correctness |
| Customers | ~~Audit rows written with a null customer; go-live counts any user as an administrator; suspending a customer locks nobody out~~ **All three closed 18.09.2026 (R5 part, R6)** | Closed, verification pending |
| Cross-cutting | ~~Login rate limiting is per process~~ **closed 18.09.2026 (R2)**; `AnalyticsEvent` is still never persisted and has no table | Partly closed |
| **Deployment** | ~~The `pgboss` schema and its grants are created only by a CI one-liner.~~ **Closed 19.09.2026.** `scripts/install-jobs-schema.mjs` installs the schema as the owner, grants the runtime role, and **verifies the grant landed** rather than trusting the statements ran. Wired into `db:setup` and the pipeline. Proven by dropping the schema and booting the built API: job runner started with 6 handlers, zero errors | Closed |
| **Feature switches** | ~~The UI cannot read a switch.~~ **Closed 17.09.2026** — `/api/me` now returns `features`, and the SPA has `useFeature(key)` | Closed, verification pending |
| **Analytics** | ~~`AnalyticsEvent` is never persisted and has no table.~~ **Closed 19.09.2026** — `analytics_event` table, append-only with an internal-read policy, a retention function, and `AnalyticsService` wired into the four services that previously only logged | Closed |
| **Scoped settings** | ~~The resolver existed with no write path: no endpoint, no screen, so every value sat at its code default and the mockup's pilot-branch override was impossible. The region layer was unreachable because nothing supplied a region.~~ **Closed 19.09.2026** — see F6 | Closed |

### E1. Feature switches readable by the UI — raised and built 17.09.2026

Foundation rule 4 requires the UI to hide a control by reading the **same key** the API
enforces. It could not: the only reader was `GET /api/admin/feature-switches`, behind
`admin.flags.manage`.

**What was built**

1. `FeatureSwitchService.enabledKeys()` — the catalogue merged with the stored
   `feature_switch` rows, filtered to those that are on.
2. `CurrentUserDto.features: string[]`, returned by `GET /api/me`. One round trip the SPA
   already makes on load, and it cannot drift from the guard because both read the same
   catalogue and the same rows.
3. `useFeature(key)` and `hasFeature(user, key)` in `src/shared/features/useFeature.ts`,
   mirroring the existing `permissions.includes(...)` pattern.
4. First consumer: the lookups **New type** button, gated on `lookups.type_creation` — the
   key its API route already enforced, so the screen and the guard now agree.

**Fails closed.** If the API omits `features`, the SPA treats it as empty, hiding optional
controls rather than offering ones the guard would refuse.

**What is still open.** Customer entitlements (`customerGroup.feature_flags`) remain
unwired — `resolveFlags()` in `contracts/feature-flags.ts` has **no callers anywhere**. So
`features` today carries platform switches only. Wiring entitlements is a separate piece of
work and is what would let a *customer-facing section* be hidden per customer.

---

## F. Gaps found by reading the UI mockups, 19.09.2026

Found by comparing our quotation design against
`REFERENCE/MOCKUP - Fright Forwarder Customer Portal/` — the staff pricing screen, its queue,
its approvals page and, decisively, its **Platform · Quotation settings** screen. These are
gaps between our design and the product the business has already drawn, so the screens win.

Alignment is applied in
[`cargowise-and-quotation/02-Quotation-Flow-and-Status.md`](cargowise-and-quotation/02-Quotation-Flow-and-Status.md);
the mechanism is decided in [ADR-010](adr/ADR-010-scoped-settings.md).

| Finding | What we had | What the screens show | Status |
| --- | --- | --- | --- |
| **Scoped settings do not exist** | Two layers: global switch, customer entitlement | Twelve settings resolving **Global → Region → Branch → Customer**, each showing which layer supplied the value | **New build. ADR-010.** Table, resolver, screen and audit are C3 work |
| Claim expiry | `QUOTE_CLAIM_TTL_HOURS`, default **24**, a config constant | **4 hours**, stated to the person claiming *and* to the customer, set per scope | Design corrected |
| Status vocabulary | `submitted`, `in_progress` | `Requested`, `Claimed` — and the stepper shows five stages by name | Design corrected |
| Force-release | A generic `quotes.claim.override` | A `releaseBy` setting naming **approvers or administrators**, always audited | Design corrected |
| Approval threshold | "No threshold. When OQ-11 is answered, it goes here" | **EUR 10,000 global, EUR 15,000 Iberia**, on the highest option sell total in EUR | **OQ-11 answered** |
| Publication mode | A `publish_requires_cw1_confirmation` switch, default off | `pubMode` = `cw1` \| `direct`, overridden **per branch**, with a logged reason | **OQ-27 answered** |
| Cost and margin | "Deliberately absent" | Per charge line, behind the `costCapture` setting, **default off**, plus `quotes.cost.view` | Design corrected — and the two positions reconcile |
| Charge lines | "Free-form rows: description, amount" | A grid: code, description, basis, qty, rate, currency, amount | Design corrected |
| Quotation terms | Not modelled | Included · Excluded · Payment terms · Subject to, **per option** | Added to C4 |
| Option fields | Label, carrier, transit days | Also **next departures** and **free time at destination** | Added to C4 |
| Carrier disclosure | Not modelled | `disclose` setting — otherwise "disclosed on booking" | Added. Relates to OQ-9 |
| Default validity | A fixed constant | `validity`, 21 days, pre-filled and shortenable per option | Design corrected |
| **Customer stepper ≠ staff stepper** | One status, assumed one presentation | Customer step 4 is **"Confirmed · in our operating system"** (CargoWise), *not* the internal approval. Both have five steps, which is what makes it a trap | Design corrected — a shared stepper component would be a **privacy defect** |
| Customer badge grain | Not modelled | `claimed` · `priced` · `approved` all collapse to **"In progress"** — the collapse is the confidentiality control | Added to C3 |
| Quote versions | "Re-pricing replaces the options; the old set goes to audit" | The customer sees **`version: 2`**. Re-pricing a *published* quote supersedes it visibly | **New column.** Acceptance must name a version |

### F1. The one that changes an existing rule

The first row is the only architectural finding; the rest follow from it. CLAUDE.md rule 4
describes **two** layers, and the settings screen needs **four**. Rather than widen feature
switches — which would give every switch four nullable scope columns it will never use — ADR-010
adds settings as a second, separate mechanism and states how the two compose.

Nothing already built is invalidated. The switch catalogue in
`contracts/feature-switches.ts` keeps all five of its current entries; none of them needed a
scope, which is why they were right as switches.

### F2. The tension this resolves rather than creates

The director's instruction of 17.09.2026 was that quotation stays **light** — no cost or margin
modelling. The staff screen shows cost and margin columns. These are not in conflict once
`costCapture` is read properly: it is **off by default**, so the shipped product has no cost or
margin, and a branch that wants it turns it on. We still model nothing and derive nothing; we
record numbers a person typed and subtract two of them. The cap holds.

**Still requiring sign-off:** the numbers themselves — 4 hours, EUR 10,000 / 15,000, 21 days.
They are defaults in a table, so confirming them is a configuration change rather than a code
change.

### F3. A quote has no branch of its own

Found while building the C3 pricing queue. The queue is branch-scoped — the mockup heads it
*"Pricing queue · Valencia"* — but `quote` carries no branch column, so the servicing branch is
resolved through a lookup: the quoted account's servicing branch, falling back to the customer's
default servicing branch when the request named no account.

That works, and it is the right default. It is **wrong for one real case**: a customer group
served by more than one branch, where a particular request should sit in a queue other than the
group's default. There is no way to express that today, and no way for an operator to move a
request between queues.

Not fixed in C3, because the fix is a column plus a re-assignment action plus an audited move,
and none of that is "status and who is working on it". Proposed as a small slice of its own.

### F4. Two defects this slice found in itself

Recorded because both are recurring shapes, not one-offs.

1. **A compiling Prisma `where` clause proves nothing.** The first branch filter read
   `group: { branchCode }`. `CustomerGroup` has no such field — it has `defaultServicingBranchId`
   — and `tsc` passed anyway. Caught only by writing a test that asserted a row came back.
   *Any nested Prisma relation filter needs a test that returns data, not a typecheck.*
2. **An early return outranked the tenancy check.** `queue()` returned `[]` for a branchless
   user before `runInternal` ever ran, so a customer session got a silent empty list instead of a
   403 — indistinguishable from "no work today". The staff-only assertion now happens before any
   exit path. *Guard at the entrance, not at the transaction.*

### F5. Three more, found by critiquing C4

1. **Pricing a quote destroyed the request it was answering.** `price()` wrote the pricer's
   covering message into `quote.notes` — which is the **customer's own remarks to the pricing
   team**, captured at request time. The text the pricer was reading in order to answer was
   overwritten by the answer. Fixed with a separate `message_to_customer` column; both columns now
   carry a comment saying whose words they are.
2. **Prices could round themselves.** `quantity * rateMinorUnits` as JavaScript numbers exceeds
   `Number.MAX_SAFE_INTEGER` at the top of the range the schema accepts, so a large charge would
   have been silently rounded. Now computed in `BigInt` with the quantity scaled by 1000.
3. **Staff identities reached the customer.** The customer projection stripped `claimedById` but
   not `pricedById`, `approvedById` or `publishedById`. Naming the second approver would invite
   precisely the conversation four-eyes exists to prevent. All of them go now, along with the
   verbatim `rateResponse`.

None of these were caught by typecheck or lint. All three were caught by asking, of each write,
*whose data is this*.

### F6. Finishing what C3 started — 19.09.2026

Raised by the user, and fairly: the scoped-settings mechanism had been reported as delivered when
**half of it did not exist**. The catalogue, the table, the RLS and the resolver were real; there
was no endpoint, no screen, and nothing that could change a value. Every setting therefore sat at
its code default, and the pilot-branch override the business had already drawn in its own mockup
was impossible to perform.

Worse, the **region layer was unreachable**. `SettingContext` accepted a region and the resolver
honoured it, but nothing in the running system ever supplied one — so the four-layer hierarchy was
really two, and the mockup's Iberia threshold of EUR 15,000 above a global EUR 10,000 could not
happen at all. Tests passed because they supplied the region by hand.

| Closed | How |
| --- | --- |
| Region unreachable | Both identity functions now project `region_code` from the user's branch, carried on `TenantContext`. `SettingsService.scopeOf(actor)` builds the full scope in one place, so no call site can forget a layer again |
| No write path | `SettingsAdminService` + `/api/admin/settings`: list with effective value and every override, set, clear, and a change log. Behind `admin.settings.read` and `admin.settings.manage`, which already existed and were unused |
| No screen | `SettingsPage` with a scope picker, grouped list showing which layer supplied each value, and a drawer requiring a reason. EN and ES strings |
| SPA could not read a setting | `/api/me` returns the caller's resolved settings; `useSetting(key, fallback)` mirrors `useFeature` |
| Cache could go stale across instances | The per-process cache is **removed**. `resolve` does one indexed read; `resolveAll` does one read for every key. A stale setting on one instance is a branch quietly running the wrong rules |

**Also closed in the same pass**, because both were long-standing and both were mine to finish:
the pg-boss deployment blocker and the unpersisted `AnalyticsEvent`. See the table in section E.

**The lesson, recorded plainly.** A mechanism without its write path is not a slice, it is a
half-built thing that reads as complete in a summary. "Catalogue, table, policy and resolver, all
tested" was true and still amounted to a feature nobody could use. *A capability is finished when
somebody outside the codebase can exercise it end to end.*

## G. Dangerous goods on a quote request, 20.09.2026

### G1. The decision, so it is not re-argued

**The portal captures dangerous-goods data. It never produces a dangerous goods declaration.**

A DG declaration is the *shipper's* signed certification that goods are correctly classified,
packed, marked and labelled under the applicable rules — the IMDG Code at sea, the ICAO Technical
Instructions and IATA DGR in the air, ADR/RID/ADN on land, all descending from the UN Model
Regulations. Three reasons it is not ours to produce:

1. **Liability.** A document that looks like a declaration is an instrument people rely on. We
   would be certifying data a customer typed. Noatum is the forwarder, not the shipper; signing as
   agent is a commercial decision nobody has taken.
2. **The dataset is a standing obligation, not a build.** A compliant declaration needs the current
   edition's dangerous goods list, packing instructions and quantity limits — licensed data,
   reissued every January for air and every two years for sea. We have no rate database; we are
   not taking on a DG rulebook we must re-license annually.
3. **CargoWise already does it**, and CW1 is the system of record. "Not a replacement for CW1
   operational workflows" applies directly.

This agrees with what the research already said, and is the reason it was written down:
[`research/06-Freight-Forwarding-and-Quotation-Research.md`](research/06-Freight-Forwarding-and-Quotation-Research.md)
§8.2 — *"A price request is not a dangerous-goods declaration and does not authorise physical
transport"* — and its §9 timing table, which puts the declaration at the tender or loading cut-off,
not at quote stage.

### G2. What was built

Migration `20261010000000_quote_dangerous_goods`. A `quote_dangerous_goods` table, **one row per UN
number and packaging variant**, never one per quote — §8.2 again: *"maintain repeatable
classification details rather than one UN number for the entire quote"*. Tenancy inherits from the
parent quote by RLS `EXISTS`, exactly as `quote_option` does.

It earns a table rather than staying in `quote.payload` under the rule `quote.schema.ts` already
sets: a field leaves the payload when it is filtered, sorted or sent to another system. DG clears
that on two counts today — ops must be able to ask which live quotes carry class 3, and a hazard
inside a JSON blob is a hazard nobody can query — and on a third once the CargoWise copy exists.
**It does not reach CargoWise yet**: `TmsQuoteRequest` has no dangerous-goods member and no adapter
implementation is bound. The customer-facing wording was corrected to match (see G7).

Four new lookups — `dg_packing_group`, `dg_packaging_type`, `dg_transport_regime`,
`dg_quantity_unit` — because the regulations they mirror are revised on a fixed cycle and a
TypeScript constant would mean a deployment each time. `hazard_class` already existed.

Switch `quotations.dangerous_goods`, **default on** because the request wizard already treats DG as
normal. Off, the API refuses a request carrying DG with 403 rather than silently dropping it.

### G3. Which fields are required — decided from the regulations, 20.09.2026

[FR-QTE-002](requirements/01-Functional-Requirements.md) requires **UN number and class** only, and
[stage 08](plans/implementation-plans/phase%201%20-%20phases/08-Customer-Quotation-and-Shared-Tools.md)
says *"additional dangerous-goods fields from research require approval before becoming mandatory"*.
Rather than pick a list by taste, the required set was taken from the binding texts.

**The rule applied:** require what the regulations require *unconditionally*; make conditional what
they make conditional, **using only conditions we can evaluate without a licensed dangerous goods
list**; leave the rest optional.

**Sources.** 49 CFR Part 172 subpart C is the binding US text and mirrors the UN Model Regulations
sequence every mode derives from — the same description the IMDG Code and the ICAO Technical
Instructions require. IMO confirms the IMDG Code is mandatory under SOLAS chapter VII and MARPOL
Annex III, amended on a two-year cycle, and that only §5.4.5 is recommendatory *"insofar as the
layout of the form is concerned"* — the **content** is mandatory, only the paper is optional.

| Field | Rule | Authority |
| --- | --- | --- |
| UN number | Required | §172.202(a)(1) |
| Proper shipping name | Required | §172.202(a)(2) |
| Class or division | Required | §172.202(a)(3) |
| Packing group | Required **as an answer**, where `NONE` is a valid answer | §172.202(a)(4) — excepted for Class 1, self-reactive, Division 5.2 and *"entries that are not assigned a packing group (e.g. Class 7)"* |
| Number of packages | Required | §172.202(a)(7) *"the number and type of packages must be indicated"* |
| Packaging type | Required | §172.202(a)(7), same clause |
| Net quantity per package + unit | Required | §172.202(a)(5) *"total quantity … must include an indication of the applicable unit"* |
| Flashpoint | Required **when class 3 is primary or subsidiary** | §172.203(i)(2) — water transport, *"if 60 °C or below"* |
| Technical name | Required **when the shipping name contains n.o.s.** | §172.203(k) |
| Subsidiary risks | Optional | §172.202(a)(3) — not required *"when a corresponding subsidiary hazard label is not required"*, a condition only the regulations can settle |
| EmS code, UN packaging code, overpack | Optional | Not part of the basic description; the packaging code is often unknown until the packaging is bought |

**Why this is not over-asking at quote stage.** Every required field except the three commercial ones
is on the customer's safety data sheet, which they already have open if they are declaring dangerous
goods. The three that are not — package count, quantity, packaging — are things only the customer
knows and must state to get a price at all. The regulatory floor and what a pricer needs to quote
turn out to be the same list, because class and quantity are exactly what drive segregation, stowage
and the surcharge.

**`NONE` is stored, not null.** "This entry is not assigned a packing group" and "nobody filled it
in" are different facts, and a blank cannot tell them apart.

### G4. What was deliberately not built

- **No UN number lookup.** The mockup carries five hardcoded UN numbers as a demo convenience. In
  production that is worse than nothing, because a suggestion reads as validation. If a UN list is
  ever added it must be a licensed dataset with a version stamp, behind its own switch, worded as
  the mockup itself words it: *"A UN lookup suggests the details; you confirm them against the
  applicable transport information."*
- **No MSDS or DG-declaration attachment.** The mockup shows one. There is no document upload
  anywhere in the portal yet, so this waits for that capability rather than growing a private one.
- **No acceptance check.** Nothing here decides whether a carrier, aircraft or lane will take the
  cargo. §6 of the research is explicit that UN number and class alone do not establish acceptance.

### G5. The one rule enforced beyond any regulation

**Every entry must name the cargo lines it sits in.** No transport document demands this, because a
declaration describes a consignment that has already been packed. A *quote request* has not been
packed yet, and an entry linked to nothing means nobody knows which packages hold the hazard — the
precise shape of a misdeclaration. Package lines gained a `lineId` so the link survives reordering
and removal.

### G6. Still open

**Noatum signing as agent.** 49 CFR 172.204(d)(1) requires the certification to be signed by *"a
principal, officer, partner, or employee of the shipper or his agent"*, and IATA states that
*"consignors are required to prepare a form certifying"* the consignment. A forwarder may sign as
the shipper's agent, and doing so takes on that liability. Whether Noatum ever does is a commercial
and legal decision, not a product one. Nothing in the portal assumes it either way.

### G7. What a critique of this slice found, same day

Ten findings. Recorded because two of them are recurring shapes, not one-offs.

1. **The captured data was write-only — critical.** Neither `pricing.service.detail()` nor
   `quotes.service.getById()` included `dangerousGoods`. A customer declared UN 1263, the row stored
   correctly, and the pricer priced the quote **seeing no hazard at all** — then would have quoted a
   non-DG rate on hazardous cargo. Worse than not offering the field, because the customer has told
   us and reasonably believes we know. The class index was added for a question no code asked.
   *This is "a mechanism without its write path" (F6) inverted: the write existed, the read did not.
   A capture is not finished until somebody can read it back.*
2. **The UI sent lookup labels where the API expects codes — critical.** The hazard-class control was
   fed from `useReferenceLabels`, so picking from the dropdown stored `"Class 3 - Flammable liquids"`
   against a `varchar(8)` column. Every dropdown-picked request was rejected, **and** the flashpoint
   rule — the one thing the slice reasoned hardest about — compared against `'3'` and so never fired.
   The unit test passed only because its fixture hand-wrote the code the UI could not produce.
   *`useReferenceLabels` is for free-text ComboInputs; anything stored as a code needs
   `useReferenceOptions`. A test whose fixture bypasses the UI proves the schema, not the system.*
3. **Only the API honoured the switch.** The customer could tick dangerous goods, complete twelve
   fields per entry, and meet a 403 at submit. Rule 4's courtesy was missing. `useFeature` existed and
   had exactly one consumer in the whole SPA.
4. **The switch test injected its own boolean**, proving an `if` branches on what it was handed.
   Replaced with an e2e test that flips a real `feature_switch` row and asserts 403 through the HTTP
   stack, plus a case proving a missing row falls back to the catalogue default rather than reading
   as off.
5. **The customer was told the data goes to the carrier. It went nowhere.** Reworded to what is true,
   and the same overclaim removed from G2 and the table comment.
6. **`PACKING_GROUPS` duplicated a lookup.** Kept as a constant — the UN defines exactly three — and
   `dg_packing_group` is now `system`-owned so an administrator cannot add a fourth and have the
   server reject it.
7. **Three comments still said "only UN number and class are required"** after the required set grew
   to eight. The applied migration was left untouched — editing it changes its checksum and Prisma
   reports drift — and corrected by a `COMMENT ON TABLE` in a follow-up migration.
8. **`subsidiaryRisks` had a column, a schema rule and a test, and no way to enter it.** The
   corrosive-with-flammable-subsidiary case the flashpoint rule exists for could not be captured.
   A subsidiary-risk control was added.
9. **No audit recorded that a request carried a hazard.** `quote.requested` now carries the count.
10. **`lineId` uniqueness was never asserted** — two lines sharing an id make the cargo link
    ambiguous, the exact failure the link exists to prevent.

**Still open after this round:** `POST /quotes` takes `@Body() body: unknown` with no `@ApiBody`, so
the generated client has no type for the request. That is *why* finding 2 reached runtime — nothing
told the author a label was going into a code field. Raised as its own gap; the fix is a request DTO
class for the whole quote-create contract, not a dangerous-goods patch.






## Activation signs a person in without ever proving the password (22.09.2026)

Found while diagnosing a pilot login that "worked, then stopped". Recorded here rather than
changed, because it alters a designed flow and needs a product decision.

**What happens.** `POST /api/auth/local/activation` sets the password and returns a session in
the same call (`setPassword` in the SPA's `local-auth.ts`; `local_password_set_from_challenge`
in the database). The person lands in the portal without ever typing that password at a sign-in
screen. In the current database, **every session ever created came from an activation** — the
audit table holds no successful password sign-in at all.

**Why that is a problem.** The first time the password is tested is when the session expires,
30 minutes idle later. By then the activation link is spent and single-use. If the stored value
is not what the person believes they typed — both fields carry `autocomplete="new-password"`, so
a browser password manager may have generated and filled one — they are locked out of an
`active` account with no self-service route back. The refusal is deliberately identical to a
wrong password, so nothing on screen distinguishes the two.

**Options, cheapest first.**

1. Keep the auto sign-in, and on the confirmation panel state the address and that the password
   is now required at next sign-in. No API change.
2. Do not spend the link until a sign-in succeeds — allow the activation token to be replayed
   within a short window, so a wrong password is recoverable by reopening the same link.
3. Do not sign in on activation. Redirect to `/login` with the address prefilled, so the password
   is proved immediately. Costs one extra step; makes the failure surface at the right moment.

Recommendation: 1 now, 3 when the pilot's onboarding wording is next revised. 2 weakens a
single-use token and should not be taken without a security review.

**Owner:** Product + IT. **Status:** Open.

---

## Quote request: the write path accepts values the request form can no longer offer

**Raised:** 22.09.2026, while reworking the customer request form and the staff pricing screen.

**What happens.** `createQuote` validates `mode` against the four transport modes and `loadType`
against a string of at most eight characters. Neither is checked against the lookups the form is
actually driven by. So the API still accepts `road` and `rail` — deactivated as request options
in the transport-mode rework — and any `loadType` string at all, including one that does not
exist. The pricing queue and the pricer's screen then show a request nobody can service.

**Why it matters now.** The form is entirely lookup-driven: what a customer may ask for is
decided by `lookup_item` rows and their `metadata.modes` scoping, which an administrator can
change without a deployment. The write path does not read any of that, so the only thing keeping
an unserviceable request out of the queue is the screen — and the rule is that hiding a control
is the courtesy, never the control.

**Options, cheapest first.**

1. Validate `mode` and `loadType` in `quotes.service` against the active lookup items and their
   mode scoping, refusing with the same shape as the other business refusals. One query,
   already cached by `ReferenceService`.
2. As 1, plus the same check on `incoterm`, `packageType` and the add-on service keys, which
   have the same property: lookup-driven on screen, free text on the wire.

Recommendation: 1 with the next quotation slice; 2 when the lookup categories settle. Neither is
in the current slice, which is the pricing screen.

**Owner:** API. **Status:** Open.

---

## Quotation listings: four controls the mockup draws that have nothing behind them

**Raised:** 22.09.2026, building the CH-12 quotation listings against
`REFERENCE/MOCKUP - Fright Forwarder Customer Portal/Noatum Quotation List.dc.html`.

**What happens.** The mockup was followed exactly except for four controls, each of which would
have been drawn with no endpoint to call. A button that does nothing is worse than an absent one —
it is a promise the screen cannot keep — so all four are left out and recorded here.

| Control | Where | What is missing |
|---|---|---|
| **Export** | Both listings, beside the primary action | No export endpoint for quotations on either side. Nothing in the PRD names a format either — CSV, XLSX and PDF are three different pieces of work |
| **New quotation** | Staff listing, primary action | A staff-originated quotation is not Phase 1: every quote begins as a customer request (`docs/plans/Project-Kickoff-and-Phase1-Plan.md`). The pricing screen answers requests; it does not raise them |
| **Assign owner** | Staff bulk bar | No endpoint. `POST /api/pricing/quotes/:id/claim` takes the claim for the caller; handing work to a named colleague is a different act and needs its own route, permission and audit event |
| **Extend validity** | Staff bulk bar, and the row action on an expiring quote | No endpoint. Re-dating a published offer is a re-price in the status machine (`published -> priced -> published`, bumping the customer-visible version), so it is not a field update and should not be one |

The row action on an expiring quote still reads "Extend validity" and opens the quote, which is
where a re-price is performed today. That is honest — it names the intent and takes you to the
one place the act can be completed — but it is not the one-click the mockup implies.

**Also substituted.** The staff grid's customer caption reads "Valencia · 12 quotations" where the
mockup reads "Valencia · 48 shipments". There is no shipment table yet (Pattern B, Phase 2), so
the row says what can actually be counted. Revisit when the shipment family lands.

**Options, cheapest first.**

1. Leave all four out. The listings are complete without them; nothing a customer or a pricer has
   to do today is blocked.
2. Export first, as one endpoint per audience returning CSV of the current query. It is the one
   people ask for unprompted, and it needs no new business rule.
3. Assign owner and Extend validity together, with their routes, permissions and audit events, as
   part of the next pricing slice. Both change who is accountable for a quote, so neither belongs
   in a bulk bar until the single-row act exists and has been used.

Recommendation: 1 now, 2 when a stakeholder asks for it by name, 3 with the pricing workflow
slice. Do not add the buttons before the endpoints.

**Owner:** Product + API. **Status:** Open.

---

## The kit labels form fields two different ways

**Raised:** 22.09.2026, while aligning the pricing work area's service-details row.

**What happens.** `Input`, `Select`, `Autocomplete` and `Textarea` all label themselves
through `Field.module.css`: 14px medium, on a 4px gap above the control. `DateField`
labels itself with the global `.noa-label`: 12px bold, on a 6px gap. Put one of each in
the same grid row — which the pricing screen and the customer request form both do — and
the labels sit at two different heights and in two different weights.

**Why it matters.** It reads as a broken layout rather than as two components, and every
screen that mixes them has to correct it locally. The pricing work area does exactly that
today, scoped to its own grid.

**Options, cheapest first.**

1. Point `DateField` at `Field.module.css` like every other field, and delete the local
   correction. One component changes; the customer request form's two date fields change
   with it, so it needs a look before it ships.
2. Keep both treatments and give the kit a documented rule for which belongs where. The
   honest version of the status quo, but every new screen still has to know the rule.

Recommendation: 1, with the customer request form checked in the same pass. Not done here
because that form is signed off and the change is visual, not a defect on it.

**Owner:** Design system. **Status:** Open.

---

## A customer cannot see the quotation they accepted

**Raised:** 23.09.2026, during an end-to-end run of Q-000003 (request → price → publish →
accept).

**What happens.** `QuotesService.forCustomer` gates the whole offer on
`const published = quote.status === 'published'`. The moment the customer accepts or
declines, the status moves to `accepted` or `rejected` and that expression turns false, so
`options`, `optionCount`, `totalMinorUnits`, `currency`, `validUntil`, `messageToCustomer`,
`daysRemaining` and `awaitingDecision` all empty out of the customer's own detail response.
`expired` behaves the same way.

**Why it matters.** The customer opens the quotation they just accepted and finds no
options, no price and no covering note — and because the SPA routes on
`options.length > 0`, they land on the in-progress page rather than the priced one. What
they agreed to becomes unreadable at the exact moment it starts to matter. The staff view
is unaffected, so the two sides of the same quotation disagree.

**What it is not.** Not the disclosure rule working as designed. The comment above the gate
says "a price that has been typed but not released is not an offer" — an accepted
quotation has been released. The gate wants "has been published", and is testing "is
currently in the published status".

**Options, cheapest first.**

1. Derive it from publication rather than from the current status:
   `const published = quote.publishedAt !== null;`. One line, and it reads as what the
   comment already says. `pipelineSegmentFor` and `awaitingDecision` keep their own
   validity and decision checks, so a lapsed or decided quote still reports correctly.
2. Test the status against the set of post-publication statuses
   (`published`, `accepted`, `rejected`, `expired`). Equivalent, but it is a second list to
   keep in step with the status machine.

Recommendation: 1. Needs a test that an accepted quote still returns its options, beside
the existing one that a `priced` quote returns none.

**Owner:** API. **Status:** Open.
