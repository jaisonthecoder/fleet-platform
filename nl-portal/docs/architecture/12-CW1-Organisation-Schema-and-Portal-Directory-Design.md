# 12 — CargoWise organisation schema, and what the portal directory should look like

> **Status:** evidence and proposed design, 13.09.2026. Written because Noatum has
> supplied no CargoWise organisation extract yet, and the organisation directory
> (ORG-02 … ORG-05) cannot be designed from guesswork.
>
> **Everything in section 2 is read from a published schema file.** Everything in
> sections 4 onward is a proposal that needs business confirmation. Sample rows in
> section 5 are **fictional** — they are shaped like CargoWise data, they are not
> Noatum data.

---

## 1. Sources

| Ref | Source | Retrieved | What it establishes |
| --- | --- | --- | --- |
| **X1** | `https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/NativeOrganization.xsd` | 13.09.2026 | The organisation record: `Organization` → `OrgHeader`, its addresses, contacts, customs codes, company data, classification flags |
| **X2** | `https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/Native.xsd` | 13.09.2026 | The envelope, the `Action` enumeration, the simplified `NativeOrganizationAddress` used on transactions, `CustomValues`, `emptiableDateTime` |
| **X3** | `https://all2sconsultingllc.com/2025/08/07/account-classifications-in-cargowise-one-click-away-from-chaos-or-clarity/` — "Account Classifications in CargoWise", ALL2S Consulting, 07.08.2025 | 13.09.2026 | What "Customer" means as a CargoWise account classification, and that one organisation may hold several classifications |
| **X4** | `https://www.studocu.com/en-za/document/university-of-south-africa/bachelor-of-commerce-in-transport-and-logistics/creating-of-organizations/27438445` — CargoWise One user guide extract | 13.09.2026 | "An organisation does not need to be created multiple times … one for creditors, one for debtors" |
| **X5** | `https://res.cloudinary.com/myquest/image/upload/v1667330333/Prod/resource_center/35693/5286/HQ-ORG020HOW_-_How_to_manage_organisations_V1.3_g3udvl.pdf` — WiseTech "How to manage organisations in CargoWise One" v1.3 | 13.09.2026 (indexed extract only; PDF body would not render) | "An address … always belongs to only one organisation" |
| **X6** | `https://all2sconsultingllc.com/2025/10/21/company-branch-and-division-mapping-the-hidden-key-to-accurate-reporting/` — "Company, Branch and Division Mapping", ALL2S Consulting, 21.10.2025 | 13.09.2026 (indexed extract; page returns 403 to direct fetch) | CargoWise's internal hierarchy is Company → Branch → Division |
| **X7** | `https://elicittechnology.com/blogs/do-you-really-need-another-cargowise-system-for-every-branch-or-company-expansion/` — Elicit Technology (CargoWise service partner), 26.05.2026 | 13.09.2026 | One CargoWise environment can hold many companies, branches and countries |
| **X8** | `https://raw.githubusercontent.com/shippool/CargoWiseOne-Schema/master/UniversalCommon.xsd` | 15.09.2026 | The full `OrganizationAddress` party type — `AddressType` required and unenumerated, both identifying codes optional, `AddressOverride`, `ScreeningStatus`, `LocalAddressCollection` — plus the enumerated `RecipientRole` code list |

**What these sources are, and are not.** They are a **historical, third-party copy** of
the CargoWise One native schema (namespace `http://www.cargowise.com/Schemas/Native/2011/11`,
`version="2.0"`). They are **not** Noatum's current contract, and they are **not** evidence
that any of this is enabled on Noatum's tenant. They are good enough to design field
shapes, lengths and relationships against, and to write a sensible file contract. They are
not good enough to claim "this is what CargoWise will send us".

Open question **OQ-2 / ORG-D06** — is the feed reachable at all — is unaffected by this
document.

---

## 2. What the schema actually says

### 2.1 The organisation header — `OrgHeader` [X1]

