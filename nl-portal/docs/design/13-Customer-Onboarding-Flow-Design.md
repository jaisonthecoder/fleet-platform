# 13 — Customer onboarding: the flow, designed from the model up

> **Status:** proposed design, 13.09.2026. Written at the user's instruction to design the
> best flow for this portal rather than reproduce the supplied mockups.
>
> Builds on the CargoWise evidence in
> [12 — CargoWise organisation schema](12-CW1-Organisation-Schema-and-Portal-Directory-Design.md)
> and the existing [Customer onboarding and user management](../design/Customer-Onboarding-and-User-Management.md)
> design. Where this document and that one differ, the differences are listed in §12.
>
> **Section 2 is the part to argue with.** Everything after it follows from it.

---

## 1. Three principles

1. **A customer is created, not discovered.** The portal owns the tenant. CargoWise has no
   customer record to import — only organisations with billing tick boxes (doc 12 §F-0).
   Nothing in an organisation import may ever create, activate or extend a customer.
2. **Onboarding is a state machine, not a form.** Real onboarding spans days and several
   people: sales names the company, operations attaches the organisations, a second person
   approves, the customer's own administrator accepts an invitation. A five-step wizard that
   must be completed in one sitting models none of that.
3. **Every grant is explicit, reversible and attributable.** No access appears as a
   side effect of something else — not from a hierarchy, not from an import, not from a
   shared address, not from a name match.

---

## 2. Why not the mockup's wizard

The supplied Create-customer mockup is a five-step wizard beginning with **Organisations**.
It is a good screen. It is the wrong *primitive*, for four reasons.

| Problem | Consequence |
| --- | --- |
| **Organisations first** | A genuinely new customer often has no CargoWise organisation yet — the account is opened *because* we won them. Step 1 dead-ends, and the operator's escape route is to invent a code, which is exactly what the link gate exists to prevent |
| **One sitting, one person** | Linking may need a second approver; the first administrator's name often is not known on day one; legal entity checks take days. A wizard forces either a fake completion or an abandoned draft |
| **Completion means "created"** | So what is a customer that reached step 3 and stopped? The mockup has no answer. Without a lifecycle there is no way to report "17 customers stuck waiting for an admin to accept" |
| **Not extensible** | Credit check, sanctions screening, signed contract and data-processing agreement are all plausible additions. Each one means re-cutting the wizard |

**The design below keeps the wizard as a *view*.** Staff still see a guided sequence. But
underneath it is a customer record with a lifecycle and a checklist of tasks, each of which
can be completed independently, by different people, on different days, and each of which
reports why it is blocked.

---

## 3. What we are modelling

Four objects, deliberately separate.

```
CargoWise                     Portal
─────────                     ──────
Organisation  ──linked to──▶  Customer  ──────▶ Users
  (+ addresses,               (a tenant)          (identities, roles)
   registrations,                 │
   classifications)               ├──▶ Entitlements (tier, feature flags)
                                  └──▶ Servicing (Noatum office)
```

| Object | Owner | Rule |
| --- | --- | --- |
| **Organisation** | CargoWise. Mirrored read-only | Never created by onboarding. Must be source-confirmed before it can be linked |
| **Customer** | The portal | The tenant. The unit of login, entitlement and data boundary |
| **Link** | The portal | One organisation belongs to exactly one customer. One customer holds many |
| **User** | The portal, identity at Entra | Belongs to one customer. Never created by an import |

---

## 4. The customer lifecycle

```
   draft ──▶ onboarding ──▶ active ──▶ suspended ──▶ active
     │            │            │            │
     └── discard  └── discard  └──────────▶ closed ◀┘
```

| State | Meaning | What is true | Who can be in it |
| --- | --- | --- | --- |
| `draft` | Named, nothing granted | No confirmed link, no users, no data visible | Deletable without trace beyond audit |
| `onboarding` | Work in progress | May have confirmed links; **no user has signed in yet** | Deletable |
| `active` | Live | ≥1 confirmed link **and** ≥1 active administrator who has accepted | Not deletable — suspend or close |
| `suspended` | Access off, data kept | Links intact, sign-in refused, nothing deleted | Reversible |
| `closed` | Terminal | Users deactivated, **links released** so the codes can be linked elsewhere | Irreversible |

