# Onboarding Walkthrough and Q&A — Customer, Region and Users

| | |
|---|---|
| **Purpose** | The complete onboarding story in the order it happens in our application, followed by answers to every onboarding question we have been asked |
| **Aligned to** | PRD v2.1 (FG-8.1, FG-8.2, FG-8.4, FG-10) · LLD v3 · Simplification Register · ADR-003, ADR-004 |
| **Audience** | Development team and anyone explaining onboarding to the business — plain English |
| **Written** | 04.09.2026 |
| **Worked example** | Noatum **Dubai branch** · customer **Gulf Fresh Trading** · their Dubai office in CargoWise is `GULFAE001`, Riyadh is `GULFSA001` · first admin **Fatima** |

---

## Part 1 — The flow, stage by stage

### Stage 0 — The portal itself is ready (once, before any customer)

**Who:** Platform Admin (internal).

1. Noatum staff sign in with their Microsoft work account. The first Platform Admin is created by configuration (an allow-listed email). Internal users have no customer group; they are marked internal.
2. Platform Admin assigns internal roles: Customer Success, Ops, Platform Admin.
3. The portal imports the **CargoWise organisation list** on a daily job — every company CargoWise knows, with code, name, country and branch. Nothing is a customer yet; this is only the menu to pick from.
4. Mapping tables are loaded: CargoWise status codes, event codes, charge codes and document types → our customer-facing names.
5. Preset customer roles exist (Standard, Quoting and Booking, Finance, Analyst, Claims, Customer Admin). Tier defaults for feature flags exist as a config constant.

**Where:** Noatum Admin → Platform (roles, mapping tables, imports).
**Behind:** `user` (internal), `role`, `master_org`, `mapping_*`.

---

### Stage 1 — Preparing the region (the Dubai branch)

There is **no region screen**. Preparing a region is four practical things, three of them outside the portal.

| Step | Inside or outside | What |
|---|---|---|
| 1a | Outside — CargoWise | Dubai's organisation records are in the imported list; Dubai's outbound messages will reach our endpoint (or the simulator for now) |
| 1b | Outside — rate source | Dubai's contract rates for its lanes (Shanghai → Jebel Ali, Rotterdam → Jebel Ali) exist in whichever rate source the instant-quote call uses. Without this every quote takes the manual route |
| 1c | Outside — people | Dubai pricing knows portal quote requests will arrive in CargoWise; Dubai operations know their milestones become visible to the customer |
| 1d | Inside | Customer Success publishes a news banner targeted to country AE: "Welcome to the Noatum customer portal" — the only region-specific configuration in the portal |

**Where:** 1d in Noatum Admin → News → scope: country = AE.
**Behind:** `news_item`. Everything else is readiness, not configuration — which is why "region" is not a database object.

---

### Stage 2 — Creating the customer

**Who:** Customer Success.

1. Noatum Admin → Customers → **New customer**.
2. Search "Gulf Fresh". The portal searches the imported CargoWise list and pre-fills legal name and country from `GULFAE001`.
3. Fill in: company name, country AE, tier (say Large), email domain `gulffresh.ae`, features switched on (quotes now; tracking later).
4. Save. Status is **Onboarding**. Nobody at Gulf Fresh knows yet.

**Behind:** one `customer_group` row; feature flags from the tier defaults; audit `group.created`.

---

### Stage 3 — Connecting the customer to its CargoWise records

**Who:** Customer Success (one audited action with a confirm dialog; a second-person approval is a seam we can switch on — ADR-003).

1. Customer → **Accounts tab** → "Add organisation" → search → tick `GULFAE001` (Dubai only; Riyadh left out of the pilot) → one-line justification → Confirm.
2. The dialog shows organisation name, code, country and target customer before the call goes through.
3. The moment it is saved:
   - `GULFAE001` becomes an account of Gulf Fresh — one code can belong to one customer only;
   - a background job goes over every shipment, invoice and staff-created quote already in the portal and marks those carrying `GULFAE001` as visible to Gulf Fresh, so their history is ready before anyone logs in;
   - anything sitting unassigned for that code is cleared.

