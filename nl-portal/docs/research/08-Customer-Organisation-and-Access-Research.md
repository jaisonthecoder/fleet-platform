# Customer organisations, regions, branches and portal access: research and page design

| Document control | Value |
| --- | --- |
| Date / version | 11.09.2026 / 1.0 |
| Audience | Product, Customer Success, Operations, Pricing, Identity, Integration and Engineering |
| Purpose | Research global practices and recommend how Noatum should present imported CW1 organisations, customer onboarding, addresses, users and operating structure. |
| Status | Research and proposed page design, not an approved extension of the FR baseline or evidence of implementation. |
| Evidence | Public publisher pages, including CargoWise, Maersk, DHL, DSV, Microsoft, UPU and Noatum; source register and limits below. |
| Boundary | No application, mockup, identity, CW1 master record or existing requirement changed by this report. |

## 1. Executive recommendation

Build customer management around **two separate directories**:

1. **CW1 organisations:** the imported business-party master, including associated source addresses and contacts where supplied and permitted. Importing a row does not create portal access.
2. **Portal customers:** deliberately onboarded CustomerGroups, their linked CW1 organisations, invited users, roles, feature entitlements and effective settings.

Maintain **Noatum operating structure** separately: servicing branches and, if approved, business regions used for routing and policy. A customer's warehouse address is not a Noatum branch. A customer with operations in several countries is not automatically several portal tenants.

The basic flow is:

```text
CW1 organisations, addresses and contacts
    -> validated read-only portal mirror
    -> authorised organisation-level linking to a CustomerGroup
    -> confirm servicing branch and effective policies
    -> invite first Customer Admin through the approved identity process
    -> Customer Admin invites colleagues and assigns permitted roles
    -> API grants only authorised customer data and actions
```

**Do not infer ownership from a company name, email domain, country, shared address or a source contact.** Linking a CW1 organisation is a deliberate access decision. Selecting one of its addresses is an operational choice, not another tenancy link.

## 2. What public industry evidence actually shows

| Published practice | Evidence | What to adopt or avoid at Noatum |
| --- | --- | --- |
| Centralised operational/master information supports customer visibility | CargoWise describes a global database, enterprise validation and Neo's connected customer views. [S01-S03] | Keep authoritative source data consistent; public marketing does not establish an organisation API schema or Noatum's licensed features. |
| Master organisation information includes names, addresses and codes; integrations validate uploads | Calsoft describes its CargoWise master-data tooling. [S05] | Useful corroboration of master-data categories, not proof that all fields are present in our inbound feed or that a new tool is needed. |
| Company access is managed separately from individual profile information | Maersk documents Company Permissions with named users and permission revocation. [S07] | Provide a visible user/access list within each customer, with explicit role and scope controls. |
| Company onboarding and source-address changes can involve support verification | Maersk documents company verification and support-mediated company-profile changes. [S08-S09] | Validate the customer relationship and preserve ownership of master data. Do not copy its support channel, deadlines or verification process as Noatum policy. |
| Some portals offer registration rather than invitation-only access | Maersk describes registration with company details; myDSV has registration/customer-number flows. [S06, S11] | These are alternative commercial models. Preserve Noatum's approved invitation-only customer model. |
| Company administration can expose address/contact maintenance | The public MyDHL+ company overview shows address/contact maintenance. [S10] | Relevant admin-page pattern only: this is DHL Express, not proof of myDHLi or our CW1 data-write policy. |
| User/team preferences and central address/contact synchronisation are used by global forwarders | DSV describes central synchronisation, user/team settings and controlled collaboration. [S11] | Separate reusable master data, user preferences and authorised collaboration. Do not import supplier-delegation scope or quote-conversion semantics into Noatum. |
| A party can have several business roles and several addresses | Microsoft documents the global address book and shared party roles/locations. [S12] | One organisation may be a customer and another kind of partner. An address, role and portal user are different records. This is a reference pattern, not a D365 integration proposal. |
| Legal entities and operating units serve different purposes | Microsoft distinguishes legal entities, business units, departments and purpose-specific hierarchies. [S13] | Keep Noatum legal issuer, operating branch and business region distinct. Do not assume a region is a legal entity. |
| Business-customer identity is distinct from workforce identity | Microsoft documents workforce versus external tenants and customer-account administration. [S14-S15] | Entra authenticates; the portal controls customer membership, roles and scope. An Entra administrator is not automatically a portal Customer Admin. |
| Address structure varies internationally | UPU documents country-specific address elements/templates and different postcode systems. [S16] | Avoid globally mandatory state/postcode patterns and preserve original/local-language address content. No address-validation subscription is selected. |
| Noatum has geographically distributed offices/companies | Noatum's public locations page searches by city, country or company. [S17] | Supports a multi-location experience, but does not supply authoritative CW1 branch codes, legal-entity mapping or region membership. |

