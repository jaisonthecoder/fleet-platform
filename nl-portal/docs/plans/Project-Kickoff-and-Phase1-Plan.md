# Project Kick-off — Noatum Logistics Customer Information Platform

## Phase 1 implementation plan, stage by stage

| | |
|---|---|
| **Version** | 1.0 (v4 document set) |
| **Governing document** | PRD v4.0 |
| **Repository** | `noatum_customer_portal` (Azure DevOps project `Noatum-Customer-Platform`) |
| **Written** | 09.09.2026 |
| **Audience** | Development team, sponsor, and anyone joining the project |

---

## 1. What we are building in Phase 1, in one paragraph

A customer of Noatum logs into a branded portal, submits a structured quote request for Air, Sea FCL or Sea LCL, and an authorised Noatum user prices that request **in the portal**. The priced quote is written into CargoWise, and only then shown to the customer, who accepts it and downloads a branded PDF. Around that one flow sits the foundation everything later depends on: identity through Microsoft Entra, customer and user onboarding, separation of each customer's data, the connection to CargoWise, the design system, and observability.

Phase 1 is complete when a pilot customer requests a quote, a Noatum user prices it, CargoWise has it, and the customer accepts it — and when onboarding a second customer or a second region would require configuration only.

## 2. Scope boundary — what is in and what is not

**In Phase 1**

| Area | Delivered |
|---|---|
| Identity and access | Entra ID for staff, Entra External ID for customers, no authentication code of our own |
| Onboarding | Organisation import from CW1, customer creation, organisation linking, invitations, roles, branch-aware internal users |
| Tenancy | Customer separation enforced in the data layer and by the database |
| Quotation, customer side | Request wizard for three modes, draft autosave, chargeable weight, quote list and detail, accept and reject, versions, branded PDF, templates, address book |
| Quotation, internal side | Pricing queue with claiming, pricing screen, approval above a threshold, write-back to CargoWise, divergence handling |
| Integration | CW1 adapter, mapping tables, message log, tenant resolution, replay; instant-rate interface implemented and stub-tested with no source configured |
| Platform | Design system and app shell, dashboard shell with a small widget set, news and banners, notification bell, audit and analytics events, API foundation, observability |

**Not in Phase 1** — tracking and milestones, documents, invoices, bookings, claims, reports, sailing schedules, predictive features, the assistant, CO2, purchase orders, external API general availability. Tables the PRD names as foundational may be created empty; no screens.

**Explicitly not built at all** — rate management, the AI email drafting service (consumed from another team), anything that replaces a CargoWise operational workflow other than the pricing step in FG-3.3.

## 3. The five ground rules

1. **Foundation before features.** Identity, tenancy, organisation linking and the design system are built once and never rebuilt. We take the time to get them right and review them before building on top.
2. **One region, any region.** The pilot is one customer in one region. No part of the foundation may assume a single region or branch; the second region must cost configuration only.
3. **Both ways of working.** Where regions or branches differ, the platform supports the alternatives side by side, configured per region, branch or customer. Nothing already designed is discarded when a new practice is discovered.
4. **Vertical slices.** Each feature is finished from database through shared contract and application logic to screen, with tests, and demonstrated before the next begins.
5. **Keep the seam, drop the code.** A nullable column, a configuration constant or an interface is cheap and keeps us flexible. A second identity flow, an extra runtime or an admin screen is not built until a measured need appears.

## 4. Before the first line of code — kick-off checklist

