# Styling

Three mechanisms coexist. Knowing which to use is most of the job.

---

## 1. The three mechanisms

| Mechanism | Where | When to use |
|---|---|---|
| **CSS Modules** | `*.module.css` next to the component | Default for anything with its own appearance |
| **Global `noa-*` classes** | `foundation.css` | Composition pieces shared across many screens — listings, drawers, badges, tables |
| **Tailwind v4** | utilities in JSX | Rare. Present mainly so shadcn primitives work |

Reach for a CSS Module first. Add a global `noa-*` class only when the same
treatment is needed by several unrelated components.

---

## 2. Tokens only

No hex colour, `font-family` or literal `border-radius` belongs in a component
stylesheet. Everything comes from `tokens.css` — see `03-design-tokens.md`.

```css
/* yes */
.card {
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-5);
  color: var(--text-body);
}

/* no */
.card { background: #fff; box-shadow: 0 2px 14px rgba(0,0,0,.1); padding: 24px; }
```

Apply typography with the `font` shorthand tokens:

```css
.title { font: var(--text-h3); color: var(--text-heading); }
```

**Pick the ramp from the shell.** `--space-*` for the customer surface,
`--noa-space-*` for the staff surface. Do not mix them inside one component.

Use the z-index scale (`--noa-z-dropdown | -sticky | -modal | -toast`). A literal
`z-index` is how a dropdown ends up under a drawer.

---

## 3. CSS Modules conventions

- File name matches the component: `TeamPage.tsx` → `TeamPage.module.css`.
- Class names are `camelCase` — `styles.cardHead`, not `styles['card-head']`.
- Compose with a template literal or an array join:

```tsx
<div className={`${styles.band} ${styles.lift}`} />
<section className={[styles.card, className ?? ''].filter(Boolean).join(' ')} />
```

- Inside the design system, `cn()` from `@/design-system/utils`
  (`twMerge(clsx(...))`) is available for merging Tailwind classes.
- Put a header comment on any stylesheet whose ramp is not obvious. The customer
  shell's stylesheet documents the shell boundary at the top; follow that.

---

## 4. State without colour alone

Colour is never the only signal (WCAG 2.1 AA). Carry state on a `data-`
attribute and style from it, so the word and the tint agree:

```tsx
<span className={styles.status} data-status={member.status}>
  {t(`teamStatus_${member.status}`)}
</span>
```

```css
.status[data-status='active']   { color: var(--noa-green-600); background: var(--noa-green-050); }
.status[data-status='invited']  { color: var(--noa-amber-600); background: var(--noa-amber-050); }
.status[data-status='disabled'] { color: var(--text-muted); }
```

Status colours come from the extension tokens — success green, warning amber,
info navy, neutral grey. **Brand red is for actions and errors only.**

---

## 5. Brand constraints

- Cards are **square-cornered**. `--noa-radius-md`, `-lg` and `-pill` all
  resolve to `0` deliberately; `--radius-btn` (4px) is for buttons and inputs.
  Use `--noa-radius-capsule` when you genuinely need a pill.
- No gradients, blur, bounce or scale animations. The one gradient in the
  system is `--noa-hero-pattern`, which is the brand canvas.
- Primary button is solid brand red; outline is the only second style.
- `--text-muted` (`#a7a7a6`) is **decorative only** — it does not meet AA for
  body text.

---

## 6. Global classes worth knowing

Defined in `foundation.css` unless noted.

| Class | Purpose |
|---|---|
| `.noa-visually-hidden` | Screen-reader-only text (**in `base.css`**) |
| `.noa-state` | The shared loading / empty / error block behind `StatePanel` |
| `.noa-skeleton` | Loading placeholder |
| `.noa-page-heading`, `.noa-section`, `.noa-stack`, `.noa-row` | Page furniture |
| `.noa-badge`, `-info`, `-error`, `-success`, `-warning` | Badges |
| `.noa-listing*`, `.noa-table*`, `.noa-pagination*` | The listing pattern |
| `.noa-filter-*`, `.noa-active-filters` | The filter drawer |
| `.noa-drawer-*`, `.noa-dialog`, `.noa-sheet-left/right`, `.noa-overlay` | Overlays |
| `.noa-select-content`, `.noa-dropdown-content`, `.noa-tooltip` | Radix portal surfaces |
| `.noa-status-dot`, `.noa-route-cell`, `.noa-milestone` | Shipment cells |

Responsive breakpoints in `foundation.css`: 620px (drawer fields collapse to one
column), 760px, 420px.

---

## 7. Global element rules

`base.css` sets defaults you will inherit:

- `box-sizing: border-box` everywhere.
- `img, svg { max-width: 100%; display: block }` — and `foundation.css` then
  forces every bare `<svg>` to `16×16` with `stroke-width: 1.5`. Size an icon
  explicitly if you need something else.
- `a { color: var(--noa-color-accent); text-decoration: none }`, underlined on
  hover.
- **One focus treatment, never removed:**
  `:focus-visible { outline: 2px solid var(--noa-color-focus); outline-offset: 2px }`.
  The focus colour is navy, not brand red — a red ring on a red button reads as
  no ring.
- A `prefers-reduced-motion` block that collapses animation and transition
  durations.

`body` typography is set in `base.css` from the `--noa-*` ramp and then
**overridden** in `foundation.css` by `font: var(--text-body-f)`. The shorthand
also resets line-height, from `1.45` to `1.6`. Load order decides; `foundation`
wins.

---

## 8. What the tests enforce

Every `var(--x)` written in **any `.css` under `src/design-system`** must resolve
within that corpus, with no cycles. A typo fails the unit suite. One runtime
name is allowlisted: `--radix-select-content-available-height`.

Stylesheets under `src/features` and `src/shared` are **not** scanned — a typo
there fails silently at runtime.

Tokens named in the parent repository's design-system document are pinned and
cannot be changed here alone. See `10-testing.md` §3.

---

## 9. Tailwind

Tailwind v4 is wired through `@tailwindcss/vite`, configured in CSS. There is no
`tailwind.config.js`. The `@theme inline` block in `foundation.css` maps the
brand onto Tailwind's colour namespace so utilities and shadcn primitives
resolve correctly.

`components.json` puts `shadcn add` output in `src/design-system/primitives`.
In practice the primitives are stripped of most Tailwind in favour of `noa-*`
globals — follow that when adding one.
