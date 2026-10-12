# Design tokens

Every CSS custom property in the app, where it lives, and which of the two ramps
it belongs to.

**Foundation rule:** all colours, fonts, radii and spacing come from these
tokens. No hex colour, `font-family` or `border-radius` literal belongs in a
component stylesheet.

---

## 1. Load order

There is exactly one stylesheet entry point, imported by `src/main.tsx`:

```
src/design-system/styles/foundation.css
├── @import 'tailwindcss'
├── @import './tokens.css'      ← every token lives here
├── @import './base.css'        ← reset and element defaults
├── @import '@fontsource/mulish/{400,600,700,800}.css'
├── @theme inline { … }         ← Tailwind v4 theme mapping (20 more tokens)
└── global .noa-* classes
```

Cascade order: Tailwind → `tokens.css` → `base.css` → Mulish →
`@theme inline` → foundation's global rules.

`components.json` also points shadcn at `foundation.css`.

> **`src/design-system/styles/fonts.css` is dead code.** Nothing imports it. It
> `@font-face`s Inter and JetBrains Mono — neither is used by any token — its
> `url('./fonts/…')` paths point at a directory that does not exist, and its
> header comment refers to a pre-submodule-split path. It defines no tokens.
> Safe to delete.

---

## 2. The two ramps

This is the single most important thing to understand about styling here.

| | Marketing / website ramp | Application ramp |
|---|---|---|
| Prefix | `--space-*`, `--text-*`, `--container-max` | `--noa-*` |
| Used by | Customer shell (`/app/*`), public landing, login | Staff shell (`/portal/*`), admin screens |
| Density | Generous | Deliberately tight |
| Pinned by a test? | **Yes** — see §8 | No |

They diverge from step 3 of the spacing scale onward. `--space-3` is 12px;
`--noa-space-3` is 10px. `--space-8` is 64px; `--noa-space-8` is 48px. Mixing
them inside one component is how a screen ends up visibly off-rhythm.

Choosing: **which shell is the screen in?** A customer-facing page uses
`--space-*`. An administration screen uses `--noa-space-*`.

---

## 3. `tokens.css` block 1 — the website ramp

### 3.1 Raw palette

| Token | Value |
|---|---|
| `--red-600` | `#aa272f` |
| `--red-700` | `#8e2027` |
| `--red-050` | `#f7ecec` |
| `--navy-800` | `#002c5f` |
| `--navy-950` | `#041c2c` |
| `--gray-900` | `#333333` |
| `--gray-700` | `#58595b` |
| `--gray-400` | `#a7a7a6` |
| `--gray-200` | `#e5e5e5` |
| `--gray-100` | `#f5f5f3` |
| `--white` | `#ffffff` |

Never use these directly in a component — use a semantic alias below.

### 3.2 Semantic colour

| Token | Resolves to |
|---|---|
| `--color-primary` | `#aa272f` |
| `--color-primary-hover` | `#8e2027` |
| `--color-accent-navy` | `#002c5f` |
| `--text-heading` | `#333333` |
| `--text-body` | `#58595b` |
| `--text-muted` | `#a7a7a6` |
| `--text-on-dark` | `#ffffff` |
| `--surface-page` | `#ffffff` |
| `--surface-section` | `#f5f5f3` |
| `--surface-card` | `#ffffff` |
| `--surface-footer` | `#aa272f` |
| `--surface-topbar` | `#aa272f` |
| `--border-subtle` | `#e5e5e5` |
| `--link` | `#aa272f` |
| `--link-hover` | `#8e2027` |

> `--text-muted` (`#a7a7a6`) is **decorative only** — it does not meet WCAG AA
> for body text. See `09-accessibility.md`.

### 3.3 Typography

`--text-*` here are **`font` shorthands** (`weight size/line-height family`),
not font sizes. Apply with `font: var(--text-h3);`.

| Token | Value |
|---|---|
| `--font-sans` | `'Mulish', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif` |
| `--text-display` | `800 42px/1.25` |
| `--text-h2` | `800 34px/1.25` |
| `--text-h3` | `700 24px/1.3` |
| `--text-h4` | `700 19px/1.35` |
| `--text-eyebrow` | `700 17px/1.3` |
| `--text-nav` | `700 17px/1.2` |
| `--text-body-f` | `400 16px/1.6` |
| `--text-small` | `400 14px/1.5` |
| `--text-stat` | `800 40px/1.1` |
| `--text-footer-heading` | `800 16px/1.3` |
| `--tracking-caps` | `0.02em` |

**There is no `--text-h1`.** The `h1` element rule uses `--text-h3`.

> **Naming trap.** The `--text-*` prefix means two different things in the same
> block: `--text-h3` is a font shorthand, `--text-heading` is a colour. Read the
> value, not the name.

### 3.4 Spacing, container, radius, shadow

