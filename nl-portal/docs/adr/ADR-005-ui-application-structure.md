# ADR-005: UI application composition and shared layouts

- Status: Accepted
- Date: 11.09.2026
- Scope: `apps/noatum-customer-portal-ui/src`

## Context

The application shell is shared by pages but is not a UI-kit primitive. The approved
structure separates application composition, shared presentation layouts and feature
content. React does not mandate a universal folder tree; this decision applies its
separation-of-concerns guidance to the existing Vite SPA without a framework rewrite.

## Decision

```text
src/
  app/
    App.tsx
    providers.tsx
    router.tsx
    layouts/PortalLayout.tsx
    navigation/navigation.ts
  shared/layouts/app-shell/
    AppShell.tsx
    AppHeader.tsx
    AppSidebar.tsx
    AppShell.module.css
    index.ts
  design-system/
    components/
    styles/
  features/<feature>/
    api/
    components/
    pages/
    i18n/
  api/generated/
  auth/
  i18n/
  main.tsx
```

- `app` owns providers, route composition, navigation configuration and connections
  to identity/effective access. `PortalLayout` renders the shared shell once and
  renders child routes through React Router's `Outlet`.
- `shared/layouts/app-shell` owns presentation, desktop collapse, mobile navigation,
  skip-link and route-change focus. It receives navigation data/callbacks and slots;
  it imports neither feature pages, routing nor authentication code.
- The design system owns tokens and reusable controls. It must not export or import
  the application shell. Shell-specific CSS lives alongside the layout and consumes
  the existing tokens; it does not define another theme.
- Features own page content and business interactions, not duplicate headers or
  sidebars. Existing API, auth and i18n folders remain in place. Feature folders are
  created only when needed, not as empty scaffolding.
- Public/invitation routes will use a separate `app/layouts/PublicLayout.tsx` when
  their slice is implemented; they must not inherit the portal sidebar. No unused
  public layout or simulated authentication is introduced in this increment.
- Tests are co-located with their subject or existing integration test; browser
  journeys remain in `e2e`. Route tests assert shell identity, collapse persistence,
  direct URLs, history and mobile focus.

## Consequences

### Responsive navigation increment - 11.09.2026

At widths up to 1100px, the shared shell displays up to four app-configured frequent
destinations plus Menu in a bottom navigation bar. Menu and the header hamburger
open the same full-menu drawer; every destination stays directly reachable. Above
1100px, the desktop sidebar replaces the bottom navigation. Bottom destinations are
selected from the supplied navigation, not a second hard-coded business catalogue.
The development preview uses existing workspace routes, not unimplemented finance
or shipment pages. Identity/effective-access filtering remains an application concern.

The bottom bar occupies its own flex row outside scrolling page content, includes
device safe-area padding, and uses at least 44px touch targets. Active links use
icon/text plus a red indicator and `aria-current`. Closing the drawer restores focus
to its actual opener; selecting a drawer route focuses main content. Short labels
are localised EN/ES. Browser checks cover 320, 390, 768, 1100 and 1440px, drawer
parity, focus, content clearance, Spanish and automated accessibility.

All sibling portal pages reuse the same mounted frame. Plain navigation URLs retain
native modified-click behavior, while application callbacks perform SPA navigation.
The development workspace exercises these routes; production continues to display
the pending-portal state until real identity/effective-access gates are satisfied.
There are no schema, API, dependency or shared-workspace-package changes.

## References

- [React: Thinking in React](https://react.dev/learn/thinking-in-react)
- [React Router: nested layouts](https://reactrouter.com/6.30.1/start/overview)
- [shadcn component aliases](https://ui.shadcn.com/docs/components-json)
- [ADR-002: Vite SPA](ADR-002-frontend-framework.md)
