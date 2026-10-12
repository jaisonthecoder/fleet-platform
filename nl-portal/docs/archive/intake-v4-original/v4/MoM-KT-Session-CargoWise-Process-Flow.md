# Minutes of Meeting — KT Session: CargoWise Process Flow

| | |
|---|---|
| **Project** | Noatum Logistics Customer Information Platform |
| **Session** | KT Session — CargoWise process flow |
| **Date** | 09 September 2026 |
| **Time / Duration** | 10:34 AM · 59 minutes 30 seconds |
| **Platform** | Microsoft Teams (recorded, transcribed) |
| **Attendees** | Jaison Joseph (Noatum Customer Portal team), Christian Hall (Director – Digital Products), Carlos Roda Garcia (Smart Logistics – Business Specialist), Omar Al Jaber, Sreedev Melethil |
| **Minutes prepared by** | Jaison Joseph |

## Purpose of the Session

A knowledge-transfer session between the Noatum Customer Portal team and the CargoWise/Noatum operations side (Christian Hall, Carlos Roda Garcia), to walk through how quotation, shipment tracking, documents, invoicing, booking, and customer/organization set-up actually work today in CargoWise — so the portal design reflects real operations rather than assumptions.

---

## 1. Discussion Summary

### 1.1 Quotation Process — Current State & Scope

- Sea freight quotations mostly happen outside CargoWise — by email, Excel, or on paper. There is no standardized quotation process across regions, countries, or branches; each operates differently.
- Confirmed with Mohamed Jamal-Eddine: there is no rate management system/backend today. This phase's scope is a standardized *manual* quotation process, not automated rating.
- Vision: the AI drafts a standardized customer email (what charges are being asked for, in what format) so the operator doesn't have to compile it manually — but the operator still keys in the actual rate. No rate is calculated or shown automatically.
- Rates are not centrally stored today — they live in local spreadsheets, individual laptops, and shared drives. Only carrier-contracted rates are somewhat centralized, and that is only part of a full quotation.
- Contracted/tender customers get fixed rates from the tender document; other customers get a case-by-case rate depending on market conditions at the time.
- An AI-suggested "recommended rate" feature was raised as a possible future value-add (with mandatory human verification before anything reaches the customer). Christian Hall will look into whether a usable data source exists, but flagged this as difficult today and not guaranteed.
- Carlos Roda Garcia raised the idea of starting the new standardized quotation process with new regions being onboarded to CargoWise, rather than retrofitting large existing regions (e.g. Spain) that already operate outside CargoWise — to be investigated further.

### 1.2 Regional Rollout Approach

- Suggested approach: release the first phase for one region (e.g. Spain), matching how that region currently operates. If other regions have materially different processes, the platform can be customized/ported for them afterward, rather than trying to standardize everything up front.

### 1.3 Shipments & Milestones

- There is no milestone set that is specific to an individual client — milestones are generic/standard across CargoWise, but not consistently used the same way operationally.
- Agreed: a live CargoWise walkthrough/demo is more useful here than answering milestone questions in writing. Christian Hall will arrange someone to run a demo — starting with a simple, standard shipment (basic FCL to begin with, plus simple air and sea import/export) rather than the most complex case.
- The Noatum Customer Portal team needs to see exactly where CargoWise is involved at each step — what data feeds in automatically vs. is entered manually, and what the portal needs to read or manage.
- Christian Hall referenced an internal air-freight requirements document and named five milestones that matter most to customers: picked up, departed, estimated time of arrival (ETA), arrived, and delivered (loaded-at-export / unloaded-at-import are the sea-freight equivalents of departed/arrived). Sea freight milestones are more complex than air.
- Internal-only examples flagged: intercompany/internal invoices, and the internal steps of customs clearance — only the final clearance outcome should be shown to the customer, not the full internal process.
- CargoWise currently has roughly 664 generic events, not flagged as internal/customer-facing and not tied specifically to air or sea. Carlos Roda Garcia will extract and share the full milestone/event list.
- Christian Hall's working assumption: start by showing everything (transparency by default), then exclude specific items only where there's a clear reason not to show them (e.g. intercompany invoices). He will also look into categorizing events (e.g. by departure, arrival, invoicing, quotation) and propose a standardized, categorized critical-path milestone list — noting operations in Europe have already done some thinking on this.