| # | Item | Owner | Blocks |
|---|---|---|---|
| 1 | Azure DevOps project and repository created, branch policies applied | Development | Everything |
| 2 | `/docs` populated with PRD v4.0, the design system, this plan, the slice backlog, the LLDs, the ADRs, `gaps.md`, `glossary.md`, and the KT session records | Development | Agent-assisted work |
| 3 | Entra External ID tenant requested, configured invitation-only; app registrations per environment | IT | Login, stage F1.02 |
| 4 | Azure subscription and Dev environment; PostgreSQL, storage, key vault, monitoring | DevOps | Deployment, not local work |
| 5 | Email sending domain with SPF and DKIM | IT | Invitations, stage F1.06 |
| 6 | Pilot customer and region confirmed, with the branch that owns them | Sponsor | Stage F1.06 onward |
| 7 | Sponsor confirmation in writing that the operational non-goal is narrowed for FG-3.3 (OQ-12) | Sponsor | Internal pricing stages |
| 8 | Head of Pricing view on internal pricing; whether cost and margin are captured (OQ-11) | Sponsor + Pricing | Stage F1.08 detail |
| 9 | Answer to OQ-3a: are shipment and invoice parties stored as organisation codes or address codes | CW1 team | Tenant resolution, stage F1.05 |
| 10 | CW1 organisation export or sample, and confirmation of the integration interface (OQ-2, OQ-2a) | CW1 / Integration team | Real connection; the stub covers us meanwhile |
| 11 | Foundation design reviewed with the wider team before implementation | Development | Ground rule 1 |

Items 1, 2, 4 and 11 are ours. The rest are requests to other teams and should be chased in parallel with the early stages, which do not depend on them.

---

## 5. Phase 1, stage by stage

Ten stages. No dates — sequence and dependency only. Each stage ends in something demonstrable, and each has an exit test that must pass before the next begins.

---

### Stage F1.01 — Repository, local environment, pipeline

**Goal:** anyone, or any agent, can run the whole platform locally with one command.

- Monorepo with pnpm workspaces: `apps/noatum-customer-portal-ui`, `apps/noatum-customer-portal-api`, `apps/cw1-simulator`, `packages/design-system`, `packages/shared-types`.
- Docker Compose: PostgreSQL and the simulator. No cache server, no broker. The job queue is
  a schema inside the same PostgreSQL, so it needs no additional service locally or in Azure
  — only a one-time schema initialisation per environment ([ADR-008](adr/ADR-008-background-work-queue.md)).
- Prisma with SQL migrations; the job queue schema in the same database.
- The API boots with job consumers in-process, `/health`, and OpenAPI published.
- CI pipeline: install, lint, typecheck, unit tests, build.
- `CLAUDE.md` at the root; `/docs` populated.

**Exit test:** `docker compose up` and `pnpm dev` bring up the API, the web app and the simulator, and a job enqueued in a transaction is consumed.

---

### Stage F1.02 — Identity and tenancy

**Goal:** a signed-in user belongs to exactly one customer and can never see another's data.

- Tables: `customer_group` (two-level hierarchy, tier, feature flags, email domains), `customer_account` (organisation code, unique, with linking metadata), `user` (customer, optional single-office restriction, **branch for internal users**, identity pointer), `audit_event`, `analytics_event`.
- The API validates Entra access tokens from two issuers and loads the user by identity pointer. **No login, session, password or MFA code.** In development, a local token issuer stands in.
- Request pipeline: tenant context, the repository that sets the tenant inside every transaction, row-level security policies as the second lock.
- `GET /me`.
- Web: a login page that starts the Microsoft sign-in, and a shell showing who is signed in.

**Exit test:** two seeded customers; a user of one receives 404 for every entity of the other, both through the API and through raw SQL under the application's database role. A parent-customer user sees its children; a child does not see its parent.

---

### Stage F1.03 — Roles, permissions and branch scoping

**Goal:** every endpoint is protected by a permission, and internal users are branch-aware.

- Tables: `permission`, `role`, `role_permission`, `user_role`.
- Permission codes and the nine presets seeded: six customer roles, and Customer Success, Ops and Platform Admin internally, plus the two pricing roles from stage F1.08.
- A guard on every route; a build-time test that fails if any route lacks a declared permission.
- Branch attribute on internal users, and the permission that grants cross-branch visibility.
- No role-designer screen; custom roles remain possible as data.

**Exit test:** permission denied returns 403; a role change takes effect on the next request without re-authentication; the route-coverage test passes.

