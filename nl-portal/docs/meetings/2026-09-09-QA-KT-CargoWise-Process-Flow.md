# KT Session — CargoWise Process Flow — Question & Answer Log

| | |
|---|---|
| **Project** | Noatum Logistics Customer Information Platform |
| **Session** | KT Session — CargoWise process flow |
| **Date** | 09 September 2026 |
| **Time / Duration** | 10:34 AM · 59 minutes 30 seconds |
| **Attendees** | Jaison Joseph, Christian Hall, Carlos Roda Garcia, Omar Al Jaber, Sreedev Melethil |

*This document restates the meeting as question-and-answer pairs, grouped by topic, for quick reference. For narrative discussion and follow-up owners, see the separate Minutes of Meeting document.*

---

## Quotation Process

**Q: How are sea freight quotations currently handled — inside or outside CargoWise?**
A: Mostly outside CargoWise — by email, Excel, or paper. Sea freight is the main problem area. There is no standardized process across regions, countries, or branches.

**Q: Is there a rate management system/backend we can build against for automated quotes?**
A: No. Confirmed with Mohamed Jamal-Eddine that there is no rate management backend today. This phase's scope is a standardized *manual* quotation process, not automated rating.

**Q: What will the AI actually do in the quotation flow if it isn't calculating rates?**
A: It will draft a standardized customer email — telling the operator what charges are being asked for and in what format — so the operator doesn't have to compile it manually. The operator still keys in the actual rate by hand.

**Q: Where do rates actually live today?**
A: Nowhere central. They're in local spreadsheets, on individual laptops, and on shared drives. Only carrier-contracted rates are somewhat centralized, and that's only part of a full quotation.

**Q: Do all customers get the same rate?**
A: No. Customers with a tender/contract get fixed rates from the tender document. Customers without one get a case-by-case rate depending on market conditions at the time.

**Q: Could the AI recommend rates to operators, even without full rate management?**
A: Christian will look into whether a usable data source exists, but flagged this as difficult today (rates are scattered, not centralized) and gave no guarantee or timeline.

**Q: Should the new standardized process roll out to existing regions like Spain, or start with new regions being onboarded to CargoWise?**
A: Open question. Carlos suggested starting with new regions being onboarded to CargoWise, rather than retrofitting large existing regions like Spain that already operate outside CargoWise. To be investigated further.

---

## Regional Rollout Strategy

**Q: Should we launch in one region first, or try to standardize across all regions immediately?**
A: Start with one region (e.g. Spain), matching how it currently operates. If another region has a materially different process, customize/port the platform for it afterward rather than standardizing everything up front.

---

## Shipments & Milestones

**Q: Is there a standard milestone set we can rely on for a given client?**
A: No — milestones are generic in CargoWise, not client-specific, and not consistently used the same way operationally.

**Q: Would a live walkthrough be more useful than answering milestone questions in writing?**
A: Yes — agreed a demo of a real shipment in CargoWise is the better path. Christian will arrange someone to run one.

**Q: What shipment scenario should the demo cover?**
A: Start simple — a basic FCL shipment, plus simple air and sea import/export — not the most complex case, since the standard process doesn't differ much regardless of complexity.

**Q: What are the five milestones that matter most to customers?**
A: Picked up, departed, estimated time of arrival (ETA), arrived, and delivered. (Loaded-at-export / unloaded-at-import are the sea-freight equivalents of departed/arrived.)

**Q: Which events must stay internal and never be shown to a customer?**
A: Examples given: intercompany/internal invoices, and the internal steps of customs clearance — only the final clearance outcome should be shown to the customer, not the full internal process.

**Q: How many events does CargoWise track, and are they categorized as internal vs. customer-facing?**
A: Roughly 664 generic events today, not flagged as internal/external and not tied to a specific mode (air/sea). Carlos will extract and share the full list.

**Q: What's the plan for deciding what to show vs. hide?**
A: Default to showing everything (transparency), then exclude specific items only where there's a clear reason (e.g. intercompany invoices). Christian will also try to categorize events (departure, arrival, invoicing, quotation) into a standardized, critical-path list.

**Q: Where does carrier event information come from?**
A: Through CargoWise's own carrier integrations (EDI or API) — if cargo is booked through CargoWise or a carrier connection, CargoWise receives the carrier's information directly.

**Q: When something goes wrong (delay, roll-over, customs hold), how do operations and the customer find out?**
A: Customs holds are usually notified through CargoWise's customs integrations, which trigger emails to operators; operators then notify the customer manually. Delay detection is largely manual today — Noatum will need to build its own predictive/exception-detection logic in the portal, since carriers don't always send a new ETA.

---

## Documents

**Q: Is there a central document store, or does everything live in CargoWise?**
A: No central document warehouse yet — everything is stored on CargoWise. When a customer sends documents (e.g. via email), operations manually extracts, checks, and uploads them with the correct document type.

**Q: What documents typically appear on a standard shipment?**
A: Packing list, commercial invoice, arrival notice, shipping notice, house bill of lading / house airway bill, and master bill of lading / master airway bill (carrier documents). Certificates (e.g. food/sanitary, certificate of origin) and dangerous-goods certificates apply where relevant.

**Q: How reliable is the document-type tagging?**
A: It's manual — the uploading user selects the document type at upload time. There's no independent validation, so accuracy depends on the user.