**Behind:** `customer_account` (with `linked_by`, and `approved_by` reserved) → visibility job → `shipment_visibility`; audit `account.linked`.

---

### Stage 4 — Inviting the customer's admin

**Who:** Customer Success.

1. Customer → **Users tab** → "Invite Customer Admin" → name Fatima, email `fatima@gulffresh.ae`.
2. The portal checks the email domain, generates a one-time link, and sends the branded invitation email.

**Behind:** `user_invitation` (token stored only as a hash, with an expiry), email job.

---

### Stage 5 — The customer's admin accepts

**Who:** Fatima.

1. Clicks the link and sees "Gulf Fresh Trading — invited by Noatum Customer Success".
2. Signs in through Microsoft Entra External ID: with her company Microsoft account, or with an email-and-password account plus multi-factor that Entra creates for her if Gulf Fresh has no corporate identity.
3. The portal checks the identity's email matches the invitation, creates her user with the Customer Admin role, and lands her on the dashboard: the UAE welcome banner and the "Request a quote" tile.
4. Gulf Fresh flips from **Onboarding** to **Active** — one linked office, one accepted admin.

**Behind:** `user` (with `idp_issuer`, `idp_subject`), `user_role`; invitation marked accepted; `customer_group.status = active`.

---

### Stage 6 — The customer builds its team

**Who:** Fatima. Noatum is no longer involved.

Administration → Users → Invite: Omar (Quoting and Booking), Sara (Finance), Khalid (Standard). Same link mechanism, same domain check. Fatima also fills the address book, or imports it, and saves a quote template.

---

### Stage 7 — The first quote (the pilot moment)

**Who:** Omar.

1. Request a quote: Sea LCL, FOB, Shanghai → Jebel Ali, 20 pallets, 8 t, 24 CBM.
2. Submit. The portal uses `GULFAE001` automatically as the customer's organisation code (their only linked office), asks the rate source, finds Dubai's rate, and shows options with charge lines and a validity date in seconds.
3. Omar accepts. The price is frozen, a PDF is generated, and a "Book" button appears (booking itself is Phase 3).
4. In CargoWise a quote record appears under `GULFAE001` carrying our portal reference, so Dubai pricing can see it.

If Omar had asked for Hamburg → Jebel Ali with no rate, the request would land with Dubai pricing in CargoWise, and their price would flow back into his screen.

---

### Stage 8 — What happens from then on, with nobody doing anything

- Every new shipment Dubai operations create in CargoWise with `GULFAE001` as shipper, consignee or local client becomes visible to Gulf Fresh (once tracking is switched on).
- Every milestone, document and invoice for those shipments follows. Invoices are shown only to the office they are addressed to.
- Anything arriving with an organisation code we have not linked is stored but shown to nobody, and appears for Customer Success in the unassigned list.

---

### Stage 9 — Growing

| Situation | What we do |
|---|---|
| Add Gulf Fresh's Riyadh office | Stage 3 again for `GULFSA001` |
| Add a second customer, Al Noor | Stages 2 to 5 again |
| Bring the Riyadh branch on | Stage 1 for Riyadh, then Stages 2 to 5 for its customers |
| Head office wants both offices in one view | Hierarchy tab: parent Gulf Fresh Group, children Dubai and Riyadh |
| Release tracking | Feature flags tab, customer by customer |

---

### What the sponsor decides in this flow

| Stage | Decision |
|---|---|
| 1 | Which branch, and whether its lanes have rates in the rate source (OQ-1 decides which source) |
| 2 | Which customer, which tier |
| 3 | Which offices to link now; whether a second-person approval is wanted |
| 4 | Who the first admin is; whether customers may invite outside their email domain |

