# Noatum UI Kit Component Library Implementation Plan

> **Status:** Proposed for approval. Plan only; no UI code, dependencies, or configuration are changed by this document.
>
> **Design contract:** `REFERENCE/MOCKUP - Fright Forwarder Customer Portal/Noatum UI Kit.dc.html`
>
> **Target:** `apps/noatum-customer-portal-ui/src/design-system/`
>
> **Verified inventory:** 81 coded entries in 12 groups, 59 custom logistics icons, and 14 named animations.

## 1. Outcome and constraints

Evolve the existing in-application design system into the single reusable component library for the portal. Do not create a parallel `src/components` library and do not rewrite feature screens before their replacement components are ready.

The finished library must:

- preserve every kit code (`FN-01` through `SH-04`) in source documentation and Storybook metadata;
- expose typed, named React exports with `forwardRef` where a consumer can reasonably need the underlying element;
- be controlled-first for interactive state, with an optional uncontrolled API only where Radix or native HTML already provides a sound one;
- use CVA for genuine visual variants, `cn()` for class composition, CSS Modules for component styling, and Tailwind v4 `@theme` only as the bridge to approved tokens;
- contain no React `style` props or HTML `style` attributes and no raw colour values, raw font families, or raw radii outside the token source; data-driven geometry must use clamped SVG presentation attributes or native `progress`/`meter` semantics rather than generated percentage classes;
- keep all customer-visible copy in i18next rather than inside generic components;
- retain the existing generated API boundary; components accept view data and callbacks, never call portal APIs directly;
- meet WCAG 2.1 AA, including keyboard operation, focus visibility, non-colour status cues, reduced motion, and useful names for icon-only controls;
- remain tree-shakeable and avoid speculative abstractions, duplicated wrappers, index barrels with side effects, or dependencies for visuals that plain HTML/CSS/SVG can render efficiently.

### 1.1 Source precedence

For this work, apply sources in this order:

1. The UI kit defines component anatomy, states, interactions, and kit codes.
2. `docs/noatum-designsystem.md` defines immutable Noatum brand roots and voice.
3. Existing portal tokens define already-approved application aliases and operational density.
4. Existing screens supply real use cases and migration constraints; they do not override the kit silently.

Where the kit and brand document differ, add a named semantic application token or record a decision. Do not mutate a brand root merely to make a specimen match.

## 2. Research findings

### 2.1 Exact catalogue

The HTML contains 81 unique IDs. Counts reconcile exactly:

| Group | Prefix | Count |
|---|---:|---:|
| Foundations | FN | 7 |
| Chrome and navigation | CH | 13 |
| Actions | AC | 4 |
| Form controls | IN | 4 |
| Selection blocks | SE | 6 |
| Data display | DA | 10 |
| Feedback and overlays | FB | 4 |
| Specialised logistics | SP | 8 |
| Dates and days | DT | 4 |
| Loading and progress | LD | 13 |
| Compact forms | CF | 4 |
| Shell sizing | SH | 4 |
| **Total** |  | **81** |

Not every code should produce a React file. `FN-01` to `FN-03`, `FN-05`, `FN-06`, `CF-04`, and `SH-04` are foundations or rules. Several loading codes are variants of shared animation primitives. Each code still requires a dedicated Storybook story or documentation section and an acceptance assertion.

### 2.2 Current implementation

The portal already has the correct ownership boundary under `src/design-system`, with branded components, neutral Radix primitives, CSS Modules, tokens, `cn()`, CVA, Vitest, Testing Library, Playwright, and axe. Relevant existing components include:

- `Button`, `Input`, `Select`, `Controls`, `Tabs`, `ComboInput`;
- `DataTable`, `DataGrid`, `DataView`;
- `DateValue`, `SectionHeading`, `InfoRibbon`, `StatCounter`;
- `Drawer`, `Header`, `Footer`, and `NewsCard`;
- shared `Breadcrumb`, staff app shell, and customer shell outside the design-system folder.

The migration must consolidate these components rather than duplicate them. `Button`, `Tabs`, `Input`, and `Select` have already exposed why styled shadcn defaults cannot compete with CSS Modules: Radix/shadcn primitives should own semantics and behaviour; the Noatum layer should own appearance.

Confirmed dependency gaps are Storybook 8, `react-day-picker`, and `cmdk`. Recharts is optional and should be added only after a plain SVG prototype fails the complexity or accessibility gate. The kit has two icon contracts: the exact 59-icon FN-07 logistics family and the generic outline control glyphs demonstrated by FN-05 and individual specimens. Lucide remains available for legacy screens while both local contracts are built.

### 2.3 Corrections to avoid carrying into implementation

- `FN-07` contains **59**, not 24, named icons.
- The loading group contains **13 component codes** and **14 CSS keyframes**; those counts describe different things.
- `CF-04` and `SH-04` are rules/comparison specimens, not independent widgets.
- Customer and staff shells are intentionally different on desktop and converge only at the mobile shell.
- The kit's Quick Quote is a short customer-data entry pattern. It must not be interpreted as an automatic-rate promise; all current quotation rules remain in force.
- Numerically ordered contract tables are for readability. The source/visual-diff fixture preserves the HTML order, where LD-13 appears before LD-10 to LD-12.

