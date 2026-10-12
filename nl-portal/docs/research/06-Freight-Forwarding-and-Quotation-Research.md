# Freight forwarding operations and quotation creation: research report

| Document control | Value |
| --- | --- |
| Date | 10.09.2026 |
| Version | 1.0 |
| Purpose | Explain forwarding operations and recommend the data, checks and workflow needed for accurate freight quotations |
| Audience | Product, Pricing, Operations, Compliance, Finance and Engineering |
| Coverage | Air freight, Sea FCL and Sea LCL; associated pickup, delivery, customs and insurance services |
| Status | Research and recommendations for review; not an approved extension of the FR baseline |
| Evidence | 20 publicly accessible publisher pages reviewed; sources and limitations in section 15 |

## 1. Executive recommendation

Build a **mode-aware quotation request**, followed by a **staff-controlled commercial offer**. Do not ask the customer to complete a shipment-execution form just to obtain a price, and do not issue an apparently complete offer from incomplete commercial or safety information.

The most important findings are:

1. **There is no universal mandatory field count for every freight quotation.** The sources reviewed do not establish one. Required information depends on mode, service boundaries, commodity, route, carrier, jurisdiction and whether the document is an estimate or a commercial offer.
2. For Noatum, this report proposes **18 common logical data fields**, plus **8 fields per Air/LCL package line** or **3 fields per ordinary FCL equipment line**. That gives **26 fields for one Air/LCL line** or **21 for one FCL line**, before conditional information. These are design recommendations, not a global standard or existing approved mandatory-field list.
3. Some fields should be prefilled or resolved by the server. A 26-field data profile does not mean 26 empty boxes that every customer must type into.
4. Route, mode, cargo-ready date, actual packed dimensions/weight and service inclusions drive quote reliability. For FCL, equipment and weight per container matter; package CBM is not a substitute for container selection. [S03] [S05]
5. Incoterms describe buyer/seller obligations in the sale of goods. They do **not** replace the forwarder's service scope, fee breakdown, payment terms or contractual conditions. Record the named place and edition. [S02] [S17]
6. DG, batteries, temperature-sensitive and oversized cargo need conditional data and competent operational review. A UN number and hazard class alone do not establish transport acceptance. [S06] [S07] [S08] [S09]
7. State what is included, excluded and conditional. Freight charges, destination charges, taxes, customs duties, insurance and demurrage/detention are not interchangeable. [S16] [S19]
8. Emissions comparison is a real market feature: DHL advertises quote comparison by price, speed and emissions. It is not evidence of a universal legal requirement to include CO2 in every quote. Keep Noatum's quotation CO2 enhancement conditional on OQ-20 and independent of pricing. [S04] [S14]

**Recommended decision:** approve a field-and-validation workshop using sections 4-7, then update the FRs and implementation design only for the agreed changes. Keep Phase 1 manual pricing and CW1 confirmation intact.

## 2. What a freight forwarder actually does

FIATA describes forwarding as a combination of arranging carriage, consolidation, storage, handling, packing, distribution and supporting customs, insurance and documentation services. The forwarder coordinates a transport chain and its commercial risks, rather than simply selling a space on a ship or aircraft. [S01]

| Operational stage | Typical work | Information and decisions that matter |
| --- | --- | --- |
| 1. Enquiry qualification | Understand the customer's goods, route and service need | Who is requesting; shipment characteristics; timing; required scope; ability to serve the lane |
| 2. Feasibility and compliance | Check cargo acceptability and legal/operational constraints | DG, batteries, dimensions, temperature, restricted goods/parties, permits and carrier limitations |
| 3. Sourcing and costing | Obtain carrier, agent, handling and inland costs | Service options, capacity assumptions, validity, local charges, currency, minimums and exclusions |
| 4. Commercial quotation | Set the sell price and issue the offer | Approved charges, terms, version, validity, estimated transit and customer-safe presentation |
| 5. Customer decision | Accept, reject, clarify or revise | Accepted version, authority, expiry and assumptions that must remain true |
| 6. Booking | Request capacity and equipment and confirm execution details | Final parties, pickup/delivery instructions, carrier confirmation, documentation and deadlines |
| 7. Origin execution | Collect, receive, measure, screen, consolidate and clear cargo | Actual measurements, cargo readiness, documents, terminal/warehouse and regulatory cut-offs |
| 8. Main carriage | Move freight and manage exceptions | Departure, connections, transshipment, disruption, arrival and customer communication |
| 9. Destination execution | Clear, deconsolidate, deliver and return equipment | Customs release, delivery availability, storage/free time, proof of delivery and empty return |
| 10. Financial closure | Reconcile vendor costs and customer billing; manage disputes | Quote versus actual differences, approved extras, supporting evidence and claims handling |

These stages can overlap. Customs/security filings can be required before loading or arrival, not just after arrival. ICS2 illustrates that timing distinction for EU-bound or transiting goods. [S12]

**Noatum boundary:** the portal collects requests and presents information; CW1 remains the operational system of record. This report is not a proposal to build a dispatch system, customs-filing platform, procurement system or rate-management application.

### 2.1 Four documents or records that must not be confused

| Item | Meaning | What it does not prove |
| --- | --- | --- |
| Quote request / RFQ | Customer asks Noatum to price a described movement | A price, capacity reservation or acceptance of cargo |
| Priced quotation | Noatum offers defined services on stated commercial terms | That every charge is fixed regardless of cargo changes; that capacity is booked |
| Booking confirmation | Applicable party confirms a booking under its terms | That cargo has departed; that an unqualified transit guarantee exists |
| Shipment record | Operational record of the actual movement | A one-to-one relationship with a quote |

For Noatum, a quote can link to multiple bookings by quote number, and shipment references can arrive later. Preserve the accepted commercial snapshot without treating it as authority over CW1.

The legal effect of accepting an offer depends on the offer wording and applicable law. Legal must approve the quotation terms. Do not describe all quotes as non-binding, or all acceptances as guaranteed carriage.

## 3. Evidence-based design principles

