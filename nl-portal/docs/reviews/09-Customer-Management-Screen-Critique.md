# Customer management: screen critique and redesign blueprint

Date: 11.09.2026. Status: proposed UX for business review, not a schema or requirements amendment.

Editable design: [09-Customer-Management-Blueprint.drawio](09-Customer-Management-Blueprint.drawio).

Research basis: [08-Customer-Organisation-and-Access-Research.md](08-Customer-Organisation-and-Access-Research.md).

Requirements: [01-Functional-Requirements.md](01-Functional-Requirements.md), especially FR-IAM-001 through FR-IAM-012, FR-ORG-001 through FR-ORG-009 and FR-CFG-001 through FR-CFG-008.

## 1. Verdict

**The overall customer workspace is useful, but the current approach is not ready to become the implementation model.** Keep the list/detail pattern, organisation-level links, invitation ownership and customer tabs. Correct the distinction between CW1 organisations, customer offices, physical addresses and Noatum operating branches. Add the missing source-directory and operating-structure journeys.

This review assesses the five supplied screenshots and their visible labels/controls. It does not infer backend vulnerabilities, missing hidden dialogs or broken interactions. Sample names, numbers and dates are not evaluated for data accuracy. Address rows appear expandable, so addresses are not assumed to be absent merely because they are collapsed.

The draw.io file contains 17 named pages. Some pages show multiple consecutive wizard states or tab contents side by side to explain them; those states are not intended to appear simultaneously on a production screen. Notes beneath wireframes are design annotations, not application copy. Page links are navigation aids, not functional application controls.

## 2. Findings, most important first

| Priority | Screenshot / visible issue | Why it matters | Redesign |
| --- | --- | --- | --- |
| High | Organisations: **Add a branch**, **CW1 branch record**, and **Branch - addresses** use different concepts interchangeably. | An organisation is a customer party; a Noatum branch owns operational work; an address is a location. Mixing them can lead to incorrect linking and quote routing. | Rename action to **Link organisation**. Separate source organisation, office display name, Noatum servicing branch, source status and link state. |
| High | Organisations: the text makes a different legal entity automatically become another customer and only offers records from the same legal entity. | This hard-codes a customer-grouping policy not established by the current working FRs. A shared group and a two-level parent/child arrangement serve different access needs. | Select eligible source organisations based on verified relationship and approved ownership rules. Make the legal-entity grouping rule an explicit business decision, not an inferred filter. |
| High | Organisations/list: second-administrator approval appears universally mandatory. | The current baseline requires justification, confirmation and audit; a second-person linking approval remains a decision. | Baseline flow: authorised link, reason, impact review and confirmation. Include a pending-review branch only if the business approves that policy. Do not remove an existing approved path merely because it is optional. |
| High | Feature flags: text says changes apply on the next navigation. | Access revocation and disabled entitlements must be enforced on the next protected API request, even if a tab remains open. | Separate customer entitlement, actual release readiness and user permission. Review/save changes with outcome and audit. Client navigation reflects the server decision, not the reverse. |
| Medium | Customers navigation shows unassigned entities but no explicit CW1 organisation directory. | Unassigned transactions are not a searchable master catalogue; they cannot support inspecting organisations that have no transaction exceptions. | Add internal **CW1 organisations** and source detail. Keep **Unassigned entities** as a separate resolution queue. |
| Medium | Overview/list prominently expose identity modes; one row says **Local account + MFA**. | This may be an ambiguous label for a Microsoft-managed identity, not proof of custom auth. It nevertheless suggests a portal-owned login mode. A dedicated external directory also must not imply one directory per customer. | Use Microsoft-managed customer identity. Keep verified binding status in user detail; remove identity configuration from ordinary customer editing and list subtitles. |
| Medium | Users table does not show financial-office restriction. | A role alone does not show whether a finance user is restricted to one linked CustomerAccount. | Add **Financial office** in user detail and optionally the list. Make clear that it is not a general shipment or quote restriction. |
| Medium | Feature flags mixes module entitlements, future capabilities and carrier disclosure. | Carrier disclosure is a commercial quotation policy; future-feature configuration cannot make unreleased workflows live. | Use **Features and settings**, with entitlement/readiness table and effective quotation-policy view linked to the authorised settings editor. |
| Medium | No region/branch setup journey is visible. | The customer's organisations tab cannot be the Noatum branch-maintenance screen. | Put **Operating structure** under Platform. Branch catalogue first; managed Region view only after D-18 approval. |
| Medium | **Impersonate a user**, **Suspend** and deactivation are visible, but confirmation states are not shown. | The screenshots cannot prove missing safeguards. They do not explain the required support and destructive-action flows either. | Retain impersonation under FR-IAM-012: explicit permission/reason, read-only, time-boxed, persistent banner, both actors audited. Define suspension and last-admin protections. |
| Lower | Repeated **How access works** panels consume a large portion of every detail tab. | This is architecture documentation, not customer-management work. It displaces relevant fields and forces repeated scrolling. | Remove the repeated panels from normal pages. Keep operational status and destructive-impact messages; put technical explanations in documentation/help. |
| Lower | Dense tiny metadata, large blank footer area and stacked organisation details make scanning harder. | Useful list identity competes with details better suited to a drill-down. Screenshot pixels alone cannot establish actual CSS contrast or font size. | Compact filter counts, readable text, one customer per row, accessible detail expansion, server pagination, responsive stacked rows and modest footer. Test actual contrast and keyboard behaviour during implementation. |

