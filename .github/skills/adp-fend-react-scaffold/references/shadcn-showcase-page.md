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