| Finding from the research | What Noatum should do | Evidence / qualification |
| --- | --- | --- |
| Maersk's public quote form distinguishes route endpoints, CY/store-door service, commodity, temperature/DG, equipment count and weight | Keep route, scope and cargo characteristics explicit | S03 is an observed form, not a universal mandatory-field specification |
| DHL allows city-to-city estimates using estimated total weight/volume and later completion | Separate estimated enquiry data from validated offer/booking data | S04 supports progressive completion; adopting a new quick-estimate path needs Product approval |
| Different modes use different charging bases | Use server-calculated cargo quantities and explicit charge-line units | S05; carrier-specific minimums, factors and conditions still apply |
| Incoterms require a precise commercial interpretation | Capture term, named place and edition; validate mode and actual service boundaries | S02 and S17; use licensed ICC rules for legal rule-by-rule implementation |
| Packaging and stackability affect handling and usable space | Capture packed dimensions and stackability; escalate unusual loads | S20; do not turn an article's generic aircraft/pallet limits into universal constraints |
| DG acceptance involves classification, packaging and declarations | Separate customer screening from trained-person approval and carrier acceptance | S06-S09; a website summary is not a licensed DG rule engine |
| Container VGM is a condition for loading | Do not make final VGM an ordinary initial quotation requirement | S10; identify anticipated weighing service/cost earlier when relevant |
| Free time and contingent charges vary | Show applicable basis, trigger events, exclusions and rates or tariff references | S16 and S19; do not hard-code one carrier's definitions or days |

## 4. How many fields are required?

### 4.1 Counting convention and scenarios

The counts below are for a **proposed complete, routine quote-request data profile**. They are not claims about legal requirements, existing implementation or the number of mandatory keystrokes.

- One logical selection counts as one field even if its stored value has components. For example, an authorised customer-office selection resolves organisation information behind the scenes.
- Length, width and height count separately. Unit selectors count separately.
- The minimum scenario has one route, one commodity, one package/equipment line, ordinary cargo, terminal-to-terminal service, and no requested customs or insurance service.
- The 18 common fields include explicit responses to optional-service and special-cargo questions. Selecting "No" does not add a conditional section.
- Full addresses, DG details, insurance values, deadlines and additional cargo/equipment lines add fields. Do not market 26 or 21 as a maximum.
- Quote identifiers, audit metadata, calculated totals and internal pricing fields are not included in the customer-input count.

| Scenario | Proposed logical field count | Composition |
| --- | --- | --- |
| Ordinary Air, one package line | 26 | 18 common + 8 package-line fields |
| Ordinary Sea LCL, one package line | 26 | 18 common + 8 package-line fields |
| Ordinary Sea FCL, one equipment line | 21 | 18 common + 3 equipment-line fields |
| Air/LCL with several package lines | 18 + 8 times the number of package lines | Split lines when dimensions, weight or handling characteristics differ |
| FCL with several equipment lines | 18 + 3 times the number of equipment lines | Split lines when equipment or cargo weight differs |
| Door service, DG, batteries, reefer, OOG, customs or insurance | Base count + applicable conditional data | The conditional catalogue below is not one universal form |

In a logged-in portal, customer account, requester, direction and units can often be prefilled. Incoterms edition can be a versioned default. The number of visible controls is a UX decision, not a reliable measure of business completeness.

### 4.2 When to require data

| Checkpoint | Recommended validation | Noatum status |
| --- | --- | --- |
| Save draft | Permit incomplete data; preserve explicit unknowns; authenticate and isolate access | Draft autosave already required |
| Submit structured request | Require approved route/mode/cargo core plus triggered fields; identify estimates as estimates | Existing PRD requires mode validation and UN/class when DG is flagged; do not relax these silently |
| Request assistance for unknown data | Route to a human without claiming a price-ready request | Proposal only; requires approved workflow and wording; never default unknown DG to "No" |
| Issue a priced offer | Resolve material pricing/safety uncertainties or state approved, bounded assumptions; verify charges and terms | Commercial validation rules require Pricing/Operations sign-off |
| Book and tender cargo | Obtain execution-level parties, final documents and mode/lane-specific approvals by their deadlines | Later booking scope; not every field belongs in the quotation wizard |

An incomplete request may be useful to Pricing. It must not be misrepresented as an accepted shipment or an unconditional price. A customs/DG safety requirement cannot be waived by an ordinary UI "continue" button.

## 5. Proposed customer field dictionary

All field rules in this section are **research recommendations** unless already covered by the current PRD/FRs. "Core" means recommended for a complete routine request, not mandated by an international standard. Sources support the underlying information needs; they do not prescribe this exact schema or count.

### 5.1 Common fields: 18

| ID | Logical field | Population / requirement | Validation and reason |
| --- | --- | --- | --- |
| Q01 | Customer account / authorised office | Core; prefilled or selected from authorised offices | Server resolves CW1 organisation; never accept arbitrary customer-group or CW1 codes |
| Q02 | Requesting contact | Core; authenticated user/contact reference | Reuse approved profile name/contact details; no need to retype email for every quote |
| Q03 | Freight product | Core; Air, Sea FCL or Sea LCL | Determines package/equipment fields and pricing basis; preserve separate mode/load-type storage if required by the API |
| Q04 | Direction | Core; derived or confirmed using approved branch context | Import/export is relative to an office; cross-trade rules need approval, not inference from one global country |
| Q05 | Requested service scope | Core; approved terminal/door combination | State pickup and delivery boundaries; Incoterms alone do not fully specify Noatum's services |
| Q06 | Origin location | Core; approved airport/port/location lookup | Correct country and location identity; use appropriate IATA or UN/LOCODE data, not free-text ambiguity |
| Q07 | Destination location | Core; approved lookup | Must match the intended scope; for door scope, add an address, not a port disguised as a door |
| Q08 | Cargo-ready date | Core for a time-specific quotation; explicit estimate permitted by policy | Date goods will actually be available, not the requested arrival date or quote expiry |
| Q09 | Incoterms rule | Core; customer selection or staff clarification | Validate against transport mode; support approved assistance path for unknown terms |
| Q10 | Incoterms named place | Core when using an Incoterm | Precise place/port appropriate to the rule; record edition alongside it as system metadata |
| Q11 | Goods / commodity description | Core | Specific description of what is being shipped; "general cargo" or "parts" alone may be inadequate for pricing and compliance |
| Q12 | Dangerous-goods indicator | Core; explicit answer | Yes opens DG details; uncertainty requires review; current PRD requires UN number and class when Yes |
| Q13 | Batteries present indicator | Core recommendation; explicit answer | Includes equipment containing batteries; separate screening helps detect undeclared DG; not a substitute for classification |
| Q14 | Temperature-control requirement | Core; explicit answer | Yes opens conditions for temperature-sensitive cargo; ambient general cargo must not silently become reefer |
| Q15 | Export customs service requested | Core scope decision; Yes/No | Clarify whether Noatum is quoting brokerage, not whether export compliance is needed |
| Q16 | Import customs service requested | Core scope decision; Yes/No | Distinguish brokerage charges from customs duty and import tax |
| Q17 | Cargo insurance requested | Core scope decision; Yes/No | Yes needs value/currency and coverage review; a request is not proof insurance is bound |
| Q18 | Weight unit | Core; default and retain explicitly | For example kg or lb; convert server-side and preserve original input; apply consistently across the request |

