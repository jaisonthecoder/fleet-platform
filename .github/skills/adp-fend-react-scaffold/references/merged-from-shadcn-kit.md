# Merged Legacy Guidance: shadcn-kit

## Table of Contents

- Original references/framework-adapters.md
- Detection
- Path conventions per framework
- `next-app-router` (default)
- `next-pages-router`
- `vite-react`
- `remix`
- `astro` (with React island)
- Per-framework gotchas
- What stays identical across frameworks
- Choosing a framework when the project is fresh
- Original references/intent-routing.md


This reference preserves the canonical guidance merged from the removed non-ADP source skill `shadcn-kit`.
The active ADP task skill is `adp-fend-react-scaffold`. Load this file only when maintaining legacy role or preset behavior, or when old role-level guidance is needed as supporting context.

## Original references/framework-adapters.md

~~~markdown
# Framework Adapters

shadcn supports Next.js (App and Pages Routers), Vite + React, Remix, and Astro + React. The kit detects which one and uses the right paths.

## Detection

The skill reads `package.json`:

| Signal | Framework |
|---|---|
| `"next": "*"` and `app/` directory exists | `next-app-router` |
| `"next": "*"` and only `pages/` directory | `next-pages-router` |
| `"vite": "*"` | `vite-react` |
| `"@remix-run/*": "*"` | `remix` |
| `"astro": "*"` | `astro` |

If none match, the skill asks the user explicitly.

## Path conventions per framework

### `next-app-router` (default)

```
app/
  layout.tsx
  globals.css                          ← imports tokens.css + Tailwind
  ui-kit/
    page.tsx
    layout.tsx
    sections/...
components/
  ui/                                  ← shadcn primitives
lib/
  utils.ts                             ← cn() helper
styles/
  tokens.css                           ← brand tokens
tailwind.config.ts                     ← v3 only; v4 puts @theme in globals.css
components.json
```

`components.json` aliases:
```json
"aliases": {
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui",
  "lib": "@/lib",
  "hooks": "@/hooks"
}
```

`tsconfig.json` paths:
```json
"paths": { "@/*": ["./*"] }
```

### `next-pages-router`

```
pages/
  _app.tsx                             ← imports globals.css
  _document.tsx                        ← injects data-theme on <html>
  ui-kit/
    index.tsx
    sections/... (rendered as components, not routes)
components/
  ui/
src/
  styles/
    globals.css
    tokens.css
```

The Pages Router can't have nested layouts the way App Router does. `/ui-kit` is a single page that imports section components.

### `vite-react`

```
src/
  main.tsx                             ← imports index.css
  App.tsx                              ← Routes including /ui-kit
  index.css                            ← imports tokens.css + Tailwind
  routes/
    UiKit.tsx
    ui-kit-sections/...
  components/
    ui/
  lib/
    utils.ts
  styles/
    tokens.css
tailwind.config.ts
components.json
```

`components.json`:
```json
"aliases": {
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui",
  "lib": "@/lib"
},
"rsc": false                            // critical — no Server Components in Vite
```

`vite.config.ts` needs the `@` alias:
```ts
import path from "path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

### `remix`

```
app/
  root.tsx                             ← Links to globals.css; sets data-theme on <html>
  routes/
    ui-kit.tsx                         ← container
    ui-kit.foundations.tsx             ← Remix nested route per section
    ui-kit.forms-controls.tsx
    ...
  components/
    ui/
  lib/
    utils.ts
  styles/
    tokens.css
    globals.css
tailwind.config.ts
components.json
```

Remix's flat route convention means each section can be its own route. The kit uses this — section nav becomes real navigation.

### `astro` (with React island)

```
src/
  components/
    ui/                                ← shadcn primitives (React)
    UiKit.tsx                          ← React island
  layouts/
    Layout.astro
  pages/
    ui-kit.astro                       ← <UiKit client:load />
  styles/
    globals.css
    tokens.css
  lib/
    utils.ts
```

Astro requires `client:*` directive on the React island. The kit uses `client:load` for `/ui-kit` because the showcase is interactive end-to-end.

`astro.config.mjs` must include `@astrojs/react` and `@astrojs/tailwind`.

## Per-framework gotchas

| Framework | Gotcha | Fix |
|---|---|---|
| Next App Router | `"use client"` missing on interactive components | shadcn adds it where needed; verify after install |
| Next Pages Router | RSC is unsupported | Set `rsc: false` in `components.json` |
| Vite | `@` alias unresolved at build time | Add to `vite.config.ts` AND `tsconfig.json` |
| Remix | Hydration mismatch on theme toggle | Set `data-theme` in root loader, not client effect |
| Astro | React state lost between pages | Use `client:load` for stateful islands; static markup for the rest |
| All | `globals.css` not loaded | Verify the framework's root file imports it |

## What stays identical across frameworks

- `tokens.css` — pure CSS, framework-agnostic
- `components/ui/*` — pure React, framework-agnostic
- `lib/utils.ts` — pure TS, framework-agnostic
- `tailwind.config.ts` (v3) or `@theme` block (v4) — framework-agnostic
- `components.json` (with `rsc` flag adjusted)

This is why the kit's verification (`/ui-kit` page) is identical across frameworks — only the route plumbing differs.

## Choosing a framework when the project is fresh

The skill doesn't pick. If a developer asks "which framework should I use?", route to a separate decision (architecture / ADR), not this skill. The kit installs into whatever exists.
~~~

## Original references/intent-routing.md

~~~markdown
# Intent Routing — match what the developer says to what to apply

When a developer asks for help building a feature, they describe **intent**, not components. "I need a settings page." "Build a dashboard." "Add a search." This reference maps common intents to the kit pieces that fit.

Use this when running [`workflows/apply-to-feature.md`](../workflows/apply-to-feature.md). The workflow asks the developer what they're building, you read the intent here, and you produce a build plan that uses kit primitives instead of inventing new ones.

**Hard rule: don't reach outside the kit.** If a primitive is missing, *add it to the kit* (via `workflows/extend-kit.md`), don't ship a one-off in the feature. The kit is the contract.

---

## Intent table

The left column is what the developer says (paraphrased). The middle column is the primitives to apply. The right column is the pattern in Section 10 that already composes them — use the pattern when it exists.

| Intent | Apply | Pre-composed pattern |
|---|---|---|
| **"Build a dashboard"** | `Card` × N for KPI tiles, `Chart` for trends, `Badge` for deltas, `Skeleton` for loading | (none — compose from scratch but use the patterns below for sub-areas) |
| **"Add a settings page"** | `Tabs` (sections), `Card` (each setting group), `Field` (label + control + help + error), `Switch` / `Select` / `Input`, `Button` (Save / Reset) | `FormPage` |
| **"Make a list page" / "Show me all the X"** | `DataTable`, `Pagination`, `Input` (search), `Select` (filter), `Button` (action), `Empty` (no results) | `DataTablePage` |
| **"I need a create / edit form"** | `Field` × N, `Input` / `Select` / `Textarea` / `Switch` / `DatePicker`, `Button` (Save / Cancel), `Sonner` (toast on success) | `FormPage` |
| **"Add a search"** | `Input` with leading icon for inline; `Command` palette for global; `Combobox` for typeahead-select | (compose) |
| **"Confirm before deleting"** | `AlertDialog` | `ConfirmDialog` |
| **"Show the user's profile"** | `Avatar`, `Card`, `Badge`, `Item` for activity rows | (compose) |
| **"Side navigation" / "App shell"** | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `DropdownMenu` (user menu) | `AppShell` |
| **"Page header with actions"** | `Typography` (title), `Breadcrumb`, `Button` (primary action), `DropdownMenu` (more) | `PageHeader` |
| **"Filter the table"** | `Input`, `Select`, `Button` (Clear), `Badge` (active-filter chips) | `FilterBar` |
| **"Empty state"** | `Empty` (icon + title + description + action) | `EmptyResults` |
| **"Multi-step wizard"** | `Tabs` (programmatic), `Field`, `Button` (Back / Next / Submit), `Progress` | (compose; consider promoting to a pattern after 2nd consumer) |
| **"Show a tooltip on hover"** | `Tooltip` for short text; `HoverCard` for richer content | (use directly) |
| **"Notify the user something happened"** | `Sonner` for transient toast; `Alert` for inline; `Banner` (custom in Feedback) for page-level | (use directly) |
| **"User picks a date"** | `DatePicker` (single); range = compose `Calendar` + `Popover` | (compose if range) |
| **"Upload a file"** | Hand-author with `Input type="file"` styled via `Field`; consider promoting to a pattern after 2nd consumer | (none yet) |
| **"Right-click menu"** | `ContextMenu` | (use directly) |
| **"Top app menu (File / Edit / View)"** | `Menubar` | (use directly) |
| **"Mobile bottom drawer"** | `Drawer` (Vaul-based, mobile-first) | (use directly) |
| **"Side panel for details"** | `Sheet` (right side default) | (use directly) |
| **"Show progress through a long task"** | `Progress` for known total; `Spinner` for unknown | (use directly) |
| **"Keyboard shortcut hint"** | `Kbd` | (use directly) |
| **"Toggle a value"** | `Switch` for binary on/off; `Toggle` for pressable button; `ToggleGroup` for segmented choice | (use directly) |
| **"Tabular data with sorting and filtering"** | `DataTable` (TanStack Table under the hood) | `DataTablePage` |
| **"Show data over time"** | `Chart` (Recharts under the hood); pick line / bar / area per data type | (use directly) |
| **"Resize-able panes"** | `Resizable` (PanelGroup / Panel / Handle) | (use directly) |
| **"Carousel of items"** | `Carousel` (Embla under the hood) | (use directly) |
| **"FAQ / collapsible content"** | `Accordion` for grouped; `Collapsible` for single | (use directly) |

---

## How to read the intent

Developers won't always say what they need precisely. Translate vague asks into intent before routing:

| What they say | What they mean |
|---|---|
| "Make it look professional" | Apply `PageHeader` + `Card` containers + correct typography hierarchy. The "professional" feel comes from the kit's tokens — don't add custom styles. |
| "Add some spacing" | Use `Stack` / `Container` / spacing tokens. Don't invent `mt-7` or `pl-9` — pick the nearest token slot. |
| "Make this clickable" | Wrap in a `Button` (variant: `link` if it should look like text). Don't add `onClick` to a `<div>`. |
| "It's broken on mobile" | The component is fine; the *layout* needs work. Check `Sidebar` collapse behavior, `Sheet` instead of fixed sidebar, `Drawer` instead of `Dialog` on small screens. |
| "Add a loading state" | `Skeleton` for the placeholder shape; `Spinner` if action-bound; never block UI without one of these. |
| "Show errors" | `Field` slot for inline form errors; `Alert variant="destructive"` for page-level; `Sonner` for transient errors. |
| "Make it accessible" | Already done if you used kit primitives. Verify with the After-you-finish checklist's keyboard tab-through. |

---

## Hard "don't" list

When a developer asks for these, **redirect**:

| Asked for | Redirect |
|---|---|
| "Custom button component" | Use `Button` with the right `variant` / `size`. If a variant is missing, extend `buttonVariants` CVA in place — see `shadcn-recipes.md` §Wrapping pattern. Don't create `MyButton.tsx`. |
| "A new color" | Add to brand tokens via `tokens.css`. Don't hardcode. |
| "Different padding" | Pick a spacing token (`--space-*`). Don't hardcode `px-7`. |
| "Custom dialog" | Use `Dialog` with custom children. The wrapper is the kit's; the contents are yours. |
| "Custom dropdown" | Use `DropdownMenu`. Compose the menu items yourself. |
| "Brand-new icon set" | The kit ships Lucide. Adding a second icon set requires a kit-level decision — open an issue against the kit, don't import a second set in a feature. |

---

## When the kit doesn't have what's needed

If the developer's intent doesn't match anything in this table:

1. **Check if it's a composition.** Most "missing" components are 2-3 primitives glued together. Sketch the composition; if it works, add to Section 10 patterns via `workflows/extend-kit.md`.
2. **Check if shadcn shipped a new primitive.** The catalog moves. Re-fetch https://ui.shadcn.com/docs/components and re-audit `references/sections-catalog.md`.
3. **Check upstream registry.** Community registries at https://ui.shadcn.com/docs/registry may have it.
4. **Last resort: hand-author.** Add to `components/ui/<name>.tsx`, document in `UI_KIT.md`, treat as a kit component (CVA variants, token-driven, all states in showcase).

**Never** add an undocumented one-off in `features/`. Once it lives there it never gets reused, and the kit is no longer the contract.

---

## Example: "Build a settings page"

Developer says: *"I need a settings page for the user — they should be able to change name, email, notification preferences, and delete their account."*

Routing:

1. Look up "Add a settings page" in the table → `Tabs` + `Card` + `Field` + `Switch`/`Select`/`Input` + `Button`. Pattern = `FormPage`.
2. "Delete their account" is destructive → use `ConfirmDialog` pattern (`AlertDialog` + destructive variant Button).
3. Notification preferences = group of toggles → `Field` with `Switch` for each.
4. Save action = `Sonner` toast on success.

Resulting build plan:

```
app/settings/page.tsx
  └─ <FormPage title="Settings" breadcrumbs={…}>
       <Tabs defaultValue="profile">
         <TabsList>
           <TabsTrigger value="profile">Profile</TabsTrigger>
           <TabsTrigger value="notifications">Notifications</TabsTrigger>
           <TabsTrigger value="danger">Danger Zone</TabsTrigger>
         </TabsList>

         <TabsContent value="profile">
           <Card>
             <Field label="Name" description="Your full name" error={errors.name}>
               <Input {...register("name")} />
             </Field>
             <Field label="Email" error={errors.email}>
               <Input type="email" {...register("email")} />
             </Field>
             <Button type="submit">Save profile</Button>
           </Card>
         </TabsContent>

         <TabsContent value="notifications">
           <Card>
             <Field label="Email notifications" description="Receive a daily summary">
               <Switch checked={…} onCheckedChange={…} />
             </Field>
             {/* … more switches */}
           </Card>
         </TabsContent>

         <TabsContent value="danger">
           <Card>
             <ConfirmDialog
               trigger={<Button variant="destructive">Delete account</Button>}
               title="Delete account?"
               description="This cannot be undone."
               confirmLabel="Delete"
               onConfirm={handleDelete}
             />
           </Card>
         </TabsContent>
       </Tabs>
     </FormPage>