Everything else is the application doing its job.

---

## Part 2 — Questions and answers

### About the customer

**The customer already exists in CargoWise. Are we creating them again?**
No. We are creating their **portal access** and pointing it at the CargoWise records they own. Two different things share the word "customer": in CargoWise a customer is an **organisation record** (a business contact with a code, referenced by shipments and invoices); in the portal a customer is a **login space** (which people may sign in, which roles, which features, which CargoWise records they may see). The company already exists; the login space does not.

**Then why is it not automatic?**
Three reasons. Most organisations in CargoWise are not customers — shipping lines, airlines, truckers, brokers, agents, our customers' suppliers — and there is no reliable flag saying which should get portal access. One portal customer is often several organisations (Dubai and Riyadh are one customer to us). And granting visibility is a business decision, not a data import; an automatic link would let a renamed or mistyped record expose one company's cargo to another.

**How much is typed by hand?**
Very little. Company name and country are pre-filled from the CargoWise record. Typed by hand: tier, which features are on, the email domain, and the first admin's name and email — none of which CargoWise holds.

**A brand-new company that has never shipped with us?**
Cannot be onboarded yet; there is nothing to show them. Sales creates them in CargoWise first, as today, then the portal steps follow.

**A company we have not onboarded, whose shipments are already arriving?**
Stored in our database, visible to nobody, listed as unassigned. The day we onboard them their history appears.

### About the region

**How do we set up a region?**
We do not — there is no region object. "One region" means: one Noatum branch, that branch's customers, and rates on that branch's lanes. In the data, the branch appears only as a `branch_code` on each linked organisation, used for reporting and for routing manual quote requests. The only region-specific thing inside the portal is a news banner targeted by country.

**So what does "one customer, one region" actually mean?**
One company; only the offices we choose to link; one Noatum branch; on lanes where rates already exist so instant quotes work in the demo.

**How do we scale to more regions and customers?**
Everything is configuration in the admin screens: link more offices, create more customers, switch features on per customer. No region-specific code. The three rules that make this possible are set once and never varied: which CargoWise party roles make a company "the customer"; that only records linked by Noatum grant visibility; and that invoices are visible only to the office they are addressed to.

### About login and registration

**Can customers register themselves?**
No. The PRD has no sign-up page. A company enters because Noatum onboards it; a person enters because someone invited them — Noatum invites the first admin, the admin invites colleagues. The only things a stranger can use without an account are public track and trace by reference, the CO2 calculator and the sailing schedule.

**How do customers sign in?**
Through Microsoft Entra External ID: with their company Microsoft account, with their own single sign-on where the company has one (federation is configured in Entra, not in our code), or with an email-and-password account plus multi-factor that Entra manages. **We write no login, password, MFA or session code.**

**Who generates the invitation link, and where does it go?**
The portal generates it — a long random one-time token, stored only as a hash, in a link that expires. It goes to **one named person**, never a shared mailbox, because the link is tied to that email address and the login must match it. The email must be on the customer's own domain unless Noatum overrides.

**What if the link expires or is used twice?**
Expired, used or revoked links are refused with a message asking the person to request a new one. Noatum or the Customer Admin can resend up to three times, which generates a fresh token.

**What if someone signs in to Entra who was never invited?**
The API refuses with "identity unknown". Having an Entra account gives no access to the portal by itself.

### About users and roles

**Who manages the customer's users?**
After the first admin accepts, the customer does. Their Customer Admin invites, deactivates, and assigns roles. Noatum stays out of it. Every action is audited and the customer can see their own audit.

**Which roles exist?**
Standard (track and documents), Quoting and Booking, Finance (invoices), Analyst (reports), Claims, and Customer Admin. A user may hold several. Roles are named lists of permissions, so "may create a quote but not submit it" already works without new code. Noatum defines the roles; the customer assigns them.