Evidence base: FIATA forwarding scope [S01], Maersk quote form [S03], DHL quotation flow [S04], Incoterms guidance [S02] [S17], DG/battery guidance [S06] [S07], and insurance guidance [S15]. Q01/Q02 and Noatum's organisation/direction rules come from the project baseline rather than external carrier practice.

### 5.2 Air and LCL: 8 fields per package line

| ID | Field | Requirement | Validation / reason |
| --- | --- | --- | --- |
| P01 | Package type | Core per line | Pallet, carton, crate or another approved value; distinguish outer handling unit from cartons packed on a pallet |
| P02 | Number of identical packages | Core per line | Positive integer; do not double-count pallet and inner cartons as independent outer units |
| P03 | Gross weight per package | Core per line | Positive, includes packaging/pallet; clearly label per-piece versus total to prevent multiplication errors |
| P04 | Packed length | Core per line | Positive; measure outermost packed extent |
| P05 | Packed width | Core per line | Positive; include overhang where it exists |
| P06 | Packed height | Core per line | Positive; include pallet/base and packaging |
| P07 | Dimension unit | Core; can be defaulted | cm/in or approved units; convert before calculating CBM or volumetric weight |
| P08 | Stackability | Core recommendation per line | An explicit answer; non-stackable does not have one universal multiplier; obtain applicable pricing/handling rule |

Different dimensions or weights require separate lines. Mixed commodities or different DG classifications also require enough per-item detail to associate hazards with packages; do not flatten these into one generic description. Support for complex mixed consignments needs a designed model, not an unstructured note alone.

The API derives package count, total gross weight, total CBM and applicable volumetric/chargeable weight. These are **derived outputs**, not additional mandatory customer fields. If an approved total-weight/total-volume enquiry path is introduced, keep it distinct from measured package-line entry and identify the estimate basis. [S04] [S05] [S20]

### 5.3 FCL: 3 fields per equipment line

| ID | Field | Requirement | Validation / reason |
| --- | --- | --- | --- |
| F01 | Container size/type | Core per line | Approved equipment catalogue; do not accept every generic type without operational support |
| F02 | Number of containers | Core per line | Positive integer; retain equipment mix, not just a TEU total |
| F03 | Estimated gross cargo weight per container | Core per line | Cargo plus its packaging, excluding container tare; split lines if weights materially differ; check equipment and inland limits |

This is a normal in-gauge container quotation profile, not a stuffing plan. Heavy/OOG cargo needs item dimensions and distribution details. Reefer requires temperature and handling details. Exact maximum payload depends on equipment and inland constraints; do not copy a single web form's threshold into a universal rule. [S03] [S19]

**Important carrier mapping detail:** the Maersk Spot terms reviewed use the expression "net cargo weight" for their rate basis. Noatum must retain an unambiguous canonical definition and confirm what each carrier/CW1 field means. Never send gross cargo weight, net goods weight and packed-container VGM as interchangeable numbers. [S19]

**TEU is a capacity-equivalence measure, not chargeable kilograms or a reliable price multiplier.** Two 20-foot containers and one 40-foot container may have equivalent TEU but different prices and feasibility. This is an analyst recommendation informed by the per-container rating distinction in [S05].

### 5.4 Conditional information: reveal only when relevant

The rows below are **field groups**, not single counted fields. Some become repeatable or jurisdiction-specific. They are intentionally excluded from the 26/21 routine-scenario totals.