---

### Stage F1.04 — Design system and application shell

**Goal:** every screen built afterwards lands in the correct brand automatically.

- `packages/design-system`: tokens imported verbatim, the core components (button, section heading, stat counter, input, select, tabs, news card, header, footer), the status-colour extension.
- Application shell: red top bar, logo band, navigation, red footer, language switch for English and Spanish, notification bell placeholder.
- Lint rule: no colour, font or radius outside the design-system package.
- Accessibility check in CI.

**Exit test:** visual regression snapshots on the core components; the accessibility check passes on the shell; the brand checklist is reviewed.

---

### Stage F1.05 — CargoWise connection and tenant resolution

**Goal:** the pipe to CargoWise exists, is observable, and every inbound entity can be assigned to the right customer.

- Tables: `integration_message` (with the raw payload and a retention rule), the mapping tables for status, event, charge and document codes, `master_org` (the organisation mirror, imported daily, keyed case-insensitively), `shipment_visibility` (empty until Phase 2).
- Inbound endpoint: archive, log, enqueue, return acknowledgement immediately. Idempotent on the source message identifier.
- **Tenant resolver:** party organisation codes resolved against linked customer accounts under a single global policy. Entities with no match are stored, visible to nobody, and listed for operations. **Address-code handling depends on OQ-3a** — the resolver is written so that mapping an address code to its parent organisation is a lookup, not a redesign.
- Adapter interfaces for tracking, quote, booking, finance, document and rate. Only the quote adapter is implemented in Phase 1.
- The simulator, or the real interface if access arrives: whichever is connected, the platform sees no difference.
- Observability: correlation identifier from browser to API to job to CargoWise message; structured logs; failed-job and latency metrics.

**Exit test:** the same message twice produces one record; a failed message lands in the failed-job store and can be replayed; an entity whose codes are unlinked is stored and invisible; a correlation identifier traces one round trip end to end.

---

### Stage F1.06 — Customer onboarding and user management

**Goal:** Noatum onboards a customer entirely by configuration, and the customer manages its own people.

- Tables: `user_invitation`, `impersonation_session`.
- Noatum Admin: customer list and detail; create a customer with name and country pre-filled from the organisation mirror; **link organisations at organisation level** with a justification, a confirm dialog and a full audit record — with the second-approver step available if the sponsor asks for it; feature flags; two-level hierarchy; unassigned-entity view; read-only impersonation with a reason and a banner.
- Customer administration: invite, resend, revoke, deactivate, assign roles, optionally tie a user to one office, view own audit.
- Invitation acceptance: token validated, Microsoft sign-in, email must match, user created with roles.
- Branded invitation and welcome emails.

**Exit test:** a customer is onboarded end to end with no code change; an expired, used or revoked invitation is refused; an invitation to an outside domain is refused for a Customer Admin; the last Customer Admin cannot be removed; linking an organisation makes existing entities visible to that customer.

---

### Stage F1.07 — Customer quote request

**Goal:** a customer submits a complete, structured quote request.

- Tables: `quote`, `quote_version`, cargo lines, status history through the audit trail.
- Shared chargeable-weight function used by both the web app and the API.
- Wizard: mode and service, route, cargo, additional services, references, review — with draft autosave, dangerous-goods fields mandatory when flagged, container picker for FCL, addresses from the address book.
- Quote list with grid, detail and card views, and saved views.
- **Organisation code chosen server-side.** Where a customer has several linked organisations the user selects by name.
- Address book and templates (create, share, use).

**Exit test:** chargeable weight correct for each mode; a draft survives a reload; dangerous-goods validation holds; a tampered organisation code in a request body is ignored.

---

### Stage F1.08 — Internal pricing, approval and write-back

