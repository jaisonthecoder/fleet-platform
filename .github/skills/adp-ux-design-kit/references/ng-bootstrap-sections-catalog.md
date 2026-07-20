# Sections Catalog

The `/ui-kit` route renders 10 sections in this order. Sister-skill consistency: identical to `shadcn-kit`'s sections — same names, same order, same intent. Different stack.

ng-bootstrap ships **18 widgets** (Angular implementations of Bootstrap components). The kit also uses **plain Bootstrap 5 classes** for primitives ng-bootstrap doesn't ship as widgets (Buttons, Cards, Badges, Tables, etc. — these are HTML + Bootstrap classes).

Reference: https://ng-bootstrap.github.io

| ng-bootstrap widget | Module / directive | Notes |
|---|---|---|
| Accordion | `NgbAccordion`, `NgbPanel` | |
| Alert | `NgbAlert` | |
| Carousel | `NgbCarousel`, `NgbSlide` | |
| Collapse | `NgbCollapse` | |
| Datepicker | `NgbDatepicker`, `NgbInputDatepicker` | |
| Dropdown | `NgbDropdown`, `NgbDropdownMenu`, `NgbDropdownItem` | |
| Modal | `NgbModal` (service) | Opened programmatically |
| Nav (Tabs) | `NgbNav`, `NgbNavItem`, `NgbNavLink`, `NgbNavOutlet` | |
| Offcanvas | `NgbOffcanvas` (service) | Side drawer |
| Pagination | `NgbPagination` | |
| Popover | `NgbPopover` | |
| Progressbar | `NgbProgressbar` | |
| Rating | `NgbRating` | Star rating widget |
| ScrollSpy | (legacy — not in modern releases) | |
| Timepicker | `NgbTimepicker` | |
| Toast | `NgbToast` | |
| Tooltip | `NgbTooltip` | |
| Typeahead | `NgbTypeahead` | Autocomplete on Input |

Plus directives: `ngbHighlight` (typeahead match highlight), `NgbButton` family (radio/checkbox styled as buttons), `NgbDate` / `NgbCalendar` (date math primitives).

Install at the project level once when the Angular UI kit implementation begins:
```bash
npm install bootstrap @ng-bootstrap/ng-bootstrap @popperjs/core bootstrap-icons
```

Each widget is imported directly in the standalone Angular component that uses it — no NgModule. ng-bootstrap is fully tree-shakeable.

---

## Section 1 — Foundations

No widgets. Hand-authored Angular component at `src/app/ui-kit/sections/foundations.component.ts`.

What renders:
- Color swatches: brand (primary, secondary, accent), neutrals (50–950), semantic (success, warning, danger, info) — each with hex, token name, WCAG ratio against `--background` and `--card`.
- Typography scale: every level (display, h1–h6, lead, body, body-bold, body-small, caption, code) live with the resolved font.
- Spacing scale: 0–24 stops as horizontal bars at actual width.
- Radius scale: sm / md / lg / xl / full as filled squares.
- Shadow scale: sm / md / lg / xl as cards.
- Motion: each duration + easing demoed.
- Iconography: 12 representative `bootstrap-icons` in 4 sizes.

Smoke test for the kit. If Foundations is wrong, everything else is wrong.

---

## Section 2 — Forms & Controls

Mostly **Bootstrap 5 form classes** — ng-bootstrap doesn't wrap basic inputs.

| Component | Origin | Notes |
|---|---|---|
| Input | HTML `<input class="form-control">` | Wrap in `shared/ui/input.directive.ts` for token-aware focus styles |
| Textarea | HTML `<textarea class="form-control">` | Same wrapper pattern |
| Select | HTML `<select class="form-select">` | |
| Typeahead | `NgbTypeahead` directive | Autocomplete on plain `<input>` |
| Checkbox | HTML `<input type="checkbox" class="form-check-input">` | |
| Radio | HTML `<input type="radio" class="form-check-input">` | |
| Switch | HTML `<input type="checkbox" class="form-check-input" role="switch">` | Bootstrap pattern |
| Slider | HTML `<input type="range" class="form-range">` | Bootstrap 5 native |
| Datepicker | `NgbDatepicker` (popup or inline) | |
| Timepicker | `NgbTimepicker` | |
| Label | HTML `<label class="form-label">` | |
| FormField | Hand-author wrapper | Compounds label + control + description + error |
| FormFieldset | HTML `<fieldset class="form-group">` | |

