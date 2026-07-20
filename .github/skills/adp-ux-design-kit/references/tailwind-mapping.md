# Tailwind Mapping

Use this reference when `adp-ux-design-kit` is applied to a React, shadcn, or Tailwind implementation. It maps the design-kit token contract to Tailwind theme keys and usage rules so components consume semantic utilities instead of raw CSS variables.

## Required Inputs

- `references/shadcn-tokens-spec.md`
- `references/shadcn-sections-catalog.md`
- Project Tailwind config (`tailwind.config.*` or framework equivalent)
- Token file path, usually `app/globals.css`, `src/index.css`, or `styles/tokens.css`

## Theme Extension

Map token names to Tailwind color keys using `hsl(var(--token))`, `rgb(var(--token))`, `oklch(var(--token))`, or the color format already used by the repository. Keep the Tailwind key stable even when brand values change.

```js
theme: {
  extend: {
    colors: {
      background: "var(--background)",
      foreground: "var(--foreground)",
      card: {
        DEFAULT: "var(--card)",
        foreground: "var(--card-fg)",
      },
      popover: {
        DEFAULT: "var(--popover)",
        foreground: "var(--popover-fg)",
      },
      primary: {
        DEFAULT: "var(--brand-primary)",
        foreground: "var(--brand-primary-fg)",
      },
      secondary: {
        DEFAULT: "var(--brand-secondary)",
        foreground: "var(--brand-secondary-fg)",
      },
      accent: {
        DEFAULT: "var(--brand-accent)",
        foreground: "var(--brand-accent-fg)",
      },
      muted: {
        DEFAULT: "var(--muted)",
        foreground: "var(--muted-fg)",
      },
      destructive: {
        DEFAULT: "var(--destructive)",
        foreground: "var(--destructive-fg)",
      },
      success: {
        DEFAULT: "var(--success)",
        foreground: "var(--success-fg)",
      },
      warning: {
        DEFAULT: "var(--warning)",
        foreground: "var(--warning-fg)",
      },
      info: {
        DEFAULT: "var(--info)",
        foreground: "var(--info-fg)",
      },
      border: "var(--border)",
      input: "var(--input)",
      ring: "var(--ring)",
    },
    borderRadius: {
      sm: "var(--radius-sm)",
      md: "var(--radius-md)",
      lg: "var(--radius-lg)",
      xl: "var(--radius-xl)",
      full: "var(--radius-full)",
    },
    fontFamily: {
      display: "var(--font-display)",
      sans: "var(--font-body)",
      mono: "var(--font-mono)",
    },
    transitionTimingFunction: {
      out: "var(--ease-out)",
      "in-out": "var(--ease-in-out)",
    },
    transitionDuration: {
      fast: "var(--duration-fast)",
      normal: "var(--duration-normal)",
      slow: "var(--duration-slow)",
    },
  },
}
```

If the project uses Tailwind v4 CSS-first theme variables, keep the same semantic names in `@theme` and document the file path in `design-system-kit.md`.

## Utility Rules

- Components use semantic utilities such as `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, `ring-ring`, `rounded-md`, and `shadow-md`.
- Do not use raw hex values, ad hoc Tailwind arbitrary colors, or direct `var(--token)` references inside component class names unless the repository has no Tailwind config layer.
- shadcn component variants should keep their public API stable: `default`, `secondary`, `destructive`, `outline`, `ghost`, and `link` unless the product explicitly approves a variant naming change.
- Use `data-[state=*]`, `aria-*`, and `focus-visible:*` utilities for state styling. Do not remove visible focus outlines without an equal or stronger replacement.
- Prefer logical spacing and alignment utilities when RTL is in scope: `ms-*`, `me-*`, `text-start`, `text-end`, and direction-aware icon placement.

## Token Mapping Checklist

- [ ] Light and dark token blocks exist.
- [ ] Every required shadcn token from `shadcn-tokens-spec.md` maps to a Tailwind key or documented exception.
- [ ] `--brand-primary-fg`, `--brand-secondary-fg`, semantic `-fg`, and surface foreground tokens pass WCAG AA against their paired backgrounds.
- [ ] `--ring` is visible against `--background`, `--card`, and form fields in both themes.
- [ ] Components avoid raw color literals and direct token references where Tailwind utilities exist.
- [ ] RTL behavior is checked for menus, sidebars, tabs, breadcrumbs, tables, and icon-leading controls.

## Evidence To Record

In `design-system-kit.md` or the handoff note, record:

- Tailwind config path and token CSS path.
- Theme mode support: light only, dark only, or light/dark.
- RTL status: supported, not applicable, or deferred with owner.
- Accessibility checks used, such as contrast output, axe result, screenshot, or manual screen reader note.
- Any token or utility exceptions and the downstream role that owns implementation follow-up.
