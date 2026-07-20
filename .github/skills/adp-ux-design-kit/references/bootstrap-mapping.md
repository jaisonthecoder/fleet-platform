# Bootstrap Mapping

Use this reference when `adp-ux-design-kit` is applied to an Angular, ng-bootstrap, or Bootstrap implementation. It maps the design-kit token contract to Bootstrap variables, utilities, and component classes so feature teams use the design system through Bootstrap conventions.

## Required Inputs

- `references/ng-bootstrap-tokens-spec.md`
- `references/ng-bootstrap-sections-catalog.md`
- Token file path, usually `src/styles/tokens.scss`
- Bootstrap override file path, usually `src/styles/bootstrap-overrides.scss`
- Angular global styles entry, usually `src/styles.scss`

## SCSS Override Layer

Bootstrap SCSS variables are compile-time values, while design-kit tokens are runtime CSS custom properties. Use Bootstrap's CSS variable hooks and a small override layer for token-driven theming.

```scss
@use "bootstrap/scss/bootstrap" with (
  $primary: var(--brand-primary),
  $secondary: var(--brand-secondary),
  $success: var(--success),
  $warning: var(--warning),
  $danger: var(--danger),
  $info: var(--info),
  $body-bg: var(--background),
  $body-color: var(--foreground),
  $border-color: var(--border),
  $border-radius: var(--radius-md),
  $border-radius-sm: var(--radius-sm),
  $border-radius-lg: var(--radius-lg)
);
```

If the installed Bootstrap version or build pipeline does not accept CSS custom properties in `@use ... with`, load Bootstrap normally and override the emitted CSS variables instead:

```scss
:root,
[data-theme="light"] {
  --bs-primary: var(--brand-primary);
  --bs-secondary: var(--brand-secondary);
  --bs-success: var(--success);
  --bs-warning: var(--warning);
  --bs-danger: var(--danger);
  --bs-info: var(--info);
  --bs-body-bg: var(--background);
  --bs-body-color: var(--foreground);
  --bs-border-color: var(--border);
  --bs-border-radius: var(--radius-md);
}
```

Mirror the same variables under `[data-theme="dark"]` and keep the source token values in `tokens.scss`.

## Component Class Mapping

| Design token | Bootstrap usage |
|---|---|
| `--brand-primary` / `--brand-primary-fg` | `.btn-primary`, `.text-bg-primary`, `.bg-primary`, `.text-primary` |
| `--brand-secondary` / `--brand-secondary-fg` | `.btn-secondary`, `.text-bg-secondary`, `.bg-secondary`, `.text-secondary` |
| `--success` / `--success-fg` | `.btn-success`, `.alert-success`, `.text-bg-success` |
| `--warning` / `--warning-fg` | `.btn-warning`, `.alert-warning`, `.text-bg-warning` |
| `--danger` / `--danger-fg` | `.btn-danger`, `.alert-danger`, `.text-bg-danger` |
| `--info` / `--info-fg` | `.btn-info`, `.alert-info`, `.text-bg-info` |
| `--background` / `--foreground` | `body`, `.app-shell`, page containers |
| `--card` / `--card-fg` | `.card`, `.dropdown-menu`, `.modal-content`, `.offcanvas` |
| `--border` / `--input` | `.border`, `.form-control`, `.form-select`, table borders |
| `--ring` | custom `:focus-visible` rule for buttons, links, form controls, nav items |
| `--radius-*` | `.rounded`, `.rounded-*`, cards, inputs, dropdowns, modals |
| `--shadow-*` | `.shadow-sm`, `.shadow`, `.shadow-lg`, custom `shadow-xl` utility if needed |

## Required Focus Rule

Bootstrap defaults are not enough when brand colors change. Add a token-aware focus style and test it in light and dark themes.

```scss
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ring) 24%, transparent);
}
```

If `color-mix` is not allowed by the target browser matrix, use a documented fallback shadow token.

## Utility Rules

- Angular templates should prefer Bootstrap classes and ng-bootstrap directives over direct `style` attributes.
- Do not use raw hex values in component templates or SCSS when a design token exists.
- Use Bootstrap naming for semantic danger states: `danger`, not `destructive`. When consuming shadcn-oriented inputs, record the alias from `destructive` to `danger`.
- Keep hand-authored primitives in `src/app/shared/ui/` small and token-driven.
- Use logical properties for RTL where Bootstrap utilities are insufficient: `margin-inline-start`, `margin-inline-end`, `padding-inline`, `text-align: start`, and `text-align: end`.

## Token Mapping Checklist

- [ ] `tokens.scss` defines light and dark token blocks.
- [ ] `bootstrap-overrides.scss` or equivalent maps tokens to Bootstrap CSS variables/classes.
- [ ] `danger` aliases any incoming `destructive` semantic token from cross-stack design specs.
- [ ] Focus styles are visible against body, card, modal, dropdown, and form backgrounds.
- [ ] Forms, dropdowns, modals, offcanvas, nav, tables, and pagination work in RTL when Arabic is in scope.
- [ ] Component templates avoid raw colors and direct token styles unless documented as an exception.

## Evidence To Record

In `design-system-kit.md` or the handoff note, record:

- Token file path and Bootstrap override file path.
- Bootstrap and ng-bootstrap versions if implementation work is in scope.
- Theme mode support: light only, dark only, or light/dark.
- RTL status: supported, not applicable, or deferred with owner.
- Accessibility checks used, such as contrast output, keyboard walkthrough, screenshot, axe result, or screen reader note.
- Any Bootstrap limitation, custom primitive, or third-party component choice that requires downstream frontend review.