```

Every component used is from the kit. No custom CSS. No new variants. The page is built in 30 minutes, not 3 hours.

That's the goal of intent routing.
~~~

## Original references/sections-catalog.md

~~~markdown
# Sections Catalog

The `/ui-kit` showcase page renders 10 sections in this order. Every section maps to one or more shadcn primitives from the live catalog at https://ui.shadcn.com/docs/components.

shadcn ships 57 components (as of catalog snapshot 2026-05-01). This catalog assigns each one to a section and notes the install command.

CLI install syntax (use the project's package manager — pnpm shown):

```bash
pnpm dlx shadcn@latest add <component>
```

`shadcn add` writes the component file into `components/ui/` and adds any required deps to `package.json`. **Re-running `shadcn add` overwrites the file** — always inventory first.

---

## Section 1 — Foundations

No shadcn primitives. Hand-authored in `app/ui-kit/sections/foundations.tsx`.

What renders:
- Color swatches: brand (primary, secondary, accent), neutrals (50–950), semantic (success, warning, destructive, info) — each with hex value, token name, and WCAG contrast ratio against `--background` and `--card`.
- Typography scale: every level (display, h1–h6, lead, body, body-bold, body-small, caption, code) with the resolved font family and weight rendered live.
- Spacing scale: 0–24 stops shown as horizontal bars at the actual pixel width.
- Radius scale: sm / md / lg / xl / full as solid color squares.
- Shadow scale: sm / md / lg / xl as cards.
- Motion: each duration + easing demoed on a Toggle button.
- Iconography: 12 representative Lucide icons in 4 sizes.

This section is the "did the tokens land correctly?" smoke test. If Foundations looks wrong, nothing else will look right.

---

## Section 2 — Forms & Controls

| shadcn component | Install | Notes |
|---|---|---|
| Input | `add input` | Base text input |
| Input Group | `add input-group` | Compound input with addons |
| Input OTP | `add input-otp` | OTP / verification code input |
| Native Select | `add native-select` | HTML `<select>` with shadcn styling |
| Select | `add select` | Radix Select; replaces native for searchable / styled lists |
| Combobox | `add combobox` | Combobox built on `command` |
| Textarea | `add textarea` | Resizable text area |
| Checkbox | `add checkbox` | Single checkbox |
| Radio Group | `add radio-group` | Grouped radios |
| Switch | `add switch` | Toggle on/off |
| Slider | `add slider` | Range slider |
| Calendar | `add calendar` | Calendar primitive (under-the-hood for Date Picker) |
| Date Picker | `add date-picker` | Calendar + Popover composition |
| Field | `add field` | Field wrapper — label + control + description + error |
| Label | `add label` | Standalone label |
| Form *(legacy alias of Field)* | — | Use `Field` for new code |

Showcase requirements: every control rendered in default / hover / focus / disabled / error / loading-where-applicable states. Field renders all four slots filled.

---

## Section 3 — Buttons & Actions

| shadcn component | Install | Notes |
|---|---|---|
| Button | `add button` | Variants: default, outline, ghost, destructive, secondary, link. Sizes: default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg. |
| Button Group | `add button-group` | Segmented / connected buttons |
| Toggle | `add toggle` | Pressable two-state button |
| Toggle Group | `add toggle-group` | Single or multi-select group of toggles |
| Kbd | `add kbd` | Keyboard shortcut chip |

Showcase requirements: Button rendered in **all 6 variants × all 8 sizes × all 5 states** (default / hover / focus / disabled / loading) — that's the matrix. Toggle and ToggleGroup shown with both `single` and `multiple` selectionType.

---

## Section 4 — Data Display

| shadcn component | Install | Notes |
|---|---|---|
| Avatar | `add avatar` | Image + fallback |
| Badge | `add badge` | Status / category pill. Variants: default, secondary, destructive, outline. |
| Card | `add card` | Header / content / footer slots |
| Separator | `add separator` | Horizontal / vertical divider |
| Item | `add item` | Compound list-row primitive (icon + content + actions) |
| Table | `add table` | Base HTML table primitive |
| Data Table | `add data-table` | Composed with TanStack Table — sortable, filterable, paginated |
| Chart | `add chart` | Recharts wrapper with token-aware styling |

Patterns shown in showcase:
- Stat card (Card + large number + Badge for delta + Separator)
- DataList (Item × N)
- Tag pile (Badge × N with `variant="outline"`)
- Table with pagination + sort
- One representative bar chart, one line chart, one pie chart

---

## Section 5 — Feedback

| shadcn component | Install | Notes |
|---|---|---|
| Alert | `add alert` | Inline banner. Variants: default, destructive. |
| Sonner | `add sonner` | Toast system (replaces deprecated `toast`) |
| Progress | `add progress` | Determinate progress bar |
| Skeleton | `add skeleton` | Loading placeholder |
| Spinner | `add spinner` | Indeterminate spinner |
| Empty | `add empty` | Empty-state compound (icon + title + description + action) |

Patterns shown: success / warning / destructive / info Alert; Sonner toast triggered by button; Progress at 0/30/70/100; three Skeleton layouts (text block, card, table row); Spinner at all sizes; Empty with and without action.

---

## Section 6 — Overlays

| shadcn component | Install | Notes |
|---|---|---|
| Dialog | `add dialog` | Modal dialog |
| Alert Dialog | `add alert-dialog` | Confirm / destructive dialog with required acknowledgement |
| Sheet | `add sheet` | Side-drawer (top, right, bottom, left) |
| Drawer | `add drawer` | Vaul-based drawer (mobile-first slide-up) |
| Popover | `add popover` | Anchored floating panel |
| Hover Card | `add hover-card` | Hover-triggered popover |
| Tooltip | `add tooltip` | Short text on hover |
| Dropdown Menu | `add dropdown-menu` | Menu with nested items, checkboxes, radios |
| Context Menu | `add context-menu` | Right-click menu |
| Menubar | `add menubar` | App-style menu bar (File / Edit / View) |
| Command | `add command` | Command palette (powers Combobox) |

Showcase requirements: each rendered with a trigger button and at least one nested item / action. Tooltip and HoverCard demoed with both keyboard-focus and mouse-hover entry.

---

## Section 7 — Navigation

| shadcn component | Install | Notes |
|---|---|---|
| Tabs | `add tabs` | Horizontal or vertical tabs |
| Breadcrumb | `add breadcrumb` | Page-path crumbs |
| Pagination | `add pagination` | Page-number nav with prev/next |
| Navigation Menu | `add navigation-menu` | Top-bar nav with mega-menu support |
| Sidebar | `add sidebar` | Full sidebar primitive (collapsible, mobile sheet) |
| Direction | `add direction` | LTR/RTL provider |

Showcase requirements: Tabs in both orientations; Breadcrumb with 3 levels; Pagination at page 1, 5, last; NavigationMenu with at least one mega-menu trigger; Sidebar in expanded + collapsed state. The Direction provider wraps the whole `/ui-kit` page when RTL is enabled.

---

## Section 8 — Disclosure

| shadcn component | Install | Notes |
|---|---|---|
| Accordion | `add accordion` | Single or multiple expanded panels |
| Collapsible | `add collapsible` | Single show/hide region |

Showcase requirements: Accordion in `single` (default) and `multiple` modes; Collapsible with text content + nested controls.

---

## Section 9 — Layout

| shadcn component | Install | Notes |
|---|---|---|
| Aspect Ratio | `add aspect-ratio` | Fixed-ratio container |
| Scroll Area | `add scroll-area` | Custom-styled scroll container |
| Resizable | `add resizable` | Resizable panel groups (PanelGroup / Panel / Handle) |
| Carousel | `add carousel` | Embla-based slide carousel |

Hand-authored layout primitives in `components/ui/` (no shadcn equivalent — keep simple):
- `Container` — width-capped wrapper using `--space-*` tokens
- `Stack` — vertical or horizontal flex with token-driven gap
- `Grid` — CSS grid wrapper with column / gap props

Showcase requirements: AspectRatio at 16:9 / 4:3 / 1:1; ScrollArea with both horizontal and vertical overflow; Resizable two-pane and three-pane horizontal; Carousel with 4 slides and dots.

---

## Section 10 — Patterns (composed)

No shadcn primitives — these are *compositions* the kit ships so feature work has a starting point. Each lives at `components/ui/patterns/<name>.tsx`.

| Pattern | Composed from | Use case |
|---|---|---|
| **PageHeader** | Typography + Breadcrumb + Button | Top of every detail page |
| **Toolbar** | Button + Separator + ToggleGroup + DropdownMenu | Action strip above tables / lists |
| **ConfirmDialog** | AlertDialog + Button | "Are you sure?" with destructive variant |
| **FilterBar** | Input + Select + Button + Badge | Table / list filters with active-filter chips |
| **EmptyResults** | Empty + Button | Search / filter returned nothing |
| **AppShell** | Sidebar + NavigationMenu + slot | App-level layout with collapsible sidebar |
| **DataTablePage** | PageHeader + Toolbar + DataTable + Pagination | Full table-page composition |
| **FormPage** | PageHeader + Card + Field × N + Button | Standard create / edit form |

Showcase requirements: each pattern rendered with realistic placeholder data so a developer can see "this is what it looks like wired up."

---

## Section count discipline

- **Always 10 sections, always in this order.** A `/ui-kit` page that re-orders or omits a section confuses every developer using it.
- **A new shadcn component goes into the right section, not a new section.** If a future shadcn release adds (say) a `MultiSelect`, it joins Section 2 — the section count stays at 10.
- **Patterns grow over time.** Section 10 is the only section that can have new entries added without spec change.

---

## Component count audit

| Section | Component count |
|---|---|
| 1. Foundations | 0 (hand-authored) |
| 2. Forms & Controls | 16 |
| 3. Buttons & Actions | 5 |
| 4. Data Display | 8 |
| 5. Feedback | 6 |
| 6. Overlays | 11 |
| 7. Navigation | 6 |
| 8. Disclosure | 2 |
| 9. Layout | 4 (+ 3 hand-authored) |
| 10. Patterns | 8 (composed) |
| **Total shadcn components covered** | **58** |

Note: total exceeds the live catalog's 57 because `Form` is treated as a legacy alias of `Field` and not separately installed. Audit against the live catalog quarterly — when the count drifts, update this catalog.
~~~

## Original references/shadcn-recipes.md

~~~markdown
# shadcn Recipes

When to use the CLI, when to wrap, when to hand-author. CVA patterns. Pinning. Common gotchas.

## CLI

```bash
pnpm dlx shadcn@latest add <component>     # pnpm
npx shadcn@latest add <component>          # npm
yarn shadcn@latest add <component>         # yarn
bun x shadcn@latest add <component>        # bun
```

The CLI:
1. Reads `components.json` to find install paths and aliases
2. Writes the component file into `components/ui/<name>.tsx`
3. Adds any required deps (`@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`, etc.) to `package.json`
4. Updates `globals.css` with any required utility classes (rare)

**`shadcn add` overwrites the destination file without confirmation.** Always inventory before running it (see `workflows/before-you-start.md`).

## When to use the CLI vs. wrap vs. hand-author

| Need | Approach |
|---|---|
| Standard primitive (Button, Dialog, Input, etc.) | **CLI** — `shadcn add <name>` |
| Token-aware variant the upstream component lacks (e.g. an extra Button variant) | **Wrap** — extend the upstream CVA in a thin wrapper |
| Composition of 2+ primitives that the kit ships as a Pattern | **Hand-author** in `components/ui/patterns/<name>.tsx` |
| Layout primitive shadcn doesn't provide (Container, Stack, Grid) | **Hand-author** in `components/ui/<name>.tsx` |
| Business component for a feature | **Not the kit's job** — lives in `features/<area>/components/` |

## Wrapping pattern

shadcn ships components with `class-variance-authority` (CVA) variant APIs. Extending them without forking:

```tsx
// components/ui/button.tsx — original from shadcn add
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center …",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // … existing variants
      },
      size: { /* … */ },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

To add a brand-specific variant (e.g. AD Ports needs an "uppercase pill" button), **don't fork**. Add the variant inline:

```tsx
// In the same file, extend variant.variant with one new entry
variant: {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  // ... existing
  pill: "bg-primary text-primary-foreground rounded-full uppercase tracking-wide hover:bg-primary/90",
},
```

This keeps the file installable from `shadcn add` (subsequent re-installs will warn that the file changed) but avoids creating a parallel `BrandButton.tsx`.

If a wrap is genuinely needed (e.g. the upstream component takes a prop the brand never wants exposed), wrap in a *new* file:

```tsx
// components/ui/brand-button.tsx
import { Button as BaseButton, type ButtonProps } from "./button";
import { forwardRef } from "react";

export const BrandButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant"> & { tone?: "primary" | "ghost" }>(
  ({ tone = "primary", ...props }, ref) => (
    <BaseButton ref={ref} variant={tone === "primary" ? "default" : "ghost"} {...props} />
  )
);
BrandButton.displayName = "BrandButton";
```

Use this sparingly. Most cases are better served by CVA variant additions in-place.

## CVA conventions

When hand-authoring or extending:

- **Variant names match shadcn's naming.** `default | secondary | outline | ghost | destructive | link` for buttons. `default | secondary | destructive | outline` for badges. Don't invent `primary` / `error` etc.
- **Size names match shadcn's naming.** `default | sm | lg | icon` for most components. Buttons additionally have `xs | icon-xs | icon-sm | icon-lg`.
- **Default variant + size are explicit.** `defaultVariants: { variant: "default", size: "default" }`.
- **Compose variants don't multiply infinitely.** If you need a `variant × size × shape × tone` matrix, you're past the kit's job — that's a feature component.

## Pinning

`components.json` pins the registry URL. The kit also pins:

- `package.json` → `shadcn` CLI version (devDep) — prevents CLI version skew breaking installs
- `package.json` → component dep ranges (`@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`)

**Pin at minor.** Patch updates are safe. Minor updates may add components or change variant APIs — review before bumping.

## components.json

The skill ships `components.json` matching the framework. Key fields:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",            // or "default" — kit ships new-york
  "rsc": true,                    // false for non-Next projects
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`style: "new-york"` is opinionated (denser, smaller default radius). The kit defaults to it because the brand specs we've seen (AD Ports, others) tend to assume tighter spacing. `style: "default"` is fine if a brand prefers more breathing room — change once at `components.json`, re-add components, done.

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `shadcn add` writes to wrong path | `aliases` in `components.json` mismatch tsconfig paths | Sync `aliases` and `tsconfig.json` `paths` |
| Component renders but colors are wrong | Tailwind theme extension missing the color name | Check `tailwind-mapping.md` — the `--color-*` variable for the missing name must be in `@theme` |
| Dark mode flickers on first paint | `data-theme` set in client effect, not on `<html>` server-side | Set `data-theme` in `<html>` directly (Next: in `layout.tsx` root); use a script tag for system preference |
| `Button` looks identical across variants | `tailwindcss-animate` plugin missing | `pnpm add -D tailwindcss-animate` and add to plugins |
| `Dialog` / `Sheet` portal not styled | `globals.css` not imported in root layout | Verify `import "./globals.css"` in `app/layout.tsx` |
| Focus ring missing | `--ring` token undefined OR custom outline-none on a parent | Check `tokens.css` for `--ring` in both themes; remove blanket outline resets |
| RTL breaks Dropdown / Popover position | Floating UI strategy not aware of dir | Wrap app in shadcn's `Direction` provider with `dir={dir}` |
| `shadcn add` complains about missing peer deps | Project's React version below shadcn's minimum | Upgrade to at least React 18.2 (absolute floor for shadcn); prefer the LTS in `/standards/framework-baselines.md` § React. Verify with `pnpm why react`. |

## Tested versions (snapshot 2026-05-01)

| Package | Pinned to |
|---|---|
| `shadcn` (CLI) | `^2.4.0` |
| `react` | `^18.2.0` (works on 19+) |
| `tailwindcss` | `^4.0.0` (v3.4+ supported) |
| `@radix-ui/*` | latest as installed by `shadcn add` |
| `class-variance-authority` | `^0.7.0` |
| `clsx` | `^2.1.0` |
| `tailwind-merge` | `^2.5.0` |
| `lucide-react` | `^0.460.0` |
| `tailwindcss-animate` | `^1.0.7` |

Audit quarterly. When the upstream snapshot diverges materially from these versions, update this table and the templates.
~~~

## Original references/showcase-page.md

~~~markdown
# Showcase Page

The `/ui-kit` page is the kit's verification surface. If it renders, the kit works.

## Route shape

