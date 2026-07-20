# Workflow — Extend Kit

Add a new component, variant, or pattern to an existing kit. Use this when:

- The user asks for a primitive that's not in `components/ui/` yet
- A new shadcn release added a component the kit should adopt
- A pattern is being used in 2+ features and should be promoted to Section 10
- The brand needs a new variant on an existing primitive

**Don't use this workflow to add one-off feature components.** Those live in `features/<area>/components/`. The kit is for things ≥ 2 consumers will use.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
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
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- New component / variant / pattern exists in the right section under `components/ui/`.
- Showcase renders it correctly in all states + both themes.
- `UI_KIT.md` documents it and the History table is updated.
- The afterchecklist subset passes.