**Two rules that matter more than they look.**

- **`active` is earned, not typed.** The transition is refused unless the facts hold: at
  least one confirmed link and at least one administrator who has actually accepted. This
  kills the failure where somebody sets a customer live and the first sign-in shows an empty
  portal.
- **`closed` releases the links.** Otherwise a departed customer's organisation codes stay
  locked forever against the one-organisation-one-customer index, and nobody can work out
  why a new customer cannot be linked.

---

## 5. The onboarding checklist

Six tasks. Order is a suggestion, not a constraint — only the stated dependencies are real.

| # | Task | Done when | Depends on | Blocked reason shown |
| --- | --- | --- | --- | --- |
| 1 | **Identity** | Name, legal name, country and at least one email domain recorded | — | — |
| 2 | **Entitlements** | Tier chosen; feature flags derived from it, overridable | 1 | — |
| 3 | **Organisations** | ≥1 link in `confirmed` | 1 | "3 organisations found but none confirmed by a source run" |
| 4 | **Servicing** | Default Noatum office set | 1 | — |
| 5 | **First administrator** | An invitation has been **accepted** | 1, and 3 for the invitation to be useful | "Invited 04.09.2026, not yet accepted" |
| 6 | **Go live** | A human presses it | 3 and 5 | "Waiting on: organisations, first administrator" |

Task 6 is a deliberate stop. Everything before it is reversible and invisible to the
customer; after it, real people see real cargo.

**Why a checklist rather than steps.** It supports the three things a wizard cannot: parallel
work by different roles, an honest answer to "what is this customer waiting for?", and the
addition of task 7 without redesigning anything.

---

## 6. How onboarding starts — four doors, one path

All four converge on the same customer record in `draft`.

### 6a. Sales-led (the common case)
Staff create the customer from the name. Organisations are attached when known — possibly
the same hour, possibly next week.

### 6b. Data-led — the unmapped-code queue
**This is the door the mockup does not have, and the one that scales.**

CargoWise sends us shipments and invoices addressed to organisation codes. Some of those
codes are linked to no customer. Each is evidence of a customer we have not onboarded.

The portal therefore keeps an **onboarding candidate** list: organisation codes carrying
recent traffic and holding no link, ranked by volume, with the organisation's CargoWise
classification beside them. One action — *Start customer from this organisation* — creates a
`draft` with the organisation pre-attached and the name pre-filled.

This turns onboarding from an act of memory into a worklist. It also means the portal can
report the honest number: *"41 organisations are receiving cargo and are not linked to any
customer."*

### 6c. Bulk import
A file of customers, from a CRM or a spreadsheet — the user's *"importing customers from any
other source"*. Same validation and the same states as a single create; it simply produces
many drafts. Deliberately **never auto-activates**: a bulk file can create drafts and propose
links, and a human still performs task 6 per customer.

### 6d. Customer-initiated request
A public "request access" form creates a `draft` plus a request record. It grants nothing and
reveals nothing — the responder cannot tell from the form whether the company is already a
customer. Gated by a feature switch, off by default.

---

## 7. Attaching organisations

### 7.1 The search
Staff search the mirrored directory by code, name, registration identifier or city. Each
result shows its state plainly:

| State | Action offered |
| --- | --- |
| Confirmed, active, unlinked | **Attach** |
| Confirmed, active, linked to another customer | **Disabled** — "Linked to Meridian Foods". Offer *Request reassignment* |
| Confirmed, **inactive** in CargoWise | **Disabled** — "Inactive in CargoWise" |
| **Provisional** (typed, unconfirmed) | **Disabled** — "Not yet confirmed by a source run" |
| Not in the directory at all | Offer *Request import* — or *Add provisionally*, if that switch is on |

### 7.2 Three soft signals, none of them blocks
Using the CargoWise evidence from doc 12:

1. **Classification mismatch.** The organisation is not ticked as a customer in CargoWise
   (doc 12 §F-0). Show *"CargoWise classifies this as Carrier."* Warn, do not block —
   classification is manually maintained and often wrong.