**Conclusion:** the evidence supports separation of business identity, physical locations, operating structure and digital access. It does not establish a single global hierarchy, mandatory field count, universal invitation process or universal admin-screen layout.

## 3. The concepts that must remain separate

| Concept | Meaning for this portal | Ownership / limitation |
| --- | --- | --- |
| CW1 source instance | The originating system namespace | Integration configuration; exact code uniqueness must be verified across instances/companies. |
| CW1 organisation | Source business-party record used on transactions | Read-only master mirror. Do not assume one record always equals one legal entity worldwide. |
| Organisation address | Location associated with a source organisation | Source-owned, repeatable; address purpose and identifiers require payload confirmation. Never independently linked to a tenant. |
| Organisation contact | Business contact belonging to an organisation or location | Not a login identity, invitation or automatic recipient authorisation. |
| CustomerGroup | Portal customer/access boundary | Portal-owned. Several linked organisations may belong to one group. |
| CustomerAccount | Deliberate link from one source organisation to one CustomerGroup | Portal-owned mapping; at most one group per source-qualified organisation. |
| Customer parent/child | Explicit portal visibility hierarchy | Current baseline permits two levels, not an arbitrary corporate tree. Parent visibility does not grant missing permissions. |
| Customer office | User-friendly label for a linked account in current flows | Must not be confused with an individual warehouse address or a Noatum branch. |
| Noatum legal entity/company | Entity contracting or invoicing for Noatum | Confirm from the business/source owner; not inferred from a branch's country. |
| Noatum operating branch | Staff/pricing operational responsibility | Internal users carry a branch; quote queue is branch-scoped; tracking is not. |
| Business region | Grouping for business configuration/reporting if approved | No settled explicit Region entity today; see section 4. |
| Portal user | Authenticated person with explicit portal roles and customer/staff context | Entra identity pointer plus portal-managed authorisation. |
| Portal address-book entry | Reusable customer-maintained operational location | Separate from CW1 master addresses; does not create a CW1 organisation or access link. |

### 3.1 Example: one international customer

Illustrative names only: a customer has Spanish and French source organisations, two warehouses under its Spanish organisation, and is served by Noatum Valencia and another authorised branch.

- If all users are meant to operate within one shared customer boundary, one CustomerGroup may link both source organisations. Do not duplicate the Spanish organisation for each warehouse or servicing branch.
- If separate subsidiary access boundaries are required, use the approved two-level parent/child group design. A user belongs to one group; do not silently introduce arbitrary multi-group membership or a global company switcher.
- Warehouse selection does not change CustomerGroup membership.
- A pricing user at Valencia sees requests assigned to Valencia, not every request with a Spanish pickup/delivery address.
- A finance user's optional CustomerAccount restriction controls financial addressee access. It must not be presented as an all-module office restriction without an approved extension.
- Noatum's servicing branch and the customer's invoice addressee remain independent choices governed by their respective rules.

## 4. Region and branch: the unresolved design boundary

The PRD section 4a.3 still says there is no Region entity and treats a region as a branch code on organisations. Later v4 rules require internal-user branch scoping and configuration-only expansion. UC-12 now requires configurable policy scopes, with precedence explicitly gated by D-18.

Therefore, **do not silently implement Region > Country > Branch as the existing approved data model**. A country is geography; a region is a business grouping; a legal entity is a contracting body. Their relationships require confirmation.

Recommended alternatives for review:

| Alternative | Suitable when | Consequence |
| --- | --- | --- |
| Branch catalogue with optional region label | Region only helps users filter/group branches | Lowest-complexity starting point; no independent regional policy or access inheritance. |
| Managed business-region catalogue with branch assignments | Regions own settings, reporting or administrative responsibility | Requires approved membership, effective dates, scope/precedence and lifecycle rules; may need a small new reference model. |

**Recommendation:** approve a managed region concept only if D-18 policies truly need it; otherwise use a branch catalogue with a region label. The page can show both concepts, but storage, membership and permissions must follow the decision rather than drive it.

Do not infer a customer's servicing branch from its country or address. Confirm whether each CustomerAccount has exactly one servicing branch, or may be served by several branches depending on mode/service. The existing single `branch_code` fields do not prove the latter case is supported. If multiple relationships are required, design explicit routing rules after approval instead of duplicating accounts or selecting an arbitrary first branch.

