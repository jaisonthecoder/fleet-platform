# P1.03 - Application shell and access navigation

Status: core UI-foundation and shared-layout rearrangement verified; full shadcn adoption and authenticated access integration remain pending. Version 1.3, 11.09.2026. Follow the [shared procedure](README.md).

## Implementation checkpoint - 11.09.2026

- Delivered increment: canonical Noatum theme with compatibility aliases, locally bundled Mulish, shadcn configuration/Tailwind integration, reusable Radix-based controls, shared presentation shell and development-only EN/ES component workspace.
- Workspace exercises forms, dialogs/side panels, keyboard navigation, table filtering/sorting/pagination and loading/empty/error states. It contains component fixtures, not live business records or simulated authentication.
- Verified: portal typecheck, lint, ten Vitest tests, Vite production build and six Playwright desktop/mobile tests passed. Browser coverage includes persistent shell identity, collapse state, direct routes/reload, back/forward, drawer focus, listing filters/pagination, Spanish, scroll containment and automated accessibility. Desktop/mobile snapshots were inspected; this is not a complete manual WCAG conformance assessment.
- Shared shell/header/sidebar/CSS now live outside the UI kit; the duplicate design-system AppShell was removed. App-owned nested routes render workspace content through one `PortalLayout` and `Outlet`.
- Approved mobile increment: up to four configured frequent destinations plus Menu in a persistent bottom bar; Menu and hamburger share the full navigation drawer. Desktop retains the sidebar. Safe-area padding, 44px touch targets, content clearance and EN/ES labels are covered at 320/390/768/1100px with desktop fallback at 1440px. Seven applicable browser tests pass; the mobile-only matrix is intentionally skipped in the desktop project. Preview tabs point only to existing workspace routes, not future business screens.
- Component provenance: shadcn configuration is present, but existing input/select are custom native controls, button is a custom CVA component, and checkbox/switch/dialog/tabs/tooltip are custom Radix wrappers. This is not a completed migration to shadcn source components; sharing Radix dependencies alone does not establish shadcn adoption.
- Production entry renders the pending-portal state rather than the development workspace. Real sign-in, effective-access integration, customer/staff navigation and business workflows remain pending; P1.03 as a whole is not complete.
- Next increment: connect the shared shell to the approved identity/effective-access contract after P1.02 gates, then deliver each business slice DB -> API -> UI -> tests. Do not expand the component library speculatively or present the component workspace as a finished dashboard.

## Outcome and entry gates

Every delivered screen uses the existing Noatum design system, responsive navigation and EN/ES. Current permissions, customer entitlements and functional release readiness are separate concerns.

Core tokens, shadcn components and development-only shell showcase depend on a runnable SPA, not the complete identity backend. Authenticated routes/effective access still depend on P1.02. Gates: D-02 unreleased navigation behaviour; D-10 terminology, assets and supported browser/device matrix. The supplied landing and dashboard screenshots guide composition; shipment widgets and public tracking are not promoted into Phase 1.

Trace: FR-NAV-001 through FR-NAV-006; FR-RPT-002 permission foundation, FR-RPT-005; NFR-UX-001 through NFR-UX-006, NFR-SEC-004/005, NFR-ARC-002.

## Vertical slices

### P1.03-A - Shared controls and accessible shell

- Start with the approved Noatum token block; replace placeholder blue/Inter styling. Preserve compatibility aliases only where existing components need them; raw brand values have one owner.
- Introduce shadcn source components inside the existing app-local design system, mapping Tailwind/shadcn semantics to Noatum tokens. No second palette, generic theme switcher, workspace package or blanket React/framework upgrade.
- Build a development-only component showcase with EN/ES, long labels, disabled/loading/error states, desktop/mobile and keyboard checks. No invented live customers, quotes, permissions or operational counts.
- Common presentation shell: utility bar, header, module navigation, contextual sidebar, content and footer. Customer/staff navigation is supplied by the application layer; design-system primitives contain no auth, router or API logic. Public/auth layout remains distinct.
- Initial core: buttons/inputs, checkbox/switch/select, tabs, dialog/side panel, tooltips, badges, table/pagination/filter controls and loading/empty/error states. Build specialised business components in their owning slices rather than a speculative library.
- UI: app-local tokens/primitives, header/navigation/footer, account/locale controls and notification entry point. Use existing components before adding a new abstraction.
- Contracts/API: own-user/effective-access projections only; do not expose internal role metadata unnecessarily to customer clients.
- State: initial authentication loading, access pending, denied, expired Microsoft sign-in and recoverable API failure; no stale business screen after user/context change.
- Tests: token lint, EN/ES missing-key checks, keyboard/focus, responsive reflow, screen-reader labels and shell visual regression. Dates DD.MM.YYYY; amounts include currency codes.
- Demo: customer and unassigned staff see the correct distinct shell state in both languages.

