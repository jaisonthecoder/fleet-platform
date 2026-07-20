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

## Validation rules

1. **Every variable in this spec is present in `tokens.css`.** No exceptions.
2. **No `/* TODO */` strings remain.** Validation fails if any do.
3. **Every color value parses as a valid CSS color.** `#abc`, `#abcdef`, `rgb(…)`, `hsl(…)`, `oklch(…)` all OK.
4. **Light + dark are both defined.** Every brand / neutral / semantic / surface token has a value under both `:root` and `[data-theme="dark"]`.
5. **`--ring` passes WCAG AA contrast against `--background` and `--card`** in both themes.
6. **Foreground tokens (`-fg`) pass WCAG AA against their counterpart** in both themes. Rendered live in Foundations section for review.
7. **Surface tokens derive from the neutral ramp + brand** — not assigned independently. (Soft rule; advisory in checklist.)

Record validation evidence in the active workflow output. For artifact work, use `workflows/produce-artifact.md`, `workflows/update-artifact.md`, or `workflows/review-artifact.md`; for component work, use `workflows/design-components.md`.

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