### 1.4 Documents

- There is no central document warehouse yet — documents are stored on CargoWise. When a customer sends documents (e.g. via an email booking request), operations manually extracts, checks, and uploads them to CargoWise with the correct document type.
- Typical documents on a standard shipment: packing list, commercial invoice, arrival notice, shipping notice, house bill of lading / house airway bill, and master bill of lading / master airway bill (carrier documents). Certificates (e.g. food/sanitary, certificate of origin) and dangerous-goods certificates apply where relevant.
- Document type is assigned manually by the uploading user in CargoWise at upload time — there is no automatic validation of the tag, so tagging accuracy currently depends on the user.
- Carlos Roda Garcia will extract and share the full CargoWise document-type list, including a category column that can help identify which types are internal/sensitive.
- Confirmed examples that must never be shown to a customer: intercompany invoices, other internal documents, and rated bills of lading (where the actual freight rate is shown on the document). Christian Hall expects the final exclusion list to be short and will confirm it.

### 1.5 Invoicing & Billing

- Billing depends heavily on Incoterms and the specific commercial agreement — there is no single fixed rule.
- Confirmed: two different parties on the same shipment can each receive their own invoice — e.g. a Chinese supplier invoiced for pre-carriage to the port, and a German consignee invoiced separately for the onward freight, depending on the Incoterm (e.g. FOB vs. EXW-type arrangements).
- Cross-trade is also possible: neither the shipper nor the consignee is billed — a third party (e.g. a notify party) is the actual paying customer.
- Most common charge codes are sea freight and air freight (the main carriage leg), followed by pre-/on-carriage and standard local charges (e.g. THC, security charges). Every charge code carries a plain-language description, so customers generally do not call to ask what a charge means — though some customers have specific agreed invoice description/format requirements.

### 1.6 Booking Process

- A CargoWise quote does not convert directly into a booking. A booking is created separately and then linked to the quote via the quote ID/number — this is a one-to-many relationship (several shipments can reference the same quote).
- For the portal: when a customer books from an accepted quote, the quote number should be included in the booking's EDI/API payload so CargoWise links it automatically — no manual "convert" step is required.
- A booking also does not equal a shipment in CargoWise — a booking still has to be converted into a shipment before execution. In practice, most operators create the shipment/console record directly and attach the booking reference afterward, rather than using a formal booking-to-shipment conversion step.
- Very little information is required to start a shipment in CargoWise (e.g. the customer / controlling customer) — there are few hard restrictions.
- Cancellation cut-off: a booking should be blocked from cancellation or change in the portal once cargo has been picked up, or delivered to an off-site location (e.g. for container packing). A hard stop should apply once the "Shipped" event is recorded — no further changes should be possible through the portal after that point.

### 1.7 Claims & Manual Work

- Christian Hall did not have answers today on: how a customer raises a claim currently, where/whether staff re-key information across two systems, or which customer inquiries take the most staff time. He will investigate internally and follow up.

### 1.8 New Idea: Internal Pricing Inside the Portal

- Proposal discussed: allow internal (pricing/operations) staff to price a customer's quote request directly inside the customer portal instead of CargoWise, with the result synced back into CargoWise.
- Christian Hall's initial reaction: feasible in principle — the portal would act as a friendlier front-end that feeds the quotation into CargoWise. This would need to be a separate, internal-only section not accessible to customers.
- Also raised: today's cross-branch internal quoting (e.g. Abu Dhabi asking a US branch for import charges) could potentially also be handled through the same portal mechanism in future.
- Christian Hall will check with the Head of Pricing on their appetite/vision for this and report back — not yet decided.

### 1.9 Roles & Permissions

- Track & Trace / visibility: no special internal roles are planned at this stage — internal users can see everything; full internal transparency is acceptable for tracking.
- Internal quotations (if built): may need role-based restriction so one branch cannot see another branch's internal quotes.
- Platform administration (creating news, customers, managing the platform) will need distinct roles — e.g. admin vs. viewer, or a role limited to creating a customer user/report without broader edit rights.
- Explicitly agreed: the portal's roles/permissions will not be aligned with or copied from CargoWise's role model — it will be a separate, independently designed system, partly because CargoWise itself may eventually be phased out.

