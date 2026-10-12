# Phase 1 vertical-slice development plan

| Control | Value |
| --- | --- |
| Version / date | 1.1 / 11.09.2026 |
| Status | Draft for review and implementation approval; no completed-development claim |
| Requested outcome | Complete agreed user, organisation, customer and administration capabilities before the initial full customer/employee quotation workflow |
| UI status | Behaviour and screen responsibilities specified; mockups will refine layout, navigation and interaction details |
| Authority | Current FR/NFR working baseline and explicit user directions; governing-source conflicts require reconciliation before affected code |

## 1. Scope and meaning of complete

Phase 1 delivers staff registration/assignment, customer invitation and user administration, source organisation inspection, customer organisation links and lifecycle, feature administration, multilingual hierarchical lookup management, approved settings, commercial tooling, manual quotations, employee pricing/approval, both publication paths, customer acceptance/rejection/PDF, dashboard, news and notifications.

Complete means the agreed lifecycle, negative cases, API protection, audit, operational recovery and end-to-end evidence, not a list of screens. It does not authorise arbitrary HR functions, CW1 organisation editing, a custom role designer, every imaginable setting or future operational workflows. Unknown fields and policies stay decision-gated.

Tracking, Documents, Invoices, Bookings and Claims retain their Phase 1 navigation, permission definitions and administrator assignment capability. Their working workflows remain later releases. Reports have permission foundations, not a Phase 1 report builder. CO2 remains conditional future scope. No Redis, broker, CRM, Power BI, owned AI models, rate management or portal-owned authentication is introduced.

## 2. Ordered stages

The numbered stages in this folder are subdivisions of **Phase 1**, not new product phases. Stage IDs P1.01-P1.12 and slice IDs below are local planning IDs, not replacements for FR IDs or the historical F1/S1 references.

| Stage | Document to execute | Outcome | Prerequisites |
| --- | --- | --- | --- |
| P1.01 | [01-Readiness-Foundation-and-Delivery.md](01-Readiness-Foundation-and-Delivery.md) | Approved next-slice inputs, runnable apps, safe migrations/jobs and CI | None |
| P1.02 | [02-Identity-Tenancy-and-Permissions.md](02-Identity-Tenancy-and-Permissions.md) | Trusted identity, isolation, portal permissions and access-pending staff | P1.01 |
| P1.03 | [03-Application-Shell-and-Access-Navigation.md](03-Application-Shell-and-Access-Navigation.md) | Noatum-themed shadcn core kit and shared shell, then current/future module access | Runnable web foundation for kit; P1.02 for authenticated access |
| P1.04 | [04-Integration-and-Organisation-Directory.md](04-Integration-and-Organisation-Directory.md) | Observable CW1/simulator connection, read-only source directory and mappings | P1.02; P1.03 for UI |
| P1.05 | [05-Operating-Structure-and-Staff-Management.md](05-Operating-Structure-and-Staff-Management.md) | Governed operating catalogue and complete agreed staff assignment lifecycle | P1.03/P1.04 source contract |
| P1.06 | [06-Customer-Onboarding-and-User-Management.md](06-Customer-Onboarding-and-User-Management.md) | Linked customers, activation/suspension, invitations, user roles and support | P1.04/P1.05 |
| P1.07 | [07-Lookups-Features-and-Settings.md](07-Lookups-Features-and-Settings.md) | Multilingual lookups, relationships, entitlements and versioned approved policies | P1.03-P1.06 |
| P1.08 | [08-Customer-Quotation-and-Shared-Tools.md](08-Customer-Quotation-and-Shared-Tools.md) | Address/template tools, Air/FCL/LCL drafts, calculation and manual submission | P1.04/P1.06/P1.07 |
| P1.09 | [09-Employee-Pricing-and-Approval.md](09-Employee-Pricing-and-Approval.md) | Branch queue, exclusive claim, options, manual pricing and independent approval | P1.08 |
| P1.10 | [10-Publication-Reconciliation-and-Communication.md](10-Publication-Reconciliation-and-Communication.md) | Direct/CW1-confirmed publication, inbound adoption and human-sent correspondence | P1.04/P1.07/P1.09 |
| P1.11 | [11-Customer-Response-and-Product-Experience.md](11-Customer-Response-and-Product-Experience.md) | Acceptance/rejection/PDF, quote notifications, dashboard and news | P1.08-P1.10 |
| P1.12 | [12-Hardening-UAT-and-Pilot-Release.md](12-Hardening-UAT-and-Pilot-Release.md) | All scope verified, live integration evidence and production readiness | P1.01-P1.11 |

