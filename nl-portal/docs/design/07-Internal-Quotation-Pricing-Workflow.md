# Noatum staff quotation pricing workflow

| Item | Detail |
| --- | --- |
| Purpose | Explain admin quotation policies, staff ownership and manual pricing, and direct or CW1-confirmed customer publication. |
| Date | 10.09.2026 |
| Version | 1.1 |
| Delivery | Phase 1 quotation capability. |
| Status | Workflow explanation incorporating user-approved UC-12 settings/publication direction; not evidence of implementation. Exact policy values and integration decisions remain gated. |

## 1. Where staff see quote requests

Recommended navigation: **Commercial > Pricing queue**.

Signing in as a Noatum employee does not automatically grant pricing access. The user must have the appropriate portal permissions and an assigned branch. The queue shows that branch's requests; cross-branch access requires explicit permission.

| Queue information | Purpose |
| --- | --- |
| Request reference | Open the customer's quotation request. |
| Customer and office | Identify the requesting organisation and office. |
| Mode and route | Identify Air, Sea FCL or Sea LCL and the requested origin/destination. |
| Cargo summary | Review the shipment's main pricing inputs. |
| Requested by and request age | Identify the contact and how long the request has waited. |
| Status and claimed by | See whether a request is available, being priced or awaiting the next action. |
| Branch | Show ownership, particularly for authorised cross-branch users. |

Provide mode, unclaimed and mine filters, plus a branch filter for cross-branch users. The documented default is oldest first.

Staff open a request and select **Claim request** before editing. Other staff can see who holds it but cannot edit without the claim. Claims can be released, expire according to configuration, or be force-released by an authorised approver with an audit record.

Claim means taking responsibility for pricing, not accepting the customer's quote or reserving capacity. Unclaimed requests are read-only. Show the owner and expiry after claiming, and provide **Release request**. A staff member cannot bypass another person's ownership or the configured publication policy.

## 2. The staff pricing workspace

Keep the original customer request visible while staff prepare the offer. Do not overwrite the customer's submitted inputs with a proposed service alternative.

The existing **View full request** popover satisfies the full-request access pattern: include every submitted section, cargo/special-requirement associations and accessible attachments. Staff must be able to inspect it without losing pricing work; a separate full-request page is not required.

| Customer request area | Pricing area |
| --- | --- |
| Shipment mode, route, Incoterm and requested scope | Carrier, service and transit estimate |
| Cargo lines, equipment and special requirements | One or more priced service options |
| Requested additional services and preferences | Charge lines and totals per currency |
| Parties, references, remarks and attachments | Validity, quotation terms and customer remarks |
| Customer quotation history | Pricing history and editable customer email draft |

Staff obtain supplier or carrier rates through their existing working arrangements, then manually enter the customer selling charges. The portal does not maintain procurement/rate tables or automatically source rates. No Phase 1 workflow depends on a live instant-rate source.

### Charge-line fields

| Field | Meaning |
| --- | --- |
| Charge code | Select an approved mapped charge; do not invent CW1 codes. |
| Description | Customer-facing explanation of the charge. |
| Basis | The applicable charging basis, such as per container, per shipment or per chargeable unit. |
| Quantity | Number of units charged under that basis. |
| Rate | Selling rate per unit. |
| Currency | Currency of the charge. |
| Amount | Calculated charge amount using the approved pricing rules. |

The API owns calculations. Show totals separately for each currency; never add unlike currencies into a single total without an approved conversion rule.

Cost and margin capture remains subject to business approval. If enabled, it requires explicit staff permission and must never appear in customer APIs, screens, PDFs, exports or emails.

## 3. Preparing multiple options

Customer option cards are already required. For the staff mockup, provide **Add option** inside the request's pricing workspace. Each option represents an alternative offer, not an additional charge to add to the other options.

| Option information | Treatment |
| --- | --- |
| Option label | Distinguish alternatives, for example Option A and Option B. |
| Carrier and service | Enter the proposed service; customer carrier disclosure follows configuration. |
| Route and service scope | Make any difference from the request or another option explicit. |
| Transit estimate | Enter a service-specific estimate, not a guaranteed delivery promise. |
| Charge lines | Maintain the charges applicable to this option. |
| Totals | Show this option's totals separately per currency. |
| Validity and terms | Show the applicable offer validity, inclusions, exclusions and qualifications. |

