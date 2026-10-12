# CW1 data contracts, standards and sample-data research

| Document control | Value |
| --- | --- |
| Research date | 11.09.2026 |
| Status | Research and proposed integration-team checklist; not an approved interface specification |
| Scope | All CW1 inputs identified for the Noatum Customer Information Platform, including master data, business records, confirmations and integration metadata |
| Change boundary | Documentation only. No application, schema, baseline requirement or integration configuration changed |
| Evidence boundary | Public primary standards/vendor pages, public secondary integration guidance, and a historical third-party CW1 XSD repository. No access to Noatum CW1 or private vendor documentation |
| Sample boundary | All business records below are synthetic. XML examples are deliberately small structural examples, not complete business transactions; JSON and CSV are proposed exchange/projection examples, not CargoWise formats |

## 1. Executive findings

1. There is no single global freight payload standard that determines what CW1 will send. Separate business meaning, identifier/code standard, message schema, transport and the locally enabled integration contract.
2. CargoWise Universal XML and Native XML are different schema families. They are not IATA Cargo-XML, DCSA JSON, ONE Record JSON-LD or UN/EDIFACT. Conversion needs explicit mappings, not an extension change from XML to JSON.
3. A historical public schema set provides concrete structural evidence, but cannot certify the current CW1 contract. Its repository identifies release `19.11.13.351`; the original vendor-issued schema set for Noatum's environment must replace it before implementation acceptance [CW4].
4. CargoWise's current public mega-features page says eAdaptor Next replaces SOAP for inbound and outbound communication [CW1]. This does not prove Noatum has migrated. Do not prescribe a SOAP endpoint, authentication method or migration deadline from an old example.
5. The most urgent business contract remains OQ-3/3a/3b: party roles, actual organisation/address identifiers and the invoice addressee. Wrong ownership resolution is a customer-data disclosure risk.
6. Source product capability does not imply Noatum has a populated feed. In particular: full contacts/addresses, branches, quotation alternatives, document retrieval and source change semantics require evidence.
7. No configured automatic rate source exists in this project. Price lines in a CW1 quotation are transaction data, not permission to build a rate repository. CW1 product advertising does not reverse this business fact.
8. Initial quote-request sync, approval and offer publication are independent. UC-12 adds direct publication; a direct-only quote must not acquire a fabricated CW1 reference. The governing-source reconciliation and D-18 decisions remain prerequisites.

### Evidence labels

| Label | Meaning |
| --- | --- |
| Business requirement | Required by the current project documents, not proof that CW1 exposes it |
| Vendor public | CargoWise/WiseTech publicly describes a capability, not its Noatum configuration |
| Historical XSD | Element/type directly inspected in the public third-party schema set; version-specific evidence only |
| Global standard | Publisher-backed vocabulary or semantic rule; adoption/version still requires agreement |
| Proposed contract | Recommended exchange information or test; not a new approved field or workflow |
| Unconfirmed | Real source/export/operation evidence still needed |

