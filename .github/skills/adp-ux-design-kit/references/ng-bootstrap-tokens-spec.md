# Token Spec — the contract

The skill enforces this contract. The user provides values. Components consume them via SCSS variables and Bootstrap utility classes.

All tokens are **CSS custom properties** on `:root` (light) and `[data-theme="dark"]` (dark). `bootstrap-overrides.scss` reads them with `var(...)` to override Bootstrap SCSS variables. The user changes brand → only `tokens.scss` changes → all components re-theme via Bootstrap's class system.

## Required variables

A `tokens.scss` is **invalid** if any of these are missing or contain `// TODO`. The skill's validation step refuses to proceed.

### Brand (the four load-bearing values)

```scss
:root {
  --brand-primary:        /* TODO */;
  --brand-primary-fg:     /* TODO */;
  --brand-secondary:      /* TODO */;
  --brand-secondary-fg:   /* TODO */;
  --brand-accent:         /* TODO */;
  --brand-accent-fg:      /* TODO */;
}
```

These map to Bootstrap's `$primary` and `$secondary` directly. Bootstrap doesn't have an `accent` slot; `--brand-accent` is custom (used for highlights, third-position buttons, etc.).

### Neutrals (11 stops)

```scss
--neutral-50      /* lightest — page background in light mode */
--neutral-100
--neutral-200
--neutral-300
--neutral-400
--neutral-500     /* mid — body text on light backgrounds */
--neutral-600
--neutral-700
--neutral-800
--neutral-900
--neutral-950     /* darkest — page background in dark mode */
```

These map to Bootstrap's `$gray-100` through `$gray-900`. Two extra stops (`50` and `950`) are kit additions — used for backgrounds in light/dark mode where Bootstrap's range stops short.

### Semantic

```scss
--success         --success-fg
--warning         --warning-fg
--danger          --danger-fg       /* note: Bootstrap convention is "danger", not "destructive" */
--info            --info-fg
```

Bootstrap uses `danger`, not `destructive`. (shadcn-kit uses `destructive` to match shadcn convention.) When porting brand specs across the two skills, alias them.

### Surface (derived from neutrals + brand)

These tokens are referenced by Bootstrap variable overrides in `bootstrap-overrides.scss`. They MUST derive from the brand + neutral ramp.

```scss
--background      /* Page bg. Light = --neutral-50. Dark = --neutral-950. */
--foreground      /* Default text. Light = --neutral-900. Dark = --neutral-50. */
--muted           /* Subdued surface. Light = --neutral-100. Dark = --neutral-900. */
--muted-fg        /* Subdued text. Light = --neutral-500. Dark = --neutral-400. */
--card            /* Card background. Light = white or --neutral-50. Dark = --neutral-900. */
--card-fg         /* Card text. Light = --neutral-900. Dark = --neutral-50. */
--border          /* Default border. Light = --neutral-200. Dark = --neutral-800. */
--input           /* Input border. Usually same as --border. */
--ring            /* Focus ring. Light = --brand-primary. Dark = lighter shade. */
```

### Typography

```scss
--font-display    /* Headings */
--font-body       /* Body, UI labels */
--font-mono       /* Code, tabular numerics */

/* Size scale */
--text-xs         /* 0.75rem */
--text-sm         /* 0.875rem */
--text-base       /* 1rem */
--text-lg         /* 1.125rem */
--text-xl         /* 1.25rem */
--text-2xl        /* 1.5rem */
--text-3xl        /* 1.875rem */
--text-4xl        /* 2.25rem */
--text-5xl        /* 3rem */

/* Paired line-heights */
--leading-xs    1.5
--leading-sm    1.45
--leading-base  1.5
--leading-lg    1.4
--leading-xl    1.4
--leading-2xl   1.3
--leading-3xl   1.25
--leading-4xl   1.2
--leading-5xl   1.15
```

### Spacing

Bootstrap's spacing scale is `0–5` (0, 0.25rem, 0.5rem, 1rem, 1.5rem, 3rem). The kit extends to a more granular ramp matching Tailwind / shadcn-kit so brand specs port cleanly.