Illustrative alternatives:

| Option | Service | Price presentation |
| --- | --- | --- |
| A | Standard service with Carrier A | Its own charges and currency totals |
| B | Faster service with Carrier B | Its own charges and currency totals |
| C | Alternative routing or service | Its own charges and currency totals |

These labels illustrate manual entry, not automatic ranking or a requirement to produce three options. Staff should offer only services they can substantiate.

**Integration decision still required:** agree how options, versions and the selected option map to CargoWise records and confirmations. Do not assume one CW1 record per option or a single CW1 record containing all options until the integration contract is confirmed.

## 4. Configured approval and publication

The initial unpriced request's optional CW1 write, internal pricing approval and final offer publication are three separate decisions. Administrators configure them; ordinary pricing staff do not receive a per-quote bypass toggle.

1. Staff claim the request, enter complete priced options and save the draft.
2. The server evaluates the policy revision recorded for the request. Where approval applies, staff submit for approval and a different authorised approver approves or rejects with a reason.
3. After approval, or where approval is not required, follow the configured publication path below.
4. Record the exact options/version, effective policy revision, publication actor or authorising actor, and time. Notify the customer once the offer is published.

| Publication mode | Staff action and result |
| --- | --- |
| CW1 confirmation required | **Submit pricing** queues the priced offer for CW1. Publish only after business confirmation, never on a transport acknowledgement. Pending/failed status and retry information are staff-only. |
| Direct customer publication | **Publish to customer** publishes the completed offer after applicable internal approval, without submitting the priced offer to CW1. Record the portal commercial snapshot; do not fabricate a CW1 reference or confirmation. |

Direct publication bypasses only the CW1 gate, not ownership, internal approval, customer-data protection or publication validation. Initial-request sync can be enabled or disabled independently of either path. A failed CW1 job must never automatically choose direct publication.

CargoWise remains the operational system of record. The direct path retains the published commercial record in the portal; it does not confirm a booking or shipment. In the CW1-confirmed path, differing CW1 pricing is reconciled with retained history and staff notification, never by rewriting an accepted version. A later CW1 message matching a directly published offer requires the agreed D-18 reconciliation procedure, not silent replacement. Pricing directly in CW1 remains supported.

### 4.1 State-specific actions

| Situation | Actions / feedback |
| --- | --- |
| Unclaimed | View full request and Claim request; pricing and submission disabled. |
| Claimed by current user | Save draft, Release request and permitted option/charge editing. |
| Approval required | Submit for approval; submission does not publish. |
| Awaiting approval | Submitted pricing is read-only; different authorised approver can Approve or Reject with reason. |
| Approval satisfied, direct mode | Publish to customer. |
| Approval satisfied, CW1-confirmed mode | Submit pricing; explain that publication follows CW1 business confirmation. |
| CW1 pending / failed | Staff-only status and authorised Retry sync when appropriate; no direct-publication fallback button. |
| Published in either mode | Published version/status and Send email; show a CW1 reference only when one exists. |

These are action/display descriptions, not additional canonical lifecycle statuses. Approval thresholds, currency evaluation and option-level CW1 mapping still require signed rules. A customer preview is labelled **Customer preview - not published** until actual publication.

## 5. Returning the offer to the customer

After publication through either configured path, the customer can open the quotation and view the available priced options. Publication is distinct from CW1 synchronisation and from sending a drafted email. The workflow includes customer notification of the published offer.

The staff workspace also provides an editable customer email draft:

- Drafting uses the other team's service when enabled by configuration.
- An approved template is available when that service is disabled or unavailable.
- Staff review and explicitly send the email; a generated draft is never sent automatically.
- Sending runs through the approved outbound job flow and must not disclose unpublished prices or internal costs. Review recipients and show sending, sent or failed feedback. No setting permits automatic sending of a generated draft.