## 5. CW1-to-portal data ownership and synchronisation

### 5.1 Ownership matrix

| Data | Read/display in portal | Edit authority |
| --- | --- | --- |
| Organisation code/name and supplied source classifications | Yes, to authorised staff | CW1/master-data owner; portal refresh must not overwrite a local tenant link. |
| Source addresses, contacts and registration identifiers | Only agreed fields and permitted purposes | CW1/master-data owner. Do not invent edit-back or import all contacts indiscriminately. |
| Source company/branch catalogue | Mirror if supplied through an agreed contract | Source owner; otherwise an approved maintained reference list, clearly labelled. |
| CustomerGroup name, tier, domains, hierarchy and entitlements | Yes | Authorised portal administration. |
| Organisation-to-customer link and customer-facing office label | Yes | Authorised Noatum user, confirmation/reason/audit; second-person approval only if approved. |
| Noatum servicing/routing association | Yes, separately labelled | Approved business owner/configuration, not a guessed attribute of a customer address. |
| Region labels and regional policy | Only after scope/model decision | Authorised administration under approved D-18 policy. |
| Portal invitation, role assignment and access deactivation | Yes, within authorised scope | Noatum for first admin/staff; Customer Admin for permitted own-group users. |
| Login credentials, password reset and MFA | Not stored/handled by portal | Microsoft Entra. |
| Customer-maintained address book | Yes, customer-scoped | Permitted customer users; distinct source/provenance from imported locations. |

### 5.2 Import contract to confirm

The current LLD mirror has organisation code, name, country, city, branch code, client indicator, active flag, parent code, hash and timestamps. **It does not define a complete address/contact collection.** An attractive Addresses tab is not proof that the feed supplies it.

Request an agreed field contract for:

- Source namespace and stable organisation identity; original code plus a normalised lookup key, with documented rename/merge semantics.
- Repeatable address identity, owning organisation, address purpose(s), primary designation if supplied, components, source status and effective dates if available.
- Repeatable contacts, their organisation/address relationships and permitted communication fields; purpose/legal basis for importing personal data.
- Registration identifiers including scheme/type and issuing jurisdiction, only where supplied and needed. Do not use one universal VAT field for every country.
- Operating company and branch identities, names, active state and relationships, if available. A transaction's company/branch context is not automatically customer ownership.
- Full snapshot versus delta semantics, paging, deletion/deactivation markers, timestamps/version/order, correlation and failure responses.

The daily organisation import remains the baseline. Use idempotent jobs behind the integration adapter; do not claim Neo's advertised live integration means our mirror is real-time.

### 5.3 Import and update behaviour

1. Validate source identity, completeness and shape before applying a record. Preserve enough provenance to explain its origin and last successful update.
2. Upsert source-owned master fields; preserve portal-owned links, labels, roles, entitlements and policies separately.
3. Importing a new organisation creates no CustomerGroup, user, invitation or customer visibility by itself.
4. Treat missing fields differently from explicit removal according to the contract. An incomplete delta must not clear all addresses or contacts.
5. Do not interpret a failed/partial snapshot as deletion of every omitted organisation. Apply deletion rules only to a confirmed complete snapshot or explicit source marker.
6. For source deactivation, code merges and reparenting, retain history and route consequential access changes for the approved process. Do not automatically move an organisation to a different tenant.
7. Linking/relinking changes access through an audited visibility re-evaluation. Reject duplicate ownership even under concurrent actions; prevent an interval where unrelated groups both receive access.
8. Retain transaction/accepted-quotation address snapshots as applicable. Updating a master address must not rewrite a previously accepted commercial record.

Exact stale-data thresholds, deactivation consequences, merge handling and re-evaluation cutover are recommendations requiring Integration/Product approval, not new lifecycle statuses.

## 6. Recommended internal administration pages

Use the existing Noatum design system, EN/ES strings and DD.MM.YYYY. Prefer paginated, searchable tables and unframed detail sections over a large organisational tree as the primary interface. Page names and detailed fields below are recommendations; baseline-supported concepts are distinguished from extensions in section 11.

### 6.1 CW1 organisations list

**Navigation:** Administration > CW1 organisations. Internal-only catalogue, not visible to Customer Admins.

| Area | Recommended content |
| --- | --- |
| Search | Organisation code/name; optionally registration identifier once the feed and permission model support it. |
| Filters | Country, source active state, portal linked/unlinked state and source instance; source classifications where supplied. Servicing branch filter only from a defined portal relationship. |
| Main columns | Organisation code, name, country/city, source status, linked CustomerGroup, last successful sync. Show source instance where needed to disambiguate codes. |
| Secondary detail | Primary address, classifications and servicing branches where confirmed; avoid an excessively wide default table. |
| Row actions | View organisation; Link to existing customer; Create customer from organisation; View linked customer, according to permission. |
| Feedback | Last import outcome and freshness; loading, no results, error, inaccessible record and mapping conflict. |