## 3. Target architecture

Keep the current design-system root and introduce clear layers:

```text
src/design-system/
  index.ts
  styles/
    tokens.css
    theme.css
    foundation.css
    motion.css
  utils/
    cn.ts
    polymorphic.ts
  icons/
    Icon.tsx
    icon.types.ts
    icon-registry.tsx
    icons/*.tsx
    index.ts
  primitives/
    ...neutral Radix and native wrappers
  components/
    actions/
    forms/
    navigation/
    data-display/
    feedback/
    dates/
    loading/
  patterns/
    logistics/
    compact-forms/
  layouts/
    chrome/
    shells/
  stories/
    foundations/
    visual-diff/
```

### 3.1 Layer rules

| Layer | Owns | Must not own |
|---|---|---|
| Styles | tokens, Tailwind bridge, reset, shared motion | feature selectors or page copy |
| Icons | SVG geometry and accessible icon wrapper | business labels or route logic |
| Primitives | focus, keyboard, portal/overlay semantics | Noatum compositions or API calls |
| Components | reusable Noatum controls and display units | tenant filtering or server rules |
| Patterns | domain compositions such as container utilisation | data fetching or workflow decisions |
| Layouts | shell/chrome geometry and responsive behaviour | permissions, navigation catalogue ownership |
| Features | API hooks, permissions, feature switches, business copy | copied component CSS or local variants |

### 3.2 Public API rules

- Named exports only; no default exports.
- Props extend the relevant native element or Radix primitive props and omit only conflicting keys.
- Callback payloads use values, not synthetic events, unless native compatibility is the explicit purpose.
- `className` is accepted on the root. Internal slot class overrides are not public unless a real extension use case exists.
- Variant unions are exported when consumers need them; internal CVA objects are not.
- Compound components are reserved for structures with independent semantics, such as `DataTable`, `Dialog`, `Drawer`, and `Tabs`.
- Components render children or typed data. They do not translate, fetch, navigate, check permissions, or evaluate feature switches.
- Stable DOM and explicit dimensions prevent loading, labels, icons, and dynamic values from shifting layout.

### 3.3 Styling and token bridge

`tokens.css` remains the only raw-value source. Add `theme.css` with Tailwind v4 `@theme inline` aliases pointing to those CSS variables; do not duplicate values in `@theme`.

Required token work:

1. Preserve the immutable brand roots already present.
2. Add semantic aliases for the kit's 30px page title, 22px section heading, 17px card heading, 15px body, 13px dense label, and 11px tracked eyebrow.
3. Resolve status aliases to the already-present approved public values (`--noa-green-600`, `--noa-green-050`, `--noa-amber-600`, `--noa-amber-050`) rather than adding another green/amber family.
4. Correct the application pill alias: pills use 20px; avatars/dots use 50%; cards remain square; capsules are reserved for the few controls the kit explicitly makes fully rounded.
5. Add raised, inset, modal, focus-width, focus-offset, control-height, and stable-layout aliases where missing.
6. Keep gradients restricted to the approved hero pattern, data gauges, and loading effects described by the kit. Feature CSS cannot invent gradients.

The first implementation increment must produce this explicit token delta ledger before changing consumers:

| Contract role | Kit value | Current source | Planned semantic alias/use |
|---|---|---|---|
| Action / hover / tint | `#AA272F` / `#8E2027` / `#F7ECEC` | exact brand roots exist | retain; actions, focus specimens, selected tint |
| Identity / deep ground / tint | `#002C5F` / `#041C2C` / `#E8EDF4` | roots and public tint exist | retain; identity/reference and dark heroes only |
| Success / tint | `#2E7D4F` / `#EAF4EE` | exact public aliases exist; older status aliases differ | point semantic success aliases to approved public values |
| Attention / tint | `#B7791F` / `#FBF3E4` | exact public aliases exist; older warning aliases differ | point semantic attention aliases to approved public values |
| Ink / body / muted | `#333333` / `#58595B` / `#A7A7A6` | exact roots exist | muted remains metadata/decorative only |
| Border / page / inset | `#E5E5E5` / `#F5F5F3` / `#FBFAF7` | exact roots/public aliases exist | retain and name inset surface |
| Portal type scale | `30/1.25`, `22/1.2`, `17/1.3`, `15/1.5`, `13/1`, `11/1` tracked `.08em` | marketing aliases are larger; app scale has no exact complete set | add portal semantic aliases; do not replace marketing display tokens |
| Geometry | `4px`, `20px`, `0`, `50%` | 4px/0/full capsule exist; pill alias is currently square | controls, pills, cards, avatars/markers respectively |
| Card / raised shadows | `0 2px 14px rgba(0,0,0,.10)` / `0 6px 22px rgba(0,0,0,.18)` | card exists; raised missing | retain card, add raised semantic alias |
| Shell geometry | utility `32px`; header `64px`; gutters `32px`; mobile gutter `14px`; staff rail `230px/64px` | customer is centred at 1170px; staff rail is 196px; token says 248px | replace shell geometry under SH-01 to SH-04 |

