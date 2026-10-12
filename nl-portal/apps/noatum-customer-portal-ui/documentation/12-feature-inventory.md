# Feature inventory

What exists under `src/features` and `src/shared`, and — just as usefully —
what does not.

---

## 1. Empty placeholders

**Ten of nineteen feature folders contain only `.gitkeep`.** They are declared so
the structure shows the whole product, not because anything is there:

```
address-book   admin-customer   admin-noatum   bookings   claims
documents      invoices         reports        templates  tracking
```

`dashboard/` and `quotes/` also still carry a leftover `.gitkeep` but are
populated.

If you are looking for one of the above, it has not been built. Check the
parent repository's `docs/plans/01-Vertical-Slice-Implementation-Plan.md` for which
slice owns it.

---

## 2. Populated features

### `admin/` — staff administration (the largest)

| Path | Contents |
|---|---|
| `api/` | `customers.ts`, `organisations.ts`, `operating.ts`, `lookups.ts`, `feature-switches.ts`, `settings.ts` |
| `components/` | `AdminListing`, `DetailHeader`, `DetailHero`, `StepRibbon`, `SummaryGrid` |
| `pages/` | `CustomersPage` + `CustomerDetailPage`, `OrganisationsPage` + `OrganisationDetailPage`, `UnassignedPage`, `LookupsPage`, `FeatureManagementPage`, `SettingsPage`, `OperatingPage`, plus shared `AdminPage.module.css` |

No `i18n/` — it uses the `staff` namespace registered by `StaffPortalLayout`.

> `pages/AdminSectionPage.tsx` is exported and **imported by nothing**. No route
> references it.

### `auth/` — sign-in

`api/current-user.ts` (the client factory, not hooks), `components/AccessPanel`,
`components/DevIdentityPicker`, `pages/LoginPage`, its own `login` namespace, and
`AccessPanel.test.tsx`.

`LoginPage` is **standalone** — mounted by `main.tsx`, outside the router and
outside `QueryClientProvider`.

### `local-auth/` — portal sessions (ADR-006)

`api/local-auth.ts` — **plain async functions, no TanStack hooks** — plus the
CSRF token in `localStorage`. Components `LocalSignInForm`, `MfaPanel`. Pages
`LocalAuthPage` (standalone, with `matchLocalAuthRoute()`),
`ForgotPasswordPage`, `SetPasswordPage`, `AccountSecurityPage` (staff shell) and
`CustomerAccountSecurityPage` (customer shell — wraps the same page in
`CustomerMeasure`). `password-rule.ts` holds `PASSWORD_MIN_LENGTH = 8` and
`meetsPasswordRule`. Own `localAuth` namespace.

### `staff/` — Noatum staff users

`api/staff.ts` (which also exports `StaffError`, re-used by nearly every other
api file), `pages/StaffPage`, `role-labels.ts` (`roleLabels`, `rolePrecedence`,
`primaryRole`, `initials`), and the `staff` namespace — the largest bundle in the
app at ~42 KB.

### `pricing/` — internal quote pricing

`api/pricing.ts`, components `CustomerPreview` and `OptionEditor` (which also
carries the draft-model helpers `emptyLine`, `emptyOption`, `optionTotal`,
`optionCost`, `toApiOption`, `fromApiOption`), pages `PricingQueuePage` and
`PricingDetailPage`, and `money.ts` (`toMinorUnits`, `fromMinorUnits`,
`formatMoney`, `parseQuantity`) with `money.spec.ts`.

### `quotes/` — customer quotations

`api/quotes.ts`, pages `QuotesListPage`, `QuoteDetailPage`, `QuoteRequestPage`.

### `dashboard/` — the customer landing

`api/activity.ts`, `api/public-landing.ts`, `components/PublicLanding.tsx`
(~700 lines — the anonymous landing page), `components/publicLandingData.ts`
(`ICON`, `FEATURES`, `STAT_RAIL` — page furniture only; the data moved behind
the transport), and `pages/CustomerDashboardPage`.

`CustomerDashboardPage` is a three-state selector: not signed in →
`PublicLanding`; signed in with no activity → first-run; signed in with activity
→ the dashboard.

### `customer-admin/` — the customer's own administration

`api/team.ts` and `pages/TeamPage`. Backed by `/api/account/*`, which takes **no
customer id** — the server resolves the tenant from the session.

### `ui-workspace/` — dev-only design-system workspace

`WorkspacePages.tsx` (`ControlsPreview`, `OverlaysPreview`, `DataPreview`,
`FoundationPreview`), `ListingPreview.tsx`, and `Workspace.test.tsx` — which
despite its location is the **project-wide guard test** for tokens, stylesheet
references and locale parity. Flat: no `api/`, `components/` or `pages/`
subfolders.

---

## 3. `src/shared`

| Path | Contents |
|---|---|
| `api/emissions.ts` | `useEmissionsReference`, `useCo2Estimate` (public transport) |
| `components/Breadcrumb` | N-level, `<nav><ol><li>`, `tone: 'surface' \| 'hero'` |
| `components/ListingGrid` | Wraps `DataGrid` and fills its ~30 chrome labels from the default namespace. **Use this, not `DataGrid` directly, on product screens** |
| `components/Co2Calculator` | Reusable emissions panel; needs a `QueryClientProvider` in scope |
| `features/useFeature.ts` | `hasFeature`, `useFeature` |
| `features/useSetting.ts` | `getSetting`, `useSetting` (ADR-010) |
| `reference/useReference.ts` | `useReference`, `useReferenceLabels`, `useReferenceOptions`, `REFERENCE` (15 categories) |
| `layouts/app-shell/` | `AppShell`, `AppHeader`, `AppSidebar`, `GlobalTrackSearch` |
| `layouts/customer-shell/` | `CustomerShell`, `CustomerMeasure` |

---

## 4. Where the shared pieces live

A quick map for "is there already one of these?"

| Need | Use |
|---|---|
| A list screen | `ListingGrid` (`shared/components`) |
| A table without the listing chrome | `DataTable` (`design-system`) |
| Loading / empty / error block | `StatePanel` (`design-system`) |
| A date | `DateValue` / `formatDate` |
| A relative age | `timeAgo` + `useNow` (`lib/`) |
| An identifier | `Code` (`design-system`) |
| Breadcrumbs | `Breadcrumb` (`shared/components`) |
| A dropdown of reference data | `useReferenceOptions` (`shared/reference`) |
| A feature flag | `useFeature` (`shared/features`) |
| A tunable setting | `useSetting` (`shared/features`) |
| Debouncing a query key | `useDebounced` (`lib/`) |
| Mapping an error to a message | `errorKey` (`lib/`) |

---

## 5. Cross-cutting observations

- **Two api styles coexist.** Most features use TanStack Query hooks;
  `local-auth` uses plain async functions with inline `useQuery`/`useMutation`
  in the page. Follow the hook style for anything new.
- **`StaffError` lives in `features/staff/api/staff.ts`** but is imported by
  `admin`, `pricing`, `quotes` and `lib/errors.ts`. It is effectively shared and
  arguably belongs in `lib/`.
- **`customer-admin/api/team.ts` diverges** from the house pattern: no
  `retry: false`, no request timeout, and a different error shape. Worth aligning.
- **The public landing is the only screen with a transport-level stand-in.**
  Everything else talks to the real API or fails.