```
app/ui-kit/
├── page.tsx                      # Container — section nav + content slot
├── layout.tsx                    # Provides ThemeProvider + Direction provider for /ui-kit only
├── theme-toggle.tsx              # Light/dark toggle (omit if darkMode === "none")
├── rtl-toggle.tsx                # LTR/RTL toggle (omit if rtl === "none")
└── sections/
    ├── foundations.tsx
    ├── forms-controls.tsx
    ├── buttons-actions.tsx
    ├── data-display.tsx
    ├── feedback.tsx
    ├── overlays.tsx
    ├── navigation.tsx
    ├── disclosure.tsx
    ├── layout.tsx
    └── patterns.tsx
```

`/ui-kit` is **not** routed inside the app's main layout. It bypasses the app shell so the showcase isn't constrained by app-level chrome.

## Container layout

The page is a single column, max-width capped, with a sticky in-page nav on the left at desktop / collapsed at the top on mobile.

```
┌────────────────────────────────────────────────────────────────┐
│  [logo / title]    [light/dark toggle]    [LTR/RTL toggle]     │  ← header (sticky, h-14)
├──────────────┬─────────────────────────────────────────────────┤
│              │                                                  │
│  Foundations │   ## Foundations                                 │
│  Forms       │                                                  │
│  Buttons     │   [Color swatches grid]                          │
│  Data        │                                                  │
│  Feedback    │   [Type scale rendered live]                     │
│  Overlays    │                                                  │
│  Navigation  │   [Spacing bars]                                 │
│  Disclosure  │                                                  │
│  Layout      │   [Radius / Shadow / Motion / Icons]             │
│  Patterns    │                                                  │
│              │   ─────────────────────────────────────          │
│   ↑ sticky   │                                                  │
│   nav        │   ## Forms & Controls                            │
│              │                                                  │
│              │   …                                              │
└──────────────┴─────────────────────────────────────────────────┘
   240px         max-w-5xl, mx-auto, px-6, py-12
```

## Per-section structure

Every section file exports a default component with this shape:

```tsx
export default function Foundations() {
  return (
    <section id="foundations" className="space-y-8 py-12 border-b border-border">
      <header className="space-y-2">
        <h2 className="text-3xl font-display font-bold">Foundations</h2>
        <p className="text-muted-foreground">
          Tokens that drive every other section. If these look wrong, fix tokens.css before continuing.
        </p>
      </header>

      <SubSection title="Colors">
        {/* Swatches */}
      </SubSection>

      <SubSection title="Typography">
        {/* Scale */}
      </SubSection>

      {/* … */}
    </section>
  );
}
```

`SubSection` is a small local component:

```tsx
function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-display font-semibold">{title}</h3>
      <div>{children}</div>
    </div>
  );
}
```

## States demo discipline

Every interactive component is rendered in **all states**, side by side:

```tsx
<div className="grid grid-cols-5 gap-4 items-center">
  <div>
    <Button>Default</Button>
    <p className="text-xs text-muted-foreground mt-1">default</p>
  </div>
  <div>
    <Button data-state="hover" className="hover:bg-primary/90">Hover</Button>
    <p className="text-xs text-muted-foreground mt-1">hover (forced)</p>
  </div>
  <div>
    <Button autoFocus>Focus</Button>
    <p className="text-xs text-muted-foreground mt-1">focus</p>
  </div>
  <div>
    <Button disabled>Disabled</Button>
    <p className="text-xs text-muted-foreground mt-1">disabled</p>
  </div>
  <div>
    <Button disabled>
      <Spinner className="mr-2" />
      Loading
    </Button>
    <p className="text-xs text-muted-foreground mt-1">loading</p>
  </div>
</div>
```

For Buttons specifically, the showcase renders a **6 × 8 × 5 matrix** (variant × size × state). It's verbose by design — if any cell looks broken, the visual review catches it.

## Theme toggle

Lives in the header. On click, sets `data-theme` on `<html>` and persists to `localStorage`.

```tsx
"use client";
import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <Toggle pressed={dark} onPressedChange={toggle} aria-label="Toggle theme">
      {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Toggle>
  );
}
```

## RTL toggle

```tsx
"use client";
import { useState } from "react";
import { Toggle } from "@/components/ui/toggle";

export function RtlToggle() {
  const [rtl, setRtl] = useState(false);
  function toggle() {
    const next = !rtl;
    setRtl(next);
    document.documentElement.dir = next ? "rtl" : "ltr";
  }
  return (
    <Toggle pressed={rtl} onPressedChange={toggle} aria-label="Toggle direction">
      {rtl ? "RTL" : "LTR"}
    </Toggle>
  );
}
```

When RTL is on, Sections 2 (Forms), 6 (Overlays), and 7 (Navigation) MUST render correctly mirrored. Other sections are tested as time allows but those three are the hard requirement.

## What NOT to put on this page

- **Real data.** Use placeholder content. Real data couples the kit to a feature.
- **Auth.** The page is public (or behind a single dev gate at most).
- **App-level chrome.** No app sidebar, no app nav. The showcase is sovereign.
- **Side-by-side comparisons with another kit.** This is the kit's verification surface, not a beauty contest.
~~~

## Original references/tailwind-mapping.md

~~~markdown
# Tailwind Mapping

The bridge between `tokens.css` (CSS custom properties) and Tailwind utilities (`bg-primary`, `text-foreground`, etc.).

shadcn's convention: components reference Tailwind utilities. Tailwind's `theme.extend` resolves those utilities to CSS variables. The variables are defined in `tokens.css`. The user changes brand → only `tokens.css` changes → all components re-theme.

## Tailwind v3 vs v4

| Aspect | Tailwind v3 | Tailwind v4 |
|---|---|---|
| Config file | `tailwind.config.ts` | `@theme` block in CSS (config file optional) |
| Variable wiring | `theme.extend.colors.primary = "hsl(var(--primary) / <alpha-value>)"` | `--color-primary: var(--brand-primary);` inside `@theme` |
| shadcn support | Stable | Stable (since shadcn v2.4) |

This skill **defaults to v4** because it's the current shadcn recommendation. v3 instructions are kept for projects that haven't migrated.

## v4 wiring (recommended)

Single file: `app/globals.css` (or `src/styles/globals.css`).

```css
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  /* Colors — map shadcn's expected names to brand tokens */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-fg);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-fg);
  --color-primary: var(--brand-primary);
  --color-primary-foreground: var(--brand-primary-fg);
  --color-secondary: var(--brand-secondary);
  --color-secondary-foreground: var(--brand-secondary-fg);
  --color-accent: var(--brand-accent);
  --color-accent-foreground: var(--brand-accent-fg);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-fg);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-fg);
  --color-success: var(--success);
  --color-success-foreground: var(--success-fg);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-fg);
  --color-info: var(--info);
  --color-info-foreground: var(--info-fg);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Fonts */
  --font-sans: var(--font-body);
  --font-display: var(--font-display);
  --font-mono: var(--font-mono);

  /* Radius — shadcn uses --radius as a base; sm/md/lg derive */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);

  /* Shadow */
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
}

/* Dark mode trigger — shadcn convention */
@variant dark ([data-theme="dark"] &);
```

## v3 wiring (legacy)

`tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-fg) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--brand-primary) / <alpha-value>)",
          foreground: "hsl(var(--brand-primary-fg) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--brand-secondary) / <alpha-value>)",
          foreground: "hsl(var(--brand-secondary-fg) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--brand-accent) / <alpha-value>)",
          foreground: "hsl(var(--brand-accent-fg) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-fg) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-fg) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

**v3 note: tokens must be HSL channel triples** (e.g. `220 40% 25%`) for the `<alpha-value>` syntax to work. The kit's blank `tokens.css.tmpl` ships with HSL triples for this reason. v4 accepts any color format.

## Why this layer exists

Without the mapping:
- shadcn components hardcode `bg-zinc-50`, `text-zinc-900` etc.
- Re-theming = sed-replace across every component file
- Brand changes are PR-scale events

With the mapping:
- Components reference semantic Tailwind utilities (`bg-card`, `text-muted-foreground`)
- Re-theming = edit `tokens.css`
- Brand changes are one-file events

## What NOT to put in this layer

- **Component-specific colors** — those belong in the component file via CVA variants.
- **Page-specific overrides** — those belong in the page's CSS, not the global theme.
- **Hardcoded values** — every `--color-*` resolves to a `var(--token)`. If a value is hardcoded here, the contract is broken.

## Verifying the wiring

After applying this config:

```bash
# In a test page, render <div className="bg-primary text-primary-foreground p-4">test</div>
# Inspect the rendered element in devtools.
# computed background-color should resolve to your --brand-primary.
# Change --brand-primary in tokens.css and reload — the div should re-color.
```

If the test div doesn't re-color when the token changes, the wiring is wrong. Common causes:
- Tailwind's content glob doesn't match the test file
- `@theme` block missing the color name
- v3: missing `<alpha-value>` syntax breaks opacity utilities
- Browser caching `tokens.css` — hard reload
~~~

## Original references/tokens-spec.md

~~~markdown
# Token Spec — the contract

The skill enforces this contract. The user provides values. Components consume them.

All tokens are CSS custom properties on `:root` (light) and `[data-theme="dark"]` (dark). Tailwind config maps them onto its theme. Components reference them via Tailwind utilities (`bg-primary`, `text-foreground`) — never directly.

## Required variables

A `tokens.css` is **invalid** if any of these are missing or contain `/* TODO */`. The skill's validation step refuses to proceed.

### Brand (the four load-bearing values)

```css
--brand-primary       /* CTAs, focus rings, active states */
--brand-primary-fg    /* Text on --brand-primary; must pass WCAG AA */
--brand-secondary     /* Outlined buttons, secondary actions */
--brand-secondary-fg
--brand-accent        /* Optional third brand color (highlights, badges) */
--brand-accent-fg
```

### Neutrals (11 stops)

```css
--neutral-50          /* Lightest — page background in light mode */
--neutral-100
--neutral-200
--neutral-300
--neutral-400
--neutral-500         /* Mid — body text on light backgrounds */
--neutral-600
--neutral-700
--neutral-800
--neutral-900
--neutral-950         /* Darkest — page background in dark mode */
```

The neutral ramp is the spine of the kit. Don't skip stops; don't use only 3. Surface tokens (`--background`, `--card`, `--border`, etc.) **derive from** the ramp — see Surface section below.

### Semantic

```css
--success        --success-fg
--warning        --warning-fg
--destructive    --destructive-fg
--info           --info-fg
```

shadcn uses `destructive`, not `danger`. (ng-bootstrap-kit uses `danger` to match Bootstrap convention.)

### Surface (derived from neutrals + brand)

These are the tokens components actually reference. They MUST be derived from the brand + neutral ramp — never assigned independently.

```css
--background         /* Page background. Light = --neutral-50. Dark = --neutral-950. */
--foreground         /* Default text. Light = --neutral-900. Dark = --neutral-50. */
--muted              /* Subdued surface. Light = --neutral-100. Dark = --neutral-900. */
--muted-fg           /* Subdued text. Light = --neutral-500. Dark = --neutral-400. */
--card               /* Card background. Light = white or --neutral-50. Dark = --neutral-900. */
--card-fg            /* Card text. Light = --neutral-900. Dark = --neutral-50. */
--popover            /* Popover background — usually same as --card */
--popover-fg
--border             /* Default border. Light = --neutral-200. Dark = --neutral-800. */
--input              /* Input border. Usually same as --border. */
--ring               /* Focus ring. Light = --brand-primary. Dark = lighter shade of brand. */
```

These are the names shadcn components reference internally. Renaming breaks the contract.

### Typography

```css
--font-display       /* Headings */
--font-body          /* Body, UI labels */
--font-mono          /* Code, tabular numerics */

/* Size scale — CSS custom properties so components can opt out of Tailwind */
--text-xs            /* 12px / 0.75rem */
--text-sm            /* 14px / 0.875rem */
--text-base          /* 16px / 1rem */
--text-lg            /* 18px / 1.125rem */
--text-xl            /* 20px / 1.25rem */
--text-2xl           /* 24px / 1.5rem */
--text-3xl           /* 30px / 1.875rem */
--text-4xl           /* 36px / 2.25rem */
--text-5xl           /* 48px / 3rem */

/* Paired line-heights */
--leading-xs         /* 1.5 */
--leading-sm         /* 1.45 */
--leading-base       /* 1.5 */
--leading-lg         /* 1.4 */
--leading-xl         /* 1.4 */
--leading-2xl        /* 1.3 */
--leading-3xl        /* 1.25 */
--leading-4xl        /* 1.2 */
--leading-5xl        /* 1.15 */
```

The size scale is **opinionated** — kit defaults match Tailwind. Override only if the brand specifies different sizes (e.g. AD Ports uses 61 / 50 / 40 / 31 / 25 / 20 / 16 — those map to existing slots, no need to add new ones).

### Spacing

```css
--space-0            /* 0 */
--space-px           /* 1px */
--space-0_5          /* 2px */
--space-1            /* 4px */
--space-1_5          /* 6px */
--space-2            /* 8px */
--space-3            /* 12px */
--space-4            /* 16px */
--space-5            /* 20px */
--space-6            /* 24px */
--space-8            /* 32px */
--space-10           /* 40px */
--space-12           /* 48px */
--space-16           /* 64px */
--space-20           /* 80px */
--space-24           /* 96px */
```

Tailwind-compatible. If the brand uses a different scale (e.g. AD Ports `8/16/24/40/64/96`), all those values are already in this scale — use the existing slots, don't invent new tokens.

### Radius

```css
--radius-sm          /* Default 4px */
--radius-md          /* Default 6px */
--radius-lg          /* Default 8px */
--radius-xl          /* Default 12px */
--radius-full        /* 9999px */
```

### Shadow

All shadows must be **derived from a single shadow color** (default: a low-opacity neutral). The brand can override `--shadow-color` if the brand book specifies (e.g. AD Ports derives shadows from Deep Blue).

```css
--shadow-color       /* rgb triple, e.g. "12 15 21" — used in rgba() */
--shadow-sm          /* rgba(var(--shadow-color), 0.08) 0 1px 2px */
--shadow-md          /* rgba(var(--shadow-color), 0.10) 0 4px 6px */
--shadow-lg          /* rgba(var(--shadow-color), 0.12) 0 10px 15px */
--shadow-xl          /* rgba(var(--shadow-color), 0.16) 0 20px 25px */
```

### Motion

```css
--ease-out           /* cubic-bezier(0.16, 1, 0.3, 1) */
--ease-in-out        /* cubic-bezier(0.45, 0, 0.55, 1) */
--duration-fast      /* 150ms */
--duration-normal    /* 200ms */
--duration-slow      /* 300ms */
```

## Validation rules (enforced by `workflows/scaffold-kit.md`)

1. **Every variable in this spec is present in `tokens.css`.** No exceptions.
2. **No `/* TODO */` strings remain.** Validation fails if any do.
3. **Every color value parses as a valid CSS color.** `#abc`, `#abcdef`, `rgb(…)`, `hsl(…)`, `oklch(…)` all OK.
4. **Light + dark are both defined.** Every brand / neutral / semantic / surface token has a value under both `:root` and `[data-theme="dark"]`.
5. **`--ring` passes WCAG AA contrast against `--background` and `--card`** in both themes.
6. **Foreground tokens (`-fg`) pass WCAG AA against their counterpart** in both themes. Rendered live in Foundations section for review.
7. **Surface tokens derive from the neutral ramp + brand** — not assigned independently. (Soft rule; advisory in checklist.)

## What the user actually fills

