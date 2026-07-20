# Workflow — Apply Kit to a Feature

When a developer asks for help building a feature ("a settings page", "a dashboard", "add a search"), this workflow translates their **intent** into a **build plan** that uses the kit's primitives — not invented one-offs.

This is the workflow you run **most often** in a project that already has the kit scaffolded.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
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
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

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