Add an ESLint/style validation rule or repository script that fails on:

- raw hex/rgb/hsl values outside `tokens.css`;
- `font-family`, literal `border-radius`, and any React/HTML inline style;
- unknown `--noa-*` variable references;
- imports from design-system internal paths when a public export exists.

## 4. Icon systems (FN-05 and FN-07)

Create a local, tree-shakeable logistics icon family from the exact FN-07 kit paths. The 59 canonical names, in source order, are:

`Container ship`, `Barge`, `Air freight`, `Truck`, `Trailer`, `Rail freight`, `Forklift`, `Mobile crane`, `Gantry crane`, `Warehouse`, `Pallet`, `Carton`, `Drum`, `Bagged cargo`, `Container`, `Reefer`, `Dangerous goods`, `Fragile`, `Not stackable`, `Gross weight`, `Dimensions`, `Cargo ready date`, `Transit time`, `Place`, `Routing`, `Global network`, `Port call`, `Customs cleared`, `Bill of lading`, `Invoice`, `Certificate`, `Cargo insurance`, `Inspection`, `Temperature`, `Batteries`, `Fumigation`, `Emissions`, `Barcode`, `Seal`, `Signature`, `Linked reference`, `Agreement`, `Branch contact`, `Email`, `Message`, `Alerts`, `Contact`, `Team`, `Branch office`, `Factory`, `Terminal gate`, `Conveyor`, `Heavy lift`, `Exception`, `Flammable`, `Bulk liquid`, `Compass`, `Delivered`, and `Free time`.

### 4.1 Logistics icon API

Use individual named SVG exports for optimal tree shaking and an optional registry-backed `Icon` convenience component for dynamic metadata-driven cases.

```ts
export type NoatumIconName =
  | 'container-ship'
  | 'barge'
  | 'air-freight'
  // ...all 59 canonical kebab-case names
  | 'free-time';

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: NoatumIconName;
  size?: 16 | 20 | 24 | 30;
  label?: string;
  decorative?: boolean;
}
```

Rules:

- Keep `viewBox="0 0 24 24"`, kit path data, rounded caps/joins, and inherited colour.
- Default stroke comes from the icon token; selected 30px tiles are composition owned by their parent selector, not by `Icon`.
- `decorative` icons use `aria-hidden`; meaningful icons require `label` and render `role="img"`.
- Aliases exist only in a typed lookup used by business metadata; aliases must never create duplicate SVG components.
- Add an icon gallery story with name, category, aliases, 16/20/24/30 rendering, light/dark rendering, and clipping checks.
- Keep Lucide for legacy controls during migration, then remove imports only after a usage audit proves every required general UI glyph has a local equivalent. Do not redraw the Noatum logo.

The exact extraction is a checked-in fixture of 59 ordered `{ displayName, name, pathD }` records. A fixture test must fail on a missing, extra, reordered, or changed path unless the source fixture is deliberately regenerated and visually reviewed.

### 4.2 Generic control glyph API

FN-05 and the component specimens also require non-logistics glyphs including search, document, alert, check, swap, menu, chevrons, close, plus, minus, calendar, list, and directional arrows. Implement these as a separate local `UiGlyph` family with the same 24 viewBox, inherited colour, outline-only, 1.8-2.2px stroke rules. Do not force them into `NoatumIconName` and do not substitute a semantically similar logistics icon.

The source of each generic glyph must be recorded as either an exact kit path or an approved Radix/Lucide path used temporarily during migration. Completion requires all glyphs visible in the 81 specimens to be local and included in the icon gallery; unrelated Lucide icons are not copied.

## 5. Loading and motion architecture

Define the 14 kit keyframes once in `motion.css`: `noaPulse`, `noaRun`, `noaWake`, `noaSpin`, `noaShimmer`, `noaFill`, `noaRise`, `noaBay`, `noaLamp`, `noaBoard`, `noaSweep`, `noaDrift`, `noaDash`, and `noaBlink`.

Motion rules:

- preserve the 14 exact kit keyframes as contract exceptions, including `noaRun` width, `noaFill` height, `noaDrift` left, and `noaDash` background-position; new motion prefers `transform` and `opacity` and must not introduce additional layout animation without review;
- do not add `will-change` permanently; apply it only while a bounded animation is active;
- all infinite animation stops under `prefers-reduced-motion: reduce`, leaving a meaningful static end state;
- progress text is authoritative; animation never pretends to be determinate when progress is unknown;
- live status announcements use one polite live region and do not announce every animation frame;
- cold-start experiences render only for genuine application bootstrap and never delay usable content for decoration;
- skeletons preserve final geometry and carry `aria-hidden`; the containing region exposes its loading state.

Loading public units should be smaller than the 13 stories:

| Public unit | Kit coverage | API direction |
|---|---|---|
| `RouteLoader` | LD-01 | lane, mode icon, steps, active step, status text |
| `ContainerProgress` | LD-02 | value, max, processed label, item count |
| `InlineWait` | LD-03, LD-11, LD-13 | `variant="compass|pulse|bars|text|arc|twin|radar|orbit|cube"` |
| `SkeletonRows` | LD-04 | rows, column widths, density |
| `ColdStart` | LD-05 to LD-09 | `variant="dark|light|bays|network|board"` plus data |
| `RefreshIndicator` | LD-10, LD-12 | `variant="thread|overlay"`, label, busy |

## 6. Full component contract and implementation map

Status values mean: **Evolve** an existing shared implementation, **Extract** a current feature/shared implementation into the design system, **Build** a missing public unit, and **Document** a foundation/rule with no dedicated component.

### 6.1 Foundations

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| FN-01 | Brand/state palette and semantic aliases; contrast examples and forbidden uses | tokens + story | Document | all modules |
| FN-02 | Six-level portal type scale with semantic heading markup | tokens + story | Document | all modules |
| FN-03 | card, raised, inset, and accented surfaces; cards stay square | `Surface` optional only if semantics justify it | Document | forms, panels, notices |
| FN-04 | heading, 40x3 rule, supporting copy; level and alignment configurable | `SectionHeading` | Evolve | every page section |
| FN-05 | outline icon usage, sizes, light/dark rules | icon story/guidance | Document | actions and navigation |
| FN-06 | radius and spacing rules; stable target dimensions | tokens + story | Document | all components |
| FN-07 | 59 exact logistics icons, typed names and aliases | `Icon` + named exports | Build | modes, cargo, docs, parties, status |

### 6.2 Chrome and navigation

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| CH-01 | 32px utility context bar; account/office left, language/help/sign-out right | `UtilityBar` | Extract | both desktop shells |
| CH-02 | logo, primary nav, optional search, notifications, profile menu; route-driven active state | `AppHeader` | Evolve | authenticated shells |
| CH-03 | grouped links, counts, active marker, expanded/collapsed states, tooltips when collapsed | `SideRail` | Extract | staff shell only |
| CH-04 | route-line breadcrumb with linked ancestors, hollow stops, current marker, back behaviour | `RouteBreadcrumb` | Extract | customer detail journeys |
| CH-05 | counted single-axis filter tabs; controlled selection and roving keyboard focus | `FilterTabs` | Evolve from `DataView` | queues and lists |
| CH-06 | panel tabs with controlled value, disabled state, optional count | `Tabs` | Evolve | detail panels |
| CH-07 | numbered heading, subtitle, optional status badge | `NumberedSectionHeader` | Build | multi-part forms |
| CH-08 | labelled icon trigger, expanded state, focus restoration | `MobileDrawerTrigger` | Extract | mobile shell |
| CH-09 | route hero with origin/destination, real progress, mode, facts, action slot | `RouteHero` | Build | shipment detail |
| CH-10 | search hero with mode selection and lifted form slot; submit owned by feature | `SearchHero` | Build | track/search entry points |
| CH-11 | rows-per-page select followed by one 40px outlined group containing previous, the fixed red page rule, `Page n of m`, next, and last; controlled server paging and disabled edge states | `Pagination` | Evolve | all paged lists |
| CH-12 | compact text breadcrumb with linked ancestors and `aria-current` | `TextBreadcrumb` | Evolve shared `Breadcrumb` | staff workspaces |
| CH-13 | dark tracking hero with pulsing live-feed marker, greeting, three left-rail metrics, translucent track panel, five reference-type pills, one 52px labelled field, red Track action, and recent-reference pills | `TrackingHero` | Build | customer dashboard |

### 6.3 Actions

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| AC-01 | light primary/outline/quiet/disabled, sizes, icons, loading and full width | `Button` | Evolve | all commands |
| AC-02 | dark-surface primary/outline/tertiary with equivalent disabled/loading states | `Button` `surface="dark"` | Evolve | heroes and dark panels |
| AC-03 | pill CTA and 36/44px icon-only controls; tooltip/name mandatory | `Button`, `IconButton` | Build/evolve | compact actions |
| AC-04 | controlled view switcher plus bounded numeric stepper | `ViewSwitcher`, `Stepper` | Evolve/extract | list views and equipment counts |

### 6.4 Form controls

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| IN-01 | text/password/number/date/select/textarea; label, hint, optional, error, suffix | `Field`, `Input`, `Select`, `Textarea` | Evolve | all forms |
| IN-02 | search and origin/destination fields; clear, swap, compact/hero heights, autocomplete slot | `SearchField`, `LaneFields` | Build from `ComboInput` | quote and tracking search |
| IN-03 | segmented, switch, checkbox, radio; controlled state, disabled, groups, keyboard semantics | controls family | Evolve | forms and settings |
| IN-04 | labelled range, value output, min/max, step, warning threshold | `RangeSlider` | Build | payload and filter limits |