| Trigger | Additional fields / information | Needed by / treatment |
| --- | --- | --- |
| Pickup requested | Pickup address, country, city, postcode where used, access restrictions, loading facilities, pickup availability | Enough locality/access detail to price; full execution address/contact before pickup; city-only offer must disclose its geographic assumptions |
| Delivery requested | Delivery address, country, city, postcode where used, unloading facilities, access/appointment restrictions | Determine last-mile cost; do not imply unloading or tail-lift is included unless quoted |
| Time-critical request | Required delivery date/time, timezone, service priority, latest acceptable departure, routing restrictions | Before selecting a time-sensitive offer; differentiate target from guaranteed commitment |
| Multiple commodities | Per-item description, package association and applicable classification | Before pricing/approval when differences affect acceptance or tariff |
| HS classification needed | HS code, classification jurisdiction/edition where relevant, fuller product description, material/use | Required when needed by commodity rules, customs/duty scope or lane; do not force an invented code merely to submit a generic enquiry |
| DG flagged | UN/ID identifier as applicable, proper shipping name, class/division, subsidiary risk, packing group where assigned, quantity/unit, package details | UN number/class already mandated by Noatum's flagged-DG request rule; remaining information and documents to trained staff before applicable acceptance gates |
| Supporting DG evidence | Relevant SDS and applicable declaration/approvals | SDS can support review; it is not by itself transport approval or a substitute for a required DGD |
| Batteries present | Chemistry, standalone/packed-with/contained-in-equipment configuration, relevant rating/content, quantity, condition, applicable test-summary evidence | Qualified review against current mode/operator rules; no universal battery whitelist based on one number |
| Temperature-sensitive / reefer | Required setpoint or range, temperature unit, commodity, packaging, active/passive needs, duration and handling limits | Before pricing suitable capacity; for reefer add ventilation/humidity/controlled-atmosphere requirements where applicable |
| OOG / heavy / project cargo | Packed dimensions per item, gross weight, drawings/photos, lifting/support points, centre of gravity where needed, loading method | Specialist feasibility and pricing; do not treat as ordinary FCL merely because a container type was selected |
| Shipper-owned container | Ownership, size/type and condition/approval information | Carrier-specific quotation/acceptance; container number/certification may follow at the appropriate execution stage |
| Insurance requested | Goods value, currency, valuation basis, nature/condition of goods, coverage and deductible requirements | Before pricing/binding insurance; coverage confirmation is a separate outcome |
| Customs brokerage / duty estimate | Goods value/currency, country of origin, HS/classification, importer/exporter details, procedure and licences as applicable | Scope-specific; broker/Compliance confirms exact legal data and authority; duty estimate clearly separated from freight |
| Regulated / restricted trade | Applicable parties, beneficial-ownership information where required, end use/user, origin/transit/destination and permits | Compliance determines required checks and clearance; a name-list match or no-match alone is not the whole decision |
| Special handling services | Packing/crating, forklift/crane, tail-lift, loading/unloading, waiting time or storage requirements | Explicitly include/exclude; avoid hiding potentially material service costs in generic remarks |
| Customer preference | Reference, requested carrier/service, routing preference, remarks and attachments | Normally optional unless needed to meet a particular customer contract; preferences are not confirmations |

For return shipments, temporary movements, exhibitions, personal effects, perishables, live animals, pharmaceuticals or other specialist services, route to Operations and approve a separate profile. Listing them here does not bring them into Noatum Phase 1 scope.

## 6. Fields that staff need before issuing a priced quotation

The customer should describe the shipment and need. Pricing staff own the commercial offer. The following are **16 offer-information groups**, not 16 extra customer questions and not a complete database column count.

| ID | Offer information | Recommended content and control |
| --- | --- | --- |
| O01 | Quote identity | Quote number, version, issue date and responsible branch; system-generated |
| O02 | Contracting parties | Issuing Noatum legal entity, customer legal entity/account and approved billing party; verify authority rather than deriving payer solely from Incoterm |
| O03 | Request snapshot | Route, scope, cargo-ready date, Incoterm/named place/edition, cargo assumptions and quantities actually priced |
| O04 | Service option | Proposed service, routing/transshipment assumptions and carrier disclosure according to customer configuration |
| O05 | Transit estimate | Duration and the events it measures, such as airport-to-airport versus door-to-door; separate estimate from contractual guarantee |
| O06 | Validity and applicability | Offer acceptance deadline, timezone, applicable departure/receipt window and revalidation conditions |
| O07 | Charge lines | Customer-safe descriptions, units, quantities, currency and sell amounts; see section 6.1 |
| O08 | Totals | Totals per currency; defined tax treatment; no unlabelled multi-currency grand total |
| O09 | Inclusions | Explicit services and charges included for origin, main carriage, destination and additional services |
| O10 | Exclusions / contingent charges | Items excluded or payable if triggered, with basis or applicable tariff/reference; never silently treat unknown as free |
| O11 | Free time / storage exposure | Applicable demurrage, detention and storage arrangements; days, trigger, calendar basis, location and rates/reference as available |
| O12 | Payment terms | Approved debtor, prepayment/credit conditions, due-date basis and invoicing currency; not a customer-editable credit approval |
| O13 | Insurance | Requested/not requested, quoted coverage basis and applicable conditions; do not represent quotation as policy binding |
| O14 | Terms and acceptance | Versioned approved conditions, amendment/cancellation/re-measurement rules, acceptance mechanism and applicable law approved by Legal |
| O15 | Internal approval evidence | Claimed owner, supplier-cost evidence as permitted, reviewer, threshold approval and any reasons; internal-only |
| O16 | CW1 publication evidence | Business confirmation of the exact priced version before customer publication; retain pending/failed sync diagnostics for staff |

S03/S04 support service and quotation detail; S16/S19 support conditional charges, currency exposure and free-time clarity. O15/O16 are Noatum-specific requirements, not generic carrier rules.

### 6.1 Charge-line checklist

Each line needs enough information to reproduce the amount and explain its scope. Recommended logical attributes are charge code, customer-safe description, service stage, rating basis/unit, quantity, unit sell rate, currency, minimum/rounding rule when applicable, tax treatment, calculated amount and inclusion/contingency treatment. Billing party or prepaid/collect allocation is conditional on the approved commercial model.

Common charge categories to review, **not charges that must always be applied**:

| Category | Examples to confirm |
| --- | --- |
| Origin | Collection, handling, export brokerage, documentation, screening, CFS receipt/consolidation |
| Main carriage | Air/ocean freight, applicable fuel/security/peak/route surcharges |
| Destination | Terminal/CFS/deconsolidation charges, documentation/release, import brokerage and delivery |
| Optional services | Insurance, special packaging, DG/reefer handling, weighing and special equipment |
| Conditional exposure | Storage, waiting, examination, demurrage/detention, re-delivery, amendment/cancellation and re-measurement |
| Government amounts | Customs duties and import taxes, clearly distinguished from broker fees and tax on transport services |

Do not include a surcharge twice when the supplier's base rate already includes it. Do not copy current monetary tariffs from this report: none are provided. "All-in" should always say **all-in for which services, period, cargo and exclusions**.

### 6.2 Three separate clocks

1. **Cargo-ready date:** when cargo is available.
2. **Offer validity:** last point at which the customer can accept the specific quotation under its terms.
3. **Rate applicability / operational cut-offs:** which sailings or cargo receipt dates qualify, and when booking, documents or cargo must be delivered.