> **Capped at director level, 17.09.2026, and largely deferred.** Christian confirmed the
> organisation has no rate database, no rate storage, no standard format and **no standardised
> quoting process**, and asked for "a very LIGHT quoting module". The stage below is retained
> as the fuller design to return to; it is not what gets built first.
>
> **What the first release delivers instead:** a price recorded against the quote by a person,
> or received from CargoWise, with an optional attached document and free text. No queue, no
> claim, no charge-code schema, no approval chain. All of it behind the
> `quotations.portal_pricing` switch, **off by default**.
>
> Build sequence: `cargowise-and-quotation/` (newest) and `plans/Quotation-Module-Phase-Plan.md` phases Q0–Q5. Scope cap and reasons:
> PRD amendment 17.09.2026 and `design/Internal-Quote-Pricing-in-Portal.md` §1b.
>
> **One correction carries into whatever is built:** the line below saying the customer sees
> the price only after CargoWise confirms is now a configured gate, not a fixed rule. An
> absolute gate stops any branch that prices outside a system from answering its customer at
> all. Awaiting the director's written answer — PRD OQ-27.

**Goal:** a Noatum user prices the request in the portal, and CargoWise receives it.

- Additions to `quote`: claim fields, pricing and approval fields, sync state, origin, branch. New table `quote_price_event` holding a snapshot at each step.
- Pricing queue, **branch-scoped**, showing age, customer, mode, route and who holds each item. Claiming with visible ownership and automatic expiry.
- Pricing screen: the customer's request, attachments and history on one side; charge lines, totals per currency, validity, carrier, service, transit and remarks on the other.
- Approval above a configurable threshold, by a different user; reject with a mandatory reason.
- Write-back to CargoWise, idempotent per quote and version; the customer sees the price only after CargoWise confirms; a failed write is visible to internal users only and raises an alert.
- Divergence: if CargoWise returns different values, CargoWise wins, our version is retained in the pricing history, and the pricing user is notified.
- **Drafted customer email** requested from the other team's service through an interface, presented as editable, with a template fallback and no unattended sending.
- **Cost and margin**, if in scope, are internal-only and stripped in a single output mapper.

**Exit test:** a second user cannot edit a claimed request; a submitter cannot approve their own quote; a pending-sync quote is invisible to the customer; retrying the write does not create a duplicate in CargoWise; a customer token receives no cost or internal charge line on any surface; CargoWise pricing a claimed request releases the claim without losing the draft.

---

### Stage F1.09 — Accept, reject, PDF, dashboard, news

**Goal:** the customer completes the journey, and the portal feels like a product.

- Accept within validity, server-enforced, freezing the version and notifying CargoWise. Reject with reason codes creating a new version.
- Branded quote PDF from a design-system template.
- Copy a quote; cancel an un-booked quote.
- Dashboard shell with the widget registry and a small set: active quotes, news, standalone-app links, and the pricing queue widget for internal roles.
- News and banners: authoring with scope global, country or customer, validity window, and the customer-side banner and pop-up.
- Notification bell for quote status changes.

**Exit test:** accepting after validity is refused; an accepted version is immutable; the PDF passes the brand checklist; a banner scoped to one country appears only for users in it.

---

### Stage F1.10 — Hardening and pilot readiness

**Goal:** Phase 1 exit criteria met.

- Cross-tenant isolation suite extended to every entity; penetration test of tenancy and identity.
- Performance budgets verified: quote list under two seconds at volume, search under one and a half, wizard steps under three hundred milliseconds.
- Accessibility pass on the wizard, dashboard and admin screens.
- Real CargoWise connection when access arrives — configuration only.
- **Second-region rehearsal:** onboard a second customer in a different branch on a test environment, purely as configuration, to prove ground rule 2.
- Master-data imports on schedule; monitoring dashboard reviewed; runbook for integration incidents.
- Pilot onboarding with the real customer; brand review sign-off.

**Exit test:** the pilot customer requests a quote, an internal user prices it, CargoWise has it, the customer accepts and downloads the PDF — and the second-region rehearsal required no code change.

---

## 6. Definition of done, every stage