| Token | Value |
|---|---|
| `--space-1` … `--space-9` | `4, 8, 12, 16, 24, 32, 48, 64, 96` px |
| `--container-max` | `1170px` |
| `--radius-btn` | `4px` |
| `--radius-none` | `0` |
| `--shadow-card` | `0 2px 14px rgba(0,0,0,0.1)` |
| `--heading-rule-w` / `-h` | `40px` / `3px` |

### 3.5 shadcn bridge

`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`,
`--muted-foreground`, `--border`, `--input`, `--ring`, `--radius` — all aliases
onto the tokens above, so shadcn primitives inherit the brand without knowing
about it. `--ring` is `--color-accent-navy`.

---

## 4. `tokens.css` block 2 — the application ramp

### 4.1 Brand and neutral ramps

`--noa-brand-50 … 900` and `--noa-neutral-0 … 900` exist for ramp-shaped APIs,
but they collapse onto the raw palette: the ten brand steps resolve to only
three distinct values (`#f7ecec`, `#aa272f`, `#8e2027`). Do not expect a real
gradient.

### 4.2 Status

| Token | Value |
|---|---|
| `--noa-success-100 / 500 / 700` | `#dff3e6` / `#1f8a4c` / `#146536` |
| `--noa-warning-100 / 500 / 700` | `#fdf0d5` / `#b4780a` / `#855804` |
| `--noa-danger-100 / 500 / 700` | `--red-050` / `--red-600` / `--red-700` |
| `--noa-info-100 / 500 / 700` | `--gray-100` / `--navy-800` / `--navy-800` |

Brand red is for **actions and errors only**. A success state uses green, a
warning amber, information navy.

### 4.3 Third-party mark

`--noa-microsoft-red/green/blue/yellow` — used only by the Microsoft sign-in
control. Not brand colours; do not reuse.

### 4.4 Semantic roles

`--noa-color-bg`, `-surface`, `-surface-raised`, `-border`, `-border-strong`,
`-text`, `-text-muted`, `-text-inverse`, `-accent`, `-accent-hover`,
`-accent-subtle`, `-focus`.

`--noa-color-focus` is **navy, not brand red** — a red ring on a red button
reads as no ring. It is deliberately equal to shadcn's `--ring`.

### 4.5 Dark hero band

`--noa-color-hero` (`--navy-950`) plus `-text`, `-muted`, `-border`, `-raised`,
`-rule`, `-ring`, `-ring-soft` as white at low alpha.

`--noa-hero-pattern` is a single token carrying the whole brand canvas: two
faint rings sweeping in from the right plus 28px hairline columns. Pair it with
`background-color: var(--noa-color-hero)`.

```css
.hero {
  background-color: var(--noa-color-hero);
  background-image: var(--noa-hero-pattern);
  color: var(--noa-color-hero-text);
}
```

### 4.6 Typography

`--noa-font-sans` aliases `--font-sans`.

`--noa-font-mono` is a **real monospace system stack** — deliberately not an
alias of the sans face, because CW1 organisation codes are compared character by
character (`NOATVAL01` vs `NOATVALO1`). No font is downloaded for it.

Sizes `--noa-text-xs … 3xl` (`0.75rem` … `2.25rem`), weights
`--noa-weight-regular|medium|semibold|bold` (400–700), line heights
`--noa-leading-tight|normal|relaxed` (1.2 / 1.45 / 1.55).

> There is no `800` weight token in this ramp, yet `foundation.css` uses
> `font-weight: 800` literally in three places.

### 4.7 Spacing

| Token | rem | px |
|---|---|---|
| `--noa-space-0` | `0` | 0 |
| `--noa-space-1` | `0.25rem` | 4 |
| `--noa-space-2` | `0.5rem` | 8 |
| `--noa-space-3` | `0.625rem` | **10** |
| `--noa-space-4` | `0.75rem` | 12 |
| `--noa-space-5` | `1rem` | 16 |
| `--noa-space-6` | `1.5rem` | 24 |
| `--noa-space-7` | `2rem` | 32 |
| `--noa-space-8` | `3rem` | 48 |

Despite the "4px base" heading in the file, step 3 is 10px. Tune the ramp here,
never per page.

### 4.8 Radii, shadows, motion

| Token | Value |
|---|---|
| `--noa-radius-sm` | `4px` |
| `--noa-radius-md` / `-lg` / `-pill` | `0` |
| `--noa-radius-capsule` | `999px` |
| `--noa-shadow-sm` / `-md` / `-lg` | all `0 2px 14px rgba(0,0,0,0.1)` |
| `--noa-duration-fast` / `-base` | `120ms` / `200ms` |
| `--noa-ease` | `cubic-bezier(0.2, 0, 0.2, 1)` |

`--noa-radius-pill` resolving to `0` is not a bug: the square-corner brand rule
beats the name. Use `--noa-radius-capsule` when you genuinely need a pill.

### 4.9 Operational workspace

`--noa-workspace-gap`, `--noa-card-padding`, `--noa-card-gap`,
`--noa-card-border`, `--noa-card-shadow`, `--noa-control-height` (38px),
`--noa-control-height-compact` (32px), `--noa-touch-target` (44px).

