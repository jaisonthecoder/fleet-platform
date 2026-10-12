# From an Empty Portal to the First Quote

**The complete flow, in the order it actually happens**

| | |
|---|---|
| **Example used throughout** | Noatum **Dubai branch** · customer **Gulf Fresh Trading** · their Dubai office in CargoWise is `GULFAE001`, Riyadh is `GULFSA001` · first admin **Fatima** · quoting user **Omar** |
| **Aligned to** | PRD v2.1 · LLD v3 · ADR-003, ADR-004 |
| **Written** | 04.09.2026 |

---

## The whole story on one page

```
STAGE 0   The portal is ready                      once, before any customer
          staff logins · internal roles · CargoWise company list imported · code mapping · preset roles
                                    │
STAGE 1   The branch is ready                      readiness, not configuration
          messages flowing · rates on its lanes · pricing and operations teams informed
                                    │
   ┌────────────────────────── NOATUM ──────────────────────────┐
STAGE 2   Create the customer        Gulf Fresh Trading · tier · email domain · features
STAGE 3   Connect their records      search the company list → tick GULFAE001 → confirm
            └─► automatic: their past shipments and invoices become visible
STAGE 4   Invite their admin         one named person · secure link that expires
   └────────────────────────────────────────────────────────────┘
                                    │  hand over
   ┌──────────────────────── THE CUSTOMER ──────────────────────┐
STAGE 5   Admin accepts and logs in  Microsoft sign-in · email must match the invitation
STAGE 6   Admin builds the team      Omar quoting · Sara finance · Khalid track only
STAGE 7   First quote                Shanghai → Jebel Ali LCL → instant price → accepted
   └────────────────────────────────────────────────────────────┘
                                    │
STAGE 8   It runs by itself          new shipments, milestones, documents, invoices arrive automatically
STAGE 9   It grows                   more offices · more customers · more branches · features switched on
```

---

## Stage 0 — The portal itself is ready

Once, before any customer exists. **Who:** Platform Admin.

1. Noatum staff sign in with their Microsoft work account. The first Platform Admin is created by configuration (an allow-listed email). Internal users belong to no customer.
2. Internal roles are assigned: Customer Success, Ops, Platform Admin.
3. The portal imports the **CargoWise company list** on a daily job — every company CargoWise knows, with code, name, country and branch. Nothing is a customer yet; this is only the menu to pick from.
4. Code mapping is loaded: CargoWise status, event, charge and document-type codes → our customer-facing names.
5. Preset customer roles exist: Standard, Quoting and Booking, Finance, Analyst, Claims, Customer Admin. Tier defaults for features exist.

**Where:** Noatum Admin → Platform.

---

## Stage 1 — The branch is ready (Dubai)

There is **no region screen** and no region in the database. "One region" means one Noatum branch. Preparing it is four practical checks, three of them outside the portal.

| # | Where | What |
|---|---|---|
| 1a | CargoWise | Dubai's company records appear in our imported list; Dubai's outbound messages will reach our endpoint (or the simulator for now) |
| 1b | Rate source | Dubai's rates for its lanes (Shanghai → Jebel Ali, Rotterdam → Jebel Ali) exist where the instant-quote call looks. Without them every quote takes the manual route |
| 1c | People | Dubai pricing knows portal quote requests will arrive in CargoWise; Dubai operations know their milestones become visible to the customer |
| 1d | In the portal | Customer Success publishes a news banner targeted to country AE: "Welcome to the Noatum customer portal" — the only region-specific setting in the portal |

---

## Stage 2 — Create the customer

**Who:** Customer Success.

1. Noatum Admin → Customers → **New customer**.
2. Search "Gulf Fresh". The portal searches the imported CargoWise list; legal name and country are pre-filled from `GULFAE001`.
3. Add what CargoWise does not know: tier (say Large), email domain `gulffresh.ae`, and which features are switched on (quotes now; tracking later).
4. Save. Status is **Onboarding**. Nobody at Gulf Fresh knows yet.

---

## Stage 3 — Connect the customer to their CargoWise records

**Who:** Customer Success. One audited action with a confirm dialog. *(A second colleague approving is an option we can switch on — open decision.)*