Most users only need to set:

1. **3 brand values** — `--brand-primary`, `--brand-secondary`, `--brand-accent` (and their `-fg` pairs)
2. **11 neutral stops** — pick a ramp that matches the brand temperature (warm / cool / true gray)
3. **3 font families** — display, body, mono
4. **4 semantic colors** — usually keep the kit defaults

Everything else (surfaces, sizes, spacing, radius, shadow, motion) has sensible defaults in the template. Override only when the brand specifies otherwise.

## What components reference

Components in `components/ui/` reference these tokens **only via Tailwind utilities**:

| Token | Tailwind utility |
|---|---|
| `--background` | `bg-background` |
| `--foreground` | `text-foreground` |
| `--card` / `--card-fg` | `bg-card` / `text-card-foreground` |
| `--muted` / `--muted-fg` | `bg-muted` / `text-muted-foreground` |
| `--brand-primary` | `bg-primary` / `text-primary` |
| `--brand-primary-fg` | `text-primary-foreground` |
| `--border` | `border-border` |
| `--ring` | `ring-ring` (focus ring) |
| `--radius-md` | `rounded-md` |
| `--shadow-md` | `shadow-md` |

Direct `var(--token)` references inside components are **forbidden** — the after-checklist greps for them. Use the Tailwind utility, which resolves through the config.

See [tailwind-mapping.md](tailwind-mapping.md) for the exact theme extension that wires these together.
~~~

## Original SKILL.md

~~~markdown
---
name: shadcn-kit
description: "Use when scaffolding or extending a shadcn/ui kit in a React or Next.js project. Brand-agnostic — accepts any token values (typography, primary, secondary, neutrals). Generates tokens.css, wires Tailwind, scaffolds the 10 standard component sections, and builds a /ui-kit showcase page. Trigger on \"set up shadcn\", \"build a UI kit\", \"add design tokens\", \"scaffold components\", \"shadcn theme\", \"shadcn dark mode\", \"shadcn RTL\", \"theme my shadcn project\"."
---
# shadcn-kit


## Metadata

- **version:** 0.1.2
- **default_prompt:** Use the shadcn-kit skill. Open SKILL.md, choose the matching workflow, and complete the request with evidence.
- **short_description:** Scaffolding or extending a shadcn/ui kit in a React or Next.js

## Abu Dhabi Ports Group Context

This skill is part of the Abu Dhabi Ports Group (AD Ports Group) AI SDLC catalog. Apply it as enterprise delivery guidance for AD Ports teams, systems, and delivery partners, keeping outputs aligned with business value, port and logistics operations, UAE regulatory expectations, security, data residency, accessibility, operational resilience, and auditable handoffs.

## What this skill does

1. Validates a filled `tokens.css` (you provide values, skill validates structure).
2. Wires `tailwind.config.ts` to consume the tokens.
3. Scaffolds the **10 standard sections** of shadcn primitives — using `shadcn add` where possible, hand-authored CVA variants where not.
4. Builds the `/ui-kit` showcase page demoing every section, every variant, every state, in light + dark.
5. Writes `UI_KIT.md` recording what's in, what's not, and how to extend.

## What this skill does NOT do

- **Pick brand values.** The user provides typography, colors, radius, shadows. The skill never invents them.
- **Replace `shadcn add`.** Where the CLI works, use it. The skill orchestrates.
- **Cover other stacks.** Angular, Vue, Solid, React Native — out of scope.
- **Generate business-feature components.** Those live in `features/` per app convention.
- **Enforce a brand book.** Brand-specific skills (e.g. `adports-design-system`) chain *into* this skill — they don't live here.

## The four load-bearing tokens

Every kit needs these four right or the kit fails. Everything else is secondary.

| Token | Why it matters |
|---|---|
| **Typography** | Sets the entire visual rhythm. Wrong font = wrong product, regardless of color. |
| **Primary** | The brand's voice. CTAs, focus rings, active states all derive from it. |
| **Secondary** | The supporting voice. Outlined buttons, badges, secondary actions. |
| **Neutrals** | 90% of the screen. Backgrounds, surfaces, borders, body text. Wrong neutrals = muddy or harsh kit. |

Semantic colors (success/warning/destructive/info), motion, and elevation are **secondary** — sensible defaults ship with the template; the user only overrides them if their brand specifies something different.

See [references/tokens-spec.md](references/tokens-spec.md) for the full required-variable list.

## Workflows — pick the phase you're in

| Phase | File |
|---|---|
| **Before you start** — preflight checks (framework, Tailwind, shadcn init, tokens ready) | [`workflows/before-you-start.md`](workflows/before-you-start.md) |
| **Scaffold** — wire tokens, install primitives, build sections | [`workflows/scaffold-kit.md`](workflows/scaffold-kit.md) |
| **Showcase** — build the `/ui-kit` page across the 10 sections | [`workflows/build-showcase.md`](workflows/build-showcase.md) |
| **Apply to feature** — translate a developer's intent ("a settings page", "a dashboard") into a build plan using kit primitives | [`workflows/apply-to-feature.md`](workflows/apply-to-feature.md) |
| **Extend** — add a new component or section to an existing kit | [`workflows/extend-kit.md`](workflows/extend-kit.md) |
| **After you finish** — verification checklist before reporting done | [`workflows/after-you-finish.md`](workflows/after-you-finish.md) |

## References — pick the topic you're working on

| If you're working on... | File |
|---|---|
| The token contract (what variables, light/dark, naming) | [`references/tokens-spec.md`](references/tokens-spec.md) |
| The 10 sections + component list per section + variant API | [`references/sections-catalog.md`](references/sections-catalog.md) |
| **Translating a developer's intent into kit components** | [`references/intent-routing.md`](references/intent-routing.md) |
| Mapping CSS vars onto Tailwind theme extension | [`references/tailwind-mapping.md`](references/tailwind-mapping.md) |
| When to use `shadcn add` vs hand-author + CVA patterns | [`references/shadcn-recipes.md`](references/shadcn-recipes.md) |
| Layout/navigation pattern for the `/ui-kit` page | [`references/showcase-page.md`](references/showcase-page.md) |
| Per-framework path conventions (Next app/pages, Vite, Remix) | [`references/framework-adapters.md`](references/framework-adapters.md) |

## Templates

The skill ships filled templates the workflows copy and substitute into the project:

| File | What it produces |
|---|---|
| `templates/tokens.css.tmpl` | Blank `styles/tokens.css` — every required variable, light + dark, `/* TODO */` placeholders |
| `templates/tailwind.config.ts.tmpl` | `tailwind.config.ts` mapping CSS vars to Tailwind theme |
| `templates/globals.css.tmpl` | `styles/globals.css` — imports tokens, applies base font/color |
| `templates/ui-kit-page.tsx.tmpl` | `app/ui-kit/page.tsx` — section navigation + slots |
| `templates/theme-provider.tsx.tmpl` | Theme provider with `data-theme="dark"` toggle |
| `templates/ui-kit.md.tmpl` | `UI_KIT.md` — records tokens source, sections, dark/RTL, framework, date |

## Hard rules the skill enforces

1. **No hardcoded hex / px in `components/ui/*`.** All visual values resolve through tokens. Verified by grep in the after-you-finish checklist.
2. **Every interactive component shows all states** — default / hover / focus / disabled / loading where applicable.
3. **Light + dark both work** when dark mode is enabled. No "looks fine in light, broken in dark."
4. **Focus ring is visible and high-contrast.** Keyboard tab through `/ui-kit` reveals every focused element.
5. **No third typeface.** Whatever the user supplies in `--font-display`, `--font-body`, `--font-mono` — those three only.
6. **Dark mode swap is `data-theme="dark"` on `<html>`.** Matches shadcn convention; no class-based or `prefers-color-scheme`-only schemes.
7. **Never overwrite an existing `components/ui/*` file** without explicit user confirmation. Inventory first.

## Operating principles

- **Tokens are the contract.** Components consume them. Brand owns them. Skill enforces them.
- **shadcn primitives are the default.** Hand-author only when the primitive doesn't exist or needs a token-aware variant the upstream version lacks.
- **Verification is part of done.** The `/ui-kit` page IS the verification — if it renders, the kit works.
- **Brand-agnostic forever.** Any AD Ports / client / personal token set must work without skill changes. If it doesn't, the skill is wrong, not the tokens.

## Handoff

← **Brand owner / designer** (provides filled `tokens.css`). → **Frontend** (consumes the kit to build features), **QA** (verifies a11y, RTL, dark mode), **Design-system reviewer** (signs off `UI_KIT.md`).

## Ownership

- **Primary owner:** frontend-react
- **Supporting owners:** ux-ui-designer, frontend-angular
- **Review cadence:** Quarterly, plus after major shadcn/ui, Tailwind, React, or Next.js changes.
- **Last reviewed:** 2026-05-01
~~~

## Original templates/globals.css.tmpl

~~~text
/*
 * globals.css — root stylesheet
 *
 * Imports Tailwind, brand tokens, and base resets.
 * For Tailwind v4: includes the @theme block that maps tokens to Tailwind utilities.
 * For Tailwind v3: leave the @theme block commented and use tailwind.config.ts instead.
 */

@import "tailwindcss";
@import "./tokens.css";

/* ─────────────────────────────────────────────────────────────
 * Tailwind v4 theme — maps tokens to shadcn's expected names.
 * If you're on Tailwind v3, delete this block and use tailwind.config.ts.
 * ───────────────────────────────────────────────────────────── */
@theme inline {
  --color-background:           var(--background);
  --color-foreground:           var(--foreground);
  --color-card:                 var(--card);
  --color-card-foreground:      var(--card-fg);
  --color-popover:              var(--popover);
  --color-popover-foreground:   var(--popover-fg);
  --color-primary:              var(--brand-primary);
  --color-primary-foreground:   var(--brand-primary-fg);
  --color-secondary:            var(--brand-secondary);
  --color-secondary-foreground: var(--brand-secondary-fg);
  --color-accent:               var(--brand-accent);
  --color-accent-foreground:    var(--brand-accent-fg);
  --color-muted:                var(--muted);
  --color-muted-foreground:     var(--muted-fg);
  --color-destructive:          var(--destructive);
  --color-destructive-foreground: var(--destructive-fg);
  --color-success:              var(--success);
  --color-success-foreground:   var(--success-fg);
  --color-warning:              var(--warning);
  --color-warning-foreground:   var(--warning-fg);
  --color-info:                 var(--info);
  --color-info-foreground:      var(--info-fg);
  --color-border:               var(--border);
  --color-input:                var(--input);
  --color-ring:                 var(--ring);

  --font-sans:    var(--font-body);
  --font-display: var(--font-display);
  --font-mono:    var(--font-mono);

  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);

  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
}

/* Dark mode trigger — shadcn convention */
@variant dark ([data-theme="dark"] &);

/* ─────────────────────────────────────────────────────────────
 * Base resets
 * ───────────────────────────────────────────────────────────── */
@layer base {
  * {
    border-color: var(--color-border);
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-family: var(--font-body);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-body);
    line-height: var(--leading-base);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    font-weight: 700;
  }

  h1 { font-size: var(--text-4xl); line-height: var(--leading-4xl); }
  h2 { font-size: var(--text-3xl); line-height: var(--leading-3xl); }
  h3 { font-size: var(--text-2xl); line-height: var(--leading-2xl); }
  h4 { font-size: var(--text-xl);  line-height: var(--leading-xl); }
  h5 { font-size: var(--text-lg);  line-height: var(--leading-lg); }
  h6 { font-size: var(--text-base); line-height: var(--leading-base); }

  code, kbd, pre, samp {
    font-family: var(--font-mono);
  }

  /* Visible focus on all keyboard-focused elements */
  :focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
}
~~~

## Original templates/tailwind.config.ts.tmpl