> **Two card shadows exist.** `--noa-shadow-*` is `0 2px 14px / .1`;
> `--noa-card-shadow` is `0 1px 4px / .08`. `foundation.css` uses
> `--noa-card-shadow` exclusively. Prefer it for application cards.

### 4.10 Public surface

Values taken from the approved landing designs — a value here is a decision
already made, not a hue invented at build time.

| Token | Value | Purpose |
|---|---|---|
| `--noa-public-max` | `1320px` | Public page container — **wider than `--noa-container-max`** |
| `--noa-public-gutter` | `32px` | |
| `--noa-on-dark-strong` | `#d7dee4` | Text over `--navy-950` |
| `--noa-on-dark` | `#b9c0c6` | |
| `--noa-on-dark-muted` | `#8fa0ad` | |
| `--noa-on-dark-placeholder` | `#7c8994` | |
| `--noa-mint-400` | `#7ed4a0` | "live", lowest emission |
| `--noa-green-600` / `-050` | `#2e7d4f` / `#eaf4ee` | |
| `--noa-amber-600` / `-400` / `-050` | `#b7791f` / `#e3b23c` / `#fbf3e4` | Attention without the finality of red |
| `--noa-navy-050` | `#e8edf4` | Informational chips, locked tiles |
| `--noa-paper` | `#fbfaf7` | Panel grounds |
| `--noa-ring-track` | `#f0efec` | Inactive rings |
| `--noa-dot-idle` | `#d8d7d4` | |

### 4.11 Layout and z-index

| Token | Value |
|---|---|
| `--noa-container-max` | `1170px` |
| `--noa-header-height` | `64px` |
| `--noa-sidebar-width` | `248px` |
| `--noa-z-dropdown / -sticky / -modal / -toast` | `100 / 200 / 300 / 400` |

Always use the z-index scale. A literal `z-index` is how a dropdown ends up
under a drawer.

---

## 5. `@theme inline` — the Tailwind v4 mapping

The only tokens defined outside `tokens.css`. They map the brand onto Tailwind's
colour namespace so utility classes and shadcn primitives resolve correctly:
`--color-background`, `--color-foreground`, `--color-primary`,
`--color-primary-foreground`, `--color-muted`, `--color-muted-foreground`,
`--color-border`, `--color-ring`, `--color-popover`,
`--color-popover-foreground`, `--color-accent`, `--color-accent-foreground`,
`--color-input`, `--color-destructive`, `--color-destructive-foreground`,
`--color-secondary`, `--color-secondary-foreground`, `--radius-md`,
`--radius-sm`, `--radius-lg`.

---

## 6. No dark mode

There is no dark ramp, no `[data-theme]` and no `prefers-color-scheme` in
`tokens.css`. This is **enforced**: `Workspace.test.tsx` asserts
`tokenSource` does not contain `prefers-color-scheme`. Adding a dark mode means
changing that test deliberately, not by accident.

The dark *hero band* (§4.5) is a brand surface, not a theme.

---

## 7. Known inconsistencies

Recorded so nobody rediscovers them as bugs.

1. **`--color-primary` is declared twice** — `tokens.css` `:root` and
   `foundation.css` `@theme inline`. Same resolved value today, but two owners.
2. **`--radius-sm` is squarer than `--radius-md`** — `sm` is `0`, `md` is `4px`.
   The names invert.
3. **Two input borders.** `--input` (tokens) is `--border-subtle` `#e5e5e5`;
   `--color-input` (`@theme`) is `--noa-color-border-strong` `#a7a7a6`. Tailwind
   classes use the second.
4. **Two container widths** — `--noa-container-max` 1170px vs
   `--noa-public-max` 1320px. Public pages are wider on purpose.
5. **Tailwind namespace overlap.** `--text-*`, `--font-*`, `--container-*`,
   `--radius-*`, `--space-*`, `--tracking-*` sit in Tailwind v4's reserved theme
   namespaces but are declared in a plain `:root`. Because `--text-small` is a
   font shorthand rather than a size, it does not mean what Tailwind's `--text-*`
   namespace expects.
6. `fonts.css` is orphaned (§1).

---

## 8. What the tests pin

`src/features/ui-workspace/Workspace.test.tsx` enforces two rules:

- **Canonical tokens.** Every declaration in the first fenced ```css block of
  `../../docs/noatum-designsystem.md` — a file in the **parent repository** —
  must appear in `tokens.css` with the same value (normalised for hex case and
  number formatting). Tokens named there cannot be changed here alone. Tokens
  *not* named there are free, which is why the `--noa-*` extensions are safe to
  add to.
- **Resolvable, acyclic references.** Every `var(--x)` across all `.css` under
  `src/design-system` must resolve within that corpus, with no cycles. One
  runtime name is allowlisted: `--radix-select-content-available-height`.

Stylesheets under `src/features` and `src/shared` are **not** scanned.