| Element | Type / length | Notes |
| --- | --- | --- |
| `PK` | string | CargoWise internal surrogate key |
| `Code` | **string(12)** | **Candidate Key: `Code`** — see §3.1, this is the crux of ORG-D02 |
| `FullName` | string(100) | |
| `Language` | string(7) | |
| `Category` | **string(3)** | A coded classification. The code list is **not** in the schema |
| `ScreeningStatus` | string(3) | Sanctions/party screening outcome |
| `IsActive` | boolean | |
| `ClosestPort` | Code string(5) | UN/LOCODE-shaped |
| `SystemCreateTimeUtc` | emptiableDateTime | |
| `SystemLastEditTimeUtc` | emptiableDateTime | Change detection without hashing, **if populated** |

Plus **role flags as individual booleans** — not a list, not an enum:

`IsForwarder`, `IsShippingProvider`, `IsAirWholesaler`, `IsSeaWholesaler`, `IsRailProvider`,
`IsLineHaulProvider`, `IsMiscFreightServices`, `IsAirCTO`, `IsAirLine`, `IsBroker`,
`IsLocalTransport`, `IsPackDepot`, `IsSeaCTO`, `IsShippingLine`, `IsUnpackDepot`,
`IsRailHead`, `IsRoadFreightDepot`, `IsShippingConsortium`, `IsFumigationContractor`,
`IsGlobalAccount`, `IsNationalAccount`, `IsSalesLead`, `IsCompetitor`, `IsTempAccount`,
`IsPersonalEffectsAccount`, `IsConsignee`, `IsConsignor`, `IsTransportClient`,
`IsWarehouseClient`, `IsContainerYard`, `IsDistributionCentre`, `IsControllingCustomer`,
`IsControllingAgent`, and `IsUserFlag1` … `IsUserFlag24`.

> **There is no `IsCustomer`.** See §3.2.

### 2.2 Addresses — `OrgAddressCollection/OrgAddress` [X1]

Candidate key **`OrgHeader.PK + Code`** — an address code is unique *within* its organisation.

| Element | Length | Maps to |
| --- | --- | --- |
| `Code` | 25 | our `source_address_code` |
| `CompanyNameOverride` | 100 | trading name at this address |
| `Address1`, `Address2` | 50 each | |
| `City` | 50 | |
| `State` | 25 | |
| `PostCode` | 10 | |
| `CountryCode/Code` | 2 | ISO 3166-1 alpha-2 |
| `RelatedPortCode/Code` | 5 | UN/LOCODE |
| `Email` | 254 | |
| `Phone`, `Fax`, `Mobile` | 20 | |
| `IsActive` | boolean | |
| pickup/delivery windows, dock height, forklift, pallet jack, `LoadingUnloadingConstraints` | various | operational, **not** customer-portal content |

**Address purpose is a separate repeating child**, `OrgAddressCapabilityCollection/OrgAddressCapability`:

| Element | Length |
| --- | --- |
| `AddressType` | **3** |
| `IsMainAddress` | boolean |

So one address can carry **several purposes**, and one of them is flagged main. That is
exactly a `text[]` of purpose codes plus an `is_primary` boolean.

### 2.3 Registration identifiers — `OrgCusCodeCollection/OrgCusCode` [X1]

Candidate key `CodeType + OrgHeader.PK + RefCountry.Code + OrgAddress.PK`.

| Element | Length | Meaning |
| --- | --- | --- |
| `CustomsRegNo` | **254** | the identifier value |
| `CodeType` | 3 | scheme (VAT, EORI, TRN …) — code list not in schema |
| `CodeCountry/Code` | 2 | jurisdiction |
| `CountryDefault` | boolean | the default identifier for that country |
| `PremisesAddress` | ref | an identifier can be tied to a specific address |

The transaction-level form [X2] is narrower — `RegistrationNumber` with `Type/Code` (3),
`Type/Description` (35), `CountryOfIssue/Code` (2), `Value` (**35**).

> Two different maximum lengths for the same concept, 254 and 35. Size for the larger.

### 2.4 Contacts — `OrgContactCollection/OrgContact` [X1]

Candidate key `ContactName + OrgHeader.PK`.