1. Customer → **Accounts tab** → "Add organisation" → search → tick `GULFAE001` (Dubai only; Riyadh stays out of the pilot) → one-line reason → Confirm.
2. The dialog shows the company name, code, country and target customer before it saves.
3. The moment it saves:
   - `GULFAE001` becomes an account of Gulf Fresh — one code can belong to only one customer, ever;
   - a background job goes over every shipment, invoice and staff-created quote already in the portal and makes those carrying `GULFAE001` visible to Gulf Fresh, so their history is ready before anyone logs in;
   - anything unassigned for that code is cleared.

**This is the most important step in the whole flow.** It is what decides which cargo this customer can see.

---

## Stage 4 — Invite the customer's admin

**Who:** Customer Success.

1. Customer → **Users tab** → "Invite Customer Admin" → name Fatima, email `fatima@gulffresh.ae`.
2. The portal checks the email domain, generates a single-use link that expires, and sends the branded invitation email.

The link goes to **one named person**, never a shared mailbox, because it is tied to that email address and the login must match it.

---

## Stage 5 — The admin accepts

**Who:** Fatima.

1. Clicks the link and sees "Gulf Fresh Trading — invited by Noatum Customer Success".
2. Signs in through Microsoft: her company Microsoft account, Gulf Fresh's own sign-on if they have one, or an email-and-password account with two-step verification that Microsoft creates for her. **We write none of this.**
3. The portal checks the identity's email matches the invitation, creates her user with the Customer Admin role, and lands her on the dashboard: the UAE welcome banner and the "Request a quote" tile.
4. Gulf Fresh flips from **Onboarding** to **Active** — one linked office, one accepted admin.

---

## Stage 6 — The customer builds its team

**Who:** Fatima. Noatum is no longer involved.

Administration → Users → Invite: **Omar** (Quoting and Booking), **Sara** (Finance), **Khalid** (Standard). Same link mechanism, same domain check. Fatima also fills the address book, or imports it, and saves a quote template.

---

## Stage 7 — The first quote (the pilot moment)

**Who:** Omar.

1. Request a quote: Sea LCL, FOB, Shanghai → Jebel Ali, 20 pallets, 8 t, 24 CBM.
2. Submit. The portal uses `GULFAE001` automatically — their only linked office — asks the rate source, finds Dubai's rate, and shows options with charge lines and a validity date in seconds.
3. Omar accepts. The price is frozen, a PDF is generated, and a "Book" button appears (booking itself is Phase 3).
4. In CargoWise a quote record appears under `GULFAE001` carrying our portal reference, so Dubai pricing can see it.

If Omar had asked for Hamburg → Jebel Ali with no rate, the request would land with Dubai pricing in CargoWise, and their price would flow back into his screen.

```
Omar fills the form ──► portal checks it ──► asks the rate source
                                                │
                        rate found ─────────────┤──── no rate
                             │                  │
                  options in seconds     request goes to Dubai pricing in CargoWise
                             │                  │
                             └──► Omar accepts ◄─┘   price frozen · PDF · ready to book
```

---

## Stage 8 — It runs by itself

- Every new shipment Dubai operations create in CargoWise with `GULFAE001` as shipper, consignee or local client becomes visible to Gulf Fresh (once tracking is switched on).
- Every milestone, document and invoice for those shipments follows.
- Each office sees only the invoices addressed to it.
- Anything arriving with a company code we have not linked is stored but shown to nobody, and listed for Customer Success.

---

## Stage 9 — Growing

| Situation | What we do | Development needed |
|---|---|---|
| Add Gulf Fresh's Riyadh office | Stage 3 again for `GULFSA001` | None |
| Add a second customer, Al Noor | Stages 2 to 5 again | None |
| Bring the Riyadh branch on | Stage 1 for Riyadh, then Stages 2 to 5 for its customers | None |
| Head office wants both offices in one view | Hierarchy: parent Gulf Fresh Group, children Dubai and Riyadh | None |
| Release tracking | Feature flags, customer by customer | None |

---

## What the sponsor decides in this flow

| Stage | Decision |
|---|---|
| 1 | Which branch, and whether its lanes have rates in the rate source (open question OQ-1 decides which source) |
| 2 | Which customer, which tier |
| 3 | Which offices to link now; whether a second person should approve the link |
| 4 | Who the first admin is; whether customers may invite outside their email domain |

Everything else is the application doing its job.

---

*Noatum Logistics · AD Ports Group · Customer Information Platform · Internal document*