## 3. Redesign of each supplied screen

### Screen 1: Customers list

Keep the page as the directory of **onboarded portal customers**, not all CW1 parties.

- Header: Customers; primary **Onboard customer** action.
- Navigation: Customers; CW1 organisations; Invitations; Unassigned entities.
- Search: customer name, approved domain or linked organisation code.
- Filters: All, Active, Onboarding, Suspended; country; servicing branch only from a defined association. Counts are compact and permission-scoped.
- Main fields: customer name/country, linked organisation count, servicing branch summary, user count, first-admin state, tier and customer status.
- Optional columns: last activity, parent customer and domains. Put full organisation/address information in detail rather than stacked text in every row.
- Actions: open customer; onboard; resume relevant onboarding work. No global create-user button tied to arbitrary CW1 contacts.
- States: loading, no customers, no filtered results, permission denied, load failure and pagination.

Draw.io pages: **02, 04, 14, 16**.

### Screen 2: Customer overview

- Header: customer display name and portal status; **Edit customer**; **More actions** for permission-controlled support and suspension.
- Tabs: Overview; Linked organisations; Users and invitations; Features and settings; Hierarchy; Audit.
- Fields: portal name/country/tier, company domains, default locale, first admin and acceptance state/date, created by/date, parent/children and linked-office readiness.
- Show customer activation and data-sync readiness separately. An accepted admin does not prove all shipments have arrived.
- Edit only portal-owned fields. It must not edit source legal name/address, choose password methods, or rerun invitation creation.
- Remove the repeated authentication-versus-authorisation lesson from the workspace.

Draw.io pages: **07, 10, 15**.

### Screen 3: Linked organisations

- Primary action: **Link organisation**, not Add a branch.
- Selector: source-qualified organisation code, source name, country/city and existing portal link. Inspect source detail before confirming.
- Linked-list fields: organisation/source, office display name, Noatum servicing association, CW1 status, portal link state and actions.
- Expanded fields: source address/contact counts when supplied, last sync, linked by/date, justification and visibility-refresh outcome.
- Source address detail: stable ID, label/purpose, formatted address and components, country, source primary/status fields when supplied. Read-only; no independent customer-link checkbox.
- Source contact detail: permitted name/function/email/phone and organisation/address association. No automatic invitation.
- Confirmation: target group, selected organisation, reason, ownership conflict check and access impact. Second-person approval is conditional, not universal.
- Link changes/reassignment require an explicit controlled workflow; historical portal-owned quotes are not automatically reassigned with shipments.

Draw.io pages: **03, 05, 07, 15**.

### Screen 4: Users

- Keep Noatum's first-admin invitation responsibility; ordinary user invitations belong to the customer's own administration page.
- List: name/email, role presets, financial-office restriction, access state, last sign-in or invitation expiry, permitted actions.
- First-admin invitation: fixed customer; display name; company email; EN/ES locale; Customer Admin role; configured expiry. Internal domain exception requires its approved grant and reason.
- Detail: roles/effective permissions, financial restriction, identity binding, invitation/acceptance/resend history and audit.
- Customer-side user form: name/email, permitted external roles, locale, optional single financial office; customer context fixed server-side.
- Resend/revoke/deactivate/reactivate remain state-specific. Last-active-admin protection must apply under concurrent actions.
- Do not label portal deactivation as revoking Microsoft sessions unless that actual integration is implemented and verified.

Draw.io pages: **08, 12, 13, 14, 15**.

### Screen 5: Feature flags

- Rename tab **Features and settings**.
- Entitlement table: feature, customer entitlement, actual release readiness, and indication that permissions remain separately assigned.
- Cover the approved module catalogue, including Quotations, Tracking, Documents, Invoices, Bookings and Claims. Future grants can be prepared without exposing live workflows.
- Move carrier disclosure to effective quotation settings alongside publication mode, initial request sync, approval, claim expiry, approved cost capture, validity/terms, templates and external drafting enablement.
- Policy fields: setting, effective value, inherited source, override state and revision. Exact scopes/precedence remain D-18 decisions.
- Editing: typed control appropriate to the setting, Inherit/Override choice when allowed, reason, impact preview, confirmation, success/error and concurrent-change handling.
- Use the existing permission framework for claim release; no switch disables tenancy, permissions, audit, cost protection or human send.

Draw.io page: **09**.

## 4. End-to-end page flow