2. **Related organisations.** The organisation is named as `ControllingCustomer` by others,
   or names one. Offer them as **suggestions to review**. Never auto-attach: doc 12 §2.6
   establishes this is a pointer, not a hierarchy, and FR-ORG-005 forbids implicit grants.
3. **Same registration identifier.** Another organisation shares a VAT or EORI number.
   Strong hint of the same legal entity; still a human decision.

### 7.3 Recording the link
Each link carries a **reason**, the person, the time and a **servicing office**.

**There is no approval step.** An authorised person links, and the link is effective. Four
eyes were considered and dropped: they slow every routine link to protect against a mistake
that is already visible, reversible and attributed. What replaces them is cheaper and works
while people are asleep:

- the **link gate** — only a source-confirmed organisation can be linked at all;
- the **unique index** — a code already held by another customer is refused outright;
- the **customer lifecycle** — a `draft` customer grants nothing, whatever is attached;
- **audit** — every link records who, when and why, and detaching is one action.

If a link is wrong, the cost is a few minutes of the wrong internal people seeing a
customer's cargo *after* that customer has already gone live, and it is undone immediately.
That is a smaller risk than a queue of pending links nobody is watching.

### 7.4 What a link actually does
A link makes an organisation's records **eligible** for that customer. It is not a grant to
any person. Three further gates apply afterwards, every time:

```
record ──eligible?──▶ the link exists and is switched on
       ──live?─────▶ the customer is active, not draft, suspended or closed
       ──visible?──▶ row-level security for this tenant
       ──allowed?──▶ this user's permissions and entitlements
```

Keeping these separate is what lets us say, truthfully, that attaching an organisation does
not hand anybody the finance tab.

---

## 8. The first administrator

1. Staff enter a name and email. The domain must match the customer's `email_domains`, or a
   Noatum user records an explicit override with a reason.
2. An invitation is sent. It is single-use, hashed at rest, and expires.
3. The recipient signs in through Entra External ID. **We write no authentication code.**
4. On acceptance the identity is bound by issuer and subject — never by email alone after
   the first binding. Task 5 completes.
5. That administrator then invites colleagues, within the same domain rules.

Until acceptance, the customer cannot go live. An invitation that is never accepted is a
visible blocked task, not a silent hole.

### 8.1 What each person sees — the restriction, stated forwards

A customer may hold several organisations (doc 12 §F-0b: one legal entity per CargoWise
branch or country, all one commercial customer). Not everyone inside that customer should
see all of them. The Madrid coordinator may have no business seeing the Hamburg entity's
invoices.

`user_account_access` already carries this, but it stores a **restriction**, and its own
schema comment says so: *"No rows means all accounts."* That inversion is correct in the
database and dangerous on a screen. An administrator who ticks nothing, meaning *none*,
would be granting *everything*.

So the screen and the API both state the effect rather than the mechanism:

| On screen | Stored |
| --- | --- |
| **All organisations** — including any linked later | no rows |
| **Only the organisations I choose** — a later link stays invisible until added here | one row per chosen account |

The API takes an explicit `scope: 'all' \| 'selected'` and refuses `selected` with an empty
list. Every account named must belong to that customer, or the restriction would point at
another tenant's link. Each change carries a mandatory reason and is audited as
`customer.user.access.changed` with the before and after sets.

The default stays "all". Restricting is the deliberate act, because a new colleague who sees
too little raises a support ticket, while a new colleague who silently sees nothing looks
like a broken portal.

---

## 9. Life after onboarding

Onboarding is not the interesting part. These are.

| Event | Design |
| --- | --- |
| **Add an organisation** | Same attach flow, same approval switch, same audit |
| **Remove an organisation** | Requires a reason. Access to its records stops. Historical audit stays |
| **Reassign to another customer** | One authorised, audited operation — never delete-then-add, which would leave a window where the code is free and a race could take it. FR-ORG-003 allows reassignment; it must be atomic and must state its effective moment |
| **CargoWise deactivates a linked organisation** | The link **survives** and an alert is raised. Deactivation must never silently strip a live customer's access |
| **CargoWise merges two organisations** (`MERGE`, doc 12 §F-E) | The losing code's link must move to the surviving code, atomically, audited, with both customers named if they differ. **Open — ORG-D09** |
| **Suspend** | Sign-in refused; links and data untouched; reversible |
| **Close** | Users deactivated, links released, data retained under the retention rule |