An offer email can direct the customer to the portal comparison view. It is not a substitute for storing the published quotation and its version history.

## 6. What the customer sees and does

Recommended navigation: **Commercial > Quotations > Selected request**.

The customer compares the offered alternatives, reviews customer-safe charges, totals per currency, transit estimates, validity and terms, and downloads the branded quotation PDF.

The intended option-comparison flow lets the customer choose a valid offered option for acceptance. The exact selected-option acceptance payload and CW1 mapping must be confirmed with the multiple-option integration design.

Acceptance freezes the selected offered option/version. Expired offers cannot be accepted. Rejection captures a configured reason and preserves previous versions according to the approved quotation lifecycle. Notify CW1 only where the applicable confirmed quote mapping exists; direct-only acceptance/rejection is stored locally without inventing a reference or implicitly creating a CW1 quote. Later handover, including the case where only an unpriced request exists in CW1, remains a D-18 integration decision.

**Quote, booking and shipment remain separate entities.** A later booking links by quote number; multiple bookings can link to a quote. Accepting a quote does not automatically create a booking or shipment. The full booking workflow releases in its planned later phase.

For direct-only quotations, agree CW1 handover and quote-number linkage before enabling a later CW1 booking workflow. This settings amendment does not bypass booking business acknowledgement.

## 7. Screens to mock up

| Screen | Main content and actions |
| --- | --- |
| Internal pricing queue | Branch-scoped requests, filters, ownership and open/claim actions. |
| Request and pricing editor | Original request, attachments, multiple options, charge lines, save draft, submit and release. |
| Approval view | Read-only submitted pricing, approve and reject with reason. |
| Publication, sync status and communication area | Effective publication mode, published version, staff-only sync state/reference where applicable and editable email with explicit send. This can be part of the pricing editor. |
| Customer option comparison | Published alternatives, customer-safe charges, validity, terms, PDF and accept/reject actions. |
| Administration > Settings > Quotation settings | Permission-scoped policy groups, effective values/inheritance, validation, change confirmation and history; catalogue below. |

Provide loading, empty, error, permission-denied and action-in-progress states as applicable. Follow the existing Noatum design system, EN/ES localisation and DD.MM.YYYY date format.

## 8. Administrator quotation settings

Only internal administrators with explicit settings permissions can maintain this page. Being a Platform Admin or Pricing user does not imply unrestricted data/scope access; Customer Admins do not administer Noatum's pricing policies.

| Group | Settings | Boundary |
| --- | --- | --- |
| Publication and CW1 | CW1-confirmed or direct publication; send initial unpriced request to CW1 enabled/disabled | Independent choices; direct publication does not submit the priced offer. No automatic outage bypass. |
| Internal approval | Approval enablement, approved threshold and currency-evaluation policy | Applies in both publication modes; different-person approval and rejection reason remain mandatory when required. |
| Ownership | Claim expiry; approved force-release grants through existing role/permission administration | Exclusive claim and branch access remain enforced. |
| Commercial defaults | Approved validity and terms; carrier disclosure; approved cost/margin-capture enablement | Defaults are not immutable offer terms; enabling capture does not grant cost permission. No rate-management tables. |
| Communication | Approved email templates and external drafting enablement | Human review/send and template fallback remain. Secrets/endpoints are not entered as ordinary business settings. |
| Customer features | Existing quotation entitlements and available optional capabilities | Availability cannot bypass release readiness, permissions or OQ-20. CO2 remains future/conditional. No live rate source is implied. |

### 8.1 Scope, inheritance and page behaviour

- Show the selected scope, saved value, effective value, inherited source and whether an override applies.
- Support platform defaults and approved region/branch/customer overrides only where meaningful for that setting. D-18 must define the allowed scope matrix and precedence; do not assume one customer's override wins across all branches.
- Use option selectors for publication policy, toggles for enablement and validated numeric inputs for expiry/thresholds. Exact ranges, units and initial values require approval.
- Provide save/cancel, a confirmation identifying affected scope, a mandatory reason, and clear success/error states. Reject stale concurrent saves instead of overwriting another administrator's changes.
- Show authorised history with actor, date/time, scope, reason and old/new values. Record administrative analytics and business audit events.
- New requests use the effective policy revision. Existing requests/versions retain their recorded revision unless a separately approved audited re-evaluation is performed. No bulk migration or automatic re-publication is implied by saving a setting.
- A setting change must not publish pending quotes, remove an existing approval gate, change accepted content or reinterpret an already queued job. Later changes to permissions still take effect on the next request; policy snapshots do not preserve revoked access.