Carries `ContactName` (256), `JobCategory` (35), `Email` (254), `Phone`/`Mobile` (20),
`IsActive`, `Salutation`, `Birthday`, `Gender`, `ProfilePhoto` (base64) …

**and also:**

| Element | Type |
| --- | --- |
| `WebAccessEnabled` | boolean |
| `Password` | string(50) |
| `PasswordHash` | base64Binary |
| `PasswordSalt` | base64Binary |
| `PasswordHashIterations` | int |

> **A naive contact import would copy credential material and personal data into the
> customer portal.** This is now the concrete reason the `organisations.contacts.import`
> switch ships **off**, and ORG-D05 must name these fields as excluded. See §3.4.

### 2.5 Per-company data — `OrgCompanyDataCollection/OrgCompanyData` [X1]

Candidate key **`GlbCompany.PK + OrgHeader.PK`**.

Holds `IsDebtor`, `IsCreditor`, `ARCategory`, `APCategory`, credit limits, credit hold,
payment terms, `ControllingBranch` (3), `ARExternalDebtorCode`, VAT configuration, and so
on — **one row per CargoWise company**, not one per organisation.

This is the single most important structural fact in the document. See §3.1 and §3.2.

### 2.6 Relationships between organisations [X1]

- `ControllingCustomer` → `Code` (12) — a reference to **another organisation**
- `OrgRelatedPartyCollection` — typed party relationships
- `OrgSupplierBuyerLink_Supplier/Buyer` — trading relationships

**There is no parent/child hierarchy element.** This matches PRD v4: *"CW1 has no hierarchy
function. Each legal entity is one organisation."*

### 2.7 The envelope and message semantics [X2]

- `Action` enumeration: **`INSERT`, `UPDATE`, `MERGE`, `DELETE`** — on almost every element
- `Native/Header` carries `OwnerCode` and `EnableCodeMapping`
- `emptiableDateTime` = a dateTime **or an empty string** — a present element is not a usable timestamp
- `CustomValues` = repeating `Name` + typed value (`Boolean` / `DateTime` / `Integer` / `String`)

### 2.8 The party reference used on transactions — `NativeOrganizationAddress` [X2]

| Element | Length |
| --- | --- |
| `OrganizationCode` | 12 |
| `AddressShortCode` | 25 |
| `CompanyName` | 100 |
| `AddressType` | **40** (required) |
| `Address1/2`, `City`, `State`, `Postcode`, `Country/Code`, `Port/Code` | as §2.2 |
| `RegistrationNumberCollection` | as §2.3 |

