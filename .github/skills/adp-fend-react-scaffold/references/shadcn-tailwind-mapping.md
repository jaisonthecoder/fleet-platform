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