Showcase requirements: every control rendered in default / hover / focus / disabled / valid / invalid / loading-where-applicable states. FormField shown with all four slots filled (label, description, value, error).

---

## Section 3 — Buttons & Actions

Mostly **Bootstrap 5 button classes**. ng-bootstrap adds `NgbButton` family for radio/checkbox-as-buttons.

| Component | Origin | Notes |
|---|---|---|
| Button | HTML `<button class="btn btn-primary">` | Variants: primary, secondary, outline-*, ghost (custom), link, danger. Sizes: btn-sm, default, btn-lg. |
| ButtonGroup | HTML `<div class="btn-group">` | |
| RadioButtons | `[ngbButton]` + `<input ngbButton type="radio">` | |
| CheckboxButtons | `[ngbButton]` + `<input ngbButton type="checkbox">` | |
| IconButton | Hand-author | Wraps `<button>` with `bi-*` icon |
| Kbd | HTML `<kbd>` | |

Showcase requirements: Button rendered in **all variants × all sizes × all states**. ButtonGroup with both vertical and horizontal orientations. Radio/Checkbox buttons in active + inactive.

Variant naming convention: this kit uses Bootstrap's names (`primary`, `secondary`, `success`, `danger`, `warning`, `info`, `light`, `dark`, `link`, plus `outline-*` for each). The "ghost" variant is hand-added (not in Bootstrap by default).

---

## Section 4 — Data Display

| Component | Origin | Notes |
|---|---|---|
| Avatar | Hand-author | Image + fallback initials |
| Badge | HTML `<span class="badge text-bg-*">` | Variants match Button |
| Card | HTML `<div class="card">` | Header / body / footer slots |
| Separator | HTML `<hr>` | Horizontal; vertical via `vr` class |
| Item | Hand-author | Compound list-row (icon + content + actions) |
| Table | HTML `<table class="table">` | Bootstrap responsive variants |
| DataTable | Hand-author or 3rd-party | Compose `<table>` + sort/filter/pagination — consider `ag-grid` or `ngx-datatable` if heavy use; document choice in `UI_KIT.md` |
| Stat | Hand-author | Card + large number + Badge + Separator |
| List Group | HTML `<ul class="list-group">` | Bootstrap pattern |

Showcase patterns:
- Stat card (Card + large number + Badge for delta)
- DataList (Item × N inside `list-group`)
- Tag pile (Badge × N)
- Table with sort + pagination
- One bar chart, one line chart, one pie chart (via Chart.js or ng2-charts — document choice)

---

## Section 5 — Feedback

| Component | Origin | Notes |
|---|---|---|
| Alert | `NgbAlert` | Variants: primary, secondary, success, danger, warning, info, light, dark |
| Toast | `NgbToast` | Auto-dismiss + manual dismiss |
| Banner | Hand-author | Page-level (distinct from inline Alert) |
| Progress | `NgbProgressbar` | Determinate + striped + animated |
| Skeleton | Hand-author | Loading placeholder shapes |
| Spinner | HTML `<div class="spinner-border">` | Bootstrap pattern |
| EmptyState | Hand-author | Icon + title + description + action |
| Rating | `NgbRating` | Star rating display + input |

Patterns shown: success / warning / danger / info Alert; Toast triggered by Button; Progress at 0/30/70/100 with striped/animated variants; three Skeleton layouts (text, card, table row); Spinner at all sizes; EmptyState with and without action; Rating with read-only and interactive states.

---

## Section 6 — Overlays

| Component | Origin | Notes |
|---|---|---|
| Modal | `NgbModal` (service) | Open via `modalService.open(Component)` — pass component class as content |
| Offcanvas | `NgbOffcanvas` (service) | Side drawer (start, end, top, bottom) |
| Popover | `NgbPopover` directive | Anchored floating panel with title + body |
| Tooltip | `NgbTooltip` directive | Short text on hover |
| Dropdown | `NgbDropdown` + `NgbDropdownMenu` + `NgbDropdownItem` | Menu with nested items |
| ContextMenu | Hand-author wrapper around `NgbDropdown` | Right-click trigger |
| ConfirmModal | Hand-author wrapper around `NgbModal` | Reusable destructive-confirm pattern |

Showcase requirements: each rendered with a trigger button and at least one nested action. Tooltip and Popover demoed with both keyboard-focus and mouse-hover entry.

