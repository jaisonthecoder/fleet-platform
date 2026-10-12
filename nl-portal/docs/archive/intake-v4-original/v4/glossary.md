# Glossary — freight forwarding and platform terms

## Freight forwarding

| Term | Plain meaning |
|---|---|
| Freight forwarder | A company that arranges cargo transport on behalf of a customer without owning ships or planes |
| Shipper | The party sending the goods |
| Consignee | The party receiving the goods |
| Notify party | A party to be informed when the cargo arrives (often the consignee's agent) |
| Local client | The organisation the forwarder invoices for a job (CargoWise term) |
| Agent | A partner forwarder at origin or destination acting for Noatum |
| Shipment | One customer job: cargo moving from A to B |
| Consol | Several shipments grouped in one container or flight |
| FCL / LCL | Full Container Load / Less than Container Load (shared container) |
| HBL / HAWB | House Bill of Lading / House Air Waybill — Noatum's document to the customer |
| MBL / MAWB | Master B/L / Master AWB — the carrier's document to Noatum |
| POL / POD | Port of Loading / Port of Discharge |
| ETD / ETA / ATD / ATA | Estimated / Actual time of Departure / Arrival |
| Milestone, event | A step in the journey: booked, loaded on board, departed, arrived, customs cleared, delivered |
| Cargo IQ | IATA's standard set of air-freight milestones |
| Incoterm | Three-letter code (FOB, CIF, DAP…) defining who pays for which part of the journey |
| Chargeable weight | Air: max(actual kg, volume in CBM × 166.67) — the "1:6000" rule. Sea LCL: revenue tons |
| CBM | Cubic metre |
| Quote | A price offer valid for a period |
| Booking | The customer's instruction to move the cargo; start of a shipment |
| Rate | A price for a lane/service — money. Not to be confused with an emission factor |
| UN/LOCODE, IATA code | Standard codes for ports and airports |
| DG | Dangerous goods (UN number and class) |
| Purchase order (PO) | A customer's order to their supplier; PVPO is Noatum's current PO management tool |
| CO2e, emission factor, GLEC, ISO 14083 | See KB-CO2-Emissions-Calculator.md §4 |

## CargoWise One (CW1)

| Term | Plain meaning |
|---|---|
| CW1 | The operations system Noatum staff work in; system of record |
| eAdapter | CW1's integration interface — XML messages in and out |
| UniversalShipment / UniversalEvent / UniversalTransaction | eAdapter message types for shipments, milestones, invoices |
| eDoc | A document attached to a CW1 record, sent via eAdapter |
| Organisation, org code | A company record in CW1 and its unique code, e.g. ACMEUK001 |
| AdditionalReference | A CW1 field where we store our portal id to match replies |

## Platform

| Term | Meaning |
|---|---|
| CustomerGroup | Our tenant: one customer company; may have child groups (two levels) |
| CustomerAccount | One CW1 org code linked to a CustomerGroup |
| Tenant resolution | Turning the org codes on an inbound message into the customer groups that may see it |
| shipment_visibility | Link table saying which groups may see a shipment and in which role |
| Pattern A / Pattern B | Single-owner tables with `customer_group_id` / shipment-family tables using `shipment_visibility` |
| RLS | Row-level security — the database refuses rows from other tenants |
| TenantContext, TenantRepository | Per-request tenant information and the data-access layer that always applies it |
| System context | Worker execution mode allowed to write rows with an explicit tenant from resolution |
| Mapping change request | A request to link, move or suspend an org code; approved by a second person (proposal) |
| Unmapped entity | An inbound shipment, quote or invoice whose org codes match no customer |
| Feature flag | Per-customer switch for a capability |
| Adapter | An implementation of an outside-system interface (TmsQuoteAdapter, RateEngineAdapter…) |
| Slice | One feature built DB → types → API → UI and demoable |
| Simulator | Fake CW1 eAdapter used for development and tests |
| Human-in-the-loop | Every automated or AI value carries provenance and can be overridden with a reason |