Use distinct labels for **CW1 status** and **Portal link status**. A source-active organisation is not necessarily an active portal customer. A source branch field must be labelled by its verified meaning, not presented as the owning pricing branch without evidence.

Do not offer Create CW1 organisation, Edit source address, Delete source organisation, automatic contact invitations or export-all by default. Source refresh/replay belongs to authorised integration administration; add no new synchronous CW1 call just for a Refresh button.

### 6.2 Organisation detail

| Tab / section | Fields and controls |
| --- | --- |
| Overview | Source organisation identity/name, source status/classifications, country, supplied identifiers, provenance and timestamps. |
| Addresses | Address label/type, formatted components, primary marker and status where supplied; organisation association is immutable here. No Link address to customer action. |
| Contacts | Permitted name, function, email/phone and source address association where supplied. Label as business contacts, not portal users. |
| Portal link | Linked CustomerGroup/account, office label, servicing association, linked by/date and reason. Link/reassign actions require permission and impact confirmation. |
| Sync and history | Last successful update, source-change summary and authorised integration diagnostics; no raw secrets or unrestricted payload dump. |

The Contacts tab can link to the separate user list when a verified portal association exists. Matching an email is not enough to merge identities or automatically invite a person.

### 6.3 Portal customers list

**Navigation:** Administration > Customers.

Columns: customer name, country, approved onboarding/active/suspended state, parent if applicable, linked organisation count, active user count and first-admin invitation progress. Servicing branch and tier can be filterable where defined.

Actions: **Create customer**, open customer, resume onboarding, and permitted suspend/reactivate actions with impact confirmation. Do not make the imported directory's entire contents appear as onboarded customers.

Counts must be permission-scoped and fetched server-side, not computed by downloading all organisations/users. Existing list/search performance targets apply; do not invent a dataset-specific pagination size here.

### 6.4 Create/onboard customer

1. Select an imported organisation, or open Create customer and search for one. Both entries use the same controlled workflow.
2. Prefill source-backed name/country. Capture portal group/display name, approved tier, allowed email domains, locale and feature entitlements. Identify which fields are portal labels rather than edits to CW1.
3. Link additional eligible source organisations belonging to that customer. Show source-qualified code, name, country, existing link and selected count. Require justification and explicit confirmation. An organisation linked elsewhere cannot be silently taken.
4. Confirm the servicing branch/routing association and effective quotation settings. Only display meaningful scopes; block ambiguous routing instead of guessing from the address.
5. Optionally establish an approved two-level parent/child relationship. Explain its data-visibility impact; a source parent code is only evidence, not an automatic access grant.
6. Invite the first Customer Admin with name, company email and locale; apply domain checks and the controlled exception policy.
7. Keep onboarding status until at least one eligible linked office and an accepted Customer Admin meet activation rules. Show whether data re-evaluation/sync has completed, independently of identity acceptance.

Use **Link organisation**, not Add address, for step 3. Source records can exist without a portal link. Customer onboarding must not create substitute CW1 records just because the desired organisation is missing; use the existing master-data support process.

### 6.5 Customer detail workspace

| Tab | Content / actions |
| --- | --- |
| Overview | Group identity/status, onboarding progress, primary admin contact and operational summary within permission. |
| Linked organisations | Account links, office labels, source details, servicing relationship and link/unlink or reassignment controls permitted by policy. |
| Users and invitations | Actual portal users and pending invitations; roles, finance-office restriction, invitation actions and deactivation. |
| Features and settings | Entitlements plus effective quotation policies/inheritance; authorised override editing only at approved scopes. |
| Hierarchy | Approved parent/child relationships and visibility explanation; no deep corporate-tree editor. |
| Audit | Authorised changes with actor, time, before/after, reason and mapping history. |

Addresses and source contacts can remain in linked-organisation detail instead of being duplicated as independent customer masters. Customer operational address book remains a separate feature.

### 6.6 Regions and branches

**Proposed navigation:** Administration > Operating structure, with Branches and, if approved, Regions views. This is an administrative reference/settings surface, not a CRM or HR system.