A quote accepted before expiry can still need revalidation if the cargo moves outside the stated rate window. Noatum must make that distinction explicit without bypassing its immutable accepted-version rule. Carrier contracts can impose amendment/cancellation obligations even when a portal action remains technically available. [S19]

## 7. Calculations and numerical safeguards

These examples explain the quantities. They are not a replacement for an approved rating specification. All commercial computations belong on the API; React displays the results.

### 7.1 Air freight and CBM

For identical packed pieces with dimensions in centimetres:

$$
\text{CBM} = \frac{\text{pieces} \times \text{length} \times \text{width} \times \text{height}}{1{,}000{,}000}
$$

Under Noatum's current Air 1:6000 baseline:

$$
\text{volumetric weight (kg)} = \frac{\text{pieces} \times \text{length} \times \text{width} \times \text{height}}{6{,}000}
$$

For a straightforward general-cargo example, compare total gross weight with volumetric weight and use the greater as the starting chargeable-weight basis. Minimum charges, rounding, commodity and contract rules still need a separate approved specification. DHL documents this general comparison and warns that carrier density ratios can differ. [S05]

**Worked example:** 2 packed pallets, each 120 x 80 x 100 cm and 90 kg gross. Total gross = 180 kg; CBM = 1.92; volumetric weight = 320 kg. The initial comparison basis is 320 kg, before applicable tariff rounding/minimums. Do not use a parcel/courier divisor merely because it also produces a dimensional weight.

### 7.2 LCL

A common weight-or-measure basis compares cubic metres with metric tonnes:

$$
\text{revenue units} = \max(\text{CBM},\ \text{gross kg}/1{,}000)
$$

This represents the common 1 CBM : 1 tonne comparison explained by DHL, **not an immutable rule for every lane or charge line**. Confirm minimum revenue units, charge increments and whether each origin/destination charge is per shipment, per unit, per tonne or per CBM. [S05]

**Worked example:** 2 packed crates, each 100 x 100 x 120 cm and 1,800 kg gross. Volume = 2.4 CBM; gross = 3,600 kg = 3.6 tonnes. Under the stated comparison, the rating basis is 3.6 revenue units before minimums/rounding. A CBM-only quote would understate this example's weight-based quantity.

### 7.3 FCL

Price the actual equipment mix and number of containers, plus applicable weight, inland and additional charges. Do not calculate the base container freight by applying the Air divisor to the cargo. Gross cargo weight still matters for carrier acceptance, payload, inland axle limits and surcharges. [S03] [S05] [S19]

Quote-stage gross cargo weight excludes container tare. SOLAS VGM covers the packed container and is obtained through an approved weighing method before loading. Estimated cargo mass is not a certified VGM. [S10]

### 7.4 Commercial arithmetic

- Keep amounts as currency-aware decimal values, with an approved rounding policy.
- Never add USD and EUR into one nominal total. If conversion is authorised, retain source currency, conversion rate, effective time and basis.
- Display each line's basis. A rate per kg is not interchangeable with per tonne, per container or per shipment.
- Recalculate after cargo or service changes and preserve the version that was previously offered.
- Distinguish cost, sell price, profit, margin percentage and markup percentage. Margin uses sell price as denominator; markup uses cost. Noatum's decision to capture cost/margin remains open.
- An unavailable supplier amount or CO2 result is not zero. Flag uncertainty rather than silently populating zero.

## 8. Safety, customs and legal matters to take care of

### 8.1 Incoterms and scope

FAS, FOB, CFR and CIF are sea/inland-waterway terms; the other seven Incoterms 2020 rules support any mode. For an Air request with FOB/CIF, request clarification rather than silently changing the customer's sale term. For container movements, check the actual delivery/handover point and whether FCA or another rule better matches the sale; do not automatically equate FCL with FOB. [S02] [S17; application recommendation]

Record **rule + named place + edition**. Do not assume the named destination is always where risk transfers. In particular, under C terms cost and risk transfer are not identical: CPT/CIP and CFR/CIF have different delivery mechanics. The purchased ICC text and qualified commercial/legal review should govern implementation, not a simplified web chart.

Incoterms also do not establish who is contractually liable to pay Noatum's invoice. Confirm the approved billing arrangement independently.

### 8.2 Dangerous goods and batteries

Treat screening, classification, documentary completeness and carrier acceptance as distinct checks. For mixed DG consignments, maintain repeatable classification details rather than one UN number for the entire quote. Packing groups are not assigned to every DG entry. Applicable exceptions and operator/state variations require trained review. [S06] [S07] [S08] [S09]

IATA's page reviewed for this report identifies the **67th DGR edition effective 01.01.2026**. Its separate battery landing page still contains references to 2025/66th-edition guidance. This illustrates why a live page's copyright year is not proof that every linked rule is current. Validate the applicable edition, addenda and carrier variations before use.

The report does not determine battery packing instructions, state-of-charge limits or aircraft eligibility. Do not use AI-generated classification as final approval. A price request is not a dangerous-goods declaration and does not authorise physical transport.

### 8.3 Customs and security data

WCO's HS structure uses six-digit commodity codes internationally. National tariff classifications can require additional detail. Do not impose one global 8- or 10-digit validation rule, derive classification from description without review, or confuse goods' country of origin with the pickup country. [S11; implementation recommendation]

Where customs/duty estimation is requested, collect sufficient value, currency, origin and classification data. A freight quote need not always contain the final commercial invoice, but that does not remove customs-document requirements later. [S18]

For EU-bound/transiting cargo, ICS2 requires complete mode/business-model-specific ENS information; air also has pre-loading requirements. Define who files, which data the customer provides and when. Do not build a new ICS2 connection in the portal merely because the research identified the obligation: coordinate with CW1/customs/integration owners. [S12]

### 8.4 Sanctions and restricted goods

Compliance must define checks applicable to the contracting entities, origin, destination, transit points, goods and end use. OFAC is one official list source, not a worldwide substitute for applicable UN, EU, UK, UAE or other regimes, ownership rules and export controls. Record who reviews a potential match and the result; never assume a simple no-match makes the shipment legal. [S13] [S19]