~~~text
/**
 * tailwind.config.ts — Tailwind v3 only.
 *
 * If you're on Tailwind v4, this file is OPTIONAL — the @theme block in globals.css.tmpl
 * does the same job. Delete this file if you don't need v3 compatibility.
 *
 * v3 requires HSL channel triples in tokens.css for the <alpha-value> syntax to work.
 * Example: --brand-primary: 220 40% 25%;  (no `hsl()` wrapper)
 */
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-fg) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-fg) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--brand-primary) / <alpha-value>)",
          foreground: "hsl(var(--brand-primary-fg) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--brand-secondary) / <alpha-value>)",
          foreground: "hsl(var(--brand-secondary-fg) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--brand-accent) / <alpha-value>)",
          foreground: "hsl(var(--brand-accent-fg) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-fg) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-fg) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-fg) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-fg) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-fg) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionTimingFunction: {
        "out-soft":   "var(--ease-out)",
        "in-out-soft": "var(--ease-in-out)",
      },
      transitionDuration: {
        fast:   "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow:   "var(--duration-slow)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
~~~

## Original templates/theme-provider.tsx.tmpl

~~~text
"use client";

/**
 * theme-provider.tsx — provides theme + direction state to the showcase and the app.
 *
 * Sets data-theme="dark"|"light" and dir="rtl"|"ltr" on <html>.
 * Persists to localStorage. Falls back to system preference on first load.
 *
 * Usage (Next App Router):
 *   // app/layout.tsx
 *   import { ThemeProvider } from "@/components/theme-provider";
 *   <html suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Direction = "ltr" | "rtl";

interface ThemeContextValue {
  theme: Theme;
  direction: Direction;
  setTheme: (t: Theme) => void;
  setDirection: (d: Direction) => void;
  toggleTheme: () => void;
  toggleDirection: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [direction, setDirectionState] = useState<Direction>("ltr");

  useEffect(() => {
    const storedTheme = (localStorage.getItem("theme") as Theme | null) ?? null;
    const storedDir = (localStorage.getItem("dir") as Direction | null) ?? null;
    const initialTheme: Theme = storedTheme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const initialDir: Direction = storedDir ?? "ltr";
    setThemeState(initialTheme);
    setDirectionState(initialDir);
    document.documentElement.dataset.theme = initialTheme;
    document.documentElement.dir = initialDir;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("theme", t);
  }, []);

  const setDirection = useCallback((d: Direction) => {
    setDirectionState(d);
    document.documentElement.dir = d;
    localStorage.setItem("dir", d);
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);
  const toggleDirection = useCallback(() => setDirection(direction === "rtl" ? "ltr" : "rtl"), [direction, setDirection]);

  return (
    <ThemeContext.Provider value={{ theme, direction, setTheme, setDirection, toggleTheme, toggleDirection }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
~~~

## Original templates/tokens.css.tmpl

~~~text
/*
 * tokens.css — brand-aware design tokens
 *
 * Generated by shadcn-kit skill. Fill the /* TODO */ placeholders, then re-invoke the skill.
 * Validation rules:
 *   - No /* TODO */ may remain.
 *   - All values must parse as valid CSS.
 *   - Light + dark must both be defined for every brand / neutral / semantic / surface token.
 *
 * Color format: any valid CSS color works. The kit's Tailwind mapping (Tailwind v4) reads these
 * directly. If the project is on Tailwind v3, use HSL channel triples (e.g. "220 40% 25%") so
 * Tailwind's <alpha-value> syntax works — see references/tailwind-mapping.md.
 *
 * Recommended: read references/tokens-spec.md before filling.
 */

:root {
  /* ───────────────────────────────────────────────────────────
   * BRAND — the four load-bearing tokens
   * ─────────────────────────────────────────────────────────── */
  --brand-primary:        /* TODO */;
  --brand-primary-fg:     /* TODO */;
  --brand-secondary:      /* TODO */;
  --brand-secondary-fg:   /* TODO */;
  --brand-accent:         /* TODO */;
  --brand-accent-fg:      /* TODO */;

  /* ───────────────────────────────────────────────────────────
   * NEUTRALS — 11 stops. The spine of the kit.
   * Pick a temperature: warm-gray, cool-gray, true-gray, slate, zinc, etc.
   * ─────────────────────────────────────────────────────────── */
  --neutral-50:   /* TODO */;
  --neutral-100:  /* TODO */;
  --neutral-200:  /* TODO */;
  --neutral-300:  /* TODO */;
  --neutral-400:  /* TODO */;
  --neutral-500:  /* TODO */;
  --neutral-600:  /* TODO */;
  --neutral-700:  /* TODO */;
  --neutral-800:  /* TODO */;
  --neutral-900:  /* TODO */;
  --neutral-950:  /* TODO */;

  /* ───────────────────────────────────────────────────────────
   * SEMANTIC — defaults usually fine. Override if brand specifies.
   * ─────────────────────────────────────────────────────────── */
  --success:        /* TODO */;
  --success-fg:     /* TODO */;
  --warning:        /* TODO */;
  --warning-fg:     /* TODO */;
  --destructive:    /* TODO */;
  --destructive-fg: /* TODO */;
  --info:           /* TODO */;
  --info-fg:        /* TODO */;

  /* ───────────────────────────────────────────────────────────
   * SURFACE — derive from neutrals + brand. Don't assign independently.
   * Recommended derivation shown in comments — uncomment the var() form
   * after filling neutrals if you want the derivation.
   * ─────────────────────────────────────────────────────────── */
  --background:    /* TODO */;       /* recommend: var(--neutral-50) */
  --foreground:    /* TODO */;       /* recommend: var(--neutral-900) */
  --muted:         /* TODO */;       /* recommend: var(--neutral-100) */
  --muted-fg:      /* TODO */;       /* recommend: var(--neutral-500) */
  --card:          /* TODO */;       /* recommend: #ffffff or var(--neutral-50) */
  --card-fg:       /* TODO */;       /* recommend: var(--neutral-900) */
  --popover:       /* TODO */;       /* recommend: var(--card) */
  --popover-fg:    /* TODO */;       /* recommend: var(--card-fg) */
  --border:        /* TODO */;       /* recommend: var(--neutral-200) */
  --input:         /* TODO */;       /* recommend: var(--border) */
  --ring:          /* TODO */;       /* recommend: var(--brand-primary) */

  /* ───────────────────────────────────────────────────────────
   * TYPOGRAPHY — three families. Tahoma / Inter / etc.
   * Include fallback stacks. Don't propose a font the brand didn't approve.
   * ─────────────────────────────────────────────────────────── */
  --font-display:  /* TODO */;       /* e.g. "ADPortsGroup", "Tahoma", sans-serif */
  --font-body:     /* TODO */;       /* same as display unless brand specifies otherwise */
  --font-mono:     /* TODO */;       /* e.g. ui-monospace, "SF Mono", Menlo, monospace */

  /* Type scale — defaults OK for most brands. Override only if brand specifies different sizes. */
  --text-xs:    0.75rem;   --leading-xs:  1.5;
  --text-sm:    0.875rem;  --leading-sm:  1.45;
  --text-base:  1rem;      --leading-base: 1.5;
  --text-lg:    1.125rem;  --leading-lg:  1.4;
  --text-xl:    1.25rem;   --leading-xl:  1.4;
  --text-2xl:   1.5rem;    --leading-2xl: 1.3;
  --text-3xl:   1.875rem;  --leading-3xl: 1.25;
  --text-4xl:   2.25rem;   --leading-4xl: 1.2;
  --text-5xl:   3rem;      --leading-5xl: 1.15;

  /* ───────────────────────────────────────────────────────────
   * SPACING — Tailwind-compatible scale. Defaults OK.
   * ─────────────────────────────────────────────────────────── */
  --space-0:    0;
  --space-px:   1px;
  --space-0_5:  0.125rem;  /*  2px */
  --space-1:    0.25rem;   /*  4px */
  --space-1_5:  0.375rem;  /*  6px */
  --space-2:    0.5rem;    /*  8px */
  --space-3:    0.75rem;   /* 12px */
  --space-4:    1rem;      /* 16px */
  --space-5:    1.25rem;   /* 20px */
  --space-6:    1.5rem;    /* 24px */
  --space-8:    2rem;      /* 32px */
  --space-10:   2.5rem;    /* 40px */
  --space-12:   3rem;      /* 48px */
  --space-16:   4rem;      /* 64px */
  --space-20:   5rem;      /* 80px */
  --space-24:   6rem;      /* 96px */

  /* ───────────────────────────────────────────────────────────
   * RADIUS — adjust to match the brand's softness.
   * ─────────────────────────────────────────────────────────── */
  --radius-sm:    /* TODO */;       /* recommend: 4px */
  --radius-md:    /* TODO */;       /* recommend: 6px */
  --radius-lg:    /* TODO */;       /* recommend: 8px */
  --radius-xl:    /* TODO */;       /* recommend: 12px */
  --radius-full:  9999px;

  /* ───────────────────────────────────────────────────────────
   * SHADOW — derived from a single color. Default: low-opacity neutral.
   * Override --shadow-color if brand specifies (e.g. AD Ports uses Deep Blue).
   * Format: "R G B" (no commas) — used inside rgb() / rgba().
   * ─────────────────────────────────────────────────────────── */
  --shadow-color: /* TODO */;        /* e.g. "12 15 21" for near-black, or "45 57 85" for AD Ports Deep Blue */
  --shadow-sm: 0 1px 2px 0 rgb(var(--shadow-color) / 0.08);
  --shadow-md: 0 4px 6px -1px rgb(var(--shadow-color) / 0.10), 0 2px 4px -2px rgb(var(--shadow-color) / 0.10);
  --shadow-lg: 0 10px 15px -3px rgb(var(--shadow-color) / 0.12), 0 4px 6px -4px rgb(var(--shadow-color) / 0.12);
  --shadow-xl: 0 20px 25px -5px rgb(var(--shadow-color) / 0.16), 0 8px 10px -6px rgb(var(--shadow-color) / 0.16);

  /* ───────────────────────────────────────────────────────────
   * MOTION — defaults OK. Override only if brand specifies.
   * ─────────────────────────────────────────────────────────── */
  --ease-out:        cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:     cubic-bezier(0.45, 0, 0.55, 1);
  --duration-fast:   150ms;
  --duration-normal: 200ms;
  --duration-slow:   300ms;
}

/* ─────────────────────────────────────────────────────────────
 * DARK THEME — every brand / neutral / semantic / surface token re-stated.
 * Activated by setting data-theme="dark" on <html>.
 * ───────────────────────────────────────────────────────────── */
[data-theme="dark"] {
  /* Brand — usually slightly lighter / more saturated in dark mode for contrast */
  --brand-primary:        /* TODO */;
  --brand-primary-fg:     /* TODO */;
  --brand-secondary:      /* TODO */;
  --brand-secondary-fg:   /* TODO */;
  --brand-accent:         /* TODO */;
  --brand-accent-fg:      /* TODO */;

  /* Neutrals — invert the ramp */
  --neutral-50:   /* TODO */;       /* often = light's --neutral-950 */
  --neutral-100:  /* TODO */;
  --neutral-200:  /* TODO */;
  --neutral-300:  /* TODO */;
  --neutral-400:  /* TODO */;
  --neutral-500:  /* TODO */;
  --neutral-600:  /* TODO */;
  --neutral-700:  /* TODO */;
  --neutral-800:  /* TODO */;
  --neutral-900:  /* TODO */;
  --neutral-950:  /* TODO */;

  /* Semantic — usually a touch brighter in dark mode */
  --success:        /* TODO */;
  --success-fg:     /* TODO */;
  --warning:        /* TODO */;
  --warning-fg:     /* TODO */;
  --destructive:    /* TODO */;
  --destructive-fg: /* TODO */;
  --info:           /* TODO */;
  --info-fg:        /* TODO */;

  /* Surfaces — re-derive */
  --background:    /* TODO */;       /* recommend: var(--neutral-950) */
  --foreground:    /* TODO */;       /* recommend: var(--neutral-50) */
  --muted:         /* TODO */;       /* recommend: var(--neutral-900) */
  --muted-fg:      /* TODO */;       /* recommend: var(--neutral-400) */
  --card:          /* TODO */;       /* recommend: var(--neutral-900) */
  --card-fg:       /* TODO */;       /* recommend: var(--neutral-50) */
  --popover:       /* TODO */;
  --popover-fg:    /* TODO */;
  --border:        /* TODO */;       /* recommend: var(--neutral-800) */
  --input:         /* TODO */;
  --ring:          /* TODO */;       /* recommend: lighter shade of --brand-primary */

  /* Shadow color often shifts darker in dark mode (deeper blacks) */
  --shadow-color: /* TODO */;
}
~~~

## Original templates/ui-kit-page.tsx.tmpl

~~~text
/**
 * /ui-kit page — entrypoint for the showcase.
 *
 * Renders all 10 sections in order. Each section is a separate file so adding /
 * editing one section doesn't bloat the diff.
 *
 * IMPORTANT: this page bypasses the app shell. It has its own layout in
 * app/ui-kit/layout.tsx (next-app-router) so the showcase isn't constrained by
 * app-level chrome.
 */

import Foundations from "./sections/foundations";
import FormsControls from "./sections/forms-controls";
import ButtonsActions from "./sections/buttons-actions";
import DataDisplay from "./sections/data-display";
import Feedback from "./sections/feedback";
import Overlays from "./sections/overlays";
import Navigation from "./sections/navigation";
import Disclosure from "./sections/disclosure";
import Layout from "./sections/layout";
import Patterns from "./sections/patterns";
import { ThemeToggle } from "./theme-toggle";
import { RtlToggle } from "./rtl-toggle";

const SECTIONS = [
  { id: "foundations",     label: "Foundations" },
  { id: "forms-controls",  label: "Forms & Controls" },
  { id: "buttons-actions", label: "Buttons & Actions" },
  { id: "data-display",    label: "Data Display" },
  { id: "feedback",        label: "Feedback" },
  { id: "overlays",        label: "Overlays" },
  { id: "navigation",      label: "Navigation" },
  { id: "disclosure",      label: "Disclosure" },
  { id: "layout",          label: "Layout" },
  { id: "patterns",        label: "Patterns" },
] as const;

export default function UiKitPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <h1 className="font-display text-lg font-bold">UI Kit</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <RtlToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <nav className="sticky top-20 hidden h-fit w-48 shrink-0 md:block">
          <ul className="space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 space-y-12">
          <Foundations />
          <FormsControls />
          <ButtonsActions />
          <DataDisplay />
          <Feedback />
          <Overlays />
          <Navigation />
          <Disclosure />
          <Layout />
          <Patterns />
        </main>
      </div>
    </div>
  );
}
~~~

## Original templates/ui-kit.md.tmpl

~~~text
# UI Kit

This kit was scaffolded by the `shadcn-kit` skill. It is the source-of-truth for UI primitives and patterns in this project.

## Tokens

- **Source:** `{{TOKENS_SOURCE}}` — e.g. `docs/specs/<brand>-design-system-<version>.md`, or "filled by hand from designer mockups on YYYY-MM-DD"
- **Brand applied:** `{{BRAND_NAME}}` — e.g. `AD Ports — Corporate`, `Acme Inc.`, `Personal project`
- **Primary token:** `{{PRIMARY_VALUE}}`
- **Last token edit:** `{{LAST_EDIT_DATE}}`

To re-theme: edit `styles/tokens.css`. No component code changes needed.

## Sections present

| Section | Components |
|---|---|
| 1. Foundations | Color swatches · Type scale · Spacing · Radius · Shadow · Motion · Icons |
| 2. Forms & Controls | Input · Textarea · Select · Combobox · Checkbox · Radio · Switch · Slider · DatePicker · Field · Label |
| 3. Buttons & Actions | Button · ButtonGroup · Toggle · ToggleGroup · Kbd |
| 4. Data Display | Avatar · Badge · Card · Separator · Item · Table · DataTable · Chart |
| 5. Feedback | Alert · Sonner (toast) · Progress · Skeleton · Spinner · Empty |
| 6. Overlays | Dialog · AlertDialog · Sheet · Drawer · Popover · HoverCard · Tooltip · DropdownMenu · ContextMenu · Menubar · Command |
| 7. Navigation | Tabs · Breadcrumb · Pagination · NavigationMenu · Sidebar |
| 8. Disclosure | Accordion · Collapsible |
| 9. Layout | Container · Stack · Grid · AspectRatio · ScrollArea · Resizable · Carousel |
| 10. Patterns | PageHeader · Toolbar · ConfirmDialog · FilterBar · EmptyResults · AppShell · DataTablePage · FormPage |

## What's NOT in this kit

| Topic | Where it lives |
|---|---|
| Brand decisions (colors, fonts, sizes) | `styles/tokens.css` (and the source doc) |
| Business components (e.g. `OrderRow`, `ShipmentCard`) | `features/<area>/components/` |
| Page layouts | `app/<route>/page.tsx` (compose using kit primitives) |
| App-level chrome (header, footer, sidebar wiring) | `app/layout.tsx` (using `AppShell` pattern) |

## Showcase

Visit `/ui-kit` in the running app to see every section, every variant, every state.

If a section looks wrong on `/ui-kit`, it's wrong everywhere. Fix it on `/ui-kit` first, then verify in features.

## Adding a new component

1. **Check if shadcn ships it:** https://ui.shadcn.com/docs/components
2. If yes:
   - `pnpm dlx shadcn@latest add <component>`
   - Find the right section in `app/ui-kit/sections/`, add a demo with all states
   - Re-run the after-checklist
3. If no but you can compose:
   - Create `components/ui/patterns/<name>.tsx` — compose from existing primitives
   - Add to Section 10 (Patterns)
   - Document the composition above
4. If no and can't compose:
   - Hand-author in `components/ui/<name>.tsx` — CVA variants, token-driven, all states
   - Add to the most-fitting section (1–9)
   - Document below in "Hand-authored additions"

Re-invoke the skill (`extend-kit` workflow) to verify and update this doc.

## Hand-authored additions

(none yet — list any non-shadcn components that live in `components/ui/`, with one-line description)

## Dark mode

- **Enabled:** `{{DARK_MODE_ENABLED}}`  (`true` | `false`)
- **Toggle:** `data-theme="dark"` on `<html>` (set via `ThemeProvider`)
- **Verified on:** every section of `/ui-kit`

## RTL

- **Enabled:** `{{RTL_ENABLED}}` (`true` | `false`)
- **Toggle:** `dir="rtl"` on `<html>` (set via `ThemeProvider`)
- **Verified on:** Forms · Navigation · Overlays sections of `/ui-kit` (minimum)

## Framework

- **Detected:** `{{FRAMEWORK}}` (e.g. `next-app-router`, `vite-react`, `remix`)
- **Tailwind version:** `{{TAILWIND_VERSION}}` (`v4` | `v3`)
- **shadcn registry:** `{{SHADCN_STYLE}}` (`new-york` | `default`)

## Versions

- `shadcn` CLI: see `package.json` devDependencies
- `tailwindcss`: see `package.json`
- `@radix-ui/*`: see `package.json`

## History

| Date | Change | By |
|---|---|---|
| `{{SCAFFOLD_DATE}}` | Initial scaffold | shadcn-kit skill |
~~~