---

## Section 7 — Navigation

| Component | Origin | Notes |
|---|---|---|
| Tabs / Nav | `NgbNav` | Pills variant via `[orientation]="'horizontal'"` and `class="nav-pills"` |
| Breadcrumb | HTML `<ol class="breadcrumb">` | Bootstrap pattern |
| Pagination | `NgbPagination` | Page-number nav |
| Navbar | HTML `<nav class="navbar">` | Bootstrap pattern + `NgbCollapse` for mobile toggle |
| Sidebar | Hand-author | Use `NgbOffcanvas` for mobile collapse, persistent sidebar for desktop |
| Stepper | Hand-author | Compose `NgbAccordion` programmatically OR custom |

Showcase requirements: Nav in horizontal + vertical (pills); Breadcrumb with 3 levels; Pagination at page 1, 5, last; Navbar with collapse; Sidebar in expanded + collapsed states.

---

## Section 8 — Disclosure

| Component | Origin | Notes |
|---|---|---|
| Accordion | `NgbAccordion`, `NgbPanel` | Single (default) or multi-expand via `[closeOthers]="false"` |
| Collapse | `NgbCollapse` directive | Single show/hide region |

Showcase: Accordion in single + multi modes; Collapse with text content + nested controls.

---

## Section 9 — Layout

Mostly **Bootstrap 5 utilities**. Bootstrap doesn't have a "Resizable" primitive — hand-author or 3rd-party.

| Component | Origin | Notes |
|---|---|---|
| Container | HTML `<div class="container">` (or `container-fluid`, `container-xxl`, etc.) | |
| Row / Col | HTML `<div class="row">` / `<div class="col-md-6">` | Bootstrap 12-col grid |
| Stack | HTML `<div class="vstack gap-3">` / `<div class="hstack gap-3">` | Bootstrap 5 utility |
| Divider | HTML `<hr>` | |
| AspectRatio | HTML `<div class="ratio ratio-16x9">` | Bootstrap utility |
| ScrollArea | Hand-author with CSS `overflow: auto` + custom scrollbar styling | |
| Resizable | Hand-author OR 3rd-party (e.g. `angular-split`) | Document choice in `UI_KIT.md` |
| Carousel | `NgbCarousel`, `NgbSlide` | |

Showcase: Container at all responsive widths; AspectRatio at 16:9 / 4:3 / 1:1; ScrollArea with horizontal + vertical overflow; Resizable two-pane; Carousel with 4 slides + indicators.

---

## Section 10 — Patterns (composed)

No widgets — these are *compositions* the kit ships so feature work has a starting point. Each lives at `src/app/shared/ui/patterns/<name>/<name>.component.ts`.

| Pattern | Composed from | Use case |
|---|---|---|
| **PageHeader** | `<h1>` + Breadcrumb + Button | Top of every detail page |
| **Toolbar** | Button + Separator + ButtonGroup + NgbDropdown | Action strip above tables / lists |
| **ConfirmDialog** | `NgbModal` + `confirm-modal.component.ts` | "Are you sure?" with destructive variant |
| **FilterBar** | Input + Select + Button + Badge | Table / list filters with active-filter chips |
| **EmptyResults** | EmptyState + Button | Search / filter returned nothing |
| **AppShell** | Sidebar + Navbar + `<router-outlet>` | App-level layout with collapsible sidebar |
| **DataTablePage** | PageHeader + Toolbar + DataTable + Pagination | Full table-page composition |
| **FormPage** | PageHeader + Card + FormField × N + Button | Standard create / edit form using Reactive Forms |

Showcase requirements: each pattern rendered with realistic placeholder data so a developer can see "this is what it looks like wired up."

---

## Section count discipline

- **Always 10 sections, always in this order.** Re-ordering or omitting confuses every developer.
- **A new ng-bootstrap release that adds a widget goes into the right section, not a new section.**
- **Patterns grow over time.** Section 10 is the only section that can have new entries added without spec change.

---

## ng-bootstrap version note

ng-bootstrap is **versioned to match Angular major versions** (e.g. ng-bootstrap 20.x ↔ Angular 20). When you upgrade Angular, you upgrade ng-bootstrap. The kit pins both — see `package.json`, `/standards/framework-baselines.md` § Angular, and `references/ng-bootstrap-recipes.md` §"Tested versions".