### 8.2 Protections that are not settings

No configuration may disable tenant isolation, endpoint permissions, branch/data access controls, exclusive pricing ownership, internal-cost protection, audit history, accepted-version immutability or explicit human send of generated email. Missing or ambiguous configuration must block the affected transition rather than select direct publication or skip approval.

This page configures agreed business policies. It is not a general-purpose rules engine or an authority to enable unsupported services.

### 8.3 Verification scenarios

1. Test both publication modes with initial-request CW1 sync on and off.
2. In each mode, test approval off and approval required, including threshold boundaries and prevention of self-approval.
3. Verify direct publication creates a customer-visible version without a priced-offer CW1 job; verify CW1 mode waits for business confirmation and never falls back on failure.
4. Change a policy while another quote is claimed, awaiting approval or awaiting sync; existing work must not publish or lose its gate automatically.
5. Test approved inheritance, override removal, cross-branch/customer scope denial, stale-save rejection and configuration audit history.
6. Confirm cost enablement never leaks internal data, disabled drafting retains template/human send, and future-feature toggles cannot enable unreleased code.
7. Test direct-only acceptance/rejection, preserved accepted versions, repeated publication and later CW1 collision handling without silent overwrite.

## 9. Decisions still requiring confirmation

| Decision | Boundary until confirmed |
| --- | --- |
| Approval threshold and currency evaluation | Keep configurable; do not invent a threshold or exchange-rate policy. |
| Cost and margin capture | Sell-price entry is the baseline; internal cost capture requires approval. |
| Multiple-option CW1 mapping | Do not assume record cardinality, partial publication or confirmation behaviour. |
| Option acceptance mapping | Confirm how the chosen option and version are recorded and sent to CW1. |
| Detailed commercial terms and service rules | Staff-entered offers must follow approved business rules; mockup examples are not policy. |
| Settings scope, precedence, ranges and initial values | D-18 must define the setting-to-scope matrix, including multi-branch customers; no permissive implicit fallback. |
| In-flight policy re-evaluation | Retain recorded policies by default; any migration must be separately approved, explicit and audited. |
| Later CW1 handover of direct offers | Define whether/when handover occurs, accepted/rejected option mapping, collision resolution and later booking linkage. Do not automatically enqueue deferred sync. |

## 10. Source documents

- [Functional requirements, quotation section](01-Functional-Requirements.md#6-quotation-and-shared-commercial-tooling): FR-QTE-006 and FR-QTE-009 through FR-QTE-020; section 4.1 adds FR-CFG-001 through FR-CFG-008.
- [Index and decisions](README.md): UC-12 approved direction and D-18 configuration/integration decisions.
- [Internal quote pricing design](../design/Internal-Quote-Pricing-in-Portal.md): permissions, claims, pricing, approval, synchronisation and staff screens.
- [PRD v4](../PRD-Noatum-Customer-Platform.md): governing quotation requirements and Phase 1 manual-pricing commitment.
- [Phased delivery plan](03-Phased-Delivery-Plan.md): quotation delivery and later booking workflow.

UC-12 explicitly changes the earlier universal CW1 publication gate in this working requirements set. The PRD, repository rules and older pricing design still require source reconciliation and an architecture decision before implementing that change; they have not been silently rewritten. Branch-scoped access, no configured live rate source and all mandatory protections remain unchanged.

## 11. Change history

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 10.09.2026 | Initial staff pricing, options, approval and CW1-confirmed publication explanation. |
| 1.1 | 10.09.2026 | UC-12: quotation settings page, independent approval/publication policies, direct publication, state-specific actions and configuration safeguards. |