No complete country-by-country legal assessment has been performed. Confirm local regulations and operating licences for every supported branch/lane before release. The report does not prescribe a new sanctions vendor or implementation.

### 8.5 Insurance and liability

Carrier/forwarder liability and cargo insurance are different. Liability may be limited by applicable convention or contract, and insurance is subject to the policy's cover, exclusions, deductibles and valuation basis. Do not promise full reimbursement merely because insurance was selected. [S15]

Do not copy historical SDR compensation figures from educational pages into the product. Legal and the insurance owner must confirm current limits and policy wording. Requesting an insurance quote, purchasing cover and obtaining a policy/certificate are separate steps.

## 9. What should wait until booking or execution?

| Information | Ordinary quote stage | Later requirement / exception |
| --- | --- | --- |
| Final shipper, consignee and notify party | Collect when needed for account, commercial or compliance checks; not universally all mandatory for basic pricing | Required operational identities according to mode, documents and lane |
| Pickup/delivery operational contact and slot | Locality/access details sufficient only for an explicitly bounded estimate | Exact address, contact and appointment before arranging service |
| Commercial invoice and packing list | Useful supporting evidence; do not universally block an ordinary preliminary RFQ for absence | Required according to customs/shipping process; maintain consistency with the priced cargo |
| AWB / bill of lading number | Normally not available for a new shipment quote | Created/linked during shipment processing; not customer-invented to satisfy a form |
| Container and seal numbers | Equipment type/count normally sufficient for an ordinary quote | Needed at appropriate execution/document stage |
| Verified gross mass | Not a normal initial quote input | Required sufficiently before vessel loading for applicable packed containers |
| DG declaration and carrier approval | DG details must be sufficient for specialist pricing; quotation is not final acceptance | Applicable completed declaration/approval before relevant tender/loading cut-off |
| Customs authorisation, licences and ENS data | Clarify feasibility and required services | Complete before the applicable filing, export, loading or arrival deadline |

Document timing is lane-specific. An ordinary quote-stage deferral does not authorise staff to postpone a known legal/safety obligation past its actual deadline. [S08] [S10] [S12] [S18]

## 10. CO2 at quotation creation

**Research conclusion:** quotation-stage emissions estimates are commercially useful and demonstrably offered in the market, but the sources reviewed do not establish them as a mandatory field on every freight quote. DHL's quote flow explicitly advertises comparing emissions. ISO 14083 establishes a methodology for transport-chain GHG quantification/reporting, not a universal quotation-form field count. [S04] [S14]

Keep Noatum's approved conditional future direction:

- Once route, mode and cargo data are available, show **estimated kg CO2e** in quote review/summary when the capability is enabled.
- Use the same backend emissions abstraction for public calculator, quote, booking and shipment views.
- Identify methodology, source/version, assumptions and disclaimer. Route/vehicle detail can become more accurate later; booking and shipment values need not equal the earlier estimate.
- Missing calculation must not block quotation submission or pricing and must not show as zero emissions.
- Preserve automated originals and audited human overrides under the project rule.
- Do not infer an offset purchase, an extra freight charge or audited-report suitability from the existence of an estimate.

OQ-20 and delivery-phase approval remain open. This report does not choose a provider, factor dataset, local formula implementation or new Azure service.

## 11. Proposed screen and validation sequence

This is a functional flow recommendation, not a visual redesign or a request to change the shared mockup.

| Step | Customer work | Server / staff safeguards |
| --- | --- | --- |
| 1. Service and route | Confirm account/office, product, direction, scope, endpoints, ready date and Incoterms | Authorised office lookup, supported locations/mode, conditional door addresses |
| 2. Cargo | Enter package lines or container mix; describe commodity and special requirements | Unit conversion, CBM/weight calculation, mode-specific checks and DG triggers |
| 3. Services and supporting details | Customs/insurance choices, required conditional details, references/remarks | Avoid duplicate scope selections; identify missing material inputs and scan uploads where supported |
| 4. Review and submit | Confirm supplied facts and see clearly marked estimates | Revalidate API payload; create request and job atomically; no implied price or booking confirmation |
| 5. Internal pricing | Claim request, clarify, source prices, build charges/options and terms | Branch access, concurrency, approval threshold, commercial/safety checks, cost protection |
| 6. Publish and decide | Customer views confirmed offer, accepts/rejects within the rules | CW1 business confirmation, immutable version, expiry checks and auditable notification |

Do not create new lifecycle statuses from these research headings. Preserve the current approved state machine; propose any new clarification/review state through change control.

### 11.1 High-value acceptance scenarios

| Test | Expected result |
| --- | --- |
| Air request with a sea-only Incoterm | Clear correction/clarification requirement; no silent rewrite |
| Two different package sizes | Separate lines; totals include both exactly once |
| cm versus inches for equivalent packages | Equivalent converted result within approved precision |
| Package weight entered as total in a per-piece field | Labels/review make basis explicit; plausibility check prompts review rather than guessing |
| Non-stackable cargo | Handling/pricing review; no invented universal surcharge multiplier |
| FCL mix of 20-foot and 40-foot equipment | Preserve mix and separate charge bases; do not price from TEU alone |
| DG Yes with missing UN/class | Current Noatum server validation rejects the incomplete flagged-DG submission |
| Battery-containing equipment labelled ordinary cargo | Screening identifies the conflict and routes for qualified review |
| Door delivery with unspecified locality/access | No unqualified door price; require sufficient detail or approved bounded estimate |
| Customs requested but duty inputs missing | Brokerage scope distinguished from duty estimate; no fabricated tax amount |
| Supplier quote includes fuel surcharge | No second fuel charge added unintentionally |
| USD freight plus local-currency destination fee | Separate currency totals or explicit approved conversion |
| Offer expires during customer acceptance | Server rejects stale acceptance using the defined timezone/rule |
| Cargo changed after offer/acceptance | Revalidation/version rules apply; original accepted snapshot remains intact |
| Supplier term or rate window expires first | Pricing revalidates or shortens/restricts offer before issue |
| CW1 write pending or transport-only acknowledgement | Customer does not see an unconfirmed priced version |
| Price already entered directly in CW1 | Reconcile authoritative value; keep portal draft/history and notify owner |
| CO2 provider unavailable | Quotation flow continues; no zero or invented estimate |
| Customer retrieves PDF/export/email | No internal costs, margins or internal-only charge lines |
| Another customer's office or quote ID supplied | Access denied server-side; no data leakage |