### 6.5 Selection blocks

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| SE-01 | single-select mode cards with icon inversion and responsive grid | `TransportModePicker` | Extract | quotation mode |
| SE-02 | radio-card group with label/detail and disabled state | `RadioCardGroup` | Build | scope and service choice |
| SE-03 | multi-select chips and removable active-filter chips | `ChipToggleGroup`, `FilterChip` | Build | services and filters |
| SE-04 | equipment type, dimensions, quantity stepper, actual payload and limit warning | `ContainerSelector` | Extract/evolve | FCL cargo entry |
| SE-05 | selected items read-back with counts and optional removal | `SelectionSummary` | Build | cargo forms |
| SE-06 | role-coded party card with lookup/free-text selection and linked contact details | `PartySelectorCard` | Extract/evolve | quote and booking parties |

### 6.6 Data display

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| DA-01 | priority cards with semantic top rail, time, route, body and action | `AttentionCard` | Build | dashboards |
| DA-02 | semantic stat tile with number, label, optional trend bars and accessible trend text | `StatTile` | Evolve `StatCounter` | dashboards/queues |
| DA-03 | generic typed table plus route-progress cell; sorting only when server supports it | `DataTable`, `RouteProgress` | Evolve | all large lists |
| DA-04 | five-stage milestone tracker with dates/locations and complete/current/future states | `MilestoneTracker` | Build | shipment and quote detail |
| DA-05 | comparable horizontal mode bars and controlled tonnage input | `ModeLadder` | Build | emissions comparison |
| DA-06 | bounded ring gauge, visible value, label and facts; SVG fallback text | `RingGauge` | Build | emissions/completeness |
| DA-07 | labelled trend sparkline with direction/value text, not colour alone | `SparklineTrend` | Build | dashboard metrics |
| DA-08 | semantic badges/status chips plus DG placard; icon/text where colour is insufficient | `Badge`, `StatusBadge`, `DangerousGoodsBadge` | Evolve | all status surfaces |
| DA-09 | key/value summary and semantic checklist | `SummaryList`, `Checklist` | Build | review and readiness |
| DA-10 | vertical event timeline with active/current/future and next-step content | `Timeline` | Build | activity/history |

### 6.7 Feedback and overlays

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| FB-01 | info/warning/error/featured notices with icon, heading/body/action slots | `Notice` evolved from `InfoRibbon` | Evolve | all modules |
| FB-02 | loading-safe empty state, attachment rows, remove/download actions, upload drop zone | `EmptyState`, `AttachmentList`, `UploadZone` | Build | documents and forms |
| FB-03 | accessible confirmation dialog with intent, pending state, safe focus and action order | `ConfirmationDialog` | Build over Radix Dialog | significant actions |
| FB-04 | 420px filter drawer, accordions, result count, reset/apply, sticky footer | `FilterDrawer` | Extract from `DataView` | large lists |

### 6.8 Specialised logistics

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| SP-01 | grouped matches, no-hit state, keyboard selection, selected token kind/count, and explicit free-text fallback flagged unverified; async/error states are portal hardening only when backed by a remote source | `Combobox` over `cmdk` | Evolve `ComboInput` | ports, parties, lookups |
| SP-02 | compact and hairline scrollbars, tokenised hover, Firefox/WebKit coverage | `[data-scroll]` styles | Evolve | rails, menus, tables |
| SP-03 | multimodal legs sized by actual duration, labelled independently of width/colour | `LegBreakdown` | Build | shipment routing |
| SP-04 | volume and payload utilisation with limiting factor and numeric read-back | `ContainerUtilisation` | Build | cargo review |
| SP-05 | free-time calendar/meter with used/free/chargeable days and currency-coded accrual | `FreeTimeMeter` | Build | container detail |
| SP-06 | charge categories as proportional bars and exact itemised values | `ChargeBreakdown` | Build | quote/invoice detail |
| SP-07 | incoterm handover stages, seller/buyer responsibility and risk-transfer marker | `IncotermHandover` | Build | quote explanation |
| SP-08 | port-call strip with current position, ETA, call status, omissions and transhipments | `VesselRotation` | Build | sea shipment detail |

### 6.9 Dates and days

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| DT-01 | stamp, segmented, compact, and form-row display variants; always `DD.MM.YYYY` | `DateDisplay` evolved from `DateValue` | Evolve | all date surfaces |
| DT-02 | seven-day multi-select with locale labels and sentence read-back | `WeekdayPicker` | Build | schedules |
| DT-03 | four shortcuts on the left; month navigation and seven-column grid; chosen state, sailing-day red dot/tint, today navy inset ring, dead past dates, legend, min/max | `DatePicker` over `react-day-picker` | Build | ready/collection dates |
| DT-04 | controlled first date plus weekday recurrence and localised summary | `SchedulePicker` | Build | recurring collections |