**Q: Which document types must never be shown to a customer?**
A: Confirmed examples: intercompany invoices, other internal documents, and rated bills of lading (where the actual freight rate is shown on the document). Christian expects the final exclusion list to be short and will confirm it. Carlos will share the full document-type list, including a category column.

---

## Invoicing & Billing

**Q: When is an invoice raised, and how is it decided who gets billed when several parties are on one shipment?**
A: It depends — mainly on Incoterms and the specific commercial agreement. There is no single fixed rule.

**Q: Can two different parties on the same shipment each receive their own invoice?**
A: Yes, confirmed. Example: a Chinese supplier billed for pre-carriage to the port, and a German consignee billed separately for the onward freight, depending on the Incoterm (e.g. an FOB-type split).

**Q: Is cross-trade billing possible, where neither the shipper nor the consignee pays?**
A: Yes — a third party, such as a notify party, can be the actual paying customer.

**Q: Which charge codes appear most often, and do customers understand them?**
A: Sea/air freight (main carriage leg) charges are most common, followed by pre-/on-carriage and standard local charges (e.g. THC, security charges). Every charge code carries a plain-language description, so customers generally don't call to ask — though some customers have specific agreed invoice description/format requirements.

---

## Booking Process

**Q: How does an accepted quote become a booking?**
A: It doesn't convert directly. A booking is created separately and then linked to the quote via the quote ID/number. This is a one-to-many relationship — several shipments can reference the same quote.

**Q: For the portal, how should a booking be linked to its quote?**
A: Include the quote number in the booking's EDI/API payload — CargoWise will link it automatically. No manual "convert" step is required.

**Q: Does a booking equal a shipment in CargoWise?**
A: No. A booking still has to be converted into a shipment before it can execute with a carrier. In practice, most operators create the shipment/console record directly and attach the booking reference afterward, rather than using a formal conversion step.

**Q: What's the minimum information needed to start a shipment?**
A: Very little — mainly the customer / controlling customer. CargoWise has few hard restrictions.

**Q: Until what point can a booking be cancelled or changed without cost?**
A: A booking should be blocked from cancellation/change once cargo has been picked up, or delivered to an off-site location (e.g. for container packing). A hard stop applies once the "Shipped" event is recorded — no further changes should be possible after that.

---

## Claims & Manual Work

**Q: How does a customer raise a claim today?**
A: Unknown at this time — Christian will investigate internally and follow up.

**Q: Where does the team re-key information into two systems, and which customer inquiries take the most time?**
A: Unknown at this time — Christian will investigate and follow up.

---

## New Idea: Pricing Inside the Portal

**Q: Could an internal user price a customer's request inside the portal instead of CargoWise?**
A: Feasible in principle — the portal would act as a friendlier front-end that feeds the quotation into CargoWise. It would need to be a separate, internal-only section, not accessible to customers.

**Q: Could this also support cross-branch internal quoting (e.g. Abu Dhabi asking a US branch for import charges)?**
A: Possibly — Christian could see the team using the portal for this, but it is not yet decided.

**Q: Who needs to weigh in before this idea moves forward?**
A: The Head of Pricing. Christian will check their appetite/vision for it and report back to the group.

---

## Roles & Permissions

**Q: Do internal CargoWise users need separate roles/permissions in the portal for Track & Trace?**
A: No — internal transparency is fine for tracking; no special roles are planned there at this stage.

**Q: What about internal quotations, if that feature is built?**
A: May need role-based restriction so one branch cannot see another branch's internal quotes.

**Q: What about platform administration (news, customers, admin functions)?**
A: Yes — this will need distinct roles, e.g. admin vs. viewer, or a role limited to creating a customer user/report without wider edit rights.

**Q: Should the portal's role model be aligned with CargoWise's role model?**
A: No — explicitly agreed the portal's roles/permissions will be a separate, independently designed system, especially since CargoWise itself may eventually be phased out.

---

## Customer Onboarding & Organization Hierarchy

**Q: How are multi-branch or multi-address customers structured in CargoWise?**
A: CargoWise has no built-in hierarchy function. Each legal entity is set up as one organization, with multiple addresses beneath it (billing, delivery, pickup, bill-of-lading, etc.), each carrying its own internal code and stated purpose. Large customers can have hundreds of addresses.

**Q: How will the portal group these into a single customer view?**
A: Manually, at least initially — an admin creates a customer organization in the portal and attaches the relevant CargoWise IDs to it.

**Q: What does the onboarding flow look like?**
A: An internal employee logs into the portal, sees/searches the full CargoWise organization list (synced into the portal's database), selects the organization(s) belonging to a customer, and invites that customer's admin user.

**Q: Does grouping need to go down to branch or address level?**
A: No — grouping happens at the organization level only.

**Q: Is there a future system that could replace this manual process?**
A: Possibly — Noatum's MDM initiative (new "Semarchy" system) is expected to introduce proper financial and commercial hierarchies in future. The portal could adopt that as a data source once available; for now the process will be manual.

**Q: Which customers should the pilot focus on?**
A: Noatum's top ~10 customers by CargoWise transaction volume, per Mohamed Jamal-Eddine's direction (relayed by Omar Al Jaber).