The final [coverage and test ledger](13-Coverage-Decisions-and-Test-Ledger.md) accounts for 79 baseline requirement entries including explicit later-phase boundaries, all 58 NFRs by inclusive range, the added lookup direction and 14 integrated acceptance journeys. The 12 stages contain 44 smaller slices. Execute a small slice, not an entire stage in one unreviewed change. Dependency order is authoritative; filenames alone do not justify skipping a gate. Source/reference contracts needed for customer setup can be established in P1.04 before the full lookup editor in P1.07; do not create throwaway duplicate data stores.

## 3. Research and source precedence

Read [the current FR baseline](../../01-Functional-Requirements.md), [NFR baseline](../../02-Non-Functional-Requirements.md), [decision register](../../README.md), [current phased delivery plan](../../03-Phased-Delivery-Plan.md), [quotation workflow](../../07-Internal-Quotation-Pricing-Workflow.md), [organisation research](../../08-Customer-Organisation-and-Access-Research.md) and [lookup plan](../Lookup-Management-Implementation-Plan.md).

The [old vertical backlog](../../../01-Vertical-Slice-Implementation-Plan.md) is used for traceability, not copied as an executable specification. [Kickoff stages](../../../Project-Kickoff-and-Phase1-Plan.md), [simplifications](../../../Simplification-Register.md), [repository rules](../../../../CLAUDE.md) and [ADRs](../../../adr/) remain relevant. Research here is a reconciliation of project evidence, not a new external integration promise or a fresh codebase audit.

| Old-plan assumption or gap | Treatment in this set |
| --- | --- |
| Shared types/design-system packages | API-local contracts, generated SPA client and app-local design system; no cross-app source imports |
| Identity/roles alone represent complete user administration | Explicit staff and customer lifecycle screens, assignment, denial cases, audit and invitation/impersonation boundaries |
| Simple mapping grid is all administration | Dedicated lookup UI plus feature and approved business settings; no arbitrary settings engine |
| Instant rates and simulator-generated prices as main success path | Manual pricing baseline; rate interface unconfigured and stub-tested only |
| Every price must pass CW1 before publication | User-approved UC-12 direct or CW1-confirmed policy; reconcile governing sources/ADR before affected implementation |
| Initial-request sync, approval and final publication treated as one flow | Independent settings, recorded revisions and explicit acceptance matrix |
| Shared browser chargeable-weight calculation | Server calculation endpoint; client displays authoritative results |
| Quote-to-booking conversion or automatic shipment creation | Three entities, later one-to-many quote-number linkage; no booking workflow in Phase 1 |
| Broad later-phase menus absent | Five required future modules have permission/entitlement-aware navigation now, no functioning future APIs |
| Redundant history/PDF/widget/rejection tables in old slices | Check existing columns/audit/version storage and simplifications; physical model reviewed per slice |
| Always-on link approval, fixed region hierarchy or policy precedence | Explicit open decisions; do not infer from mockup labels |
| CRM, Power BI or locally owned AI implementation | Excluded; approved external drafting interface with template fallback only |

### Historical crosswalk

| New stages | Historical anchors |
| --- | --- |
| P1.01 | F1.01; S1.01, S1.01b, S1.07a |
| P1.02-P1.03 | F1.02-F1.04; S1.02-S1.04 |
| P1.04 | F1.05; S1.07 |
| P1.05-P1.06 | F1.03/F1.06; S1.12; source/operating research |
| P1.07 | F1.05/F1.06/F1.08 administration; user-approved lookup direction; UC-12 |
| P1.08 | F1.07; S1.05, S1.08, S1.09 manual entry, S1.11 |
| P1.09-P1.10 | F1.08; SP internal-pricing scope, S1.09 integration; UC-12 |
| P1.11 | F1.09; S1.06, S1.10, S1.13 |
| P1.12 | F1.10; S1.14 |

## 4. Standard development procedure

