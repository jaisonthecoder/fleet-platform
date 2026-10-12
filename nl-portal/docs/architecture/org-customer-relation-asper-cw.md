Let me check exactly what exists today so I don't overstate anything.

Read , lines 1 to 30

Read , lines 16 to 40

Good question — and the honest answer is that the **Organisations page does not exist yet**. Let me explain the whole picture.

## The two things, in one line each

| | What it is | Example |
|---|---|---|
| **Organisation** | A company as **CargoWise** knows it. We copy it in, read-only. | `ACMEIB001 — Acme Iberica SA, Madrid` |
| **Customer** | A **login account** in our portal. We create it. CargoWise knows nothing about it. | `Acme Group` — the tenant whose staff sign in |

They are **not** the same thing. CargoWise has no "customer" record at all — it just has organisations with tick boxes on them (Customer, Vendor, Carrier…). That's what my research proved.

## How they join up

```
ACMEIB001 (Spain)  ─┐
                    ├──▶  Customer "Acme Group"  ──▶  laura@acme.example signs in
ACMEDE001 (Germany)─┘
```

**One customer holds many organisations. One organisation belongs to exactly one customer.**

## Where things actually are right now

Left menu under Administration:

| Menu item | Status |
|---|---|
| **CW1 organisations** | ⚠️ **Placeholder.** Empty page. Not built |
| **Customers** | ✅ **Built** — list + detail + attach |
| Unassigned entities | ⚠️ Placeholder |
| Lookup management | ✅ Built earlier |
| Feature management | ✅ Built earlier |

So where *is* the organisation data? **It's in the database** — 13 organisations, 15 addresses, 11 tax numbers — and you can **search it**, but only from inside the customer screen. There's no standalone browsing page yet.

## A worked example — how it works today

**Say Acme wins a contract with Noatum.**

**Step 1 — Someone imports the CargoWise organisations** (a file today, the live feed later). `ACMEIB001` and `ACMEDE001` land in the directory, marked *confirmed* because a source run produced them.

**Step 2 — You create the customer "Acme Group".** It starts as a **draft**. It grants nothing. Nobody can sign in.

**Step 3 — On the Acme Group page, you click "Attach organisation".** A drawer opens, you search `ACME`, and you see:

```
ACMEIB001   Acme Iberica SA          Coslada · ES · CUS
ACMEDE001   Acme Deutschland GmbH    Hamburg · DE · CUS
NEWLEAD001  Levante Ceramics SL      ✗ Not yet confirmed by a source run
DORMANT001  Costa Verde Produce SL   ✗ Inactive in CargoWise
MERIDIAN01  Meridian Foods Ltd       ✗ Already linked to Meridian Foods
```

You pick the two Acme ones, type a reason, attach. The greyed-out ones **cannot** be picked — and the server refuses them too, not just the screen.

**Step 4 — You invite Laura as their administrator.**

**Step 5 — You press "Go live".** Now Acme's staff can sign in and see cargo for those two organisation codes.

**If you press "Go live" too early**, the button is disabled and says:

> *Not ready to go live. Still needs at least one linked organisation and an invited administrator.*

## The important bit — nothing leaks

Until you press **Go live**, the customer is a draft and resolves **zero** organisation codes, even with organisations attached. Same if you later suspend them.

That's the safety net that replaced the approval step you asked me to remove. And there are tests proving it.

## What I built in this last step

- **Customers list** — search, filter by status, see who's blocked
- **Customer detail** — a checklist showing exactly what's missing, the linked organisations, and Go live / Suspend / Close
- **Attach drawer** — search the CargoWise directory, with each ineligible organisation explaining *why*
- **Close releases the codes** so another customer can use them
- 20 + 18 new tests

## What's genuinely missing

| Gap | Why it matters |
|---|---|
| **Organisations page** | You can't browse the directory on its own, see an organisation's addresses and tax numbers, or check which customer holds it. This is the page you're asking about |
| **Create customer form** | The API works; there's no button yet. Customers exist only from the seed |
| **Invite administrator** | Task 5 shows the status but there's no invite button |

**My suggestion: build the Organisations page next.** It's the missing half of the picture — and without it you can only ever see an organisation through the lens of one customer.

________________________________________



Let me research how CargoWise structures companies, branches and regions.



Fetched https://html.duckduckgo.com/html/?q=CargoWise+enterprise+company+branch+department+structure+explained

Two directly relevant sources. Let me read them.



