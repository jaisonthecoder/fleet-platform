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