Every one of these changes what a customer may see, so each triggers the same
**re-evaluation** pass, and each reports its result per entity type. The result is a fact to
show the operator, not a background silence.

---

## 10. Hierarchy — and the rule that makes it safe

Customers nest: a group parent with regional children. CargoWise has no equivalent
(doc 12 §2.6), so this is purely ours.

> **A parent customer sees nothing of its children by default.**

Inheritance is an **explicit, per-relationship, audited grant** with its own permission — not
a property of being a parent. The reasoning is simple: hierarchy is convenient for reporting
and lethal for tenancy. A structural field must never be an access path, or the first
reorganisation in the customer's own company silently widens who can see cargo.

What the parent relationship gives for free: grouping, rolled-up reporting *where explicitly
granted*, and a place to hang shared entitlement defaults.

---

## 11. Built for scale from the start

| Concern | Decision |
| --- | --- |
| **Several CargoWise databases** | Every link records the organisation's `source_instance`. Nothing assumes one instance (doc 12 §F-A) |
| **Several regions** | Servicing office per link, not per customer only. No rule keys off region until D-16/D-18 settle |
| **Thousands of customers** | Every list is server-side paged and searched. The unmapped-code queue is the scaling mechanism for *finding* work |
| **Bulk and automated onboarding** | The create-customer service takes a batch of one or many. A future CRM sync is another caller, not another code path |
| **Non-CargoWise customer sources** | The customer import contract is separate from the organisation import contract. They share the run/report/audit machinery only |
| **New onboarding obligations** | A new checklist task, not a new wizard |
| **Changing governance** | Manual entry, self-service request and contact import are feature switches, changeable without a release. If four eyes are ever genuinely required, they return as one switch plus one permission — the audit columns that would carry them are already recorded |

**Deliberately not built:** a rules engine for eligibility, automatic customer creation from
CargoWise data, automatic hierarchy inference from `ControllingCustomer` or shared VAT
numbers, and per-address linking. The first three are guesses about access; the fourth is
forbidden by FR-ORG-005.

---

## 12. Where this departs from the mockups and the existing design

| Departure | Why |
| --- | --- |
| **No approval step on a link** | §7.3 — four eyes were dropped at the user's direction. The link gate, the unique index, the customer lifecycle and audit carry the weight instead |
| Lifecycle states replace "wizard completed" | §2 |
| Checklist replaces fixed five steps | §5 |
| Identity is task 1, organisations task 3 | A new customer may legitimately have no organisation yet |
| Added the unmapped-code queue as a first-class door | §6b — this is the scalability change |
| `active` is a guarded transition, not a field somebody sets | §4 |
| `closed` releases links | §4 |
| Parent customers inherit **nothing** by default | §10 — the existing design mentions "hierarchy descendants" in the tenant context without stating the grant rule |
| Reassignment is one atomic operation | §9 |
| CargoWise classification is a **warning**, never a filter | doc 12 §F-0 — classification is manually maintained |

Everything else — invitation-only access, Entra External ID, domain validation, no local
authentication code, read-only time-boxed impersonation — is unchanged.

---

## 13. Screens

| Screen | Contents |
| --- | --- |
| **Customers** list | Name, country, status, links (confirmed/pending), users, blocked-task chip. Filters: status, country, tier, "blocked", "no confirmed link" |
| **Customer** detail | Header with status and the go-live action. Tabs: Overview (the checklist) · Organisations · Users · Entitlements · Hierarchy · Audit |
| **Create customer** | The guided shell over tasks 1–2, then lands on the detail page with the rest outstanding. Abandoning leaves a usable `draft` |
| **Attach organisation** | Right drawer: search, state badges, soft signals, reason, servicing office |
| **Unmapped codes** | Ranked queue of organisation codes with traffic and no link → *Start customer* |
| **Organisation** detail | Overview · Addresses · Identifiers · Linked customer · History (doc 12) |