### 1.10 Customer Onboarding & Organization Hierarchy

- CargoWise has no built-in hierarchy function. Each legal entity is set up as one organization, with multiple addresses beneath it (billing, delivery, pickup, bill-of-lading, etc.), each carrying its own internal code and stated purpose. Large customers can have hundreds of addresses.
- Because CargoWise doesn't group addresses/entities into a parent hierarchy, the portal will need its own mechanism — at least initially, this will be manual: an admin creates a customer organization in the portal and attaches the relevant CargoWise IDs to it.
- Proposed onboarding flow: an internal employee logs into the portal, sees/searches the full CargoWise organization list (synced into the portal's database), selects the organization(s) belonging to a customer, and invites that customer's admin user.
- Confirmed: grouping happens at the organization level only — no need to also link to a specific branch or address.
- Longer-term option flagged: Noatum's MDM initiative (with the new "Semarchy" system) is expected to introduce proper hierarchies (financial and commercial) in future. The portal could adopt that as a data source once available; for now the process will be manual.
- Christian Hall proposed a dedicated follow-up meeting to walk through his proposed design for the organization-hierarchy mechanism in detail.
- Per Mohamed Jamal-Eddine's direction (relayed by Omar Al Jaber): the pilot should focus on Noatum's top ~10 customers by CargoWise transaction volume first, then scale from there.

---

## 2. Decisions Confirmed

- Scope for this phase excludes automated rate management — the quotation feature standardizes the manual process (structured input + AI-drafted email) but does not calculate or apply a rate.
- The portal's roles/permissions model will be designed independently of CargoWise's role model.
- A CargoWise "quote" is linked to — not converted into — a "booking"; a "booking" is separately converted into a "shipment." These are three distinct entities the portal design must respect.
- Booking cancellation/changes via the portal should be blocked once the "Shipped" milestone is recorded.
- Organization grouping/hierarchy in the portal will initially be built and maintained manually, at the organization level only.
- Pilot will focus on Noatum's top ~10 customers by CargoWise transaction volume.

---

## 3. Action Items

| Owner | Action | Notes |
|---|---|---|
| Christian Hall | Investigate and share where/how quotation rates are stored today (at least for Spain / the pilot region). | No firm timeline — flagged as complex. |
| Christian Hall | Arrange a live CargoWise demo/walkthrough for the Noatum Customer Portal team. | Start with a simple standard shipment (FCL), then simple air/sea import & export. |
| Christian Hall | Propose a standardized, categorized critical-path milestone list, flagging internal-only events. | Building on the full event list Carlos will provide. |
| Christian Hall | Confirm the list of document types that must never be shown to customers. | Expected to be a short list (e.g. intercompany invoices, rated B/L). |
| Christian Hall | Investigate current claims-management process and where double data entry happens. | No information available yet. |
| Christian Hall | Check with the Head of Pricing on appetite for internal quoting inside the portal. | Will report back to the group. |
| Christian Hall | Set up a follow-up meeting to walk through the proposed organization-hierarchy design. | Separate, dedicated session. |
| Carlos Roda Garcia | Extract and share the full CargoWise milestone/event list. | ~664 events currently, not categorized. |
| Carlos Roda Garcia | Extract and share the full CargoWise document-type list, including category column. | |
| Carlos Roda Garcia | Investigate whether new regions onboarding to CargoWise could adopt the new standardized quotation process from day one. | Alternative to retrofitting existing regions like Spain. |
| Noatum Customer Portal team | Design the rate/data-source integration to be pluggable for a future rate-management system. | No rework required when a real system becomes available. |
| Noatum Customer Portal team | Explore feasibility of an AI-assisted "recommended rate" feature once a usable data source is identified. | Human verification required before anything reaches the customer; not a near-term priority. |

---

## Next Steps

Christian Hall to follow up with the information above as it becomes available. The Noatum Customer Portal team to raise further questions as they arise, and to schedule the CargoWise demo and the organization-hierarchy follow-up meeting once dates are confirmed.
