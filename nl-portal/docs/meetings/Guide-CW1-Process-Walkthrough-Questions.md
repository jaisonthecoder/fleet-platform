# Meeting Guide — CW1 End-to-End Process

| | |
|---|---|
| **With** | Carlos Roda Garcia, Smart Logistics — Business Specialist, Noatum Logistics |
| **Subject** | End-to-end process flow in CargoWise |
| **Prepared** | 04.09.2026 |

**How this guide is arranged.** Questions are grouped by the order we will build the portal, not by the order a shipment happens. Group A feeds the very first slices; Group E is much later. If time runs out, you will have covered what actually blocks the build.

**Each question has three lines:**
- **Ask** — the question as you say it
- **Why we ask** — what it changes in the build, so you know how hard to push
- **If he asks what you mean** — the plain-English expansion to give him

*Carlos is a business specialist, not the integration team. Keep XML and eAdapter out of this conversation — instead, ask him for the name of the right person in the CW Centre of Competence.*

---

## Opening (two minutes)

> "We are building a portal where customers log in to request quotes, track shipments, download documents and see invoices. CargoWise stays the system your teams work in — the portal reads from it and passes customer requests into it. I am not here about technology today. I want to understand how the work actually happens, step by step, because the portal has to mirror it. Where you can, show me the screen rather than describe it."

---

## GROUP A — Foundation slices: customer set-up, who sees what
*Everything else in the platform sits on these answers. A wrong answer here is expensive later.*

**A1. How is a customer company set up in CargoWise? Can you show me one?**
**Why we ask:** Our portal imports that list so our team can pick a company when onboarding. We need to know what fields exist and which are reliable.
**If he asks what you mean:** "When Noatum takes on a customer, someone creates a record for them in CargoWise. I would like to see what that record holds — the code, the name, the address, the branch — because our portal will read that list and use it to work out which company is which."

**A2. If a customer has several offices, are they separate records, or one record with several addresses?**
**Why we ask:** Decides whether one portal customer maps to one CargoWise record or several.
**If he asks:** "Take a customer with a Dubai office and a Riyadh office. Is that two company records with two codes, or one? And if two, does anything in the system say they belong together?"

**A3. Is there a parent or 'related organisation' link between records, and is it actually maintained?**
**Why we ask:** If it is reliable we can pre-fill the customer's offices at onboarding. If not, a person picks them by hand — fine, but we need to know.
**If he asks:** "Some systems let you record that company B is a subsidiary of company A. Does CargoWise have that, and does anyone keep it up to date in practice?"

**A4. Is there a field or category that separates a client from a carrier, an agent or a supplier?**
**Why we ask:** CargoWise holds thousands of organisations; only a fraction are portal customers. A category lets us filter the onboarding search.
**If he asks:** "The organisation list has everybody in it — shipping lines, truckers, customs brokers, our overseas partners, and our actual paying customers. Is there a tick box or a type field that tells them apart?"

**A5. On a shipment, which party does Noatum consider 'the customer'? Is it always the local client?**
**Why we ask:** **The single most important question of the meeting.** It is the rule that decides which company can see which shipment in the portal. Get it wrong and one customer sees another's cargo.
**If he asks:** "A shipment names several companies — shipper, consignee, sometimes a notify party, sometimes an agent, and the party Noatum invoices. When our portal receives a shipment it has to decide which of our customers is allowed to see it. Which of those parties should give someone the right to see it, and which should not?"

**A6. Can two of our customers be on the same shipment — say we handle both the shipper and the consignee? How common is that?**
**Why we ask:** Our design lets a shipment be visible to two customers at once, each seeing only their own paperwork. We need to confirm it really happens.
**If he asks:** "If Gulf Fresh ships to Al Noor and both are Noatum customers, both would want to see that shipment. Does that come up, and is it a problem if both can watch the same shipment move?"

**A7. Does the same company ever appear more than once in CargoWise, and how do you deal with it?**
**Why we ask:** Duplicates mean the wrong record could be linked at onboarding.
**If he asks:** "Sometimes a company gets created twice, or with a slightly different name. Does that happen, and is there a clean-up process?"