| View | Proposed fields | Rules |
| --- | --- | --- |
| Branch list | Branch code/name, source company/instance, country/city, region label/assignment if approved, operational status | Distinguish source active state from portal readiness. Display imported records read-only where source-owned. |
| Branch detail | Verified operating address/contact, legal-issuer reference where supplied, timezone if approved, staff assignments and effective quotation settings | Do not equate operating address, legal registered office and customer delivery address. Avoid importing HR/payroll data. |
| Region list/detail, if approved | Stable region identifier/name, assigned branches, active state and effective settings | Membership/lifecycle/precedence require D-18 decision; no assumed geography hierarchy or automatic customer access. |
| Branch readiness | Integration mapping, permitted staff/pricing capability and required policy completeness | Readiness checklist is not proof of available rates; no configured live rate source exists. |

**Adding a branch:** select an existing source branch where the catalogue is provided, then enable/configure its portal use. If there is no source feed, use a business-approved mapping maintained by authorised staff, with reconciliation ownership. Do not create a fictional CW1 branch code or write a branch back to CW1 from the portal.

**Adding a region:** if the managed-region option is approved, create a portal business grouping and associate approved branches. Confirm whether assignments can overlap or change over time before modelling them. Do not reassign customers, staff permissions or existing quote policies merely by changing the region label.

The user's latest settings requirement allows direct or CW1-confirmed quote publication. Neither mode changes organisation linking, identity, branch access or financial addressee controls. Refer to FR-CFG-001 through FR-CFG-008 and D-18 rather than implementing a second settings engine here.

### 6.7 Staff users

**Navigation:** Administration > Staff users. Separate from customer users.

Eligible staff first sign in with corporate Entra and receive an unprivileged portal record. An authorised admin assigns approved roles and a branch. Show name, email, access state, branch, roles, last activity and assignment history. Do not import CargoWise employee roles as portal permissions or build Create password/MFA controls.

Branch changes and role removal take effect on the next request. Define what happens to active claims when staff lose branch/role access; do not preserve access merely because a quote recorded an earlier policy. Cross-branch pricing requires its own permission; tracking is not automatically limited to the employee's branch.

## 7. Customer-admin pages and adding users

### 7.1 Customer Administration > Users

Show only the authorised customer's users. Columns: display name, email, assigned role presets, status, optional financial-office restriction and last activity where permitted. Pending invitations show invitation date/expiry separately from an active user's last login.

Actions: **Invite user**, edit permitted roles, deactivate/reactivate, resend or revoke pending invitation, and view own-group audit. Protect the last active Customer Admin. Bulk invitation is not an approved Phase 1 feature.

### 7.2 Invite user form

| Field | Treatment |
| --- | --- |
| CustomerGroup | Resolved from authorised context; not arbitrary customer-entered tenant selection. |
| Name | User-facing display name, subject to confirmed invitation contract. |
| Company email | Validate against registered customer domains; internal-only audited exception where approved. |
| Role presets | Multi-select only allowed external presets. Show module/action implications without a new custom-role designer. |
| Finance office restriction | Optional CustomerAccount from this group; explicitly labelled as financial scope, not all shipments/quotes. |
| Locale | EN/ES preference within existing supported locales. |
| Personal message | Optional if retained by the approved invitation contract; never credentials. |

Inviting creates a portal invitation and approved email job. **It does not by itself provision an Entra External ID account.** Identity team must confirm the supported provisioning/federation/user-flow sequence, particularly while open self-sign-up is disabled. Use Microsoft-managed flows, never temporary passwords collected or sent by the portal. [S14-S15]

Acceptance verifies the invitation binding, expiry and single use, then binds the identity by issuer and subject. Continued access is not matched by email alone. A CW1 contact, an email-domain match, or possession of a Microsoft account grants no data access.

### 7.3 Customer profile and locations

Customer users can view approved company/office information for their group, not the global organisation directory. Show source-owned fields read-only; discrepancies go through the agreed support process. A new in-portal master-data change-request workflow is optional future scope, not assumed here.

Keep the operational **Address book** visibly distinct: customer-maintained pickup/delivery locations do not change source legal/billing data. Reusing an imported address in a quote should retain provenance and a transaction snapshot; whether users can copy source addresses into their address book is a feature decision, not implicit write-back.

## 8. Address and identifier design for global use

Candidate source/display fields, only when actually supplied and permitted:

| Group | Recommended representation |
| --- | --- |
| Identity | Stable address identifier and source-qualified parent organisation; original source label. |
| Usage | Source-defined address purposes, potentially several; separate primary-per-purpose designation if available. No invented universal source codes. |
| Physical address | Address lines, building/unit where supplied, locality/city, administrative subdivision, postcode where used, country code and formatted source address. |
| Language | Preserve original script/diacritics and optional transliteration only when provided/approved. Do not destroy source identity through display normalisation. |
| Communications | Telephone with country context, email and permitted contact association; do not require a single national phone format. |
| Registration | Repeatable identifier type, value and jurisdiction where required. Do not put all VAT/EORI/business registrations in one undifferentiated number. |
| Lifecycle | Source-active indicator and validity dates if available; last successful sync and provenance generated by integration. |