Fetched 2 resources

The second source blocked. Let me confirm the hierarchy vocabulary.



Fetched https://html.duckduckgo.com/html/?q=CargoWise+"company"+"branch"+"department"+hierarchy+levels+reporting+mapping+GLB



Fetched https://html.duckduckgo.com/html/?q=CargoWise+branch+and+department+setup+multi-country+company+code+accounting+entity

I have what I need. Let me record it, then explain.

Updated memory file

Here's what the research found.

## 1. CargoWise's own internal structure

CargoWise organises **Noatum's own business** in three levels:

```
Company  →  Branch  →  Division / Department
(GlbCompany)  (GlbBranch)   (GlbDepartment)
```

All three are **3-character codes** in the schema. Per the consulting source:

> *"Company, branch, and division setup is the foundation of your system hierarchy. It determines how jobs, invoices, and transactions are assigned to legal entities, reported by location, region or business unit, and consolidated into financials."*
> — ALL2S Consulting, 21.10.2025

Note: there is **no "region" level**. Region is something you build by grouping branches — which is exactly what we did with our own portal-owned `region` table.

## 2. One database or several? — usually **one**

> *CargoWise can "add branches within the same country, create multiple companies inside the same environment, operate different business units together, share operational data across entities, maintain separate financial structures, centralize visibility" — all without purchasing a separate system.* A separate environment is only for *"a clear business or technical need."*
> — Elicit Technology (CargoWise service partner), 26.05.2026

So Noatum almost certainly runs **one CargoWise database** covering all 26 countries. That effectively answers **ORG-D02** — though I'd still like it confirmed.

## 3. The fact that answers your question

**Inside one CargoWise database, an organisation record is global.** One code, one row. Noatum Spain and Noatum Germany both see the *same* `ACMEIB001`.

What changes per company/branch/country is **the relationship data hanging off it** — never its identity:

| CargoWise table | Keyed by | Means |
|---|---|---|
| `OrgCompanyData` | company + organisation | Is this a debtor? Credit limit? — **per company** |
| `OrgARTerms` | + **branch** + **department** | Invoice terms — **per branch and department** |
| `OrgCountryData` | + country | Country-specific settings |
| `OrgStaffAssignments` | + company | Account manager — **per company** |
| `OrgAppointedAgentPorts` | + company + port/country | Agent coverage by region |

So the same company can be a **customer in Spain** and a **vendor in Vietnam**, with different credit limits per Noatum company — all on **one** organisation record.

## 4. And this is the clincher

CargoWise has three fields that exist *only* to describe multi-entity customers:

| Field | Meaning |
|---|---|
| `IsGlobalAccount` | This entity is part of a global account |
| `IsNationalAccount` | Part of a national account |
| `ControllingCustomer` → another organisation's code | This entity's group head |

**CargoWise itself expects one commercial customer to span several organisations.** That validates our model.

But note carefully: `ControllingCustomer` is a **pointer, not a hierarchy**. CargoWise does not grant anything through it — and neither do we.

## So: is "one customer, many organisations" correct?

**Yes — and it matches how CargoWise thinks.** Concretely:

```
CargoWise:                          Our portal:
ACMEIB001  Acme Iberica SA      ─┐
  IsGlobalAccount ✓              ├──▶  Customer "Acme Group"
  ControllingCustomer: ACMEGRP   │
ACMEDE001  Acme Deutschland GmbH─┘
  IsGlobalAccount ✓
  ControllingCustomer: ACMEGRP
```

Two legal entities → **always** two organisation codes. That's fixed by CargoWise, whatever Noatum's own branches look like.

Grouping them into **one portal login** is purely Noatum's commercial choice: *who signs the contract and gets billed?*

## Two things you must not conflate

1. **Noatum's branch ≠ the customer's country.** `ControllingBranch` on the organisation is *Noatum's* servicing office, not where the customer is. I've labelled it that way in the UI and the schema comments.
2. **A customer's structure ≠ Noatum's structure.** Noatum Spain servicing Acme Germany is normal and shouldn't affect who sees what.

## My recommendation

| Situation | Model |
|---|---|
| One contract, one bill, group logistics team | **One customer**, attach all their organisations |
| Separate contracts per country, separate teams | **Separate customers**, optionally parent/child |
| One contract, but Spain mustn't see Germany | **One customer** + restrict users via `user_account_access` |