**A8. Who at Noatum touches a customer's work from first enquiry to invoice? Which roles, which branch?**
**Why we ask:** Tells us which internal roles the portal needs and who should receive what.
**If he asks:** "I want to draw the chain of people: who takes the enquiry, who prices it, who books it, who runs the shipment, who invoices. Just the roles, and whether they sit in the same branch."

**A9. Roughly how many organisation records exist, and how many are real paying customers?**
**Why we ask:** Sizes the search and tells us whether the onboarding list needs filtering.
**If he asks:** "Hundreds or tens of thousands? And what fraction are actual customers?"

---

## GROUP B — Quotation slices: the first feature customers will use

**B1. Walk me through a quote from the moment a customer asks. Who receives it, where is it entered, what is mandatory?**
**Why we ask:** The portal's quote form must collect exactly what CargoWise needs — no more, no less.
**If he asks:** "A customer emails asking for a price. What happens next: who picks it up, do they create something in CargoWise straight away, and what must they fill in before they can save it?"

**B2. Which lanes have rates ready so a price can be given immediately, and which always need a person? Roughly what proportion?**
**Why we ask:** The portal promises an instant price where rates exist. If the pilot customer's lanes have none, every quote takes the slow route and the pilot looks weak.
**If he asks:** "For some routes you have contract rates and can answer in minutes. For others somebody works it out. What is the split, and which are the easy lanes?"

**B3. Where do the rates actually live — CargoWise rate management, a spreadsheet, another tool?**
**Why we ask:** Open decision. The portal must ask something for a price; we need to know what.
**If he asks:** "When your team needs a rate, where do they look? Inside CargoWise, in files, or somewhere else?"

**B4. When you price manually, what do you look at?**
**Why we ask:** Tells us what a pricing person needs on screen if they ever price in the portal.
**If he asks:** "Talk me through the thinking. Carrier tariff, what we quoted last time, local charges? What is on the desk while you do it?"

**B5. Does a quote include cost and margin, or only the sell price? Who may see the cost side?**
**Why we ask:** If cost comes anywhere near the portal it must be invisible to customers on every surface — screen, PDF, export, API. That is a new class of sensitive data for us.
**If he asks:** "Inside CargoWise, does the quote hold what we pay as well as what we charge? And are there people who should not see the buy side?"

**B6. Is there an approval step before a quote goes out? Who approves, and is there a value threshold?**
**Why we ask:** If we build internal pricing in the portal, approval must work the same way.
**If he asks:** "Can the person who prices it send it straight to the customer, or does a manager sign it off? Does that depend on the value?"

**B7. What statuses does a quote pass through, and what are they called on screen?**
**Why we ask:** Every CargoWise status maps to something the customer understands, held in an editable table.
**If he asks:** "Between 'customer asked' and 'customer accepted', what states does the quote sit in, and what words does CargoWise use?"

**B8. How is a quote sent to the customer today, and how long is it valid?**
**Why we ask:** Our branded PDF must carry at least what yours does, and the portal enforces validity when the customer accepts.
**If he asks:** "Does the system produce a document, or does somebody write an email? And how long can the customer sit on it before the price is no longer good?"

**B9. What does a customer typically ask to change, and what happens then?**
**Why we ask:** Decides whether the portal creates a new version or a new quote.
**If he asks:** "They come back and say the volume changed, or they want a different service. Do you edit the same quote or start a new one?"

**B10. What do customers most often get wrong or leave out when they ask for a price?**
**Why we ask:** Everything on that list becomes validation in the portal form, so requests reach you complete.
**If he asks:** "What makes you go back and ask for more information before you can even start?"

---

## GROUP C — Tracking slices: milestones, documents, invoices

**C1. Walk me through a sea FCL shipment from booking to delivery — every step somebody records.**
**Why we ask:** This becomes the timeline the customer sees.
**If he asks:** "Just narrate it. Booked, container picked up, at the port, loaded, sailed, arrived. I want every point where somebody marks in CargoWise that something happened."

