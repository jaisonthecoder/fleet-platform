# Workflow — Build Showcase

Construct the `/ui-kit` page and its 10 section files. Run after `scaffold-kit.md` (primitives installed) or as part of an existing kit refresh.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
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
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- All 10 section files exist under `app/ui-kit/sections/`.
- The dev server runs without errors.
- Visiting `/ui-kit` shows all sections, in order, with no console errors.
- Theme toggle works end-to-end (if dark mode enabled).
- RTL toggle works on Forms / Overlays / Navigation (if RTL enabled).
- All contrast ratios in Foundations pass AA, in both themes.
- Mobile (375px) renders without horizontal scroll on the page itself (individual scroll-on-overflow components excepted).
- Ready to run [`after-you-finish.md`](after-you-finish.md).