### 6.10 Loading and progress

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| LD-01 | signature route wait with lane, moving mode, and truthful task states | `RouteLoader` | Build | long route operations only |
| LD-02 | determinate container fill with real value/count | `ContainerProgress` | Build | imports/uploads |
| LD-03 | compass, pulse and bars inline waits | `InlineWait` variants | Build | buttons, rows, recalculation |
| LD-04 | stable table/list skeletons with staggered shimmer | `SkeletonRows` | Build | data lists |
| LD-05 | dark first-paint wordmark/line splash | `ColdStart variant="dark"` | Build | authenticated bootstrap |
| LD-06 | light equivalent with sweep | `ColdStart variant="light"` | Build | light bootstrap |
| LD-07 | sequential platform loading bays | `ColdStart variant="bays"` | Build | module bootstrap |
| LD-08 | sequential port network rotation | `ColdStart variant="network"` | Build | network bootstrap |
| LD-09 | arrivals-board lines reveal real customer counts | `ColdStart variant="board"` | Build | dashboard bootstrap |
| LD-10 | boxless refresh thread with no blocking surface | `RefreshIndicator variant="thread"` | Build | tables/panels |
| LD-11 | text-preserving wait marker with no layout shift | `InlineWait variant="text"` | Build | unresolved cells/figures |
| LD-12 | readable 45% content overlay, thread and short copy; no panel/blur/spinner | `RefreshIndicator variant="overlay"` | Build | background refresh |
| LD-13 | 14-20px arc/twin/radar/orbit/cube spinners | `InlineWait` spinner variants | Build | compact async actions |

### 6.11 Compact forms

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| CF-01 | Quick Quote asks five customer-known entries and reads back known account/quote data | `QuickQuoteForm` pattern | Extract/evolve | quotation request |
| CF-02 | agreed quote read-back; required pickup date, optional customer reference, required terms acceptance, and Place booking disabled with an explanatory note until accepted | `BookQuoteForm` pattern | Build when booking slice starts | booking |
| CF-03 | six-cell cargo line with derived totals and stable row/footer layout | `CargoLineEditor` | Extract/evolve | cargo entry |
| CF-04 | six rules: ask only customer-known data and read back known values; derive permitted arithmetic; use chips/segmented controls for at most four choices and select for five or more; use 40px compact and 44px full-form controls with labels above; expose one primary action with a pre-submit missing count; accept code-field free text and flag it unverified | form guidance/story | Document | every form |

### 6.12 Shell sizing

| Code | Contract, states, and behaviour | Implementation unit | Status | Principal use |
|---|---|---|---|---|
| SH-01 | customer desktop: 32px utility bar, sticky 64px header, top navigation with seven slots, no side rail, no centred maximum measure, full-width content, 32px gutters, 28px section gap | `CustomerShell` | Evolve with geometry replacement | customer portal |
| SH-02 | staff desktop: 32px utility bar, 64px header, 230px module rail with 44px rows and 3px active marker, 64px collapsed rail, fluid content with 32px gutters, rail hidden below 1024px | `StaffShell` | Evolve with geometry replacement | staff portal |
| SH-03 | shared 390x780 reference: 56px mobile header, drawer trigger, five-tab bottom bar, 14px gutters, single-column cards, safe-area insets | `MobileShellNavigation` | Evolve with geometry replacement | both audiences |
| SH-04 | comparison rules: customer has no rail, top navigation, and route-line breadcrumb; staff has a 230/64 rail tree and text breadcrumb; mobile has drawer navigation, five tabs, and title only; both desktop content areas are full width | shell documentation/story | Document | architecture |

## 7. Storybook and test strategy

### 7.1 Storybook 8

Add Storybook only after a compatibility spike confirms the exact Storybook 8 packages support the repository's React 19, Vite 8, TypeScript, and ESM setup. Pin compatible package versions together; do not mix Storybook majors.

Configuration must import the real font, tokens, theme bridge, foundation, and motion styles. Global decorators provide i18next EN/ES, React Router memory context, reduced-motion mode, light/dark surfaces, and desktop/mobile viewports. They must not mock application APIs globally.

Every kit code gets a story ID and title, even when several codes share one component. Each interactive component must demonstrate:

- default, hover/focus where representable, active/selected, disabled, error, empty, loading, and reduced-motion states as applicable;
- controlled usage with Actions logging value callbacks;
- realistic longest EN and ES labels;
- narrow mobile and wide desktop layouts;
- keyboard interaction and an a11y panel result;
- the kit code, intent, composition notes, and approved portal use cases.

Add one `UI Kit Visual Diff` story page that renders all 81 specimens in source order beside captured reference crops or approved measurements. It is the migration scorecard, not a second implementation.

Each code also receives a machine-readable specimen contract recording label, source order, required anatomy, interactive states, exact dimensions/tokens, responsive transformation, and whether a behaviour is mockup-required or portal hardening. A Storybook story is incomplete while any required anatomy field is unresolved.

### 7.2 Vitest and Testing Library

Tests scale by behaviour rather than taking snapshots of every class:

- primitives: accessible name, ref forwarding, keyboard operation, disabled behaviour, callback values;
- selectors: controlled selection, roving focus, required/invalid semantics, removal;
- overlays: focus trap, initial focus, escape, outside interaction policy, focus restoration;
- tables/pagination: semantic table output, server-page callbacks, disabled boundaries, stable loading geometry;
- date controls: locale, keyboard calendar navigation, disabled dates, shortcuts, recurrence output;
- loading: correct ARIA busy/live output and reduced-motion class/state, not animation timing;
- SVG data views: accessible text equivalent and boundary values (0, threshold, 100, overflow refusal).