### P1.03-B - Full navigation and protected routes

- Navigation catalogue: customer Quotations, address book/templates, dashboard/notifications; internal customer/staff/source administration, lookups/settings, pricing/approval and integration diagnostics when granted. Exact grouping/labels remain a mockup decision.
- Future catalogue: Track and trace, Documents, Invoices, Bookings and Claims definitions and grants exist now. Reports use the approved availability pattern for their permission foundation.
- Rules: permission plus entitlement controls eligibility; release readiness controls whether an eligible route is functional. An unreleased entry remains visible to an eligible user under D-02 but invokes no future business API.
- UI: approved disabled-entry or controlled unavailable-page pattern, including direct URL navigation; no fake counts, operational forms or sample customer records.
- Tests: customer preset matrix from FR section 5.1, combined roles, all internal presets, no-role staff, revoked access, direct-route attempts and disabled feature. Test network requests to prove no unreleased endpoint is called.
- Demo: a permitted future Bookings entry has safe unavailable behaviour; changing its URL cannot create a booking.

### P1.03-C - Reusable data-view and form interaction patterns

- UI: labelled fields, accessible dialogs/panels, server validation presentation, pagination/search, empty/no-result/error/loading states and reliable pending-action feedback.
- Data views: reuse DataView where Grid/Detail/Card is required, without forcing those modes on every admin table. Stable dimensions and long EN/ES labels must not overlap.
- Forms: react-hook-form and zod derived from generated API contracts; no handwritten mirror DTOs or duplicated calculations. Preserve unsaved work and expose failed saves honestly.
- Query state: keys include relevant locale/filter/customer context; clear sensitive cached state on identity/scope changes. Cache never extends authorisation.
- Tests: mobile/desktop containment, focus restoration, keyboard dialogs, validation errors, slow/error responses and repeat-click prevention.
- Demo: one small real authorised data view, or shell fixture explicitly limited to tests, exercises all states. Do not publish demo fixture rows as application data.

## Approved file boundaries

See [ADR-005](../../../adr/ADR-005-ui-application-structure.md). Under `apps/noatum-customer-portal-ui/src`, `app` owns routing/providers/navigation and `PortalLayout`; `shared/layouts/app-shell` owns the persistent shell, header, sidebar and layout CSS. `design-system` owns only tokens and reusable controls. Feature pages render inside `Outlet`; they do not repeat the frame. Existing auth/i18n/generated API boundaries remain. The development preview has direct routes; real authenticated access remains gated. No shared workspace package. No changes to the separately maintained HTML mockup unless separately requested.

## Mockup review contract

For each supplied screen record its revision, owning slice, fields, actions, data source, permission/feature conditions and error/pending states. Layout changes are expected. A new workflow/status/setting/source write is a scope decision, not a CSS update.

Preserve provided full-request popover and expandable organisation-address patterns. Do not interpret a collapsed tab or sample number as a business defect. Accessibility and server-side permissions remain requirements even if the mockup omits them.

## Exit evidence

The UI-foundation increment requires a running Vite page, scoped lint/typecheck/build/tests and browser verification of desktop/mobile shell, EN/ES, keyboard drawer/dialog and absence of production showcase output. It is not evidence that real sign-in, permissions, dashboards or P1.03-B have been delivered. Record actual implementation progress separately from the remaining stage gates.

Role/entitlement/readiness matrix, EN/ES screenshots and browser tests, axe plus manual keyboard/contrast checks, and proof of no future-module queries. Screen-specific UI tests continue in every following stage.

Next: [P1.04](04-Integration-and-Organisation-Directory.md).