### 13.1 Guidance on the page, not in a manual

Nobody reads the manual for an internal admin screen. Every screen therefore carries one
short paragraph of standing copy that answers *what is this and what am I deciding*:

| Surface | What the copy has to establish |
| --- | --- |
| Customers list | A customer is the company you give access to; it is linked to organisations, then people are invited |
| Onboarding checklist | Work down the list; go-live needs one linked organisation and one invited administrator |
| Linked organisations | These codes are how shipments, quotes and invoices reach the portal; one company may trade as several; a code belongs to one customer at a time |
| Attach drawer | Search the CargoWise directory; codes held elsewhere cannot be chosen |
| People and what they see | Everyone sees all linked organisations by default; narrow it deliberately |
| Access drawer | Each option states its future behaviour — "including any organisation linked later" against "a later link stays invisible until you add it" |
| Organisation directory | A read-only mirror; corrections are made in CargoWise and arrive on the next import |

The rule this follows: **describe the consequence, not the control.** "Only the
organisations I choose" with the warning that later links will not appear is worth more than
a tooltip explaining what a checkbox does.

---

## 14. Permissions

| Permission | Grants |
| --- | --- |
| `admin.customers.read` | See customers and their links |
| `admin.customers.manage` | Create, edit, go live, suspend, close |
| `admin.organisations.link` | Attach, detach and reassign organisations |
| `admin.customers.hierarchy.grant` | Grant a parent sight of a child |

`admin.customers.read/manage` and `admin.organisations.link` exist today. Only the hierarchy
grant is new. **No approval permission**: with four eyes dropped there is nothing to grant.

---

## 15. Data model changes still required

Already in place: `customer_group.parent_id / legal_name / country_code / email_domains /
status / default_servicing_branch_id`, and `customer_account.justification / linked_by /
linked_at / servicing_branch_id / is_active`.

| Still needed | For |
| --- | --- |
| `customer_onboarding_task` — or a derived view | §5. Prefer **derived**: compute each task from facts already stored, and add a table only if tasks need per-task owners and notes |
| `customer_hierarchy_grant` | §10 — explicit inheritance, never implicit |
| Resolver gate on customer status and link `is_active` | §7.4 — the change that makes `draft` mean something |

Removed on 13.09.2026 with the approval flow: `link_status`, `approved_by_user_id`,
`approved_at`, the `org_link_status` enum and the `organisations.link.require_approval`
switch.

---

## 16. Build order

| Slice | Contents | Gate |
| --- | --- | --- |
| **CO-1** | Lifecycle states + guarded transitions + derived checklist; customers list and detail | — |
| **CO-2** | Attach, detach and reassign organisations, reason, servicing; **resolver gate on customer status** | — |
| **CO-3** | First administrator invitation and acceptance wired to task 5 and go-live | — |
| **CO-4** | Unmapped-code queue | Needs shipment or invoice traffic to exist |
| **CO-5** | Reassignment, suspend, close, re-evaluation reporting | — |
| **CO-6** | Hierarchy grants | Needs the tenancy decision confirmed |
| **CO-7** | Bulk customer import | Needs the source and its contract |

CO-1 and CO-2 are the usable increment: a customer can be created, organisations attached,
and nothing can leak.

---

## 17. Decisions this document asks for

| Ref | Question |
| --- | --- |
| **CO-D01** | Is `active` a guarded transition — no go-live without a confirmed link and an accepted administrator? (§4) |
| **CO-D02** | On `closed`, are links released so the codes can be reused? (§4) |
| **CO-D03** | Do parent customers inherit nothing by default, with inheritance an explicit grant? (§10) |
| ~~CO-D04~~ | **Closed 13.09.2026.** No approval step on links, so no separate approve permission |
| **CO-D05** | Is the customer-initiated access request in scope at all, or is onboarding staff-only? (§6d) |
| **CO-D06** | Which source feeds bulk customer import, and what is its contract? (§6c) |
| **ORG-D09** | Still open: what happens on a CargoWise `MERGE` when the losing code is linked (§9) |
| ~~ORG-D08~~ | **Closed 13.09.2026.** "Does linking require a second approver?" — no |