Use Playwright screenshots for a risk-based automated matrix plus a complete manual visual-diff page. Capture at widths `320`, `390`, `768`, `1024`, and `1440`; freeze animations at their documented comparison frame; use the same Mulish files and deterministic fixture data on both sides. Token values, typography, radii, shadows, and named dimensions are exact computed-style assertions. Automated image comparison permits at most `0.5%` differing pixels for antialiasing, and any non-zero structural difference requires explicit review rather than baseline replacement. Axe runs on representative stories and real feature flows.

### 7.3 Acceptance budgets

- No component story produces horizontal page overflow at 320px.
- Interactive targets are at least 44px where touch interaction is expected; dense desktop table controls keep a 44px accessible hit area where visual height is smaller.
- No layout shift when loading state becomes content.
- A feature importing a single component must not pull charts, all icons, or all stories into its production chunk.
- Recharts, if adopted, is lazy-loaded with the feature and justified by measured complexity; static and small charts use SVG/CSS.
- Data components render bounded pages only; virtualisation is considered after measurement, not added to mask unbounded API queries.

## 8. Migration plan

### Phase 0 - Contract lock and safety rails

**Files:** plan/reference documentation, token validation script, Storybook compatibility spike.

1. Capture all 81 labels, 59 SVG paths, 14 keyframes, and reference dimensions as machine-readable fixtures generated once from the HTML and then reviewed.
2. Capture each code's required anatomy, mockup interactions, responsive transformation, and source order; distinguish contract requirements from portal hardening.
3. Record token conflicts without changing brand roots.
4. Inventory all current imports and mark each existing component as retain/evolve/extract/replace/remove.
5. Confirm Storybook 8/Vite 8 compatibility and select exact package versions.

**Gate:** counts reconcile; no unresolved duplicate public component names; no dependency installed before compatibility is known.

### Phase 1 - Tokens, motion, and icons

**Files:** `styles/tokens.css`, new `theme.css`, new `motion.css`, `icons/**`, foundation stories/tests.

1. Add semantic kit aliases and Tailwind `@theme inline` mappings.
2. Add hardcode/unknown-token enforcement.
3. Implement the 59 local icons and gallery.
4. Implement the 14 motion definitions and reduced-motion policy.

**Gate:** FN-01 to FN-07 and motion reference stories approved; icon path/count fixture is exact; no feature migration yet.

### Phase 2 - Core controls

**Files:** existing action/form/navigation components and tests/stories.

Implement AC-01 to AC-04, IN-01 to IN-04, CH-05 to CH-08, CH-11, CH-12, SP-01, SP-02, DT-01, and basic FB units. Preserve public APIs through adapters where inexpensive; deprecate old props in development before removal.

**Gate:** current admin and pricing screens can use the evolved controls without local style overrides; keyboard and ref contracts pass focused tests.

### Phase 3 - Data and selection components

Implement SE-01 to SE-06, DA-01 to DA-10, FB-01 to FB-04, and LD-03/04/10/11/12/13. Extract `FilterDrawer` and counted tabs from `DataView` without breaking server pagination.

**Gate:** one dense staff list and one customer detail page are migrated as proving screens; no duplicate table, badge, notice, or drawer implementation remains in those paths.

### Phase 4 - Dates and logistics patterns

Add `react-day-picker` and `cmdk` wrappers, then implement DT-02 to DT-04 and SP-03 to SP-08. Use plain SVG/CSS first. Add Recharts only if the Mode Ladder, Sparkline, or Charge Breakdown prototype demonstrates that custom SVG would duplicate substantial chart behaviour.

**Gate:** date keyboard behaviour, locale parity, SVG text alternatives, numeric boundaries, and responsive layouts are covered.

### Phase 5 - Chrome, shells, and signature loading

Implement/evolve CH-01 to CH-04, CH-09, CH-10, CH-13, SH-01 to SH-04, and LD-01/02/05 to LD-09. Move shell visuals into design-system layouts while keeping route catalogues, auth, permissions, and sign-out orchestration in app layouts.

**Gate:** customer/staff desktop distinction and mobile convergence match the kit; no shell checks an unrelated permission to render; cold starts do not delay interactive content.

### Phase 6 - Compact business forms

Build CF-01 and CF-03 by composing the new controls around existing quote contracts. Build CF-02 only with the booking business slice and real generated API contract. Apply CF-04 to remove repeated known fields and client-side calculation rulebooks.

**Gate:** form payloads still come from generated contracts; derived totals come from the server where required; Quick Quote does not imply an automatic rate source.

### Phase 7 - Application migration and removal

Migrate one feature at a time in risk order:

1. component workspace and authentication surfaces;
2. admin lists/drawers;
3. pricing queue/detail;
4. quotation request/detail;
5. customer dashboard and shells;
6. future tracking, booking, documents, invoices, and specialised logistics as their business slices land.

For each feature: replace imports, remove local duplicate styles, compare the relevant stories/reference, retain all loading/empty/error states, then delete the obsolete component only after a repository usage search returns zero.

Likely removal candidates to verify, never delete speculatively: the unused shadcn `primitives/button.tsx`, orphaned `DetailHeader`, `GlobalTrackSearch`, and `AdminSectionPage`.