That third option already works in the database — *"no rows means all accounts"* — but has **no screen yet**. If you pick the grouped model, that screen becomes necessary.


________________________________________


Let me explain it properly before I build anything more.

## The situation

Acme is one commercial group, but it trades through **two separate legal companies**:

- **Acme Iberica SA** — registered in Spain, VAT `ESA12345674`
- **Acme Deutschland GmbH** — registered in Germany, VAT `DE123456789`

They are genuinely different companies. Different tax numbers, different bank accounts, different legal directors. Noatum invoices each one separately.

## What CargoWise does with that

CargoWise gives each legal company its **own organisation record with its own code**:

```
ACMEIB001   Acme Iberica SA          Coslada, Spain
ACMEDE001   Acme Deutschland GmbH    Hamburg, Germany
```

**It has no choice.** CargoWise has no hierarchy — each legal entity is one organisation. You cannot make "Acme Group" a record in CargoWise that contains the other two.

So the shipments arrive labelled like this:

| Shipment | Consignee in CargoWise |
|---|---|
| Container from Shanghai → Valencia | `ACMEIB001` |
| Air freight from Chicago → Hamburg | `ACMEDE001` |

Two different codes. Always.

## The problem that creates

Acme has **one logistics manager, María, sitting in Madrid**, responsible for both countries. She signs the contract with Noatum. She gets one login.

If we made "one organisation = one customer", María would need **two separate logins** and would have to sign out of one to see the other. For a group with 8 countries, that's 8 logins. Unusable.

## What we do instead

We create **one portal customer** and attach both organisations to it:

```
                         ┌─ ACMEIB001  Acme Iberica SA (Spain)
Customer "Acme Group" ───┤
                         └─ ACMEDE001  Acme Deutschland GmbH (Germany)
```

Now María logs in once and sees **both** countries' shipments in one list.

This is exactly what's in your database right now:

```
 customer    | linked_org | servicing
-------------+------------+-----------
 Acme Group  | ACMEIB001  | ES-MAD
 Acme Group  | ACMEDE001  | ES-MAD
```

## What actually happens when a shipment arrives

1. CargoWise sends a shipment with consignee `ACMEDE001`
2. The portal asks: *"which customer holds `ACMEDE001`?"* → **Acme Group**
3. The portal asks: *"is Acme Group live?"* → yes
4. María opens her shipment list → she sees it

If María had a colleague at a different customer, that colleague would **never** see it — because `ACMEDE001` belongs to exactly one customer.

## The rule that keeps this safe

The relationship is one-way:

```
One customer      →  MANY organisations   ✅  (Acme Group holds 2)
One organisation  →  ONE customer only    🔒  (ACMEIB001 is Acme Group's, full stop)
```

The second line is enforced by the database. If someone tries to attach `ACMEIB001` to a second customer, it's refused — even if they type it in different capitals.

## And CargoWise agrees with this design

This isn't something I invented. CargoWise has three fields that exist *only* to describe this situation:

| Field | Meaning |
|---|---|
| `IsGlobalAccount` | This entity is part of a global customer |
| `IsNationalAccount` | Part of a national customer |
| `ControllingCustomer` | Points at the group's head company |

CargoWise already assumes one commercial customer spans several legal entities. We're modelling the same reality.

## When you should *not* group them

If Acme Spain and Acme Germany are run by **different teams who must not see each other's cargo** — separate contracts, separate negotiations, maybe even competing internally — then make them **two customers**. One organisation each.

Your seed data already shows both patterns, deliberately:

| Customer | Holds | Why |
|---|---|---|
| **Acme Group** | ACMEIB001 + ACMEDE001 | One team, one contract → grouped |
| **Atlas Logistics** | ATLASLOG01 | US parent |
| **Atlas Logistics Mexico** | ATLASLOGMX | Separate team → **its own customer**, child of Atlas |

## The middle case — and why I'm about to build it

Sometimes you want **one customer** (one contract, group reporting) but **not everyone should see everything**:

```
Acme Group holds Spain + Germany

  María  (group manager, Madrid)  → sees both
  Laura  (warehouse, Valencia)    → Spain only
  Klaus  (warehouse, Hamburg)     → Germany only
```

The database already supports this — *"restricts a user to a subset of the accounts in their group; no rows means all accounts"* — but **there is no screen for it yet.**

That's the gap. Grouping is only safe if you can control it per person, so that's what I'll build next: a **Users** section on the customer page where you set each person to *"All organisations"* or *"Only these"*.