> **This bears directly on OQ-3a** ("do shipment parties carry organisation or address
> codes?"). The answer this schema gives is **both**: a party is an organisation code
> *plus* an address short code. It does not tell us which one Noatum populates in practice.
> Our rule is unaffected: we resolve the customer from **`OrganizationCode` only**, and the
> address short code is displayed, never used to grant access (FR-ORG-005).

### 2.8.1 The fuller party — `OrganizationAddress` in `UniversalCommon.xsd` [X8]

Re-read on 15.09.2026. The universal form carries more than the simplified native one, and
four of its properties change how parties must be handled. Decisions are in **ADR-007**.

| Element | Length | Required |
| --- | --- | --- |
| `AddressType` | 40 | **Yes** (`minOccurs="1"`) |
| `OrganizationCode` | 12 | No |
| `AddressShortCode` | 25 | No |
| `AddressOverride` | boolean | No |
| `ScreeningStatus` | `CodeDescriptionPair` | No |
| `GovRegNum` / `GovRegNumType` | 254 / 3 | No |
| `Contact`, `Email`, `Phone`, `Mobile`, `Fax` | — | No |
| `Port` | `UNLOCO` 5 | No |
| `LocalAddressCollection` | repeating `OrganizationLocalAddress` | No |
| `RegistrationNumberCollection` | repeating | No |

1. **`AddressType` is the discriminator, and it is not enumerated.** A free 40-character
   string in both the native and universal forms, whereas `Action` and `RelatedPartyType`
   in the same files *are* enumerated. The value list exists only in Noatum's CargoWise,
   so it belongs in `mapping_entry`, never in TypeScript.
2. **Both identifying codes are optional.** §2.8 recorded that both *exist*; it did not
   record that both may be **absent**. A party can legally arrive as `AddressType` plus a
   typed company name. Such a party is unidentifiable and must grant nothing.
3. **`AddressOverride`** marks an address that was typed over on the transaction and no
   longer matches master data. Transaction parties therefore must never write back into
   `master_org` / `org_address`.
4. **`ScreeningStatus`** carries sanctions/denied-party screening on the party. Internal
   only, on every surface.
5. **`LocalAddressCollection`** repeats the address in another language (`Language` per
   entry) — relevant to the EN/ES requirement when party display is built.

> **A separate, genuinely enumerated role list exists**: `RecipientRole` in the same file
> restricts `Code` to roughly eighty three-character values (`CNE`, `CNR`, `FOR`, `PUP`,
> `WHS`, `BCO`, `CAR`, `BRO` …). It governs **document recipients**, not shipment parties,
> so it is not the `AddressType` list — but it is a reasonable seed vocabulary and shows
> CargoWise does use short role codes elsewhere.


---

## 3. Findings that change our design

### F-0. What a "customer" is in CargoWise — and why ours is a different thing

This is the finding everything else hangs off, so it comes first.

**In CargoWise there is no customer record.** There is one `Organization`, and
"Customer" is an **account classification ticked on it** [X3]:

> *"Customer — an organization that is billed for services. Used for: AR invoicing,
> customer statements, revenue reporting."* … *"They pay us → tick Customer. We pay them →
> tick Vendor. They move freight → tick Carrier. They represent us in another region →
> tick Agent."* … *"If a company legitimately fits more than one role, you can (and should)
> select multiple boxes to avoid duplicating the organization."* [X3]

The CargoWise user guide says the same thing from the other direction:

> *"An organisation does not need to be created multiple times, e.g. one for exports, one
> for imports, one for creditors, one for debtors."* [X4]

And underneath the tick box, the money lives per CargoWise company: `OrgCompanyData` is
keyed `GlbCompany.PK + OrgHeader.PK` and holds `IsDebtor`, `ARCategory`, `ARDebtorGroup`,
credit limit, credit hold and `ARExternalDebtorCode` [X1].

So the CargoWise answer to "is this a customer?" is: **"in which of our companies, and in
what capacity?"** One organisation can be our customer in Spain and our vendor in Vietnam.

**The portal's "customer" is a completely different object.** It is a **tenant**: a set of
people who sign in, a set of feature entitlements, a billing relationship with us, and a
boundary that data must not cross. Nothing in CargoWise represents it.

| | CargoWise | Portal |
| --- | --- | --- |
| The thing | `Organization` with classification flags | `customer_group` — a tenant |
| Owned by | CargoWise | **The portal.** Typed in, or imported from a non-CargoWise source |
| "Customer" means | ticked "Customer" — we bill them | a login boundary and an entitlement set |
| Can nest? | **No** hierarchy. Only `ControllingCustomer`, a pointer | **Yes** — `customer_group.parent_id` |
| Relationship | — | one customer **holds many** organisations; one organisation **belongs to one** customer |

**Therefore the direction of work is: customer first, organisations attached to it.** The
supplied Create-customer mockup does exactly that — step 1 searches the already-imported
directory and attaches every organisation belonging to that customer. An organisation
import never creates a customer.

### F-0b. Regions and branches — and why one customer may hold several organisations

CargoWise organises **the forwarder's own business** in three levels [X6]:

```
Company  →  Branch  →  Division / Department
```

All three are three-character codes in the schema (`GlbCompany`, `GlbBranch`,
`GlbDepartment`, `ControllingBranch`, `Department`). **There is no "region" level** —
a region is something a forwarder builds by grouping branches, which is exactly what our
portal-owned `region` table does.

**One environment usually covers many countries.** A CargoWise service partner is explicit
that a growing forwarder can *"add branches within the same country, create multiple
companies inside the same environment, operate different business units together, share
operational data across entities, maintain separate financial structures, centralize
visibility"* without a second system; a separate environment is only for *"a clear business
or technical need"* [X7]. This is the practical answer to **ORG-D02**: expect **one**
`source_instance`, and confirm it.

**Inside one database the organisation record is global.** One code, one row, visible to
every company and branch. What varies by company, branch or country is the *relationship
data hanging off it*, never its identity [X1]:

| Table | Keyed by | Varies per |
| --- | --- | --- |
| `OrgCompanyData` | `GlbCompany.PK + OrgHeader.PK` | **company** — `IsDebtor`, credit limit, `ARCategory` |
| `OrgARTerms` | … `+ GlbBranch.PK + GlbDepartment.PK` | **branch and department** — invoice terms |
| `OrgCountryData` | `OrgHeader.PK + RefCountry.Code + OrgAddress.PK` | **country** |
| `OrgStaffAssignments` | `Role + Department + OrgHeader.PK + GlbCompany.PK` | **company** — account manager |
| `OrgAppointedAgentPorts` | `GlbCompany + PortOrCountry` | **company and port** — agent coverage |

So the same company can be our customer in Spain and our vendor in Vietnam, with different
credit terms per Noatum company, all on **one** organisation record.

**CargoWise models multi-entity customers itself.** Three fields exist only for this:
`IsGlobalAccount`, `IsNationalAccount`, and `ControllingCustomer` → another organisation's
code [X1].

That is the validation for our model: **one portal customer may hold several
organisations**, because CargoWise already expects one commercial customer to span several
legal entities. Two rules follow, and both matter:

- Separate legal entities are **always** separate organisations with separate codes,
  whatever Noatum's own branch structure looks like. Grouping them into one portal login is
  a **commercial decision** — who signs and who is billed — not a CargoWise fact.
- `ControllingCustomer` is a **pointer, not a hierarchy**. CargoWise grants nothing through
  it and neither do we (FR-ORG-005).

**Two things never to conflate.** `ControllingBranch` on an organisation is *Noatum's*
servicing office, not where the customer is. And a customer's own structure is not Noatum's:
Noatum Spain servicing Acme Germany is ordinary and must not affect who sees what.

**Where that leaves visibility.** Grouping entities under one customer means their users
could see all of it. The control for that already exists in the schema:
`user_account_access` — *"restricts a user to a subset of the accounts in their group; no
rows means all accounts"*. Grouping is therefore safe **provided that restriction has a
screen**, which is why it is built rather than left as a column.

### F-A. ORG-D02 is effectively answered: the namespace is the CargoWise *database*

`OrgHeader`'s candidate key is **`Code` alone** [X1]. Inside one CargoWise database an
organisation code is therefore unique. The sub-division that does exist — `GlbCompany`,
3 characters — sits **below** the organisation in `OrgCompanyData`, keyed
`GlbCompany.PK + OrgHeader.PK`. A company is a *facet of* an organisation, never a
namespace for it.

**Decision.** `source_instance` means **"which CargoWise database"**. It is *not* a branch,
a company or a region. The natural key `(source_system, source_instance, code_norm)` stands
and is correct whether Noatum runs one CargoWise database or several.

**Still to confirm:** does Noatum run one CargoWise database, or more than one? If one,
ORG-D02 closes with `source_instance` holding a single constant.

### F-B. There is no "is customer" flag in CargoWise

Customer-ness is expressed three indirect ways, none of them a single boolean on the
organisation:

1. `OrgCompanyData.IsDebtor` — **per CargoWise company**
2. `ARCategory` / `ARDebtorGroup` — accounts-receivable classification, per company
3. `OrgHeader.Category` (3 chars) — a coded classification whose code list is not published

**Decision.** `master_org.is_customer` and `is_supplier` are **portal-derived
classifications**, and the schema and UI must say so. We additionally store what the source
actually gives us: `category` (3) and `source_roles text[]` holding the CW1 role flags that
were set. Nothing is invented, and the derivation is visible.

**Still to confirm:** which signal Noatum wants used — `Category` code, `IsDebtor`, or an
explicit list of role flags.

### F-C. `Code` is 12 characters, not 40

We store `varchar(40)`. **Keep it.** Two reasons: the published document-type catalogue
already contains 4-character codes where the historical schema said 3, so these limits move;
and truncating a source key is unrecoverable. Over-provisioning a key column costs nothing.

### F-D. Contacts carry credentials

See §2.4. **Decision:** `org_contact` stays created-and-empty. When ORG-D05 clears, the
importer must carry an explicit allow-list of contact fields, and `Password`,
`PasswordHash`, `PasswordSalt`, `PasswordHashIterations`, `WebAccessEnabled`,
`ProfilePhoto`, `Birthday` and `Gender` are **never** ingested.

### F-E. `DELETE` exists in the message contract

`Action` can be `DELETE` [X2]. Our mirror never deletes: a `DELETE` action **deactivates**
(`is_active = false`) and writes an `org_change_log` row. A linked organisation that the
source deletes must raise an operational alert, not silently remove a customer's access.

### F-F. `MERGE` exists, and we have no answer for it

`Action` can be `MERGE` [X2] — two CargoWise organisations becoming one. If a merged-away
code is linked to a customer, the link must move, and that is a **tenancy event**.

**This is a new gap.** Recorded as **ORG-D09** below; not designed here.

---

## 4. Resulting portal design

### 4.1 `master_org` — the mirror

| Column | Source | Note |
| --- | --- | --- |
| `id` | portal | surrogate |
| `source_system`, `source_instance` | portal/config | §3 F-A |
| `source_code` | `OrgHeader.Code` | varchar(40), §3 F-C |
| `code_norm` | generated | `lower(btrim(source_code))` |
| `name` | `OrgHeader.FullName` | |
| `legal_name` | portal | where the source separates it |
| `category` | `OrgHeader.Category` | **new**, 3 chars |
| `source_roles` | the `Is*` booleans that are true | **new**, `text[]` |
| `is_customer`, `is_supplier` | **derived** | §3 F-B |
| `country_code`, `city`, `state`, `postcode` | main address | |
| `source_branch_code` | `ControllingBranch` | a CargoWise attribute, **not** the Noatum servicing branch |
| `source_controlling_customer_code` | `ControllingCustomer.Code` | **renamed** from `source_parent_code`; evidence only, grants nothing |
| `is_active` | `IsActive` | deactivate, never delete |
| `is_source_confirmed` | portal | the link gate |
| `source_hash`, `first_seen_at`, `last_seen_at`, `source_version` | portal | change detection |

### 4.2 `org_address`

Adds, from §2.2: `related_port_code` (5, UN/LOCODE), `company_name_override` (100),
`email`, `phone`. `purposes text[]` holds `OrgAddressCapability.AddressType` codes;
`is_primary` holds `IsMainAddress`.

### 4.3 `org_registration_id`

`value` widened to **254** (§2.3), plus `scheme_description` (35) from the transaction form.

### 4.4 The customer, and how organisations attach to it

From the supplied Create-customer and Customer-detail mockups.

**`customer_group`** — portal-owned, created independently of the directory.

| Column | Note |
| --- | --- |
| `parent_id` | Customer hierarchy. The mockup shows *"IRG North America Inc. · child"*. **Not** a CargoWise hierarchy — CargoWise has none |
| `name`, `legal_name`, `country_code` | |
| `email_domains` | Domains a Customer Admin may invite without a Noatum override |
| `status` | `onboarding` / `active` / `suspended` / `closed` |
| `default_servicing_branch_id` | The mockup's *"default servicing ESVLC"* |
| `tier`, `flags` | entitlements |

**`customer_account`** — the link, one row per organisation attached to a customer.

| Column | Note |
| --- | --- |
| `customer_group_id` + `org_id` | the link itself |
| `cw1_org_code` | globally unique on its normalised form — one organisation, one customer |
| `justification`, `linked_by_user_id`, `linked_at` | who linked it and why. Recorded, **not** approved by a second person |
| `servicing_branch_id` | the mockup's *"per-office assignment on each link"*, falling back to the customer default |

**Rules the mockups state, and where each is enforced.**

| Rule | Enforced by |
| --- | --- |
| One organisation belongs to one customer | **Database** — unique index on the normalised code |
| Only a source-confirmed organisation may be linked | **Database** — composite foreign key |
| *"Inactive organisations cannot be onboarded"* | **Service**, at link time. Deliberately not a database rule: an organisation going inactive in CargoWise later must not break an existing row, it must raise an alert |
| A pending link grants nothing | **Replaced.** There is no approval step. The equivalent protection is the customer lifecycle: a customer that is still `draft` grants nothing, whatever is linked to it |
| *"33 addresses inherit"* | **Schema shape** — addresses hang off the organisation and have nowhere to record a customer, so they cannot be linked individually (FR-ORG-005) |
| *"Linking makes records **eligible**; what each user sees still follows visibility rules and permissions"* | Two separate layers: eligibility (this link) and visibility (RLS + permissions) |

**Data re-evaluation.** The mockup reports *"Completed 12.06.2026 17:05 · 1,412 shipments ·
388 invoices · 22 quotes · per entity type · eligibility only; permissions still apply"*.
Linking or unlinking changes which records a customer may see, so it must trigger a
re-evaluation pass with a visible result. **Not built** — belongs with ORG-08.

### 4.5 The file contract — proposed answer to ORG-D03

Three CSV files, UTF-8, comma-separated, first row = header. Column names are ours; the
**source column** tells the operator exactly which CargoWise field to export.

**`organisations.csv`**

| Column | CargoWise source | Required |
| --- | --- | --- |
| `org_code` | `OrgHeader.Code` | yes |
| `full_name` | `OrgHeader.FullName` | yes |
| `category` | `OrgHeader.Category` | no |
| `is_active` | `OrgHeader.IsActive` | no, default true |
| `country_code` | main address `CountryCode/Code` | no |
| `city`, `state`, `postcode` | main address | no |
| `controlling_customer_code` | `ControllingCustomer.Code` | no |
| `controlling_branch_code` | `OrgCompanyData.ControllingBranch.Code` | no |
| `roles` | semicolon-separated set of the true `Is*` flags | no |
| `source_last_edit_utc` | `SystemLastEditTimeUtc` | no |

**`organisation_addresses.csv`**

`org_code`, `address_code` (`OrgAddress.Code`), `address_types` (semicolon-separated
`OrgAddressCapability.AddressType`), `is_main_address`, `company_name_override`,
`address_1`, `address_2`, `city`, `state`, `postcode`, `country_code`,
`related_port_code`, `email`, `phone`, `is_active`.

**`organisation_registrations.csv`**

`org_code`, `code_type` (`OrgCusCode.CodeType`), `value` (`CustomsRegNo`),
`country_code` (`CodeCountry/Code`), `is_country_default`.

**What makes a file authoritative.** A file is authoritative when the operator declares, at
upload, that it is a **complete snapshot** of a named `source_instance`. Only an
authoritative snapshot may deactivate organisations by absence. A file uploaded as a
**delta** may only add and update. In addition, a safety brake: if an authoritative snapshot
contains fewer than a configured proportion of the currently active rows, the run aborts and
deactivates nothing.

> This is a **proposal**. ORG-D03 is the sign-off that it matches what Operations can
> actually export.

---

## 5. Sample data — fictional, CargoWise-shaped

> **These are invented organisations.** No real Noatum customer, code, tax number or address
> appears. They exist so the directory can be seen and the link gate exercised.

`organisations.csv`

```csv
org_code,full_name,category,is_active,country_code,city,state,postcode,controlling_customer_code,roles
ACMEIB001,Acme Iberica SA,CUS,true,ES,Coslada,Madrid,28821,,IsConsignor;IsTransportClient
ACMEDE001,Acme Deutschland GmbH,CUS,true,DE,Hamburg,,20457,,IsConsignee;IsTransportClient
MERIDIAN01,Meridian Foods Ltd,CUS,true,GB,Felixstowe,Suffolk,IP11 3SY,,IsConsignee
GULFPET001,Gulf Petrochem Trading LLC,CUS,true,AE,Abu Dhabi,Abu Dhabi,,,IsConsignor;IsGlobalAccount
ATLASLOG01,Atlas Logistics Inc,CUS,true,US,Compton,CA,90220,,IsTransportClient;IsNationalAccount
ATLASLOGMX,Atlas Logistics Mexico S de RL,CUS,true,MX,Monterrey,Nuevo Leon,64000,ATLASLOG01,IsTransportClient
CARRIER001,Iberian Container Line SA,CAR,true,ES,Barcelona,Barcelona,08039,,IsShippingLine;IsShippingProvider
AGENTVN001,Saigon Freight Services JSC,AGT,true,VN,Ho Chi Minh City,,,,IsForwarder;IsControllingAgent
DORMANT001,Costa Verde Produce SL,CUS,false,ES,Almeria,Almeria,04001,,IsConsignor
```

`organisation_addresses.csv`

```csv
org_code,address_code,address_types,is_main_address,address_1,city,state,postcode,country_code,related_port_code
ACMEIB001,MAD-HO,HDO;BIL,true,Avenida de Italia 2,Coslada,Madrid,28821,ES,ESMAD
ACMEIB001,VLC-WH,DLV;PKP,false,Poligono Fuente del Jarro,Valencia,Valencia,46988,ES,ESVLC
MERIDIAN01,FXT-HO,HDO,true,Dock Road,Felixstowe,Suffolk,IP11 3SY,GB,GBFXT
MERIDIAN01,FXT-AC,BIL,false,Accounts Payable PO Box 114,Ipswich,Suffolk,IP1 2AA,GB,
PACIFICT01,NGB-FY,PKP,false,Beilun Industrial Park,Ningbo,Zhejiang,,CN,CNNGB
```

`organisation_registrations.csv`

```csv
org_code,code_type,value,country_code,is_country_default
ACMEIB001,VAT,ESA12345674,ES,true
ACMEIB001,EOR,ESA12345674,ES,false
GULFPET001,TRN,100123456700003,AE,true
ATLASLOG01,EIN,12-3456789,US,true
```

> `ATLASLOGMX` points at `ATLASLOG01` through `controlling_customer_code`. That relationship
> is **displayed as evidence and grants no access** — linking `ATLASLOG01` to a customer does
> **not** give that customer sight of `ATLASLOGMX`'s cargo.

---

## 6. Decisions this document takes, and what remains open

| Ref | Taken here |
| --- | --- |
| ORG-D02 | `source_instance` = the CargoWise **database**. Composite natural key retained. Confirm whether Noatum has one database or several |
| ORG-D03 | Three-file contract in §4.4; "authoritative" = operator-declared complete snapshot, plus a shrinkage brake |
| F-B | `is_customer` / `is_supplier` are portal-derived and labelled as such; `category` and `source_roles` carry what the source said |
| F-D | Contact credential and personal fields are named as never-ingested |
| F-E | `DELETE` deactivates; a delete affecting a linked organisation alerts operations |

| Ref | Still open |
| --- | --- |
| **ORG-D09** *(new)* | `MERGE`: what happens when two CargoWise organisations become one and the losing code is linked to a customer |
| ORG-D05 | Legal basis for contacts and identifiers. The schema makes the risk concrete (§2.4) |
| ORG-D06 / OQ-2 | Whether the feed is reachable at all |
| OQ-3a | Which of `OrganizationCode` / `AddressShortCode` Noatum populates on parties. §2.8 shows both exist; our resolution stays organisation-level regardless |
| — | The code lists behind `Category`, `AddressType`, `CodeType` and `ScreeningStatus` are **not** in the schema and must come from Noatum's CargoWise |

---

## 7. What this does not claim

- Not evidence of Noatum's current CargoWise version, configuration or enabled messages.
- Not a working integration. `ORG-D06` / `OQ-2` remain open.
- The sample rows are **fictional**, including every code, address and tax number.
- Field lengths come from a historical published schema and must be re-checked against the
  contract Noatum's integration team actually supplies.