**Gate:** no feature imports deprecated internals; no dead duplicate CSS; production bundle excludes Storybook and unused visualisation code.

## 9. Business usage map

| Portal area | Primary kit contracts | Boundary notes |
|---|---|---|
| Customer dashboard | CH-01/02/13, DA-01/02, LD-04/10/12, SH-01/03 | metrics arrive from API; tracking remains privacy-safe |
| Quote request | CH-07/10, IN-01/02/03, SE-01 to SE-06, CF-01/03, DT-03 | manual-pricing model; no rate promise or client-derived price |
| Quote detail | CH-04/06/09, DA-08/09/10, FB-02/03, DT-01 | customer status projection remains distinct from staff lifecycle |
| Pricing queue | CH-03/05/11/12, DA-03/08, FB-01/04, LD-04/10 | server-side paging/filtering; branch scope comes from API |
| Pricing detail | CH-06/07, IN-01, DA-09/10, SP-06, FB-03 | cost visibility remains permission controlled by API |
| Shipment tracking | CH-04/09/13, DA-03/04/10, SP-03/08, LD-01 | future slice; no predictive data unless approved and gated |
| Booking | CF-02, DT-02/03/04, SE-04/06, FB-02/03 | quote, booking, shipment remain separate entities |
| Documents/invoices | DA-03/08, FB-02, SP-05/06, DT-01 | document allow-list and invoice addressee rules stay server-side |
| Customer/organisation admin | CH-03/05/06/11/12, DA-03/08/09, FB-01/03/04 | dense staff shell; no React tenant filtering |
| Lookups/features/settings | IN-01/03, DA-03/08, FB-01/03/04 | switches gate API and UI; settings remain scoped data |
| Authentication/recovery | AC-01/02, IN-01/03, FB-01, LD-05/06, SH-03 | auth orchestration remains outside components |

## 10. Planned file changes

### Parent repository

- Add and maintain this plan.
- Update `docs/noatum-designsystem.md` only for approved, durable design-system decisions; do not copy the whole kit into it.

### UI submodule

Expected additions or edits after approval:

- `package.json` and the root lockfile for approved Storybook/date/combobox/chart dependencies;
- `.storybook/main.ts`, `.storybook/preview.tsx`, and Storybook scripts;
- `src/design-system/styles/{tokens,theme,foundation,motion}.css`;
- `src/design-system/icons/**`;
- reorganised `src/design-system/components/**`, `patterns/**`, and `layouts/**`;
- focused colocated `*.test.tsx` and `*.stories.tsx` files;
- existing shared shells/breadcrumb and feature consumers as each migration increment lands;
- lint/token-validation configuration and a visual-diff story/page.

No API, database, migration, generated client, feature switch, or permission change is implied by the component-library foundation. Feature-specific wiring remains in the corresponding approved business slice.

## 11. Risks and decisions already resolved

| Risk | Decision |
|---|---|
| Two parallel component libraries | Evolve `src/design-system`; do not create a second root library |
| One file per kit code creates junk | Map codes to stories/contracts; share implementation where variants have the same semantics |
| Local icon registry can defeat tree shaking | Export individual icons; dynamic registry is an optional separate import |
| Lucide and local icons conflict | Local set is authoritative for kit components; migrate legacy Lucide usage incrementally |
| Storybook bloats production | Dev dependency only; stories excluded from app imports/build |
| Chart dependency becomes global | SVG/CSS first; optional chart library is lazy and feature-scoped |
| Dynamic geometry conflicts with the no-inline-style rule | Use clamped SVG presentation attributes or native `progress`/`meter`; finite states use classes/data attributes; no generated percentage-class catalogue and no React `style` prop |
| Animation implies false progress | Determinate visuals require real values; indeterminate variants never show fabricated percentages |
| Kit token differs from brand root | Keep root immutable; add semantic alias and record rationale |
| Shell component absorbs auth/permissions | Layout receives navigation/user/action data; app layout owns policy and orchestration |
| Compact forms duplicate server rules | Generated contracts and server-derived values remain authoritative |

## 12. Approval and completion gates

Approval of this plan authorises implementation only when the user explicitly says to start. Implementation should proceed in the phases above, with a brief file list before each increment.

The library migration is complete only when:

1. all 81 codes appear in Storybook/documentation with no omissions;
2. all 59 logistics icons match the ordered extracted path fixture, all generic glyphs visible in the specimens are local, and both families have accessible usage rules;
3. all 14 animations have reduced-motion behaviour;
4. tokens and Tailwind `@theme` contain no duplicated raw values;
5. interactive components are typed, controlled-first, ref-capable, keyboard operable, and localisable;
6. every migrated data surface retains loading, empty, and error states and server-side pagination;
7. all 81 machine-readable specimen contracts are complete and the visual-diff page passes the defined desktop/mobile computed-style and screenshot comparisons;
8. representative Vitest, axe, and Playwright checks pass when the user schedules verification;
9. the production bundle contains no Storybook code, unused icon registry, or eagerly loaded chart library;
10. repository searches find no active imports of superseded components and no unapproved hardcoded visual values.