## 12. Comparison with the current Noatum baseline

The comparison is against the documents, not a new audit of runtime completeness.

| Topic | Current documentation | Research recommendation / approval needed |
| --- | --- | --- |
| Air/FCL/LCL wizard | FR-QTE-001 and PRD FG-3.1 already cover the main categories | Define a signed field dictionary by mode and checkpoint; do not treat every proposed core field as already mandatory |
| Door and Incoterms details | Route, optional addresses and Incoterm already included | Clarify named place/edition and when door pricing requires detailed address/access information |
| Cargo calculations | FR-QTE-003 specifies server-owned CBM and Air 1:6000; FCL picker | Confirm per-piece versus total weight, units, LCL charge basis, minimums, rounding and equipment restrictions |
| Cargo readiness | Not explicitly named in the consolidated FR-QTE-001 row | Confirm capture and relationship to validity/service windows |
| Stackability and battery screening | Not explicit in the consolidated quotation rows | Proposals for Operations review; define unknown/assistance handling without weakening DG requirements |
| DG | FR-QTE-002 requires UN/class when flagged | Retain baseline; define specialist details, document timing and acceptance responsibility |
| Insurance and customs | Additional services exist as a category | Approve exact choices and triggered values/documents; distinguish premium/brokerage/duty |
| Commercial terms | Charge lines, validity and terms already required | Make inclusions/exclusions, free time, contingent fees and date-window interpretation explicit |
| Pricing ownership and confirmation | FR-QTE-010 through FR-QTE-016 already define controls | Preserve them; research does not justify instant rates, local rate tables or early customer publication |
| Quote acceptance and booking links | Version and validity controls; separate quote/booking/shipment model | Preserve distinct records and both CW1/portal pricing paths |
| CO2 | FR-CO2-004 already records conditional quotation estimates | Keep future/conditional; no added Phase 1 dependency |

Reference documents: [01-Functional-Requirements.md](01-Functional-Requirements.md), [02-Non-Functional-Requirements.md](02-Non-Functional-Requirements.md), [03-Phased-Delivery-Plan.md](03-Phased-Delivery-Plan.md), [PRD](../PRD-Noatum-Customer-Platform.md), and [internal pricing design](../design/Internal-Quote-Pricing-in-Portal.md).

## 13. Decisions to obtain before implementation

| Owner | Decision to confirm |
| --- | --- |
| Head of Pricing + Product | Approve the common/mode field profiles and distinguish RFQ completeness from offer readiness |
| Operations by branch/mode | Door-address precision, cargo-ready date, stackability, weight semantics and special-cargo escalation |
| DG specialist + Compliance | Supported DG/battery/temperature cargo, conditional fields, evidence and current rule/operator validation |
| Pricing + Finance | Units, minimums, rounding, rate windows, tax presentation, currency/FX and permitted commercial overrides |
| Legal + Commercial | Quotation conditions, acceptance effect, re-measurement/change/cancellation terms and billing-party responsibilities |
| Customs + Compliance | Lane-specific data, authorisations, HS validation and filing ownership; no assumed portal customs integration |
| Insurance owner | Offered coverage, value basis, binding process and customer-facing wording |
| Integration team + CW1 owner | Exact mapping for fields, units, charge lines/options, business acknowledgement and changes after confirmation |
| Product + Sustainability + Legal | OQ-20 methodology/provider/disclaimer and timing for quotation CO2 |

Bring real examples to the workshop: one Air quote, one heavy LCL quote, one mixed-equipment FCL quote, one door-to-door quote, one DG/battery request and one revised/expired quote. Compare anonymised supplier input, customer offer and actual invoice for missing charges or changed assumptions. Do not send identifiable customer documents to unapproved research or AI services.

**Definition of a useful outcome:** an approved field dictionary, checkpoint-specific rules, a customer-safe offer example for each mode, and a small acceptance fixture set. Merely increasing the number of mandatory boxes is not an outcome.

## 14. Knowledge maintenance

Treat the linked evidence as a dated research baseline, not permanently current regulation.

| Knowledge area | Suggested review trigger | Owner |
| --- | --- | --- |
| DG/battery rules and operator variations | Applicable edition/addendum changes and before a new carrier/commodity is supported | DG specialist |
| Customs/security/sanctions | Regulatory/list updates, a new lane and before the relevant business/execution decision | Compliance / Customs |
| Carrier tariffs and commercial terms | Each supplier offer's effective period and material term change | Pricing |
| Equipment/handling restrictions | New equipment, carrier, warehouse or inland route | Operations |
| Insurance terms | Policy renewal or coverage change | Insurance / Legal |
| Emissions methodology | Provider/factor/methodology change and OQ-20 approval | Sustainability / Legal |
| Portal rules | Signed process change and before affected release | Product / Engineering / QA |

Version material inputs and decisions with their effective date and source. Do not silently recalculate historical accepted prices under a newer rule. Proposed monitoring metrics are first-pass request completeness, clarification frequency, time to first valid offer, pricing rework, post-quote charge variance and submission abandonment; agree targets after measuring a pilot.

## 15. Sources and research limitations

### 15.1 Method

Research used browser-based web searches followed by direct reading of publisher pages, plus comparison with the current Noatum PRD/FRs. Example discovery queries were `DHL global forwarding chargeable weight 6000 LCL freight quote` and `site.maersk.com spot terms quotation validity demurrage detention`. Search snippets and AI-generated search summaries were not treated as evidence for the report's conclusions.

The source register contains **20 substantive pages reviewed on 10.09.2026**, from standards bodies, regulators, an industry federation, a carrier and a forwarder. Commercial examples are principally DHL and Maersk; this is not a statistically representative survey of all forwarders. The 26/21 field profiles, workflow recommendations and test cases are the report's synthesis, not a form mandated or jointly endorsed by these organisations.