**C2. Now the same for an air shipment. Where does it differ?**
**Why we ask:** Air and Sea need different timelines.
**If he asks:** "Same exercise for a job that flies. Which steps disappear, which appear?"

**C3. Which milestones does CargoWise fill in automatically, and which does a person type?**
**Why we ask:** Manually typed milestones arrive late and inconsistently, which changes what we can promise the customer.
**If he asks:** "Does carrier data flow in on its own for some of these, or does somebody update them by hand?"

**C4. If you had to pick the five milestones that would stop the phone ringing, which five?**
**Why we ask:** Those five drive the tracking screen and the default alerts. Everything else is secondary.
**If he asks:** "Customers call asking where their cargo is. Which five updates, if they could see them themselves, would remove most of those calls?"

**C5. Which events are internal only and must never be shown to a customer?**
**Why we ask:** A hard rule. Anything on this list is hidden on every screen, export, alert and report.
**If he asks:** "Some entries in the event list are for your own team — internal notes, cost events, things that would confuse or worry a customer. Which must never leave the building?"

**C6. Do you use the IATA Cargo IQ milestone set for Air, or your own naming?**
**Why we ask:** Cargo IQ is the industry standard the requirements reference; if you use it, we map to it directly.
**If he asks:** "Cargo IQ is a standard list of air freight milestones many forwarders follow. Do we use those names or our own?"

**C7. How quickly after something happens does it show up in CargoWise?**
**Why we ask:** Sets what we can promise. The requirement is three hours for air milestones.
**If he asks:** "If a container is loaded this morning, when does that appear — within the hour, end of day, next day?"

**C8. Where does carrier information come from today?**
**Why we ask:** Whether we need a separate visibility provider.
**If he asks:** "Does someone check the shipping line's website, do we get a data feed, or does it arrive by email?"

**C9. When something goes wrong — delay, roll-over, customs hold — how do you find out, and how does the customer find out?**
**Why we ask:** This becomes the portal's alerting.
**If he asks:** "Walk me through a bad day. The vessel rolls the container to the next sailing. Who notices, and how long before the customer knows?"

**C10. What documents exist across a shipment, and when does each appear?**
**Why we ask:** Becomes the documents tab; the order tells the customer when to expect them.
**If he asks:** "From booking to delivery, what paperwork gets created or attached, and roughly when?"

**C11. Which document types must never be visible to a customer?**
**Why we ask:** Same hard rule as internal events. A rated bill of lading is the classic case.
**If he asks:** "Which of those documents are for our eyes only — anything showing our costs, internal correspondence, agent instructions?"

**C12. Which documents do customers ask for most, and how do they ask?**
**Why we ask:** Tells us what to put one click away.
**If he asks:** "What is the document request that comes in most often, and does it come by email or phone?"

**C13. When a customer sends you documents, how do they arrive and what do you do with them?**
**Why we ask:** The portal will let them upload; we need to know where the file must end up.
**If he asks:** "They send a packing list or a commercial invoice. Does it come by email, and does someone attach it to the shipment in CargoWise?"

**C14. When is an invoice raised — at departure, arrival, delivery, on a cycle?**
**Why we ask:** Tells the customer when to expect it and shapes the invoices screen.
**If he asks:** "At what point in the job does billing happen?"

**C15. How is it decided who gets billed when several parties are on one shipment?**
**Why we ask:** The portal shows an invoice only to the party it is addressed to. We need the real rule, including exceptions.
**If he asks:** "If there is a shipper, a consignee and an agent, who receives the invoice? Always the same party, or does it vary?"

**C16. Can two different parties on one shipment each receive their own invoice?**
**Why we ask:** Confirms a rule already built into the design.
**If he asks:** "Does it happen that we bill the shipper for the freight and the consignee for destination charges, on the same job?"