1. Migration written and reversible; single-owner tables carry the customer column with an index and a policy; shipment-family tables use the visibility link table; internal-only tables have an internal policy. No table without a policy.
2. Types and validation schemas in the shared package, used by both the web app and the API.
3. Every route declares a permission; permission codes seeded.
4. Tests: business rules, one cross-tenant test per new entity, one denial test per endpoint. Lint and tests pass.
5. Screens use only design-system components; loading, empty and error states present; accessibility check passes; performance budget met for the stage's list and search endpoints.
6. English and Spanish strings; dates as `DD.MM.YYYY`; no emoji and no exclamation marks in anything customer-facing.
7. Audit event for significant writes; analytics event for user actions.
8. OpenAPI regenerated; `/docs` updated; a decision record written for any architectural choice.
9. Demonstrated end to end locally against the simulator or the real interface.

## 7. How we work

- One stage, one branch, one pull request per slice within it. Branch names carry the stage identifier.
- Board: an epic per phase, a feature per stage, tasks within.
- Every demonstration runs against whichever CargoWise interface is connected.
- Where the PRD is silent we do not guess: the question goes to `gaps.md` with an owner, and the interim assumption is stated in the task.
- Agent-assisted development follows the metaprompt pack: a written task specification, plan mode and approval before code, then a review in a fresh session against the definition of done.

## 8. Risks carried into Phase 1

| Risk | Effect if it lands | What we are doing |
|---|---|---|
| **OQ-3a** — parties turn out to be address codes, not organisation codes | Tenant resolution matches nothing, or matches wrongly | Resolver written so that address-to-organisation mapping is a lookup; question raised with the CW1 team now |
| CargoWise integration access delayed or unavailable in the assumed form | No real round trip in Phase 1 | Adapter interfaces plus the simulator; the platform is indifferent to which is connected |
| Internal pricing not adopted by the pricing team | The Phase 1 quotation feature has no internal users | Head of Pricing view sought before stage F1.08 detail; the pricing screen is designed around what CargoWise makes hard |
| Cost and margin later brought into scope | A new class of sensitive data across every surface | Internal charge-line flag and single output mapper built from the start, whether or not cost is captured |
| Event and document lists arrive late | Phase 2 mapping delayed, not Phase 1 | Mapping tables are administrator-editable; seeded with a small set meanwhile |
| Pilot lanes have no rates | Nothing — the manual path is the Phase 1 commitment | Instant path retained as capability, not as a promise |

## 9. What Phase 2 onward looks like

Sequence and dependency only.

| Phase | Delivers | Depends on |
|---|---|---|
| **2 — Visibility** | Logged-in and public track and trace with the five confirmed milestones, unified search, event mapping from the categorised list, documents on an allow-list, invoices resolved from the transaction addressee, standard alerts including platform-computed delay detection and automatic customs-hold surfacing, per-shipment subscriptions, full dashboard, standard reports with report assignment | Stage F1.05, and the event and document lists |
| **3 — Booking and claims** | Booking from an accepted quote and directly, with the quote number carried for linkage, three-entity handling, document transfer, the confirmed cancellation gate; sailing schedule; claims once the current process is understood; advanced alerts; email rule builder | Phase 2, and OQ-23 |
| **4 — Intelligence and analytics** | Predictive ETA on top of the variance detection, disruption intelligence, benchmarking, data-quality merging with provenance, self-service reports, embedded dashboards, the assistant, training, platform analytics | Phase 2 data |
| **5 — Ecosystem** | Purchase-order visibility, customer data feeds, external API, an additional transport system, more languages | Phase 3 |
| **Deferred** | CO2 across the calculator, tracking and booking | The methodology decision (OQ-20) |

## 10. Day one

1. Create the repository and apply the branch policies.
2. Copy the document set into `/docs` and place `CLAUDE.md` at the root.
3. Build stage F1.01 and prove the local environment.
4. Send the outstanding requests from the kick-off checklist, particularly OQ-3a to the CargoWise team.
5. Implement stage F1.02 and do not write a business feature until the cross-tenant test passes.
6. Review the foundation design with the team before stage F1.05.