1. **Integration imports CW1 organisations.** Validate source identity and update source-owned fields; do not create tenants, users or access from imports.
2. **Noatum opens CW1 organisations (02).** Search and inspect Organisation detail (03), including addresses/contacts where supplied. Alternatively start from Onboard customer in Customers (04).
3. **Customer details (05, step 1).** Enter portal display name, country, tier, domains and locale; review entitlements and optional two-level parent relationship.
4. **Link organisations (05, step 2).** Select eligible source-qualified organisations; inspect existing links, set office display labels and record justification. Reject conflicts; never independently link addresses.
5. **Servicing (06, step 3).** Resolve the approved Noatum servicing branch association; display source company/region context and effective quotation policies. Do not infer routing from customer geography.
6. **First admin (06, step 4).** Name, email, locale, Customer Admin role and configured expiry. No password/MFA form.
7. **Review (06, step 5).** Confirm organisation/customer relationship and access impact. Create once, audit, enqueue invitation and relevant re-evaluation. Optional mapping review applies only if approved.
8. **Customer remains onboarding (07).** Show linked-office readiness, first-admin invitation and delivery outcome separately. Failed email retries do not recreate the customer.
9. **Customer accepts (13).** Microsoft-managed authentication plus valid single-use invitation; bind issuer/subject. Identity provisioning remains the agreed external process, not a side effect inferred from email send.
10. **Activate when eligible.** At least one linked office and accepted Customer Admin; show asynchronous data readiness separately.
11. **Customer Admin manages colleagues (13).** Invite users, assign permitted role presets and financial-office restriction; manage invitations and audit within own group.
12. **Noatum manages ongoing customer setup (07-10).** Additional organisation linking, portal profile updates, support, suspension, settings, hierarchy and audit under explicit permissions.
13. **Platform Admin manages operating structure/staff (11-12).** Configure verified branch mappings and eligible staff access. Add managed regions only if that design is approved.
14. **Exceptions use dedicated recovery (14-15).** Unknown source references, failed sync, invitation expiry, stale settings, permission loss and controlled reassignment do not silently expand access.

## 5. Draw.io page catalogue

| Page | Contents |
| --- | --- |
| 00 | Verdict, concept separation, legend and scope |
| 01 | Connected end-to-end journey with responsibility lanes and decision paths |
| 02 | CW1 organisation directory: search, filters, source/link states and paging |
| 03 | Organisation overview, addresses, contacts, portal link and sync history |
| 04 | Redesigned Customers list |
| 05 | Onboarding steps 1-2: customer fields and organisation linking |
| 06 | Onboarding steps 3-5: servicing, first admin, review and result |
| 07 | Customer overview and Linked organisations tab contents |
| 08 | Internal customer-user list, invitation dialog and user detail |
| 09 | Entitlements, effective quotation policies and settings editor |
| 10 | Two-level hierarchy, change review and audit list/detail |
| 11 | Noatum branch list/detail/configuration and conditional Region design |
| 12 | Staff list, branch/role assignment and first-login pending state |
| 13 | Customer invitation acceptance, user self-service, roles and company profile |
| 14 | Invitation management and unassigned-entity resolution |
| 15 | Impersonation, suspension, link-change review and recovery states |
| 16 | Narrow-screen list/form wireframes, accessibility and delivery gates |

## 6. Boundaries and decisions

- **Baseline-backed:** deliberate organisation links, daily mirror, customer grouping, two-level hierarchy, invitation-only customer access, portal-managed roles, financial-office restriction, read-only impersonation, next-request revocation and admin quotation settings.
- **Proposed UX:** navigation organisation, compact list columns, drawers/dialogs, wizard step arrangement and the source-detail page layout. These are not new independent backend entities.
- **Source-dependent:** stable source namespace, full address/contact collections, branch/company master, merge/deletion semantics and OQ-3a address resolution. Obtain payload samples before finalising fields.
- **Business decisions:** legal-entity grouping constraints, optional second-person linking, region-as-label versus managed region, multi-branch servicing, D-18 policy precedence and last-office/reassignment lifecycle.
- **Identity decision:** the actual invitation-only Entra External ID provisioning/federation sequence. No local login, password, MFA or Microsoft-directory-per-customer architecture is proposed.
- **Unchanged:** existing mockup HTML, application code, schema, approved FRs and prior research. This deliverable is a critique and editable blueprint, not implemented software.

## 7. Verification

The draw.io XML was parsed locally. Its 17 page identifiers, 254 cells, connector references, cross-page links and page-bound geometry passed structural validation. Companion Markdown links and table structure are checked separately.

No draw.io desktop executable was found in the standard local installation paths, so native draw.io rendering and font-dependent text fitting have not been visually verified. The file uses uncompressed native shapes and editable labels, not an embedded screenshot. Open it in the draw.io VS Code extension or diagrams.net desktop to review exact rendering; Mulish availability can affect text metrics.

No browser accessibility, application behaviour, runtime permission or CW1 integration test is claimed by this design review.