**Approved UI-foundation-first sequence (11.09.2026):** reconcile Noatum tokens, customise shadcn centrally, verify the reusable core kit and common header/sidebar, then complete each business slice through DB, API, UI and tests before starting the next. Do not batch all backend work ahead of all UI. Token/component/showcase work may start with the runnable SPA; it does not complete P1.02 or prove authenticated access. The initial showcase is development-only, with no customer records or simulated permissions presented as production access.

1. Read the selected slice, its FR/NFR references, resolved decision records and current nearby code. Establish what exists; do not assume scaffolding or mockups are working features.
2. Present exact files, schema/grant changes, migration/backfill strategy, contract changes and focused tests. Obtain implementation approval under repository rules.
3. Implement DB/RLS and reversible forward migration where required, then API-local DTO/zod contracts, repositories/services/controllers and focused tests.
4. Implement transaction-bound integration jobs if required. Regenerate OpenAPI and the SPA client before consuming new contracts.
5. Implement the smallest usable screen/action using existing components, react-hook-form/zod, TanStack Query and EN/ES. Server owns business rules.
6. Immediately validate each substantive edit using the narrowest relevant test/typecheck; then run the required slice gates. Include at least one 403 test per new endpoint and isolation per new entity.
7. Demo the slice including its negative/error path. Record build/environment, fixtures, actual results and open risks. Update this set only for agreed scope/decision changes.
8. Obtain slice review before advancing. No silent commits, new infrastructure, destructive resets or unrelated fixes.

### Reusable implementation task script

This is a development brief, not an executable shell script. Resolve actual commands from current package scripts before use; never pretend tests have run.

```text
Implement slice <P1.xx-letter> from <stage document>, and only that slice.
Read the listed sources, approved decisions and applicable repository instructions.
Inspect nearby code and existing tests; report implementation gaps without rewriting unrelated work.
Before editing, list exact files, schema/RLS/backfill changes, contracts and tests for approval.
Build DB -> API contracts -> API and tests -> integration if needed -> OpenAPI/client -> UI.
Preserve tenant, permission, source-ownership, policy-version and historical-data protections.
Use the approved mockup revision when supplied; otherwise mark UI layout provisional.
Run focused tests after edits, then required lint/typecheck/build/isolation/browser gates.
Demonstrate the happy path, denial path, concurrency/retry path where applicable.
Report changed files, actual checks/results, blocked gates and remaining work.
Do not mark the stage complete merely because its screen renders.
```

## 5. Definition of done and UI change control

- Applicable FRs traced to tests; every open gate resolved or explicitly recorded as blocking/partial, never silently passed.
- Migrations, safe upgrade/backfill/recovery, RLS/grants, route permissions, entitlements, generated contracts and audit/analytics verified.
- Unit, integration, isolation, concurrency and endpoint-denial evidence appropriate to the slice; `pnpm test` and `pnpm lint` pass at required integration gates, with actual scripts confirmed before execution.
- EN/ES including email/PDF/error strings, DD.MM.YYYY and currency codes; Noatum design system; loading/empty/error/unavailable states; WCAG 2.1 AA automation plus manual checks.
- Applicable performance and operational gates from the NFR baseline, not invented metrics. Simulator demos are not real CW1 acceptance.
- UI mockups will be logged by revision against a screen/slice. Compare fields, actions, permissions and states; retain full-request popover and expandable source addresses where provided. Do not report collapsed content as absent.
- A mockup may refine layout without changing business rules. New fields, statuses, approvals, source writes or setting precedence require a documented decision and updated tests before implementation.
- User-approved scope here is planning direction. Existing PRD/root conflicts and the rejection-reason enum conflict must be reconciled before the affected code, not by silently editing historical evidence.

## 6. Release outcome

An eligible employee registers without business access, receives authorised roles/branch, onboards a linked customer, invites its first admin and manages only permitted settings. Customer admins manage their own users. A customer submits a valid quotation; staff claim, price and approve as configured; direct or CW1-confirmed publication delivers a safe offer; the customer accepts/rejects and downloads the correct immutable version. Notifications, support, diagnostics and recovery work without leaking another customer's data or internal costs.

All 12 stages remain planned until their evidence is recorded. The full Phase 1 release requires both publication paths, including real CW1 business acknowledgement. A direct-only pilot needs separate bounded approval and is not full Phase 1 completion.
