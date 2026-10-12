# ADR-010 — Scoped settings, alongside platform switches

| | |
| --- | --- |
| Status | Accepted |
| Date | 19.09.2026 |
| Supersedes | Nothing. It **adds a third layer** below CLAUDE.md rule 4 |
| Evidence | `REFERENCE/MOCKUP - Fright Forwarder Customer Portal/Noatum Internal Workspace.dc.html` — the Platform · Quotation settings screen |
| Affects | Quotations (C3–C8), organisation linking (D-13), and anything later that needs "on here, off there" |

## The decision

Optional behaviour is governed by **three layers**, not two:

| Layer | Question it answers | Where it lives | Scope |
| --- | --- | --- | --- |
| **Platform switch** | May anyone at Noatum use this at all? | `feature_switch` table, catalogue in `contracts/feature-switches.ts` | Global |
| **Scoped setting** | How does *this* part of the business use it? | `setting_value` rows keyed by scope, catalogue in code | Global → Region → Branch → Customer |
| **Customer entitlement** | May this customer use it? | `customerGroup.feature_flags` | One customer |

They compose, and they compose in that order. A setting is only consulted when its switch is on.

## Why

The two-layer model in CLAUDE.md rule 4 could not express what the business screen already
shows. The mockup's own settings log records this change:

> 09.09.2026 · Diego Navarro · **Publication mode · Branch ESVLC** ·
> CW1 confirmation → Direct to customer ·
> *"CW1 quote write-back not yet live for ESVLC pilot"*

One branch publishes directly while the rest of the region waits for CargoWise. A global boolean
has to be either wrong for the pilot or wrong for everyone else. The same shape recurs
immediately: the approval threshold is EUR 10,000 globally and EUR 15,000 in Iberia — one key,
two answers, neither of them a feature being off.

CLAUDE.md's own boundary already pointed here: **if it needs a scope, it is a setting, not a
switch.** This ADR does no more than take that sentence seriously and give settings a home.

## Why not widen feature switches instead

Because a switch and a setting fail differently, and conflating them loses that.

- A switch is **binary and fails closed**. `@RequireFeature` returns 403. That is right for
  "this capability does not exist here".
- A setting **always resolves to a value**. There is no 403 for "the threshold is 15,000". Making
  `threshold: 15000` a switch means inventing a switch per value, which is a configuration table
  with extra steps.
- A switch is a **release control** — it retires once a capability is proven. A setting is
  **permanent business configuration** and never retires.

Adding scope to `feature_switch` would have given every switch four nullable scope columns, of
which the great majority stay null forever, and a resolver that most callers must remember not to
need. Two small mechanisms, each honest about what it is, beat one that is neither.

## Rules

1. **The catalogue is code; the values are data.** An administrator sets a value at a layer.
   Nobody invents a key. Same rule as switches, same reason.
2. **Most specific layer wins.** A layer that says nothing inherits.
3. **The resolver returns the value *and* the layer that supplied it.** The screen says
   "inherited from Global" / "override at ESVLC", so the API must carry the provenance. A bare
   value cannot be explained to the person about to change it.
4. **Every change is audited with a mandatory reason**, keeping before and after. The settings log
   is the feature, not decoration — it is how the pilot override above is defensible six months
   later.
5. **A setting changes behaviour and presentation, never schema.** `costCapture` going off does
   not drop a column; costs already recorded stay recorded and readable.
6. **The API is the control.** Where a setting changes a *response*, the service omits the data.
   A field that is merely hidden still ships in JSON.
7. **Settings never weaken safety.** `PROTECTED_CAPABILITIES` — tenancy, RLS, permissions, audit,
   human-send, the link gate — may not become settings any more than they may become switches.
8. **Permissions stay separate and stricter.** `costCapture` says the organisation *may* record
   cost; `quotes.cost.view` says *this person* may see it. Both must be true. A setting is not an
   access control.

## The first catalogue

Taken from the settings screen, not invented. Details in
[`docs/cargowise-and-quotation/02-Quotation-Flow-and-Status.md`](../cargowise-and-quotation/02-Quotation-Flow-and-Status.md) §6.

`pubMode` · `sendReqCw1` · `fourEyes` · `approval` · `threshold` · `claimExpiry` · `releaseBy` ·
`costCapture` · `disclose` · `validity` · `draftSvc` · `co2`

`draftSvc` shows the composition working: the platform switch
`communication.ai_drafting` says the drafting service is available to Noatum at all; the
`draftSvc` setting says whether this branch uses it. The switch off means the setting is never
read.

## Consequences

- **Two open questions close.** PRD **OQ-27** becomes `pubMode`; **OQ-11** becomes `costCapture`
  and `threshold`. Both were open because they were being asked as global yes/no questions that
  the business could not answer globally. As scoped settings they stop being architecture and
  become numbers an administrator types.
- Resolution is a hot path — it runs on every claim, price and publish. It is cached per request
  and invalidated on write. It is **not** a reason for Redis (ADR-008 §6 is unmoved).
- One more table, one resolver, one screen. Weighed against the alternative of a branch-shaped
  `if` in the publish service, this is the cheaper of the two.
- D-18 (configuration scope and precedence) is answered by this ADR rather than by a meeting.

## Status of the numbers

The **mechanism** is decided here. The **values** — 4 hours, EUR 10,000, 21 days — come from the
mockup and remain subject to the sponsor's confirmation. They are defaults in a table, so
confirming or changing them is a configuration change, not a code change. That is the point.