## Original workflows/after-you-finish.md

~~~markdown
# Workflow — After You Finish

Verification checklist. Run before declaring any kit work done — scaffold, extend, or feature application.

The kit is not done until 100% of these pass. "It probably works" is not a state the kit can ship in.

## Before you start

Confirm the changed scope: scaffold, extension, or feature application. Open `SKILL.md`, the relevant workflow, and the changed kit files before running the checklist.

## Goal

Catch the predictable failures (hardcoded values, missing states, broken focus, dark-mode regressions) *before* features start consuming the kit.

## Steps

### Tokens & theming

- [ ] **No placeholder marker strings** anywhere in `styles/tokens.css`.
- [ ] **All required tokens defined** in both `:root` and `[data-theme="dark"]`. Cross-check against [`references/tokens-spec.md`](../references/tokens-spec.md) §"Required variables".
- [ ] **Every color value parses.** Render `/ui-kit` Foundations section → no missing swatches.
- [ ] **`--ring` passes WCAG AA** against `--background` and `--card` in both themes (computed in Foundations).
- [ ] **Every `-fg` token passes WCAG AA** against its counterpart in both themes.

### Component-level cleanliness

- [ ] **No hardcoded hex values in `components/ui/`.**
   ```bash
   grep -rE '#[0-9a-fA-F]{3,8}' components/ui/ --include='*.tsx' --include='*.ts'
   ```
   Should return empty. Allowed exceptions: hex literals inside `cva()` strings that resolve through Tailwind utilities (rare; flag for review).

- [ ] **No hardcoded pixel values in `components/ui/`.**
   ```bash
   grep -rE '\b[0-9]+px\b' components/ui/ --include='*.tsx' --include='*.ts'
   ```
   Should return empty. Allowed exceptions: explicit `1px` borders or motion durations where Tailwind utilities don't cover the case.

- [ ] **No `var(--token)` references inside JSX.** Components use Tailwind utilities; the utilities resolve through theme. Direct `var()` is a contract leak.
   ```bash
   grep -rE 'var\(--' components/ui/ --include='*.tsx'
   ```
   Should return empty (or only inside `style={{}}` blocks that have a documented reason).

### Showcase verification

- [ ] **`/ui-kit` renders without console errors.** Open dev tools → no red.
- [ ] **All 10 sections render in order.** Foundations → Patterns. No section skipped, no out-of-order.
- [ ] **Every interactive component shows all states** — default / hover / focus / disabled / loading where applicable. The Button 6×8×5 matrix is fully populated.
- [ ] **Every overlay opens and closes correctly.** Dialog, AlertDialog, Sheet, Drawer, Popover, HoverCard, Tooltip, DropdownMenu, ContextMenu, Menubar, Command — click each trigger.

### Dark mode (if enabled)

- [ ] **Toggle works end-to-end.** Click the theme toggle in `/ui-kit` header → page re-themes immediately, no flash.
- [ ] **Every section re-renders correctly in dark.** Walk all 10. Look for white-on-white, missing borders, broken contrast.
- [ ] **Focus rings still visible in dark.** Tab through forms / buttons in dark mode.
- [ ] **Shadows still readable in dark.** They may need a darker `--shadow-color` in dark mode.
- [ ] **No SSR flash** on first load. With `data-theme` set in `<html>` server-side or via blocking script.

### RTL (if enabled)

- [ ] **Toggle works end-to-end.** Click the RTL toggle → page mirrors immediately.
- [ ] **Forms section** mirrors correctly: labels right-aligned, controls flow RTL, placeholder text aligned.
- [ ] **Overlays section**: dropdowns open on the correct (left) side, menus flow RTL.
- [ ] **Navigation section**: sidebar collapses to the correct side, breadcrumb chevrons mirror, pagination "next" arrow points left.
- [ ] **No layout breakage** in any other section (Cards may need `space-x-*` → `space-x-reverse` adjustments — flag if found).

### Accessibility

- [ ] **Keyboard tab through `/ui-kit`.** Every focusable element receives focus and shows a visible ring.
- [ ] **No focus traps** (Dialog/Sheet excepted — those should trap intentionally and release on close).
- [ ] **Tooltip + HoverCard work on keyboard focus** — not just mouse hover.
- [ ] **Screen reader smoke test**: open VoiceOver / NVDA → tab through Buttons section → labels announced.
- [ ] **All `Field` slots used** in Forms section — label, description, error all rendered to demonstrate.
- [ ] **Color is not the only signal** — error states use icon + text, not just red.

### Mobile / responsive

- [ ] **375px width**: page renders without horizontal scroll on the showcase nav itself.
- [ ] **Sidebar primitive** collapses to `Sheet` at small breakpoints.
- [ ] **Tables** scroll horizontally inside their container, not the page.
- [ ] **Dialogs** respect viewport height; close button reachable.
- [ ] **Drawer** slides up from bottom on mobile (Vaul default).

### Documentation

- [ ] **`UI_KIT.md` exists** at project root and all `{{PLACEHOLDERS}}` are filled.
- [ ] **History table updated** with the date and a one-line description of what changed.
- [ ] **Hand-authored additions section** lists every `components/ui/*` file that wasn't from `shadcn add`.
- [ ] **Sections present table** matches reality — if the kit is missing a section, the table reflects that.

### Repo hygiene

- [ ] **`pnpm install` clean** — `package.json` and lockfile in sync.
- [ ] **`pnpm typecheck`** (or `tsc --noEmit`) passes.
- [ ] **`pnpm lint`** passes (or has only pre-existing unrelated warnings).
- [ ] **`pnpm dev`** starts without errors.
- [ ] **`pnpm build`** succeeds (catches things the dev server hides).
- [ ] **Working tree contains only kit-related changes** — no rogue commits to unrelated files.

### Sister-skill consistency (if both kits are in the project)

- [ ] **Section count matches `ng-bootstrap-kit`.** Both kits have 10 sections.
- [ ] **Component coverage roughly equivalent.** A user of either kit gets the same primitives by name.
- [ ] **`UI_KIT.md` notes both kits** if both are scaffolded in the same project.

## Anti-patterns

- Treating visual spot checks as a substitute for keyboard, dark-mode, RTL, and mobile checks.
- Accepting missing showcase states because the feature that needs them is not built yet.
- Reporting the kit done while `UI_KIT.md` still has placeholder values or stale section coverage.

## Common failures and fixes

| Failure | Cause | Fix |
|---|---|---|
| Foundations swatches all white | tokens.css not imported | Verify `@import "./tokens.css"` in globals.css |
| Buttons all look identical | Tailwind theme extension missing color names | Re-check [`references/tailwind-mapping.md`](../references/tailwind-mapping.md) |
| Dark mode flickers on first paint | `data-theme` set in client effect | Set in `<html>` server-side or via blocking script |
| Focus ring invisible | `--ring` token undefined or outline reset somewhere | Check tokens.css; remove blanket `outline: 0` |
| `Dialog` portal not styled | `globals.css` not imported in root | Verify root layout imports it |
| Lucide icons missing | `lucide-react` not installed | `pnpm add lucide-react` |
| Hot reload doesn't pick up token changes | Vite/Next caching CSS | Hard reload (Cmd+Shift+R) |
| `shadcn add` errors on install | Peer dep mismatch (React version) | Check `pnpm why react`; upgrade if < 18.2 |
| Hardcoded `px` from `cva()` defaults | shadcn ships some `px` in spacing classes | Acceptable for `1px` borders; flag others for follow-up |

## After you finish

Capture the checks run, unresolved risks, and the `/ui-kit` route used for visual verification in the handoff package.

## Definition of Done

- Every checkbox above is checked.
- The user has been shown the `/ui-kit` URL and confirmed it renders.
- `UI_KIT.md` is committed.
- The kit is ready to consume from features (use [`apply-to-feature.md`](apply-to-feature.md) when developers ask for help building things).
~~~

## Original workflows/apply-to-feature.md

~~~markdown
# Workflow — Apply Kit to a Feature

When a developer asks for help building a feature ("a settings page", "a dashboard", "add a search"), this workflow translates their **intent** into a **build plan** that uses the kit's primitives — not invented one-offs.

This is the workflow you run **most often** in a project that already has the kit scaffolded.

## Before you start

Confirm the kit already exists and `/ui-kit` renders. If the project has no kit, route to [`scaffold-kit.md`](scaffold-kit.md) before planning the feature UI.

## Goal

Every line of UI in the new feature uses kit primitives or kit patterns. No new colors, no new spacing values, no new component shapes outside the kit. The feature ships in 30 minutes, not 3 hours, because the kit answers most decisions in advance.

## When to use this

- "Build me a settings page"
- "Add a search to the dashboard"
- "Make a form for creating an order"
- "Show all the shipments in a table"
- "I need a confirm-delete flow"
- "Side panel for editing a row"
- "Profile page with the user's info"

…and anything else that's "build a UI for X."

## When NOT to use this

- "Add a new variant to Button" → use [`extend-kit.md`](extend-kit.md)
- "Set up shadcn from scratch" → use [`scaffold-kit.md`](scaffold-kit.md)
- "Why is the focus ring missing?" → use [`after-you-finish.md`](after-you-finish.md) §"Common failures"
- "Update the brand colors" → edit `styles/tokens.css` directly; no workflow needed

## Steps

### 1. Read what the developer said

Their words. Not your interpretation. Quote them back if it helps:

> "I need a settings page where users can change their name, email, and notification preferences, and delete their account."

Resist the urge to start coding. The next two steps are what make this workflow valuable.

### 2. Translate intent → kit pieces

Open [`references/intent-routing.md`](../references/intent-routing.md). Walk the developer's request and pull the components.

For the example above:

| Their words | Kit pieces |
|---|---|
| "settings page" | `FormPage` pattern (Section 10) — wraps `PageHeader` + `Tabs` + `Card` |
| "change their name, email" | `Field` (label + input + description + error), `Input` |
| "notification preferences" | `Field` + `Switch` per preference |
| "delete their account" | `ConfirmDialog` pattern (Section 10) — destructive variant, requires acknowledgement |
| (implicit) "save the settings" | `Button` (variant `default`), `Sonner` toast on success |

If a piece doesn't map to anything in the catalog or patterns table, **stop and route**:

- Composition gap → consider promoting to a Section 10 pattern via [`extend-kit.md`](extend-kit.md), but only if the composition will be used 2+ times. Otherwise compose inline in the feature, no new pattern.
- Primitive gap → check shadcn upstream + community registries. If still missing, [`extend-kit.md`](extend-kit.md).
- True one-off → compose inline using existing primitives. Don't add to the kit.

### 3. Read the developer's constraints

Beyond the components, the developer often signals constraints in passing. Catch them:

| Signal | Constraint to honor |
|---|---|
| "users on mobile" / "from their phone" | Use `Drawer` not `Dialog`; full-width buttons; `Sheet` for side content |
| "in Arabic" / "for the GCC" | Verify RTL on this feature's specific components; bidi-correct icons (chevrons mirror) |
| "for accessibility" / "screen reader users" | All `Field` slots filled; `aria-label` on icon-only buttons; verify keyboard tab order |
| "fast" / "low-bandwidth" | `Skeleton` placeholders; defer non-critical components; lazy-load `/ui-kit`-style preview routes |
| "show errors clearly" | `Field` error slot + `Sonner` toast; `Alert variant="destructive"` for blocking errors |
| "with their permissions" | Disabled state on actions the user can't take; tooltip explaining why |
| "lots of items" / "long list" | `DataTable` + pagination (not raw `Table`); virtualization if > 1000 rows |
| "multi-step" / "wizard" | `Tabs` programmatic + `Progress` + back/next `Button`s |
| "auto-save" | `Sonner` toast on every save; consider `Spinner` inline per-field |
| "destructive" / "can't be undone" | `AlertDialog` with explicit confirm text typed by user (e.g. "type DELETE") |
| "matching the rest of the app" | Use `AppShell` pattern; don't override page chrome |

These often surface bugs in the kit. If a developer says "for the GCC" and the kit doesn't have RTL set up, that's a kit-level problem to fix first.

### 4. Sketch the page in primitives

Before writing code, write the JSX skeleton — just the imports and component nesting. No props, no logic. This is the build plan.

Example (from intent-routing.md §"Example: Build a settings page"):

```tsx
<FormPage title="Settings" breadcrumbs={[…]}>
  <Tabs defaultValue="profile">
    <TabsList>
      <TabsTrigger value="profile">Profile</TabsTrigger>
      <TabsTrigger value="notifications">Notifications</TabsTrigger>
      <TabsTrigger value="danger">Danger Zone</TabsTrigger>
    </TabsList>

    <TabsContent value="profile">
      <Card>
        <Field label="Name" description="Your full name">
          <Input />
        </Field>
        <Field label="Email">
          <Input type="email" />
        </Field>
        <Button>Save profile</Button>
      </Card>
    </TabsContent>

    <TabsContent value="notifications">
      <Card>
        <Field label="Email notifications" description="Daily summary">
          <Switch />
        </Field>
      </Card>
    </TabsContent>

    <TabsContent value="danger">
      <Card>
        <ConfirmDialog
          trigger={<Button variant="destructive">Delete account</Button>}
          title="Delete account?"
          description="This cannot be undone."
          confirmLabel="Delete"
        />
      </Card>
    </TabsContent>
  </Tabs>
</FormPage>
```

Show this skeleton to the developer (or, in auto mode, proceed with it). Confirm it matches what they want before adding props/logic.

### 5. Check imports

Every import comes from `@/components/ui/...` or `@/components/ui/patterns/...`. If you find yourself reaching for:

- `import "lib-not-in-package-json"` — stop, that's a new dependency, not a kit decision
- `import { CustomButton } from "../local-button"` — stop, the kit's `Button` covers this
- `import "./feature.css"` — almost always wrong; tokens + Tailwind cover styling

### 6. Add the feature logic

Wire `react-hook-form` + `zod` for forms (kit doesn't ship them but the project's `frontend-react` skill mandates them). Connect to API. Handle loading / error states using the kit's `Skeleton` / `Spinner` / `Alert` / `Sonner`.

For sequential steps (form submission with multiple states):

```tsx
const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");

// In the button:
<Button disabled={state === "saving"}>
  {state === "saving" && <Spinner className="mr-2" />}
  {state === "saving" ? "Saving…" : "Save"}
</Button>

// On success:
toast.success("Profile saved");
```

### 7. Verify on `/ui-kit` first if uncertain

If you're using a primitive you haven't touched before, **open `/ui-kit` in the browser and look at it** before placing it in the feature. The showcase shows you exactly how every variant + state looks with the project's tokens. No surprises.

### 8. Verify the feature

- Tab through the feature with the keyboard. Every focusable element shows the focus ring.
- Toggle dark mode. The feature still looks right.
- Toggle RTL (if enabled). Forms flow correctly.
- Resize to 375px wide. Layout adapts (or `Drawer` substitutes for `Dialog`).

### 9. If something's missing from the kit

If during the build you needed a primitive or pattern the kit doesn't have:

- Stop the feature work
- Run [`extend-kit.md`](extend-kit.md) to add it properly (with showcase entry, `UI_KIT.md` doc, all states)
- Resume the feature, importing from the kit

Do **NOT** add the missing piece inline in the feature and "promote later." Promoting later never happens. The kit accretes one-offs and stops being the contract.

## Anti-patterns