**C17. Which charge codes appear most often, and do customers understand them?**
**Why we ask:** Charge codes are mapped to plain names in the portal. The ones customers ring about are our priority list.
**If he asks:** "On a typical invoice, what are the line items called, and do customers ever ask what one of them means?"

**C18. Do customers dispute invoices, and how does that work today?**
**Why we ask:** Tells us how much finance visibility is worth, and whether disputes belong in the portal later.

---

## GROUP D — Booking slices

**D1. How does an accepted quote become a booking? A conversion in CargoWise, or re-keying?**
**Why we ask:** If it is re-keyed today, the portal removes that work — a number worth quoting to management.
**If he asks:** "The customer says yes to the price. Does somebody click to turn the quote into a job, or type it all again?"

**D2. What must be present before a shipment can actually start?**
**Why we ask:** The portal's booking form must collect all of it.
**If he asks:** "What is the minimum you need in hand before operations can begin — addresses, references, cargo detail, documents?"

**D3. Until what point can a booking be cancelled or changed without cost? Which milestone is the cut-off?**
**Why we ask:** The portal enforces this on the server, so it needs a real answer.
**If he asks:** "The customer changes their mind. Up to what point is that free — before the container is picked up, before it is loaded?"

**D4. What does the customer receive as confirmation, and which reference do they quote back to you?**
**Why we ask:** That reference must be searchable in the portal.
**If he asks:** "After you confirm the booking, what number does the customer use when they email you about it?"

---

## GROUP E — Later phases, only if time allows

- **E1.** How does a customer raise a claim today, and where is it recorded?
- **E2.** What are the most common exceptions, and who handles them?
- **E3.** Do customers ask for CO2 figures, and what do you send them?
- **E4.** Do any customers get regular reports, and how are those produced?
- **E5.** Do customers ever ask about purchase orders against shipments?

---

## GROUP F — The new request: pricing inside the portal

The business has asked whether an internal user could price a customer's request **in the portal** instead of logging into CargoWise, with the result syncing back. CargoWise stays the record; the portal is a second front door for one step. Carlos's honest view matters more than management's enthusiasm.

**F1. Would your pricing people actually want a second screen, or would they rather stay in CargoWise?**
**If he asks:** "This is not decided. I want to know whether it would help your team or annoy them."

**F2. What would make the portal better than CargoWise for this task?**
**If he asks:** "For example seeing the customer's original request, their attachments and their history in one place. Is there something CargoWise makes hard that we could make easy?"

**F3. If a quote were priced in the portal, what must reach CargoWise — the full quote with charge lines, or just the outcome?**

**F4. How would we stop two people pricing the same request in two systems?**
**If he asks:** "If it can be done in both places, somebody has to own it. Do you have a way of claiming a job today?"

**F5. If this worked for quotes, would you want the same for bookings or exceptions later?**

---

## What to ask him to send afterwards

No meeting needed, and it unblocks a lot:

- Screenshots or a short screen recording, customer data blanked: a quote being created · a booking converted · a shipment's event list · the documents tab · an invoice
- The event and milestone code list for Air and Sea, marking internal-only ones
- The document type list, marking those that must never be customer-visible
- The charge code list with plain-language descriptions
- A sample quote PDF and a sample invoice as the customer receives them today
- An organisation export for the pilot branch, if he can get it
- Names: who in the CW Centre of Competence handles integration configuration, and who owns rates for the pilot branch

---

## What to leave the meeting with

1. The answer to **A5** — which party makes a company "the customer". Do not leave without it.
2. One sea job and one air job narrated end to end.
3. The five milestones that matter most, and the list that must stay internal.
4. The billing rule when several parties are on a shipment.
5. Whether rates exist for the pilot lanes.
6. His honest view on pricing in the portal.
7. The name of the right person for integration questions.

---

## Notes to take as you go

- **Every code he mentions** — event, status, charge, document type. These become our mapping tables.
- **Every time he says "then we email"** — that is where the portal adds value.
- **Every rule with an exception** — "usually the local client, except when…". The exceptions are what break the design if we do not hear them today.