Country determines applicable address validation. UPU's S42 uses common elements plus country-specific templates; this supports flexible modelling, not globally mandatory state and ZIP fields. [S16] Postal address validity also does not prove that a truck can access the site or establish a legal registered address.

Avoid importing credit limits, bank details, tax documents or personal contacts merely because they exist in CW1. Fields need a business purpose and explicit access classification. A Noatum admin page is not automatically authorised for unrestricted financial master data.

## 9. Page states, permissions and operational exceptions

| Situation | Required baseline or recommended handling |
| --- | --- |
| Organisation imported but not linked | Internal discovery only; no portal users or customer-visible data created. |
| Organisation linked to another group | Show conflict only within authorised visibility; reject duplicate linking, including concurrent requests. |
| Similar name or shared domain | Suggest human review at most; never automatic merge/link. |
| Address code arrives instead of organisation code | Resolve using the approved address-to-organisation lookup under OQ-3a; quarantine unknown/ambiguous references. |
| Import fails or becomes stale | Display last successful sync and failure state; do not report the mirror as current. Staleness action thresholds need approval. |
| Source organisation/address deactivated | Preserve history and apply approved eligibility rules; do not silently delete linked users or accepted quote data. |
| Parent group added/changed | Review data-visibility effect and re-evaluate under the approved two-level policy; no automatic role grants. |
| Organisation reassigned between customers | Authorised reasoned change plus controlled access re-evaluation; historical record ownership/replies require explicit handling. |
| Customer suspended | Deny its users on the next request while retaining data/ingestion; source CW1 organisation need not be deactivated. |
| User deactivated or permission removed | Deny the next request; prevent scheduled delivery from disclosing data after revocation. |
| Shared warehouse or contact | No shared tenant access follows from physical/email overlap. |
| Source branch missing/ambiguous | Do not derive routing from postal country; resolve through the approved mapping/process. |

UI states must distinguish loading, empty directory, filtered no results, failed sync, access denied and save failure. Paginate server-side, preserve filter context on return, use clear source/editability labels and provide keyboard-accessible dialogs/tabs with visible focus. No screenshots or browser interaction tests of a proposed portal implementation were performed.

## 10. Acceptance scenarios to bring to the workshop

1. Import an organisation with several addresses: one organisation row, several subordinate addresses, no automatic customer or user.
2. Repeat the same full import/delta: no duplicate organisations/addresses and no lost portal configuration.
3. Stop a snapshot midway: missing rows are not interpreted as source deletions.
4. Link an organisation already linked elsewhere, including simultaneous actions: duplicate ownership is refused.
5. Process identical-looking codes from two source namespaces: no accidental cross-instance match; confirm identifier semantics before rollout.
6. Add an address beneath a linked organisation: it is visible only through the appropriate scope, not independently mapped to another customer.
7. Import a CW1 contact with a company email: no login or invitation is automatically created.
8. Invite a user, then try expired/reused/wrong-identity acceptance: all refused; issuer/subject remains stable after email changes.
9. Attempt to remove the last Customer Admin: refused even under concurrent requests.
10. Parent user views authorised child data; child/sibling users cannot traverse upwards/sideways; finance still needs its permission/addressee rules.
11. Finance user restricted to one linked account cannot read another account's invoices. Do not extend this fixture into an unapproved all-module restriction.
12. One customer is served by two branches: requests follow explicit routing and staff branch permissions, not the customer's country.
13. A staff branch/role changes while holding a pricing claim: access is revoked and ownership recovery follows the approved rule.
14. Update a master address: new selections use the current record without rewriting accepted quote snapshots.
15. Rename/merge/deactivate a source organisation: history and customer links are preserved or deliberately reconciled, never guessed from name similarity.
16. Change a regional quotation setting: effective inheritance is clear; pending/accepted quotes are not silently republished or reinterpreted.
17. Onboard a second region/country with different address formatting: no tenant/auth rewrite or mandatory invented postcode.
18. Verify customer users cannot call the global organisation list or internal settings endpoints directly.

These are proposed fixtures, not a claim that tests exist or pass today.

## 11. Fit with the existing Noatum baseline