### 15.2 Source register

| ID | Publisher and page | What was used / authority limit |
| --- | --- | --- |
| S01 | [FIATA: About freight forwarding][S01] | Forwarder responsibilities and service scope; industry federation definition |
| S02 | [ICC: Incoterms 2020][S02] | Official overview of 11 rules, costs/risks/obligations; full purchased text not reviewed |
| S03 | [Maersk: Online quote][S03] | Observed public route, service, commodity, equipment, date and company fields; no quote submitted |
| S04 | [DHL UAE: Discover Quote + Book][S04] | Estimated city/cargo data, save/resume, services and price/speed/emissions comparison; product-specific |
| S05 | [DHL: Calculating chargeable weight][S05] | Gross/volumetric comparison, Air and LCL ratios, FCL basis and carrier exceptions |
| S06 | [IATA: Dangerous goods][S06] | DGR role, 2026 edition and operator/state variations; not a complete licensed rulebook |
| S07 | [IATA: Batteries][S07] | Battery configuration and guidance needs; landing-page edition references require freshness checks |
| S08 | [IATA: DG shipper's declaration][S08] | Declaration and e-DGD purpose; applicable exceptions still require the regulations |
| S09 | [IMO: IMDG Code][S09] | Packaged maritime DG framework and substance-specific requirements; no full code review |
| S10 | [IMO: Verified gross mass][S10] | Shipper responsibility, weighing approaches and condition for loading |
| S11 | [WCO: Harmonized System][S11] | International six-digit classification structure; no commodity-specific classification performed |
| S12 | [European Commission: ICS2][S12] | ENS data completeness, modes, pre-loading/pre-arrival timing and filing arrangements |
| S13 | [US Treasury OFAC: Sanctions List Service][S13] | Official list facilities; not a complete assessment of applicable sanctions laws |
| S14 | [ISO: ISO 14083:2023][S14] | Published abstract on transport-chain GHG methodology; full standard not reviewed |
| S15 | [DHL: Cargo insurance explained][S15] | Distinction between liability and insurance; historical numerical examples not adopted |
| S16 | [DHL: Demurrage, detention and storage][S16] | Different charge exposures and need for quotation/free-time clarity; local terminology varies |
| S17 | [DHL: Incoterms explained][S17] | Named place, edition, mode distinction and limits of Incoterms; explanatory article, not legal authority |
| S18 | [DHL: Air cargo documentation][S18] | Typical shipper/forwarder documents and consistency; jurisdiction-specific wording not generalised into law |
| S19 | [Maersk: Terms for Spot Booking][S19] | Scope, currency, cargo-weight changes, surcharges, amendment and free-time dependencies; product-specific contract, not Noatum terms |
| S20 | [DHL: Stackable and palletized][S20] | Packed dimensions/handling and stackability importance; equipment limits must be independently confirmed |

### 15.3 Limits and confidence

- **High confidence:** modes and service scope require different data; packed weight/dimensions and equipment matter; commercial terms must explain price applicability; DG and VGM are not merely pricing fields. These conclusions have direct publisher support.
- **Design recommendation, not external fact:** the precise 18+8 / 18+3 field grouping, prefill choices, validation checkpoints and screen arrangement need Noatum approval.
- **Not verified:** Noatum's actual supplier contracts, customer SOPs, CW1 mapping completeness, branch customs/legal obligations, current insurer policy or production field support.
- **Not a certification:** the full paid ICC, IATA and ISO publications were not accessed. No claim of legal, DG or ISO compliance is made.
- Some initially attempted global DHL/Maersk URLs returned not found and were replaced with working regional/official URLs. Trade.gov pages and a Freightos page could not be meaningfully extracted; they are not cited as supporting evidence. No conclusion relies on those failed retrievals.
- Public commercial articles simplify complex subjects and can contain stale examples. This report does not reproduce generic liability limits, aircraft dimensions, DG thresholds, carrier charges or sales-contract terms as universal rules.
- No carrier quote/booking was submitted, no private customer data was entered, and no application, mockup, FR, NFR or delivery commitment was changed by this report.

[S01]: https://fiata.org/about-freight-forwarding/
[S02]: https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/
[S03]: https://www.maersk.com/onlinequote
[S04]: https://www.dhl.com/ae-en/home/global-forwarding/mydhli/discover-quote-and-book.html
[S05]: https://www.dhl.com/us-en/home/global-forwarding/freight-forwarding-education-center/calculating-chargeable-weights.html
[S06]: https://www.iata.org/en/programs/cargo/dgr/
[S07]: https://www.iata.org/en/programs/cargo/dgr/lithium-batteries/
[S08]: https://www.iata.org/en/programs/cargo/dangerous-goods/shippers-declaration/
[S09]: https://www.imo.org/en/OurWork/Safety/Pages/DangerousGoods-default.aspx
[S10]: https://www.imo.org/en/OurWork/Safety/Pages/Verification-of-the-gross-mass.aspx
[S11]: https://www.wcoomd.org/en/topics/nomenclature/overview/what-is-the-harmonized-system.aspx
[S12]: https://taxation-customs.ec.europa.eu/customs/customs-security/import-control-system-2_en
[S13]: https://ofac.treasury.gov/sanctions-list-service
[S14]: https://www.iso.org/standard/78864.html
[S15]: https://www.dhl.com/us-en/home/global-forwarding/freight-forwarding-education-center/cargo-insurance-explained.html
[S16]: https://www.dhl.com/us-en/home/global-forwarding/freight-forwarding-education-center/demurrage-detention-and-storage-charges.html
[S17]: https://www.dhl.com/us-en/home/global-forwarding/freight-forwarding-education-center/incoterms-explained.html
[S18]: https://www.dhl.com/us-en/home/global-forwarding/freight-forwarding-education-center/air-cargo-documentation.html
[S19]: https://terms.maersk.com/terms-spot-booking
[S20]: https://www.dhl.com/us-en/home/global-forwarding/freight-forwarding-education-center/good-cargo-packaging.html