Project sources: [PRD integration](../PRD-Noatum-Customer-Platform.md#L374), [working baseline and decisions](README.md#L34), [KT Q&A](../meetings/2026-09-09-QA-KT-CargoWise-Process-Flow.md), [organisation import contract](08-Customer-Organisation-and-Access-Research.md#L102), [quotation workflow](07-Internal-Quotation-Pricing-Workflow.md), [integration stage](Implementation%20plans/phase%201%20-%20phases/04-Integration-and-Organisation-Directory.md), and [lookup plan](Implementation%20plans/Lookup-Management-Implementation-Plan.md).

## 2. What format might actually arrive?

Directions below are from the portal's perspective: portal inbound is CW1 outbound. An endpoint called inbound by CargoWise normally receives messages sent TO CargoWise.

| Data family | Evidence-backed format candidate | What must be confirmed |
| --- | --- | --- |
| Organisation directory | Native XML organisation message; projected CSV/reference API supplied by the integration team | Exact export route, field projection, source identity, paging and delta/snapshot behavior |
| Shipments, containers, consols, legs | Universal XML `UniversalShipment/Shipment` [X1] | Enabled export, record type/context and relationships actually populated |
| Events | Universal XML `UniversalEvent/Event` [X2] | Triggers, event catalogue, source record reference, event time and cancellation/correction behavior |
| Invoices/credit notes | Universal XML `UniversalTransaction/TransactionInfo` [X3] | Ledger/type selection, business addressee, customer charges versus internal posting detail |
| Documents | Embedded `AttachedDocument` in supported messages; document request structure also exists [X8, X9] | Complete response envelope, supported filters, stable identity, binary encoding or separately agreed retrieval interface |
| Quotations | Project requires source quotes/pricing and write-back; shipment schema contains a `QuoteNumber` reference | A complete quote/pricing/options/version contract was NOT verified. Do not invent a `UniversalQuotation` schema |
| Bookings | Historical shipment schema contains `IsBooking` and `QuoteNumber` | Correct importer/exporter, source record identity, business acknowledgement and later shipment links |
| Responses | `UniversalResponse` and optional interchange acknowledgement facilities [X5, X6] | Status meanings, completion guarantees and the operation being acknowledged |
| Dictionaries/master lookups | Scheduled extract or agreed reference interface | Whether CW1, another licensed source or a maintained business catalogue owns each dataset |

### Transport is a separate agreement

- XML is a payload, not a transport. SOAP envelopes, HTTP endpoints, eAdaptor Next and integration-team REST wrappers must not be conflated.
- CSV over an agreed file channel or JSON from an integration-team API is possible only if that team supplies and owns that contract. Neither is guaranteed as a native CW1 route.
- eAdaptor Next security details in third-party guidance mention OAuth2/JWTs/certificates [CW3]. Obtain the actual direction-specific authentication specification; these terms alone do not establish a usable grant, audience, certificate or endpoint.
- The project allows a different integration transport behind adapters. It does not authorise direct database access to CW1 or browser-to-CW1 calls.
- Do not assume an exported document is a public URL, or a browser can safely fetch it without the portal's document checks.

### Namespace and version distinctions

| Item | Historical evidence | Interpretation |
| --- | --- | --- |
| Universal namespace | `http://www.cargowise.com/Schemas/Universal/2011/11` | Namespace identifier, not an API endpoint or guarantee that the payload is current |
| Native namespace | `http://www.cargowise.com/Schemas/Native/2011/11` | Separate schema family |
| Universal XSD metadata | Inspected shipment/event/transaction/response schemas identify version `1.1` | Not the CargoWise product build or quote revision |
| Native XSD metadata | Native/organisation schemas identify version `2.0` | Not permission to choose a version arbitrarily |
| Instance `version` attribute | Optional token in the inspected declarations | Exact required value belongs in the approved route contract |
| Business revision | Quote option/version, record revision or source change sequence | Must be explicitly correlated; cannot be replaced with an XML schema version |

`UniversalInterchange` has ordered `Header` and `Body`; the header includes `SenderID` and `RecipientID`. `Native` also defines a header/body envelope. Both inspected envelopes permit arbitrary child payloads with `processContents="skip"`: validating an envelope alone does not validate its business payload [X6, X7].

CargoWise also publicly advertises Connector and Mapper, with Mapper supporting XML, EDIFACT, iDOC, JSON and CSV transformations [CW1]. This supports asking the integration team for a documented projection, but does not establish an automatic REST endpoint or Noatum licence/configuration. The same page advertises emissions and carrier-contract capabilities; their existence does not make them approved or available sources for this project.

## 3. Field-level business inventory

The names below describe logical information to request, NOT confirmed CW1 element names. Exact paths are provided only where separately supported by the historical XSD evidence. Optional source data must not become a fabricated mandatory field.

### 3.1 Organisation, address, contact and operating structure

| Information to request | Business use | Contract caveat |
| --- | --- | --- |
| Source instance/namespace and stable organisation identity | Avoid identical codes from different source instances colliding | Whether PK, code or a composite remains stable under rename/merge must be agreed |
| Original organisation code and name | Staff directory, deliberate customer linking | Preserve original text; lookup normalisation must be source-specific |
| Country, city and active state | Search and source-status display | Source-active is not portal-active; inactive handling is a decision |
| Client/carrier/agent/supplier classifications where supplied | Appropriate onboarding search | An organisation may have several classifications; do not assume a single exclusive category |
| Address identity/code and owning organisation | Address resolution and location display | Linking remains organisation-level; this relationship may be required even when full address display is deferred |
| Address purpose(s), label and components | Billing, pickup, delivery and document addresses | Repeatable collection, not a single universal company address |
| Primary indicator, active/effective dates where supplied | Explain current addresses without rewriting historical snapshots | Do not invent these when absent |
| Contact identity, organisation/address association, name/function and permitted communication details | Business contact display | Purpose/legal basis and field availability must be approved; never auto-create users |
| Registration identifier, scheme and jurisdiction where needed | Disambiguation of legal entities | No global one-field VAT assumption; avoid indiscriminate personal-data import |
| Operating company/branch identity, name, source status and relationships | Verify branch routing context | A source branch association is not automatically customer ownership or pricing responsibility |
| Branch operating address/contact and legal issuer information where supplied | Operational contacts and approved quotation output | Do not equate operating location with registered office; source ownership unconfirmed |
| Source change/version/time and rename/merge/deactivation/removal signals | Safe daily refresh and reconciliation | Distinguish missing fields, explicit removal and incomplete snapshots |

Historical paths [X4]: root `Organization`, child `OrgHeader`; selected children include `PK`, `Code`, `FullName`, `IsActive` and `OrgAddressCollection`. `NativeOrganization` is a complex type name, not the root element in this file. Source contacts and company-specific fields exist in that broad schema, but their presence is not evidence of enabled extraction.

The historical universal `OrganizationAddress` type contains both `OrganizationCode` and `AddressShortCode` [X8]. This is a useful evidence request for OQ-3a, not its answer. Inspect real exported parties and transactions.

CW1's legal-entity/address arrangement must not be mistaken for a source customer hierarchy. The portal groups customers manually; a future MDM hierarchy is a separately approved source. Do not copy a simulator `parentCode` into production access logic.

### 3.2 Reference data

| Dataset | Logical information | Source/maintenance rule |
| --- | --- | --- |
| Countries | Code system, code, name, permitted subdivisions where needed | ISO 3166 or approved projection; geography does not grant access |
| Locations | Code system, code, name, country, supported location functions and source status | UN/LOCODE and IATA must remain distinguishable; verify airport versus metropolitan location |
| Currencies | Alphabetic code, applicable minor unit and source edition | Currency minor unit is not an exchange rate or universal rounding policy |
| Charge codes | Code, source description, active state, approved canonical mapping | Prices are stored on transactions, not on generic lookup items |
| Incoterms | Rule, supported edition and authorised labels | Exact source/licence and supported subset to approve; named place is transaction input |
| Units | Unit code, code system, dimension and label | Unit changes must not silently change calculation behavior |
| Package types | Package code and label | Cartons/pallets are packaging, not ISO container size/type |
| Equipment types | Source code, canonical/ISO relationship and label | Commercial labels may not map one-to-one to ISO codes |
| Vessel references | Stable vessel identifier where available and name | Voyage number and schedule are separate data |
| Status codes | Entity-specific source code and business meaning | Map to implemented canonical states; never create a new lifecycle through lookup editing |
| Event codes | Source code/description and operations-approved mode/critical-path/exclusion classification | CW1's generic catalogue is not inherently customer-safe or mode-specific |
| Document types | Source code/description/category plus approved portal publication policy | Unknown types hidden; manual source tagging remains a residual operational risk |

Branches, organisations and their addresses remain domain records, not copies in a generic lookup table. EN/ES portal labels are not guaranteed to exist in CW1. Translation ownership, fallback and source refresh must be agreed.

### 3.3 Quotations and pricing

| Information to request from CW1 | Purpose and unresolved detail |
| --- | --- |
| Quote reference, source identity, organisation and branch context | Adopt CW1-created quotations and identify the correct portal customer |
| Request details: mode/service, route, Incoterm, cargo/equipment, references and remarks | Reconstruct a source-originated request; actual completeness varies with source practice |
| Customer-safe offered carrier/service, transit estimate and alternative route/scope | Present a comparable offer; carrier disclosure remains portal policy |
| Charge code/description, charging basis, quantity, unit selling rate, currency and amount | Display/reconcile selling charges; define decimal precision and included/excluded amounts |
| Currency totals, validity and commercial terms | Customer decision and immutable accepted output; never sum unlike currencies |
| Status/change indication, revision identity and timestamps | Avoid duplicate adoption and out-of-order overwrites |
| Portal reference plus option/version correlation | Match replies to the exact submitted business operation |
| Business acceptance/rejection, resulting source reference and authoritative returned values | Distinguish transport receipt from persisted commercial result |
| Cost/margin fields only if approved and needed | Keep internal-only; do not expose all `JobCosting` data to customers |

Historical `UniversalShipment/Shipment/QuoteNumber` is an optional string with maximum length 20 in the inspected release [X1]. This is a candidate reference field, not proof that the schema carries complete quotations or that every importer creates the required linkage.

No verified current contract was found for alternatives, selected-option acceptance, quotation revisions, approval, cancellation or direct-offer later handover. Do not assume one record per option or one multi-option CW1 record. Ask for successful and rejected examples of each approved operation.

### 3.4 Shipments, consols, containers and legs

| Information | Why it matters |
| --- | --- |
| Source record identity/type, shipment/job reference, status and context | A job, consol and booking must not collapse into one record |
| Shipment-party role plus organisation/address references | Resolve customer visibility using approved roles and deliberate links |
| Mode, direction and service/cargo characteristics | Air, FCL, LCL and applicable operational views |
| House/master transport-document references, customer references and source booking/quote links | Unified search and later cross-entity navigation; a search reference is not a tenant identifier |
| Origin/destination and intermediate transport legs | Route display and event context; retain location code systems |
| Carrier, vessel identifier/name, voyage or flight reference | Explain the actual leg; identifiers belong to different schemes |
| Packages, quantities, gross weight, volume and source units; dimensions where supplied | Shipment detail and comparison with original request; do not replace actual data with quoted quantities |
| Container identity, size/type and shipment/consol association | Shared/LCL relationships and container-level tracking |
| Planned, estimated and actual pickup/departure/arrival/delivery values | Keep forecasts separate from facts; preserve prior ETA values for variance |
| Related/parent/sub-record relationships | Avoid assuming one shipment per booking or one shipment per container |

The historical `Shipment` type includes context, `IsBooking`, `QuoteNumber`, packing/container/leg collections, milestones, attachments and related shipment collections [X1]. Exact element order, record selectors and export behavior are schema/route-specific. A shared wire structure does not erase the three business entities.

### 3.5 Milestones, exceptions and source corrections

Request event identity, source code, record association, event time, time semantics, location/leg/container context where supplied, creation/update time and correction/cancellation information. Preserve carrier/source provenance when supplied rather than claiming every event is a direct carrier fact.

Historical `UniversalEvent/Event` requires `EventTime` and `EventType`; `EventType` is at most three characters but is not enumerated into a complete code list by that XSD [X2]. Do not put DCSA `DEPA` into it merely because the business meaning is departure.

Critical Noatum milestones: picked up, departed, ETA, arrived and delivered, with approved sea equivalents. Request customs holds and final clearance outcomes. Operations must classify exclusions from the generic catalogue. A source hold does not authorise exposure of every internal customs step.

Carriers do not reliably supply revised ETA values. The portal needs agreed missing-ETA behavior and delay-variance rules, not fabricated predictions. Source occurrence time, source message time, portal receipt time and portal publication time are different latency clocks.

Important schema nuance: `EventTime` uses `emptiable_dateTime`, a union permitting a date-time OR an empty string [X2, X8]. Required element presence does not ensure a usable timestamp. Similarly, a maximum string length does not prove a code belongs to the approved catalogue. Completeness and code-mapping checks must be separate from XSD validation.

### 3.6 Documents

| Information | Contract need |
| --- | --- |
| Stable identity and revision/replacement relationship | Required to avoid duplicates and stale downloads; not verified as a direct `AttachedDocument` field |
| Parent shipment/job/booking and source context | Correct association and permission evaluation |
| Source type code, filename and source publication metadata | Mapping and diagnostics; publication flag alone is not customer permission |
| File bytes or agreed retrievable reference | Delivery mechanism, encoding, content type, size limit and authorised retrieval |
| Save/update timestamp and applicable source information | Synchronisation and replacement behavior |
| Financial addressee association when applicable | Apply financial privacy independently of shared shipment visibility |
| Removal/revocation behavior | Prevent an obsolete or newly restricted file remaining downloadable |

Historical `AttachedDocument` requires `FileName`, `ImageData` of `xs:base64Binary`, and `Type`; optional information includes `IsPublished`, `SaveDateUTC`, `SavedBy`, `Source` and visibility data [X8]. The classification path in this type is `Type/Code`, not an assumed `DocumentType/Code`. No explicit document ID or download-URL field was verified in that type.

`UniversalDocumentRequest/DocumentRequest` exposes filters including `DocumentType`, `IsPublished`, `SaveDateUTCFrom`, `SaveDateUTCTo`, company, branch and department [X9]. This establishes a request structure, not a live route, supported retrieval right or response contract.

Typical content: packing list, commercial invoice, arrival/shipping notices, house/master bills or air waybills, and relevant certificates. Intercompany/internal material and rated bills of lading never reach customers. A supplier commercial invoice attachment is not automatically a Noatum receivables transaction. Source publication flags and manual type tags do not replace the approved allow-list and content controls.

### 3.7 Invoices and credit notes

Request transaction identity/number/type, source ledger/company, actual addressee organisation/address, related jobs, invoice dates, charge lines, currency and totals. Due/paid dates and outstanding amounts exist in the historical schema but should only be imported/displayed if the approved financial scope needs them.

The root is `UniversalTransaction`, with child `TransactionInfo`, not `Transaction`. The inspected type includes a required `PostingJournalCollection` with at least one `PostingJournal` [X3]. Accounting journal structure is not automatically the customer charge-line model; mapping must be approved by Finance.

Agree credit-note sign convention, tax/net/gross treatment, original-invoice references where supplied, reversals, currency scale and source updates before implementing totals. Do not turn invoice visibility into payment collection or infer the paying party from Incoterms. Cross-trade and split billing require independent addressee resolution.

### 3.8 Bookings and acknowledgements

Request source booking identity/status, controlling customer and branch context, confirmed operational details, quote-number linkage, accepted changes/cancellations and later shipment references. Cargo pickup/off-site-delivery and Shipped events enforce the agreed change/cancellation gate.

For every submitted operation distinguish:

1. Transport delivery/receipt.
2. Parsing or processing response.
3. Actual business acceptance, with the affected source record and accepted values.
4. Later source publication/echo and final portal reconciliation.

Historical `UniversalResponse` requires `Status` and `Data`, optionally `ProcessingLog`. `Status` has maximum length three, but the XSD does not define its meanings. `Data` permits zero or one arbitrary child [X5]. Never invent a success code or assume HTTP 200/status text guarantees commercial persistence.

Historical interchange acknowledgement controls include `OnAll`, `OnError`, `OnSuccess`, and channel values `eHub`/`eAdaptor` [X6]. These are not evidence of exactly-once delivery or a retry SLA.

## 4. Global standards and mapping decisions

| Standard/source | Verified meaning | Noatum mapping consequence |
| --- | --- | --- |
| ISO 3166 [S1] | Alpha-2, alpha-3 and numeric country codes; separate subdivision/former-code parts | Preserve scheme and leading zeros; country is not customer region/branch |
| UN/LOCODE, Recommendation 16 [S2] | Country alpha-2 plus three location characters; functions distinguish sea/air/road and other uses | Not a terminal ID; preserve release/status/function; a port location may have multiple functions |
| IATA location and airline codes [S3] | Three-character location codes can identify airports, metropolitan areas or intermodal locations; airline designators are distinct | Do not equate an airport code with a city code, ICAO code or airline accounting prefix |
| ISO 4217 / SIX [S4] | Currency codes and minor units; verified JPY=0, AED=2, KWD=3, CLF=4, XAU=N.A. | Never enforce two decimals globally; N.A. is not zero; precision/rounding policy remains separate |
| UNECE unit/package vocabularies [S5] | `KGM` kilogram, `MTQ` cubic metre, `CMT` centimetre; `CT` carton, `PX` pallet | `KG` from a source is not automatically the same lexical code as `KGM`; map explicitly |
| ISO 6346 / BIC [S6] | Equipment identity: prefix/category/serial/check digit; separate four-character size/type | Container number is not booking reference; valid checksum does not prove existence or owner registration |
| IMO ship identifier [S7] | `IMO` plus seven digits identifies a ship persistently | Vessel name changes do not create a new ship; voyage remains separate |
| WCO HS [S8] | International harmonisation at six digits; national extensions vary | Preserve edition/jurisdiction for longer codes and leading zeros; no universal 10-digit HS field |
| ICC Incoterms 2020 [S9] | Seven any-mode rules, four sea/inland-waterway rules | Record rule + named place/port + edition; do not derive payer, full forwarder scope or title from the rule |
| IATA Cargo-XML [S10] | Air-cargo electronic message standards | Not CargoWise Universal XML; a distinct schema and mapping effort |
| Cargo iQ [S11] | Air-cargo process/performance and route-map framework | Not a message envelope or a guaranteed source event list |
| IATA ONE Record [S12] | Common cargo data model, JSON-LD and secured web APIs | Not evidence that Noatum's CW1 route returns JSON-LD |
| DCSA T&T 2.2.0 [S13] | Checked API uses SHIPMENT/TRANSPORT/EQUIPMENT events and planned/estimated/actual classifiers | Useful comparison, not an approved new feed or evidence of CW1 codes |
| UN/CEFACT / UN/EDIFACT [S14] | Semantic models and EDI message families are distinct; IFTMIN instructions, IFTSTA status, INVOIC invoice at a high level | Directory release and partner guide required; exact segment definitions were not verified in this research |
| W3C XML Schema datatypes [S15] | Decimal and date/time lexical/value rules | Preserve precision; no exponent in `xs:decimal`; an unzoned timestamp is not implicitly UTC |
| IATA DGR / IMO IMDG guidance [S16] | Mode-specific dangerous-goods rules | UN number/class alone is not complete DG acceptance; applicable edition, cargo and operator rules need operational review |

UNECE's publications page at research time labelled `2025-1` production separately from a pre-release updated 31.08.2026 [S2]. Pin approved releases rather than infer a dataset version from the current year. Likewise, DCSA 2.2.0 is the version inspected, not a claim that it is the latest or deployed by CW1.

### Commercial and calculation distinctions

- Total versus per-piece weight and dimensions must be explicit. Gross weight, net weight, chargeable weight and container verified gross mass (VGM) are not interchangeable.
- Twelve cartons measuring 60 x 40 x 50 centimetres each occupy 1.440 cubic metres. A total gross mass of 240 kg is a separate input, not derivable from those dimensions.
- At the project's Air 1:6000 example basis, those dimensions imply 240 kg volumetric weight before applicable rounding/business rules. This example does not establish a universal carrier factor.
- FCL equipment pricing is not automatically a price per TEU; LCL W/M needs an agreed rate basis. Unit codes do not encode pricing logic.
- An offer expiry date, cargo-ready date, sailing date and rate-applicability window are different fields.
- Incoterms 2020: EXW/FCA/CPT/CIP/DAP/DPU/DDP are any-mode; FAS/FOB/CFR/CIF are sea/inland-waterway. Do not reproduce this as new blanket submission validation without the business-approved supported profile.
- `45G1` is a 40-foot high-cube general-purpose equipment size/type example, not 45-foot equipment [S6]. Commercial `40HC` remains a separate mapped label.
- Unknown dates, currencies, locations or classifications must remain unknown/rejected/quarantined as appropriate; no invented default UTC, AED, branch or customer.

## 5. Synthetic samples: what the data can look like

### 5.1 Historical Native XML organisation fragment

Validated against historical [X4] and its resolved dependencies on 11.09.2026; not a complete Native/eAdaptor envelope, approved export or business-valid import. Fictional customer. No instance version selected without a route contract.

```xml
<Organization xmlns="http://www.cargowise.com/Schemas/Native/2011/11">
  <OrgHeader>
    <Code>DEMOORG01</Code>
    <FullName>Example Components Trading</FullName>
  </OrgHeader>
</Organization>
```

### 5.2 Historical Universal XML reference fragment

Validated against historical [X1] and its resolved dependencies on 11.09.2026, but not a full quote or booking. It intentionally omits identifiers/context required by an actual route. This is a concrete example of schema-valid content that does not prove business completeness.

```xml
<UniversalShipment xmlns="http://www.cargowise.com/Schemas/Universal/2011/11">
  <Shipment>
    <QuoteNumber>QT-DEMO-001</QuoteNumber>
  </Shipment>
</UniversalShipment>
```

These XML snippets are not asserted to conform to Noatum's current XSD. No fabricated event codes, transaction journal structures, success statuses or quotation-option XML are supplied.

### 5.3 Proposed organisation CSV projection

Integration-team projection only, NOT a vendor CSV layout. UTF-8, delimiter/quoting, nullable values, line endings, boolean values and full/delta semantics must be specified. The sample is a proposed complete extract, not a definition of production update behavior.

```csv
source_instance,organisation_code,name,country_code,city,is_active
DEMO-CW1,DEMOORG01,Example Components Trading,AE,Dubai,true
DEMO-CW1,DEMOORG02,Example Components Distribution,ES,Valencia,true
```

Use a separate repeatable address projection, not one flattened row that loses additional addresses:

```csv
source_instance,organisation_code,address_code,purpose,address_line_1,city,country_code
DEMO-CW1,DEMOORG01,DEMOADDR01,billing,Example Building 1,Dubai,AE
DEMO-CW1,DEMOORG01,DEMOADDR02,pickup,Example Warehouse 2,Dubai,AE
```

The purpose labels are illustrative, not verified CW1 codes. Neither row creates a portal customer link. No genuine phone numbers, emails, tax identifiers or credentials are included.

### 5.4 Proposed canonical JSON example

This is a research projection, NOT generated API types, a CW1 JSON API or an approved DTO. Field names are explanatory. Fictional IDs are deliberately prefixed with DEMO; map standards to source codes explicitly. The direct offer has no CW1 quote reference.

```json
{
  "exampleOnly": true,
  "sourceInstance": "DEMO-CW1",
  "organisation": {
    "code": "DEMOORG01",
    "name": "Example Components Trading",
    "country": { "scheme": "ISO3166-1-alpha2", "code": "AE" },
    "addressReferences": ["DEMOADDR01", "DEMOADDR02"]
  },
  "cargo": {
    "packageCount": 12,
    "packageType": { "scheme": "UNECE-Rec21", "code": "CT" },
    "dimensionsEach": { "length": "60", "width": "40", "height": "50", "unit": "CMT" },
    "grossWeightTotal": { "value": "240.000", "unit": "KGM" },
    "volumeTotal": { "value": "1.440", "unit": "MTQ" }
  },
  "directOffer": {
    "portalReference": "DEMO-Q-001",
    "cw1QuoteReference": null,
    "optionReference": "DEMO-OPTION-A",
    "commercialRevision": 1,
    "policyRevision": "DEMO-POLICY-1",
    "chargeLines": [
      {
        "sourceChargeCode": null,
        "description": "Illustrative main carriage",
        "basis": "per-shipment-example",
        "quantity": "1",
        "sellingUnitRate": "1250.00",
        "currency": "AED",
        "amount": "1250.00"
      }
    ],
    "totalsByCurrency": [{ "currency": "AED", "amount": "1250.00" }]
  },
  "sharedShipment": {
    "sourceReference": "DEMO-S-001",
    "partyReferences": [
      { "roleMeaning": "shipper", "organisationCode": "DEMOORG01" },
      { "roleMeaning": "consignee", "organisationCode": "DEMOORG02" }
    ]
  },
  "invoice": {
    "sourceReference": "DEMO-INV-001",
    "shipmentReference": "DEMO-S-001",
    "addresseeOrganisationCode": "DEMOORG02",
    "currency": "EUR",
    "total": "800.00"
  }
}
```

The EUR invoice illustrates independent addressee ownership; it is not derived from the AED offer and implies no FX rate. Both shipment parties may qualify for shipment visibility under the approved policy, but only the linked invoice addressee qualifies for financial visibility. Null `sourceChargeCode` signals an unmapped research example, not a valid submission default.

### 5.5 Event, container and monetary examples

| Example | Meaning and validation boundary |
| --- | --- |
| `TRANSPORT / ARRI / EST` | Corroborated DCSA concepts for an estimated arrival, not a CW1 event code or complete DCSA payload |
| `2026-09-11T14:30:00+04:00` | Same instant as `2026-09-11T10:30:00Z`; original offset may matter for explanation |
| Container `SYNU1234568`, size/type `45G1` | Synthetic checksum example: weighted sum 5596, remainder 8. Owner registration and physical existence are NOT verified |
| `JPY 12000`, `AED 12000.50`, `KWD 12000.125` | Different ISO 4217 minor units; no exchange/conversion relationship implied |
| `FCA Example Warehouse 2, Dubai, UAE, Incoterms 2020` | Fictional named-place illustration; actual agreed handover point and freight service/payer need separate definition |

### 5.6 Remaining domain examples and expected interpretation

These are logical sample rows, NOT XML elements, approved statuses or a complete source dataset. Tokens beginning DEMO are fictional placeholders; operational source codes and record-type discriminators must come from the approved contract.

| Family | Illustrative values | Expected interpretation |
| --- | --- | --- |
| Operating structure | instance DEMO-CW1; company DEMO-COMPANY; branch DEMO-BRANCH; country AE | Namespaced source association only; no automatic region assignment or staff permission |
| Contact | organisation DEMOORG01; contact DEMO-CONTACT-1; name Example Contact; email contact@example.invalid | Business contact only; reserved invalid domain, not a working recipient or invited portal user |
| Source quotation | source quote QT-DEMO-001; organisation DEMOORG01; revision token DEMO-REV-2 | Different from the direct-only offer above; exact revision/option representation unverified |
| Quote response | portal request DEMO-REQUEST-1; source quote QT-DEMO-001; outcome meaning accepted | Meaning only, not an invented CW1 success status. Must prove the precise persisted option/version |
| Booking linkage | DEMO-B-001 and DEMO-B-002 both reference QT-DEMO-001 | One quote, two distinct bookings; never merge the bookings by quote reference |
| Later shipment linkage | DEMO-B-001 later links to DEMO-S-001; DEMO-B-002 has no shipment yet | Missing shipment reference does not negate a confirmed booking |
| Consol/container association | consol DEMO-C-001; shipments DEMO-S-001 and DEMO-S-002; container SYNU1234568 | Associations may be shared; do not infer invoice ownership or duplicate a container per customer |
| Transport leg | DEMO-LEG-1; mode meaning sea; voyage DEMO-026E; vessel identity not supplied | Keep missing identifier unknown; do not use voyage or vessel name as an IMO number |
| Event correction | DEMO-E-001 estimate 14:30+04:00, later revision 16:00+04:00 on 11.09.2026 | Preserve old estimate and correction lineage; do not manufacture an actual arrival |
| Document metadata | DEMO-DOC-1; parent DEMO-S-001; filename example-packing-list.txt; classification pending | Suggested stable ID requires source agreement; pending/unknown type cannot be published |
| Attachment encoding | UTF-8 text Example document; Base64 RXhhbXBsZSBkb2N1bWVudA== | Encoding illustration only, not a real trade document or evidence of MIME/type safety |
| Credit note | DEMO-CN-001; related invoice DEMO-INV-001; value 100.00 EUR | Absolute illustrative value only; sign, tax and reversal semantics need the Finance mapping |
| Source removal | DEMOORG01 omitted from a partial refresh | Do not deactivate/unlink it merely because a partial feed omitted it |

Hypothetical DEMO-COMPANY/DEMO-BRANCH values deliberately do not pretend to satisfy historical three-character source-code limits. They belong to this semantic table, never a ready-to-send CW1 XML sample.

## 6. Collection and change contract required for every feed

These are proposed integration acceptance questions, not claims that CW1 always supplies these fields.

| Contract area | Required answer/evidence |
| --- | --- |
| Ownership | Which business owner and source instance own the record? Which party/addressee actually grants access? |
| Identity | Stable record key, original source code, correlation key, schema version and rename/merge behavior |
| Completeness | Full snapshot, partial snapshot, patch or append-only event? Is absence different from explicit null/removal? |
| Ordering | Source timestamp/revision/sequence; how corrections and late events supersede earlier facts |
| Initial load | Open/history scope per module, source retention, volume, filtering and deduplication when catch-up overlaps live traffic |
| Refresh | Daily master-data baseline; source business push, or approved polling fallback with watermark/paging |
| Deletion | Explicit retirement/removal/tombstone or confirmed complete-snapshot behavior; never delete on a failed partial refresh |
| Delivery | Message ID, duplicate/redelivery semantics, retries/backoff, timeout, replay and maximum payload/batch size |
| Acknowledgement | Receipt versus parse/processing versus persisted business result; failure code meaning and operator action |
| Files | Binary/reference mechanism, identity/revision, size, encoding, authorization and scan/restriction behavior |
| Security | Direction-specific authentication, authorised source, company/branch boundaries, data minimisation and secrets handling |
| Diagnostics | Correlation, source/receive/apply times, safe error detail and named support/change-control owner |

Project targets, not demonstrated source performance: master data daily; push propagation <=60 seconds; fallback <=5 minutes where supported; portal writes visible in CW1 <=60 seconds. Air occurrence-to-publication <=3 hours is a different end-to-end target. Raw integration retention has a 13-month project baseline subject to approved Legal policy.

## 7. Sample pack to request from the CW1 team

Request anonymised, internally consistent samples with an expected-result note. Preserve referential joins while anonymising; do not send real credentials or unnecessary personal data.

| Pack | Requested scenarios and expected evidence |
| --- | --- |
| A: Master directory | Active/inactive organisations, multiple addresses/purposes, organisation-versus-address references, source code collision across instances, rename/merge, partial refresh and explicit removal |
| B: Quotes | CW1-originated request/priced offer; portal request accepted/rejected; approved pricing persisted; differences returned by CW1; status changes; duplicate/late echo; selected option/version examples if supported |
| C: Tracking | Air import/export, simple FCL, LCL/consol, shared-customer shipment, unlinked party, multi-leg/container associations, changed parties and source cancellation |
| D: Events | Actual/estimated milestones, customs hold/final clearance, internal exclusions, late/corrected/cancelled event, missing ETA, two distinct clocks and timezone/DST cases |
| E: Documents | Approved type, unknown type, internal/rated document, replacement, revoked publication, binary/retrieval example, multiple attachments and missing parent association |
| F: Financials | Invoice and credit note; supplier/consignee split billing; third-party addressee; address-code addressee; multiple currencies; reversal/update; invoice attachment distinct from accounting transaction |
| G: Bookings | Direct booking, quote-linked booking, multiple bookings per quote, accepted update/cancel, refused change after gate, delayed shipment linkage and source-created booking |
| H: Failures | HTTP success without business completion, invalid schema/code, unknown customer, duplicate message, out-of-order reply, timeout followed by successful source creation, outage replay and partial batch failure |

Ask for the approved current XSD bundle including imports/includes, integration-team OpenAPI/JSON schema if wrapped, code lists, examples, field dictionary, directional authentication guide, route/module permissions, triggers, acknowledgement semantics and test-environment verification steps. A screenshot proves neither the payload path nor successful asynchronous processing.

## 8. Readiness and decisions

### Immediate P1 gates

- D-03/OQ-2/2a: actual transport, eAdaptor generation/build, credentials provisioned outside documents, schemas and real test round trip.
- OQ-3/3a/3b: populated party/address fields, address-parent relationship, billing addressee and visibility policy. Unresolved ownership fails closed.
- Organisation/branch/reference contracts: exact source fields, source namespaces, stable identity, daily refresh and source-versus-portal ownership.
- D-12/D-18: quotation alternatives/version mapping, approval and currency rules, direct/CW1-confirmed publication, later handover and collision handling.
- D-09: first upload/import file limits and malware/unknown-result handling; do not copy an old sample's arbitrary limits.

### Later gates

- P2: approved event catalogue/exclusions, document allow-list, financial mappings, date/ETA semantics and reference/history coverage.
- P3: booking linkage, document attachment, cancellation events and business acknowledgements. Claims and sailing provider contracts are separate, not assumed CW1 feeds.
- Future: detailed PO data comes from the approved OM source; CO2 methodology/provider/phase remains OQ-20; AI output comes from approved other-team services. No automatic rate, CRM, Power BI or owned-model dependency is reinstated here.

### Verification before production acceptance

1. Validate each payload against the approved current schema, including imported schemas, business payloads inside permissive envelopes and semantic rules.
2. Demonstrate one real source record in CW1 matching each accepted portal operation and its references, not just a transport response.
3. Verify duplicates, out-of-order updates, retries after uncertain completion and mapping changes do not duplicate business results or leak data.
4. Verify financial addressee, customer-safe charges and document allow-list on every output surface, including download/PDF/export/email.
5. Reconcile record counts and selected amounts/units after a snapshot plus concurrent deltas. Preserve accepted commercial snapshots under master-data and source changes.
6. Version the contract, dataset releases, mappings and test fixtures with named integration/business approvers. Simulator success remains development evidence, not production acceptance.

## 9. Sources and research limitations

Sources below were directly inspected during the research, except the explicitly inaccessible leads listed afterward. Historical schemas are secondary evidence even though they contain concrete technical definitions. Publisher pages often explain standards without distributing full licensed texts; no full paid-standard review or certification is claimed.

### Document validation

- Both XML snippets passed .NET XML Schema validation against their linked historical root schemas with includes/dependencies resolved. Current vendor-issued Noatum schema validation remains outstanding.
- Embedded JSON and CSV parsed successfully. Cargo volume, illustrative offer arithmetic, synthetic container checksum and local Markdown links were checked; tables/fences and editor diagnostics passed.
- These checks validate research examples and document integrity, not transport authentication, actual source population, licensing, business acknowledgement, regulatory compliance or integration acceptance.

### CargoWise and integration evidence

| ID | Source | Evidence/use |
| --- | --- | --- |
| CW1 | [CargoWise mega features](https://www.cargowise.com/cargowise-mega-features/) | Primary public eAdaptor Next/SOAP replacement statement; no Noatum deployment verification |
| CW2 | [CargoWise eDocs](https://www.cargowise.com/solutions/cargowise-enterprise/edocs/) | Primary product document capabilities; no complete wire contract |
| CW3 | [Chain.io integration documentation](https://chain.io/cargowise-api-documentation/) and [eAdaptor Next overview](https://chain.io/cargowise-eadaptor-next-integration/) | Secondary Universal/Native and transport guidance, not vendor schema authority |
| CW4 | [CargoWiseOne-Schema repository](https://github.com/shippool/CargoWiseOne-Schema) | Historical third-party schema collection, README release 19.11.13.351; moving repository URL is not a pinned production dependency |
| CW5 | [Complect workflow messages](https://www.complect.io/docs/cargowise-integrations/cargowise-eadaptor-relay/xus-and-xue-messages/) and [ad hoc exports](https://www.complect.io/docs/cargowise-integrations/cargowise-eadaptor/ad-hoc-messages/) | Secondary examples of configured/manual exports, not proof of Noatum triggers |
| X1 | [UniversalShipment.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalShipment.xsd) | Historical shipment/reference structure |
| X2 | [UniversalEvent.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalEvent.xsd) | Historical event structure |
| X3 | [UniversalTransaction.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalTransaction.xsd) | Historical financial structure |
| X4 | [NativeOrganization.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/NativeOrganization.xsd) | Historical organisation root/type distinction |
| X5 | [UniversalResponse.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalResponse.xsd) | Historical processing response |
| X6 | [UniversalInterchange.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalInterchange.xsd) | Historical envelope and acknowledgement controls |
| X7 | [Native.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/Native.xsd) | Historical Native envelope |
| X8 | [UniversalCommon.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalCommon.xsd) | Historical attachment/organisation-address shared types |
| X9 | [UniversalDocumentRequest.xsd](https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalDocumentRequest.xsd) | Historical document-request filter structure |

### Standards evidence

| ID | Publisher/resource | Scope actually checked |
| --- | --- | --- |
| S1 | [ISO country codes](https://www.iso.org/iso-3166-country-codes.html) | Country-code scheme overview |
| S2 | [UNECE Recommendation 16](https://unlocode.unece.org/recommendation16), [publications](https://unlocode.unece.org/publications), [data attributes](https://unlocode.unece.org/docs/data-attributes) | LOCODE structure/functions, release distinction and attributes |
| S3 | [IATA location database](https://www.iata.org/en/publications/manuals/airline-airport-location-coding-databases/airport-location-identifier-database/), [code search](https://www.iata.org/en/publications/directories/code-search/) | Location types and airline/location identifier distinctions; not a bulk licensed dataset |
| S4 | [SIX standards maintenance](https://www.six-group.com/en/products-services/financial-information/data-standards.html), [currency List One XML](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) | Maintenance source and named currency/minor-unit examples |
| S5 | [UN/CEFACT units](https://vocabulary.uncefact.org/UnitMeasureCode), [package types](https://vocabulary.uncefact.org/PackageTypeCodeList) | Specific codes; not a claim to have established latest Rec20/21 editions |
| S6 | [BIC container identification](https://www.bic-code.org/identification-number/), [size/type](https://www.bic-code.org/size-and-type-code/) | Identifier/check digit and equipment-code distinction; synthetic prefix registration not checked |
| S7 | [IMO identification scheme](https://www.imo.org/en/OurWork/MSAS/Pages/IMO-identification-number-scheme.aspx) | Permanent ship identifier and separate company schemes |
| S8 | [WCO HS overview](https://www.wcoomd.org/en/topics/nomenclature/overview/what-is-the-harmonized-system.aspx), [FAQ](https://www.wcoomd.org/en/topics/nomenclature/overview/harmonized_system_faq.aspx) | Six-digit harmonisation and national-extension distinction; no classification ruling |
| S9 | [ICC wallchart description](https://2go.iccwbo.org/incoterms-2020-practical-free-wallchart.html), [introduction description](https://2go.iccwbo.org/incoterms-2020-introduction-free-document-pdf.html) | Public rule/mode and commercial-boundary descriptions, not full paid rules |
| S10 | [IATA Cargo-XML](https://www.iata.org/en/programs/cargo/e/cargo-xml/) | Messaging framework |
| S11 | [Cargo iQ](https://www.cargoiq.org/) | Process/performance framework |
| S12 | [IATA ONE Record](https://www.iata.org/en/programs/cargo/e/one-record/) | JSON-LD/API framework |
| S13 | [DCSA T&T 2.2.0](https://api.swaggerhub.com/apis/dcsaorg/DCSA_TNT/2.2.0), [event domain 1.0.4](https://api.swaggerhub.com/domains/dcsaorg/EVENT_DOMAIN/1.0.4) | Named version's event families/classifiers; not latest-version or CW1-support claim |
| S14 | [UN/CEFACT vocabulary documentation](https://vocabulary.uncefact.org/about) | BSP vocabulary identifies D23B; exact EDIFACT directory pages were inaccessible |
| S15 | [W3C XML Schema datatypes](https://www.w3.org/TR/xmlschema-2/) | Generic date/decimal semantics, not a CW1-specific profile |
| S16 | [IATA DGR](https://www.iata.org/en/publications/dgr/), [IMO dangerous goods](https://www.imo.org/en/OurWork/Safety/Pages/DangerousGoods-default.aspx) | Framework/edition dependency; full licensed acceptance tables not reviewed |

### Limitations

- No Noatum CW1 build, licensed modules, enabled route, authenticated endpoint, live payload, current official XSD or operational outcome was inspected. The workspace search found no XML/XSD files to establish an approved local fixture set.
- CargoWise generic integration/wisecloud pages could not be meaningfully extracted. Vendor account resources were not accessed. A vendor-linked Next flyer and third-party quotation PDF were not extractable; an additional Next setup-guide link returned Not Found. These were not used as schema evidence.
- Requested UNECE EDIFACT message-directory pages returned 403. No release-specific segment/cardinality claim is made; obtain the applicable implementation guide when relevant.
- Public specifications can change. The source list records the inspected pages and historical release, not an archived vendor-certified distribution or exhaustive vendor feature inventory.
- Illustrative XML/JSON/CSV does not establish current XSD conformance or a supported business operation. Exact quotations, invoice-journal mapping, document identity/retrieval and source-party policies remain the integration team's deliverables.
- This report does not amend PRD/root rules, select additional providers, prescribe new customer fields or claim standards compliance. Resolve affected scope/authority decisions through the existing approval process.