| Area | Already required | Needs clarification or approval |
| --- | --- | --- |
| Organisation mirror and linking | FR-ORG-002/003/005; daily search/import; organisation-level mapping | Full address/contact feed, stable identities, source namespace, merges/deletions and source-field ownership. |
| Customer setup | FR-ORG-001/004/006; two-level hierarchy; activation/suspension | Precise onboarding layout and visibility re-evaluation readiness. |
| Customer users | FR-IAM-005 through FR-IAM-011; invitations, roles and last-admin protection | Identity provisioning sequence and reconciliation of old email/user-schema assumptions. |
| Internal staff | FR-IAM-002/003; eligible first login without access; admin branch/role assignment | Branch catalogue authority, reassignment/claim handling and exact grants. |
| Customer address book | FR-TOL-001/002 | Relationship to imported CW1 addresses; no implicit master write-back. |
| Finance scope | FR-ORG-008 and FR-FIN-001/002 | Label the office restriction accurately; broader per-office/module scopes require a new approved requirement. |
| Regions/branches | Multi-region growth and branch pricing rules; UC-12 settings | Explicit Region concept, source-company/branch mapping and multi-branch servicing model remain unresolved. |
| Settings | FR-CFG-001 through FR-CFG-008; D-18 | Scope matrix/defaults/precedence; do not turn security invariants into toggles. |
| Global contacts/CRM | Not a new portal CRM | Do not add sales leads, campaigns, unrestricted address editing or contact-to-user auto-provisioning. |

The older onboarding design contains obsolete role-designer, local-MFA/password/session and approval-queue examples. The older KB contains superseded per-group party-policy and document-filter examples. Current root/v4 and the working FR baseline control; use the old files for context, not as copy-ready implementation instructions.

The v3 LLD is useful evidence of current intended storage, not a verified deployed schema. This research did not audit runtime code or database contents.

## 12. Decisions and evidence needed before building

These are workshop questions, not new numbered baseline decisions:

| Owner | Decision / evidence |
| --- | --- |
| Integration + CW1 master-data owner | Anonymised organisation feed with multiple addresses/contacts, source keys, classifications, parent references and update/delete/merge semantics; capability list of fields actually available. |
| Integration + Operations | One party-address example for OQ-3a, one invoice addressee example and one multi-source/company example; confirm namespaces and lookup ownership. |
| Operations + Product | Is region a label or managed business unit? Can regions cross countries/legal entities? Who owns branch creation, code changes and region membership? |
| Pricing + Customer Success | One or several servicing branches per customer account? What determines request ownership when modes/services differ? Confirm explicit routing rather than deriving it from geography. |
| Product + Security | Organisation-directory admin scope, link/reassign permissions, second-person mapping policy if desired, parent/child visibility and any additional per-module office restrictions. |
| Identity team | Invitation-only External ID provisioning/federation sequence and supported claims; distinguish portal invite from directory-account creation. |
| Privacy + Master-data owner | Which contacts/identifiers can be imported, viewed and retained; data-correction process; source and transaction snapshot retention. |
| Product + Finance + Engineering | D-18 settings precedence and effective-version behaviour across multi-branch customers; legal issuer and approved defaults. |

Bring four anonymised customer cases: one domestic single-office customer, one multi-address organisation, one multi-country customer group, and one customer served by multiple Noatum branches. Include a merger/code-change case if available. Public research cannot decide these Noatum-specific facts.

**Recommended next deliverable:** approve the concept distinctions and page catalogue, obtain the payload samples, then produce the field-to-source mapping and low-level design. Do not start with a Region CRUD page or copy a third-party access flow before those decisions.

## 13. Sources and limitations

Research used Bing discovery followed by direct publisher-page reads. Search snippets were used to find sources, not as proof of detailed behaviour. Seventeen substantive URLs are registered below; the DSV UK page was also read as corroboration but is not counted as a separate practice. Review date is the workspace date, 11.09.2026.