- ❌ "Just use a `<div>` with custom classes" instead of finding the kit primitive. Forbidden.
- ❌ Importing a new icon library because Lucide doesn't have the icon. The kit ships one icon library. Pick a Lucide icon that's close enough, or use `IconButton` with text.
- ❌ Adding `mt-7` because none of the spacing tokens "feel right." Pick the closest token. The kit's rhythm depends on token discipline.
- ❌ "I'll just hardcode this brand color here, it's a one-off." Brand colors live in `tokens.css`. Always.
- ❌ Building a "custom dialog" because the kit's `Dialog` "doesn't quite fit." It does fit. Read the API.
- ❌ Skipping intent routing because the request seems obvious. The discipline of routing catches assumptions early.
- ❌ Adding the feature's components to `components/ui/`. Feature components live in `features/<area>/components/`.

## After you finish

Capture the primitive routing, any kit gaps, feature verification, and whether `extend-kit.md` was used before handing off to QA or code review.

## Definition of Done

- Every UI piece in the feature imports from `@/components/ui/...` (or `@/components/ui/patterns/...`).
- Zero hardcoded hex/px in the feature's component files.
- Loading / empty / error states use the kit's `Skeleton` / `Empty` / `Alert` / `Sonner`.
- Keyboard tab-through reveals focus on every focusable element.
- Dark mode + RTL (if enabled) work without per-component overrides.
- Mobile (375px) layout adapts using kit primitives.
- If anything was missing, it was added to the kit via [`extend-kit.md`](extend-kit.md), not invented inline.

## Worked example: "Build a dashboard"

Developer: *"I need a dashboard showing the user's last 7 days of orders, total revenue this month, count of pending shipments, and a chart of orders per day. It should work on mobile."*

Routing:

| Need | Kit piece |
|---|---|
| "user's last 7 days of orders" → KPI tile | `Card` + large number + `Badge` for "7 days" |
| "total revenue this month" → KPI tile | `Card` + currency + `Badge` for delta vs. last month |
| "count of pending shipments" → KPI tile | `Card` + number + `Badge` (warning variant if > threshold) |
| "chart of orders per day" → time-series viz | `Chart` (line variant) |
| "show all this together" → page skeleton | `PageHeader` + `Container` + `Grid` (3 KPI cards) + chart card below |
| "should work on mobile" → responsive constraint | `Grid` collapses 3-col → 1-col at sm breakpoint |
| (implicit) "loading state while fetching" | `Skeleton` for each KPI + `Skeleton` for chart |
| (implicit) "no data yet" | `Empty` pattern with "Create your first order" action |

Sketch:

```tsx
<Container>
  <PageHeader title="Dashboard" />

  <Grid cols={3} gap="md" className="mt-6">
    <Card>
      <CardHeader>Orders (last 7 days)</CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-12 w-24" /> : <p className="text-4xl font-bold">{orderCount}</p>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>Revenue this month</CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-12 w-32" /> : (
          <>
            <p className="text-4xl font-bold">{revenue}</p>
            <Badge variant={delta >= 0 ? "default" : "destructive"}>
              {delta >= 0 ? "+" : ""}{delta}% vs last month
            </Badge>
          </>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>Pending shipments</CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-12 w-16" /> : (
          <>
            <p className="text-4xl font-bold">{pendingCount}</p>
            {pendingCount > 50 && <Badge variant="destructive">Action needed</Badge>}
          </>
        )}
      </CardContent>
    </Card>
  </Grid>

  <Card className="mt-6">
    <CardHeader>Orders per day</CardHeader>
    <CardContent>
      {loading ? <Skeleton className="h-64 w-full" /> :
       data.length === 0 ? <EmptyResults message="No orders yet" action={…} /> :
       <Chart type="line" data={data} />}
    </CardContent>
  </Card>
</Container>
```

Built in primitives only. Mobile handled by `Grid` collapsing. Loading + empty handled with kit pieces. Zero custom CSS, zero hardcoded values, zero new components.

That's how every feature should land.
~~~

## Original workflows/before-you-start.md

~~~markdown
# Workflow — Before You Start

Run this checklist before scaffolding, extending, or applying the kit. Every item must pass or be explicitly waived. If something fails, **stop** and fix it — don't proceed and hope.

## Before you start

Open `SKILL.md`, identify whether the task is scaffold, showcase, extension, or feature application, and confirm the project root before inspecting files.

## Goal

Confirm the project is in a state where the skill can do useful work. Catch missing prerequisites *before* writing files.

## Steps

### Project shape

- [ ] **Framework detected.** Read `package.json`. Confirm one of: `next` (App or Pages Router), `vite`, `@remix-run/*`, `astro`. If none, ask the user which framework — don't guess.
- [ ] **Node at the recommended baseline.** Use the LTS recorded in `/standards/framework-baselines.md` § Node.js. Check with `node -v`. shadcn CLI requires a current LTS.
- [ ] **Package manager identified.** Look for `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` / `package-lock.json`. Use the matching command throughout.
- [ ] **TypeScript present.** `tsconfig.json` exists. shadcn-kit is TS-only.
- [ ] **`@/*` path alias set.** Check `tsconfig.json` `compilerOptions.paths`. If missing, add it. (Vite also needs it in `vite.config.ts`.)

### Tailwind

- [ ] **Tailwind installed.** `tailwindcss` in `package.json`. If not, install **Tailwind v4**: `pnpm add -D tailwindcss @tailwindcss/postcss postcss`.
- [ ] **Tailwind version recorded.** `pnpm why tailwindcss` → note v3 or v4. Templates differ; pick the right one.
- [ ] **PostCSS configured.** `postcss.config.{js,mjs,ts}` exists or v4's PostCSS plugin is wired.
- [ ] **Content globs include the source dirs.** v3: `tailwind.config.ts` `content`. v4: nothing — Tailwind v4 auto-discovers.

### shadcn

- [ ] **`components.json` present.** If not, run `pnpm dlx shadcn@latest init` — answer the prompts, but **stop after init** and return to this checklist.
- [ ] **Style chosen.** `components.json` → `style: "new-york"` (kit default) or `"default"`. Document choice in `UI_KIT.md`.
- [ ] **Aliases match `tsconfig.json`.** `components.json` `aliases.*` use `@/...`; `tsconfig.json` `paths` resolve `@/*` to the same root.
- [ ] **Icon library set.** `components.json` → `iconLibrary: "lucide"` (kit default). If brand mandates a different library, set it but be aware: every section's icon usage will need a matching library import.

### Existing kit inventory

- [ ] **List `components/ui/`.** `ls components/ui/` (or `src/components/ui/`).
- [ ] **For each existing component, decide:** keep / overwrite / merge.
   - **Keep:** never re-run `shadcn add` on it. Note in `UI_KIT.md` "Hand-authored additions".
   - **Overwrite:** confirm with user — `shadcn add` overwrites without backup. Show the diff if possible.
   - **Merge:** rare — only if the existing component has critical project-specific code. Manually port the code into the freshly-installed file.
- [ ] **List existing `app/ui-kit/` (if any).** If the showcase exists from a prior run, default to **extend** (`extend-kit.md` workflow), not re-scaffold.

### Tokens

- [ ] **Source identified.** Where do tokens come from? Options:
   1. A brand spec doc (e.g. `docs/specs/<brand>-design-system.md`) — preferred
   2. A designer's filled `tokens.css` — copy it
   3. Nothing yet — generate the blank template and **stop**, hand off to the user/designer to fill, re-invoke when filled
- [ ] **If token file exists, validate:**
   - Every variable from [`references/tokens-spec.md`](../references/tokens-spec.md) §"Required variables" is present
   - No placeholder marker strings remain
   - Every color value parses (run a CSS-parse check or eyeball)
   - Light + dark both defined for every brand / neutral / semantic / surface token

If validation fails, stop. Surface the missing variables to the user.

### Dark mode + RTL

- [ ] **Dark mode requirement confirmed.** `required` / `optional` / `none`. Default `optional` (light + dark generated, toggle wired up but kit works without it).
- [ ] **RTL requirement confirmed.** `required` / `optional` / `none`. Default `optional`. If the project serves Arabic/Hebrew/Farsi/Urdu users, this is `required`.

### Repo state

- [ ] **Working tree is clean** (`git status`). The skill writes many files; mixing them with unrelated changes makes review impossible.
- [ ] **You're on a feature branch**, not `main` / `master`. `git branch --show-current`.

## Anti-patterns

- ❌ Running `shadcn add` to "see what happens" before this checklist completes. shadcn writes files immediately and overwrites without prompting.
- ❌ Generating tokens.css with placeholder colors "to see the layout." The Foundations section will display contrast warnings; the kit looks broken; everyone loses confidence in the kit before it's been fairly tested.
- ❌ Skipping the existing-kit inventory. Overwriting a hand-tuned `Button.tsx` with the default version costs hours to recover from.
- ❌ Starting on `main`. Even with auto mode, the kit scaffold is a multi-file change that deserves its own PR.

## After you finish

Record the detected framework, Tailwind version, shadcn style, token path, package manager, and any waived prerequisite before moving to another workflow.

## Definition of Done

- Every checkbox is checked or explicitly waived (with the user's confirmation in chat).
- A summary message to the user states: framework, package manager, Tailwind version, shadcn style, dark mode mode, RTL mode, tokens source, existing-kit inventory.
- Either: tokens are validated and ready (proceed to `scaffold-kit.md`), OR the blank template was generated and the workflow exits with "fill these N variables, then re-invoke me."
~~~

## Original workflows/build-showcase.md

~~~markdown
# Workflow — Build Showcase

Construct the `/ui-kit` page and its 10 section files. Run after `scaffold-kit.md` (primitives installed) or as part of an existing kit refresh.

## Before you start

Run [`before-you-start.md`](before-you-start.md) and confirm tokens, Tailwind, shadcn, aliases, dark mode, RTL expectations, and existing component inventory are known.

## Goal

Every primitive in `components/ui/` is rendered on the showcase, in every variant, every state, in both themes if dark mode is enabled. The showcase IS the kit's verification — if it renders correctly, the kit works.

## Steps

### 1. Set up route shell

Per [`references/framework-adapters.md`](../references/framework-adapters.md), create the route directory:

| Framework | Path |
|---|---|
| `next-app-router` | `app/ui-kit/` |
| `next-pages-router` | `pages/ui-kit/` |
| `vite-react` | `src/routes/UiKit.tsx` + section files in `src/routes/ui-kit-sections/` |
| `remix` | `app/routes/ui-kit.tsx` + nested section routes |
| `astro` | `src/pages/ui-kit.astro` + `src/components/UiKit.tsx` island |

### 2. Copy the page template

Copy [`templates/ui-kit-page.tsx.tmpl`](../templates/ui-kit-page.tsx.tmpl) → the route's `page.tsx` (or framework equivalent).

For `next-app-router`: also create `app/ui-kit/layout.tsx` that bypasses the app shell:

```tsx
// app/ui-kit/layout.tsx
import "../globals.css";

export default function UiKitLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

### 3. Add toggles

Create `app/ui-kit/theme-toggle.tsx` and `app/ui-kit/rtl-toggle.tsx` (omit either if the corresponding mode is `none`).

```tsx
// app/ui-kit/theme-toggle.tsx
"use client";
import { useTheme } from "@/components/theme-provider";
import { Toggle } from "@/components/ui/toggle";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Toggle pressed={theme === "dark"} onPressedChange={toggleTheme} aria-label="Toggle theme">
      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Toggle>
  );
}
```

```tsx
// app/ui-kit/rtl-toggle.tsx
"use client";
import { useTheme } from "@/components/theme-provider";
import { Toggle } from "@/components/ui/toggle";

export function RtlToggle() {
  const { direction, toggleDirection } = useTheme();
  return (
    <Toggle pressed={direction === "rtl"} onPressedChange={toggleDirection} aria-label="Toggle direction">
      {direction === "rtl" ? "RTL" : "LTR"}
    </Toggle>
  );
}
```

### 4. Build each section

For each of the 10 sections, create `app/ui-kit/sections/<name>.tsx`. The section file follows the structure in [`references/showcase-page.md`](../references/showcase-page.md) §"Per-section structure".

Order to build (start with Foundations — it's the smoke test):

1. **`foundations.tsx`** — color swatches with WCAG ratios, type scale, spacing bars, radius squares, shadow cards, motion demos, icon set
2. **`buttons-actions.tsx`** — the 6×8×5 Button matrix, ButtonGroup, Toggle, ToggleGroup, Kbd
3. **`forms-controls.tsx`** — every input rendered in default / hover / focus / disabled / error / loading states
4. **`data-display.tsx`** — Avatar, Badge variants, Card with all slots, Separator orientations, Item rows, Table, DataTable with pagination + sort, Chart (3 types)
5. **`feedback.tsx`** — Alert variants, Sonner trigger, Progress 0/30/70/100, Skeleton layouts, Spinner sizes, Empty with/without action
6. **`overlays.tsx`** — every overlay with a trigger button + nested content
7. **`navigation.tsx`** — Tabs (both orientations), Breadcrumb, Pagination, NavigationMenu, Sidebar (expanded + collapsed)
8. **`disclosure.tsx`** — Accordion (single + multiple), Collapsible
9. **`layout.tsx`** — Container, Stack, Grid, AspectRatio (3 ratios), ScrollArea (h+v overflow), Resizable (2-pane + 3-pane), Carousel
10. **`patterns.tsx`** — every Section 10 pattern with realistic placeholder data

After each section is built, **reload `/ui-kit` and verify visually** before moving to the next. Don't batch — catch issues early.

### 5. States demo discipline

Every interactive component is rendered in its full state matrix. See [`references/showcase-page.md`](../references/showcase-page.md) §"States demo discipline" for the canonical layout pattern.

The Button section is the hardest because it's a 6×8×5 matrix. Don't skip cells. The visual review of that grid catches more bugs than any other section combined.

### 6. Foundations: contrast ratios

The Foundations section MUST display computed WCAG contrast ratios next to each brand/foreground pair. Use this helper:

```tsx
// app/ui-kit/sections/_contrast.ts
function contrastRatio(fg: string, bg: string): number {
  // Simple approximation — for full WCAG, use a real algorithm.
  // Implementation left to scaffolding step or pull from a library like 'wcag-contrast'.
  return 0;
}