**Can a customer admin invite an external consultant or an agent?**
Not by default — the email must be on the company's domain. Noatum can override for genuine cases. This is a decision to confirm with the sponsor.

**A user should only see one office's invoices. Possible?**
Yes. A user can optionally be tied to one office; if set, they see only invoices addressed to that office. If not set, they see all of the group's.

**What happens when someone leaves the customer?**
Their admin deactivates them. The next request they make is refused. Their data and audit trail stay. Reactivation is possible.

### About the CargoWise link

**What exactly links a customer to their data?**
The CargoWise **organisation code**. Our `customer_account` table holds one code per row, attached to one customer. When a shipment arrives, we read the codes of its parties and match them; that is the only thing that grants visibility. Codes are never typed by a customer and never shown to them.

**Can one code belong to two customers?**
No — the database refuses it. If a code must move, the change is audited and visibility is recalculated.

**What if a shipment involves two of our customers?**
Both see the shipment move; each sees only the invoices addressed to them. This is automatic, decided when the message arrives.

**Does anything get written into CargoWise during onboarding?**
No. Onboarding only reads the organisation list. The first thing we write into CargoWise is a quote request, at Stage 7.

**Is eAdapter something we build?**
No. eAdapter is CargoWise's own integration component, licensed and configured by the CargoWise team. We build the endpoint it posts to and the client that posts to it. **Note:** that Noatum has eAdapter licensed and enabled is an *assumption* in PRD §12 and the subject of open question OQ-2 — it is not yet confirmed. If it turns out not to be available, the transport changes (extracts, files, another API) and only our adapter implementations change.

### About Noatum staff

**Do employees work in the portal?**
Only for administration and support. Customer Success sets customers up, publishes news and can view a customer's screen to help them (read-only, with a reason, fully audited). Platform Admin governs roles, flags and mapping tables. Operations and pricing keep working in CargoWise; if they log in it is to look, and they never see content flagged restricted unless permitted.

**Nothing operational moves into the portal?**
Nothing. Pricing, booking handling, shipment updates, document issuing and invoicing stay in CargoWise. That is the PRD's first stated non-goal.

### Practical

**What do we need from the customer before onboarding day?**
Their legal name, which offices should be included, their email domain, and the name and email of the first admin. Everything else we already hold.

**How long does onboarding one customer take, once decided?**
It is a few minutes of screen work: create, link, invite. The waiting is on the human side — the customer nominating their admin, and that person accepting.

**Can we practise before real CargoWise access?**
Yes. The simulator provides a fake organisation list of about thirty companies and fake shipments, including a shipment shared between two customers and one with unlinked codes, so the whole flow can be built, demonstrated and tested end to end.

**What can go wrong, and what happens?**

| Situation | Behaviour |
|---|---|
| Code linked to the wrong customer | Audit shows who linked it and when; unlink and relink, visibility is recalculated |
| Customer says a shipment is not theirs | The audit shows which organisation code and party role granted visibility |
| Invitation email never arrives | Resend; the previous token is invalidated |
| Customer has no corporate identity | Entra creates an email-and-password account with multi-factor for them |
| Organisation renamed or deactivated in CargoWise | The daily import updates the name and flags inactive records; the link and visibility are unaffected until someone changes them |

---

## Part 3 — Open items in this area

| # | Item | Owner |
|---|---|---|
| 1 | Which party roles grant visibility (notify party — yes or no) | Product and Ops |
| 2 | Whether linking an organisation code needs a second person to approve | Sponsor |
| 3 | Whether customer admins may invite outside their email domain | Sponsor |
| 4 | Customer tiers and the features each gets (OQ-10) | Commercial |
| 5 | CargoWise organisation export format and whether a client or carrier category exists | CargoWise team |
| 6 | Whether eAdapter is licensed and enabled, and in which environments (OQ-2) | CargoWise team |
| 7 | Whether a public "request access" form should exist | Sponsor |