| ID | Publisher / page | Evidence and limit |
| --- | --- | --- |
| S01 | [CargoWise platform][S01] | Global database and integration positioning; marketing, not an API schema. |
| S02 | [CargoWise enterprise][S02] | Central customer information and address/registration/phone validation capabilities; not proof of Noatum's configuration. |
| S03 | [CargoWise Neo][S03] | Connected customer operational views; no authenticated admin workflow inspected. |
| S04 | [CargoWise customer relationship manager][S04] | Global organisation database and business-contact context; CRM capability is not proposed for this portal. |
| S05 | [Calsoft CargoWise master-data tools][S05] | Third-party description of organisation names/addresses/codes and validation; not authoritative field mappings. |
| S06 | [Maersk: add company user][S06] | Product-specific registration with company details; not adopted as Noatum invitation policy. |
| S07 | [Maersk: company permissions][S07] | User listing and permission/revocation description; no actual company account accessed. |
| S08 | [Maersk: edit company profile][S08] | Support-mediated address correction; not a required Noatum support-system integration. |
| S09 | [Maersk: company verification][S09] | Verification as a separate process; its response deadline/documents are not imported into Noatum rules. |
| S10 | [MyDHL+ admin settings][S10] | Public company overview address/contact form; Express product, not myDHLi; deeper authenticated settings not verified. |
| S11 | [DSV: myDSV][S11] | Central customer-address/contact synchronisation, team settings and collaboration; not a documented permission schema. |
| S12 | [Microsoft: global address book][S12] | Party/role/address distinction; ERP reference pattern, no D365 adoption implied. |
| S13 | [Microsoft: organisational hierarchies][S13] | Legal entities versus operating units and purpose-specific hierarchy; not Noatum's legal structure. |
| S14 | [Microsoft: customer account management][S14] | External ID directory provisioning is distinct from app membership; no portal-owned credential handling proposed. |
| S15 | [Microsoft: tenant configurations][S15] | Workforce versus external customer identity boundaries. |
| S16 | [UPU addressing solutions][S16] | Country-specific templates and S42 concepts; full licensed datasets/templates not reviewed or selected. |
| S17 | [Noatum locations][S17] | City/country/company-based office discovery; no verified CW1 branch/region map. |

Limitations:

- No authenticated CargoWise, Neo, Maersk, DHL or DSV customer/admin account was accessed. No company, user, quote or shipment was created or submitted.
- Exact CW1 organisation/address/contact XML or API field names, entitlement requirements, source branch cardinality and Noatum legal structure are unverified. Names in the proposed page catalogue are logical fields, not fabricated integration keys.
- An initial CargoWise generic solution URL did not yield meaningful extraction; current official enterprise/Neo pages provided the usable evidence. A consultant article failed certificate validation and was excluded; no certificate bypass was attempted.
- Search results included training/exam mirrors and company-specific procedure PDFs on third-party hosts. They were not used as authoritative documentation of CW1 or Noatum practice.
- Vendor behaviour differs by product, country and rollout. The public MyDHL+ form must not be described as myDHLi functionality. DSV's public pages distinguish legacy/new portals; no single backend user-management model is inferred.
- This is a qualitative comparison, not an exhaustive worldwide survey or legal/privacy certification. Page recommendations, optional fields and hierarchy choices require business approval.

### Local baseline references

- [Functional requirements](01-Functional-Requirements.md), especially FR-IAM, FR-ORG, FR-CFG, FR-TOL and FR-FIN.
- [Index and decisions](README.md), including UC-12 and D-03/D-04/D-18.
- [Internal quotation workflow](07-Internal-Quotation-Pricing-Workflow.md).
- [PRD v4](../PRD-Noatum-Customer-Platform.md), section 4a and v4 overrides.
- [Organisation LLD](../lld/Organisation-Management-and-Customer-Onboarding.md), source/mapping/user concepts subject to reconciliation.
- [Onboarding design](../design/Customer-Onboarding-and-User-Management.md) and [CW1 multi-tenant note](../KB-CW1-Integration-Multi-Tenant.md), read with the supersession cautions above.

[S01]: https://www.cargowise.com/
[S02]: https://www.cargowise.com/solutions/cargowise-enterprise/
[S03]: https://www.cargowise.com/solutions/cargowise-neo/
[S04]: https://www.cargowise.com/solutions/cargowise-enterprise/customer-relationship-manager/
[S05]: https://www.calsoft.com/solutions/cargowise/master-data-migration-tool/
[S06]: https://www.maersk.com/support/faqs/add-a-new-user-to-my-company
[S07]: https://www.maersk.com/support/faqs/who-has-access-to-my-company-details
[S08]: https://www.maersk.com/support/faqs/edit-my-company-profile
[S09]: https://www.maersk.com/support/faqs/submit-documents-for-company-verification
[S10]: https://mydhl.express.dhl/gb/en/corporate.html
[S11]: https://www.dsv.com/en/digital-solutions/mydsv
[S12]: https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/fin-ops/organization-administration/overview-global-address-book
[S13]: https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/fin-ops/organization-administration/organizations-organizational-hierarchies
[S14]: https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-manage-customer-accounts
[S15]: https://learn.microsoft.com/en-us/entra/external-id/tenant-configurations
[S16]: https://www.upu.int/en/Postal-Solutions/Programmes-Services/Addressing-Solutions
[S17]: https://www.noatumlogistics.com/locations/