export function ContrastBadge({ fg, bg }: { fg: string; bg: string }) {
  const ratio = contrastRatio(fg, bg);
  const passes = ratio >= 4.5;
  return (
    <span className={passes ? "text-success" : "text-destructive"}>
      {ratio.toFixed(2)}:1 {passes ? "AA ✓" : "AA ✗"}
    </span>
  );
}
```

If any pair fails AA, the kit is not done. Fix tokens and re-validate.

### 7. RTL verification (if RTL enabled)

Toggle RTL in the showcase header. Sections 2 (Forms), 6 (Overlays), 7 (Navigation) MUST render correctly mirrored. Walk each one and confirm:

- Form labels and controls flow right-to-left
- Dropdown menus open on the correct side
- Pagination "next" arrow points left (mirrored)
- Sidebar collapses to the correct side

Other sections are tested as time allows but those three are the hard requirement.

### 8. Dark mode verification (if dark mode enabled)

Toggle dark mode in the showcase header. Walk all 10 sections. Look for:

- Color swatches show the dark palette
- Contrast ratios still pass AA
- Focus rings still visible against `--background` and `--card`
- Shadows still readable (shadow-color may need adjustment in dark mode)
- No "white card on dark page" mismatches

### 9. Mobile verification

Resize the browser to 375px wide. Walk all 10 sections. Look for:

- Showcase nav collapses to top
- Sidebar primitive collapses to Sheet
- Tables scroll horizontally instead of breaking layout
- Dialogs respect viewport height

## Anti-patterns

- ❌ Building all 10 sections before reloading. Errors cascade — the second-to-last section breaks everything below it and you don't know why.
- ❌ Skipping the Button matrix. Buttons are 80% of UI; their state matrix is the most important thing on the page.
- ❌ Using real data ("here's the actual user list"). Couples the kit to a feature; review becomes about the data, not the kit.
- ❌ Wrapping the showcase in the app shell. The kit should look the same regardless of app — bypass the shell.
- ❌ Hardcoding colors in section files for "demo purposes." The whole point is that the kit re-themes via tokens.

## After you finish

Record the `/ui-kit` URL, section coverage, dark-mode and RTL results, mobile result, and any token corrections made while building the showcase.

## Definition of Done

- All 10 section files exist under `app/ui-kit/sections/`.
- The dev server runs without errors.
- Visiting `/ui-kit` shows all sections, in order, with no console errors.
- Theme toggle works end-to-end (if dark mode enabled).
- RTL toggle works on Forms / Overlays / Navigation (if RTL enabled).
- All contrast ratios in Foundations pass AA, in both themes.
- Mobile (375px) renders without horizontal scroll on the page itself (individual scroll-on-overflow components excepted).
- Ready to run [`after-you-finish.md`](after-you-finish.md).
~~~

## Original workflows/extend-kit.md

~~~markdown
# Workflow — Extend Kit

Add a new component, variant, or pattern to an existing kit. Use this when:

- The user asks for a primitive that's not in `components/ui/` yet
- A new shadcn release added a component the kit should adopt
- A pattern is being used in 2+ features and should be promoted to Section 10
- The brand needs a new variant on an existing primitive

**Don't use this workflow to add one-off feature components.** Those live in `features/<area>/components/`. The kit is for things ≥ 2 consumers will use.

## Before you start

Confirm the request is a reusable primitive, variant, or pattern. If it has only one consumer, keep it in the feature unless the product team explicitly accepts kit ownership.

## Goal

The new piece is added to the right section, follows kit conventions (tokens, CVA, all states), is documented in `UI_KIT.md`, and renders on `/ui-kit`.

## Steps

### 1. Decide where it goes

Re-read [`references/sections-catalog.md`](../references/sections-catalog.md) and pick the section.

| If the new piece is... | It goes in section... |
|---|---|
| A form field type (e.g. `MultiSelect`) | 2 — Forms & Controls |
| A click target variant (e.g. `IconButton` if not already there) | 3 — Buttons & Actions |
| A way to display data (e.g. `Timeline`) | 4 — Data Display |
| User-facing status (e.g. `Toast` variant) | 5 — Feedback |
| A floating panel (e.g. `Notification` popover) | 6 — Overlays |
| A wayfinding control (e.g. `MegaMenu` if not in NavigationMenu) | 7 — Navigation |
| Show/hide content (e.g. `Reveal`) | 8 — Disclosure |
| A layout primitive (e.g. `Masonry`) | 9 — Layout |
| A composition of 2+ primitives (e.g. `SettingsPage`) | 10 — Patterns |

If it doesn't fit any section, **stop and reconsider** — you might be trying to add a feature component, not a kit component.

### 2. Check for upstream

Does shadcn ship it?

1. Visit https://ui.shadcn.com/docs/components — re-fetch, the catalog moves
2. If yes:
   - `pnpm dlx shadcn@latest add <component>`
   - Skip to step 4
3. If no, check community registries: https://ui.shadcn.com/docs/registry
   - If a high-quality registry has it, install via the registry's CLI
   - Document the registry in `UI_KIT.md` "Hand-authored additions" with the registry URL
4. If still no, hand-author (next step)

### 3. Hand-author (if no upstream)

Create `components/ui/<name>.tsx` (or `components/ui/patterns/<name>.tsx` for Section 10).

Conventions (non-negotiable):

- **CVA-based variants** if the component has shape/size variation. Variant names match shadcn's convention (`default | secondary | outline | ghost | destructive | link` for buttons, etc.).
- **`forwardRef`** for any component that wraps a focusable element.
- **`displayName` set.**
- **Token-driven only.** Tailwind utilities that resolve through the theme — no `bg-[#abc]`, no `p-[7px]`.
- **Includes all states** the component supports — default / hover / focus / disabled / loading where applicable.
- **TypeScript strict.** Props typed; no `any`; export the props type.

Example skeleton:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const myComponentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: { default: "...", outline: "..." },
      size: { default: "...", sm: "...", lg: "..." },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface MyComponentProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}

export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div ref={ref} className={cn(myComponentVariants({ variant, size }), className)} {...props} />
  )
);
MyComponent.displayName = "MyComponent";
```

### 4. Add a variant to an existing component (alternate path)

If the user wants a brand-specific variant (e.g. `Button` with an "uppercase pill" variant):

- Re-read [`references/shadcn-recipes.md`](../references/shadcn-recipes.md) §"Wrapping pattern"
- Edit the existing `components/ui/<name>.tsx` in place
- Add the new entry to `variant.variant` (or `size`, etc.) in the CVA call
- **Don't create a new `BrandButton.tsx`** — wrap only if the upstream takes a prop the brand never wants exposed

### 5. Add to the showcase

Open `app/ui-kit/sections/<matching-section>.tsx`. Add a sub-section for the new component, following [`references/showcase-page.md`](../references/showcase-page.md) §"Per-section structure".

For interactive components, render the full state matrix (default / hover / focus / disabled / loading where applicable) — see [`references/showcase-page.md`](../references/showcase-page.md) §"States demo discipline".

For new variants on existing components, add them to the existing matrix — don't make a separate sub-section.

### 6. Update `UI_KIT.md`

Open `UI_KIT.md` at project root. Add a row to the "Sections present" table if a new component was added. If a new pattern was added, add a row in Section 10.

If hand-authored (no upstream), add an entry under "Hand-authored additions" with a one-line description and the date.

Append to the History table:

| Date | Change | By |
|---|---|---|
| `YYYY-MM-DD` | Added `<ComponentName>` to Section N | extend-kit |

### 7. Verify

Reload `/ui-kit`. Confirm:

- New component renders in the right section
- All states demo'd
- Light + dark both work (toggle and verify)
- RTL works for the affected sections (if RTL enabled)
- No console errors
- No hardcoded hex/px (run the after-checklist grep)

### 8. Run the after-you-finish subset

You don't need the full [`after-you-finish.md`](after-you-finish.md) for an extend, but **do** run these subset checks:

- [ ] No hardcoded hex/px in the new file
- [ ] Focus ring visible on the new component if interactive
- [ ] WCAG contrast passes for new color combinations
- [ ] Component shows in `/ui-kit` correctly in both themes (if dark enabled)

## Anti-patterns

- ❌ Adding to "wherever it fits" without picking a section. Section assignment is part of the kit's contract.
- ❌ Hand-authoring before checking shadcn upstream. Re-inventing what already exists is the most common kit mistake.
- ❌ Forking an existing component to add a variant. Edit in place via CVA.
- ❌ Skipping the showcase update. A component that isn't on `/ui-kit` is invisible — features won't know it exists.
- ❌ Creating a new section for one new component. Sections are fixed at 10. Find the right home.
- ❌ Adding a one-off pattern to Section 10 before there are 2 real consumers. Promote when reuse is proven, not predicted.

## After you finish

Record the section, files changed, source of the component (upstream, registry, or hand-authored), verification evidence, and any new usage constraints in `UI_KIT.md`.

## Definition of Done

- New component / variant / pattern exists in the right section under `components/ui/`.
- Showcase renders it correctly in all states + both themes.
- `UI_KIT.md` documents it and the History table is updated.
- The afterchecklist subset passes.
~~~

## Original workflows/scaffold-kit.md

~~~markdown
# Workflow — Scaffold Kit

Wire tokens, install primitives, build all 10 sections. The main flow.

**Run [`before-you-start.md`](before-you-start.md) first.** This workflow assumes its checklist passed.

## Before you start

Use the recorded preflight output from [`before-you-start.md`](before-you-start.md): framework, package manager, Tailwind version, shadcn status, aliases, token path, dark mode, RTL, and component inventory.

## Goal

A fresh project goes from "no kit" to "all 10 sections render at `/ui-kit` with the brand applied" in one session.

## Steps

### 1. Validate tokens

Re-read [`references/tokens-spec.md`](../references/tokens-spec.md) §"Validation rules" and apply each to `styles/tokens.css` (or wherever the user's filled tokens live).

If any rule fails, **stop**. Don't proceed with broken tokens.

### 2. Place tokens

Copy the user's filled tokens to the framework-conventional location:

| Framework | Path |
|---|---|
| `next-app-router` | `app/styles/tokens.css` (or `styles/tokens.css` at root) |
| `next-pages-router` | `src/styles/tokens.css` |
| `vite-react` | `src/styles/tokens.css` |
| `remix` | `app/styles/tokens.css` |
| `astro` | `src/styles/tokens.css` |

### 3. Wire globals.css

Copy [`templates/globals.css.tmpl`](../templates/globals.css.tmpl) to the framework-conventional location:

| Framework | Path |
|---|---|
| `next-app-router` | `app/globals.css` |
| `next-pages-router` | `src/styles/globals.css` |
| `vite-react` | `src/index.css` |
| `remix` | `app/styles/globals.css` |
| `astro` | `src/styles/globals.css` |

Adjust the `@import "./tokens.css";` path if needed for the layout.

For Tailwind v3 projects: also copy [`templates/tailwind.config.ts.tmpl`](../templates/tailwind.config.ts.tmpl) to `tailwind.config.ts` and **delete the v4 `@theme` block** from `globals.css`.

### 4. Wire root layout

Ensure the root file imports `globals.css`:

| Framework | File | Import to add |
|---|---|---|
| `next-app-router` | `app/layout.tsx` | `import "./globals.css";` |
| `next-pages-router` | `pages/_app.tsx` | `import "@/styles/globals.css";` |
| `vite-react` | `src/main.tsx` | `import "./index.css";` |
| `remix` | `app/root.tsx` | Add to `links()` |
| `astro` | `src/layouts/Layout.astro` | `import "../styles/globals.css";` in frontmatter |

### 5. Add ThemeProvider (if dark mode != "none")

Copy [`templates/theme-provider.tsx.tmpl`](../templates/theme-provider.tsx.tmpl) to `components/theme-provider.tsx`.

Wrap the root in it:

```tsx
// next-app-router example
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### 6. Install shadcn primitives — by section

Walk [`references/sections-catalog.md`](../references/sections-catalog.md) section by section. For each component listed, run `shadcn add <name>` IF it isn't already in `components/ui/` (per the inventory from `before-you-start.md`).

Use this exact order — installing a section at a time keeps the diffs reviewable:

```bash
# Section 2 — Forms & Controls
pnpm dlx shadcn@latest add input textarea native-select select combobox checkbox radio-group switch slider date-picker calendar field label input-group input-otp

# Section 3 — Buttons & Actions
pnpm dlx shadcn@latest add button button-group toggle toggle-group kbd

# Section 4 — Data Display
pnpm dlx shadcn@latest add avatar badge card separator item table data-table chart

# Section 5 — Feedback
pnpm dlx shadcn@latest add alert sonner progress skeleton spinner empty

# Section 6 — Overlays
pnpm dlx shadcn@latest add dialog alert-dialog sheet drawer popover hover-card tooltip dropdown-menu context-menu menubar command

# Section 7 — Navigation
pnpm dlx shadcn@latest add tabs breadcrumb pagination navigation-menu sidebar

# Section 8 — Disclosure
pnpm dlx shadcn@latest add accordion collapsible

# Section 9 — Layout
pnpm dlx shadcn@latest add aspect-ratio scroll-area resizable carousel
```

Confirm each install before moving on. If the CLI errors, stop and resolve — don't continue with a half-installed section.

### 7. Hand-author missing primitives

Some primitives shadcn doesn't ship — write them once, document them in `UI_KIT.md`. The kit needs:

| Component | Where | Why |
|---|---|---|
| `Container` | `components/ui/container.tsx` | Width-capped wrapper, token-driven padding |
| `Stack` | `components/ui/stack.tsx` | Vertical/horizontal flex with token gap |
| `Grid` | `components/ui/grid.tsx` | CSS grid with column / gap props |
| `Banner` | `components/ui/banner.tsx` | Page-level banner (Section 5 — distinct from `Alert`) |

Reference [`references/shadcn-recipes.md`](../references/shadcn-recipes.md) §"Wrapping pattern" for CVA conventions.

### 8. Compose Section 10 patterns

Per [`references/sections-catalog.md`](../references/sections-catalog.md) Section 10, compose these in `components/ui/patterns/`:

- `page-header.tsx`
- `toolbar.tsx`
- `confirm-dialog.tsx`
- `filter-bar.tsx`
- `empty-results.tsx`
- `app-shell.tsx`
- `data-table-page.tsx`
- `form-page.tsx`

Each pattern is composed of primitives. No new variants. No new colors. The pattern is just a typed React component that combines kit pieces in a repeatable shape.

### 9. Build the showcase route

Run [`build-showcase.md`](build-showcase.md). It produces `app/ui-kit/page.tsx` and the 10 section files.

### 10. Write `UI_KIT.md`

Copy [`templates/ui-kit.md.tmpl`](../templates/ui-kit.md.tmpl) to project root. Fill the placeholders:

- `{{TOKENS_SOURCE}}` — path to brand spec OR "filled by hand on YYYY-MM-DD"
- `{{BRAND_NAME}}` — e.g. "AD Ports — Corporate"
- `{{PRIMARY_VALUE}}` — the actual `--brand-primary` value
- `{{LAST_EDIT_DATE}}` — today
- `{{DARK_MODE_ENABLED}}` — `true` / `false`
- `{{RTL_ENABLED}}` — `true` / `false`
- `{{FRAMEWORK}}` — detected framework
- `{{TAILWIND_VERSION}}` — `v4` or `v3`
- `{{SHADCN_STYLE}}` — `new-york` or `default`
- `{{SCAFFOLD_DATE}}` — today

### 11. Run after-you-finish

Run [`after-you-finish.md`](after-you-finish.md). The kit is not done until that checklist passes 100%.

## Anti-patterns

- ❌ Installing all components in one giant CLI call. The diff is unreviewable; one component's failure cascades.
- ❌ Skipping hand-authored primitives because "we can add them later." Section 9 (Layout) needs them on day one.
- ❌ Inventing variants during scaffold. The kit ships with shadcn defaults; brand-specific variants come *after* the kit is verified working.
- ❌ Customizing CVAs in the same session as the install. Confirm the default works first, then iterate.
- ❌ Generating Section 10 patterns before Sections 1–9 are confirmed working. Patterns assume primitives work.

## After you finish

Record installed primitives, hand-authored primitives, Section 10 patterns, token file path, framework wiring, and any setup choices in `UI_KIT.md`.

## Definition of Done

- All sections of [`references/sections-catalog.md`](../references/sections-catalog.md) have their primitives installed or hand-authored.
- All Section 10 patterns exist in `components/ui/patterns/`.
- `globals.css` is wired and the root layout imports it.
- `ThemeProvider` wraps the root if dark mode is enabled.
- `UI_KIT.md` exists with all placeholders filled.
- The dev server runs without errors (`pnpm dev` and visit `/`).
- Ready to run [`build-showcase.md`](build-showcase.md) to populate `/ui-kit`.
~~~