```scss
--space-0      0
--space-px     1px
--space-0_5    0.125rem  /* 2px */
--space-1      0.25rem   /* 4px */
--space-1_5    0.375rem  /* 6px */
--space-2      0.5rem    /* 8px */
--space-3      0.75rem   /* 12px */
--space-4      1rem      /* 16px */
--space-5      1.25rem   /* 20px */
--space-6      1.5rem    /* 24px */
--space-8      2rem      /* 32px */
--space-10     2.5rem    /* 40px */
--space-12     3rem      /* 48px */
--space-16     4rem      /* 64px */
--space-20     5rem      /* 80px */
--space-24     6rem      /* 96px */
```

In `bootstrap-overrides.scss` the kit re-defines Bootstrap's `$spacers` map to consume these tokens — see `references/bootstrap-mapping.md`.

### Radius

```scss
--radius-sm      /* 4px (default) */
--radius-md      /* 6px (default) */
--radius-lg      /* 8px (default) */
--radius-xl      /* 12px (default) */
--radius-full    9999px
```

Bootstrap's `$border-radius` etc. consume these.

### Shadow

All shadows derived from a single `--shadow-color`. Override if brand specifies (e.g. AD Ports derives shadows from Deep Blue).

```scss
--shadow-color  /* "R G B" triple, e.g. "12 15 21" */
--shadow-sm     0 1px 2px 0 rgba(var(--shadow-color), 0.08)
--shadow-md     0 4px 6px -1px rgba(var(--shadow-color), 0.10), 0 2px 4px -2px rgba(var(--shadow-color), 0.10)
--shadow-lg     0 10px 15px -3px rgba(var(--shadow-color), 0.12), 0 4px 6px -4px rgba(var(--shadow-color), 0.12)
--shadow-xl     0 20px 25px -5px rgba(var(--shadow-color), 0.16), 0 8px 10px -6px rgba(var(--shadow-color), 0.16)
```

Bootstrap's `$box-shadow-*` consume these.

### Motion

```scss
--ease-out          cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out       cubic-bezier(0.45, 0, 0.55, 1)
--duration-fast     150ms
--duration-normal   200ms
--duration-slow     300ms
```

## Validation rules

1. **Every variable in this spec is present in `tokens.scss`.** No exceptions.
2. **No `// TODO` strings remain.** Validation fails.
3. **Every color value parses as valid CSS.**
4. **Light + dark are both defined.**
5. **`--ring` passes WCAG AA against `--background` and `--card`** in both themes.
6. **Foreground tokens (`-fg`) pass WCAG AA against their counterpart** in both themes. Rendered live in Foundations section.
7. **Surface tokens derive from the neutral ramp + brand** — advisory.

Record validation evidence in the active workflow output. For artifact work, use `workflows/produce-artifact.md`, `workflows/update-artifact.md`, or `workflows/review-artifact.md`; for component work, use `workflows/design-components.md`.

## What the user actually fills

Most users only need to set:

1. **3 brand values** — `--brand-primary`, `--brand-secondary`, `--brand-accent` (and their `-fg` pairs)
2. **11 neutral stops** — pick a temperature
3. **3 font families** — display, body, mono
4. **4 semantic colors** — usually keep kit defaults

Everything else has sensible defaults in the template.

## What components reference

Components in `src/app/shared/ui/` reference tokens **only via Bootstrap classes that have been overridden in `bootstrap-overrides.scss`**.

| Token | Bootstrap class |
|---|---|
| `--brand-primary` | `bg-primary` / `text-primary` / `btn-primary` |
| `--brand-primary-fg` | `text-bg-primary` (auto-paired text on primary bg) |
| `--brand-secondary` | `bg-secondary` / `btn-secondary` |
| `--success` | `bg-success` / `btn-success` / `alert-success` |
| `--danger` | `bg-danger` / `btn-danger` / `alert-danger` |
| `--background` | applied to `body` via `--bs-body-bg` override |
| `--foreground` | applied to `body` via `--bs-body-color` override |
| `--card` / `--card-fg` | `<div class="card">` consumes `--bs-card-bg` |
| `--border` | `--bs-border-color` |
| `--ring` | applied via custom CSS to `:focus-visible` (Bootstrap doesn't have a focus-ring utility) |
| `--radius-md` | `rounded` (Bootstrap's default radius), or `rounded-md` if scale extended |
| `--shadow-md` | `shadow` |

Direct `var(--token)` in component templates is **forbidden** — the after-checklist greps for it. Use the Bootstrap class.

See [bootstrap-mapping.md](bootstrap-mapping.md) for the full SCSS variable override layer.
