# UI Primitives — shadcn/ui + Lucide

The AD Ports React standard for **UI primitives** (button, dialog, input, select, popover, ...) is **shadcn/ui**. The standard for **icons** is **Lucide** (`lucide-react`), accessed through a small `<Icon />` wrapper.

This reference describes the rules. **It does not include install or init commands** — use the official tools in your repo when adopting; the rules below apply once the tooling is in place.

## Why these choices

- **shadcn/ui** is a *vendored-source* component set, not a dependency. You own the code in your repo, so you can customize tokens, add RTL behavior, change a11y semantics, and never wait on a third-party release. Built on Radix UI primitives — accessibility is correct by default.
- **Lucide** is a focused, tree-shakable icon set with a consistent visual language. `lucide-react` exports per-icon components so unused icons don't ship.

The vendored-source model is the reason the next rule is non-negotiable: when you own the source, "the existing one doesn't fit" is never an excuse to fork — you can always change it.

## ⛔ Reuse, do not recreate

This is the load-bearing rule of the entire skill. Read it twice.

- **Every UI primitive must come from `@shared/ui/*`.** If `@shared/ui/button` exists, you import `Button` from it. You do not write `MyButton`, `PrimaryButton`, `AppButton`, `<button className="...">` styled to look like a button, or any other parallel construct.
- **Every icon comes through `<Icon name="..." />`** from `@shared/ui/icon`. You do not `import { Search } from 'lucide-react'` inside a feature, ever. If the icon you need is not in the registry, add the name to the registry — do not bypass the wrapper.
- **If a primitive variant is missing** (the existing `Button` doesn't have a `loading` state, the existing `Dialog` doesn't support an alternate header), **edit the existing primitive in `@shared/ui/`** to add the variant. Do not fork it inside a feature.
- **If the primitive does not exist in `@shared/ui/` at all**, vendor it from shadcn (CLI emits it into `@shared/ui/`). Do not hand-roll a competing implementation.
- **Promotion rule:** a feature-scoped component is promoted to `@shared/ui/` only after a second feature actually needs it and the API can be made domain-neutral.

A code generator (human or AI) that creates a parallel `MyButton.tsx` next to an existing `button.tsx` has violated the most important rule in this skill. Reviewers reject such PRs without further discussion.

The broader **Search before creating** table (covering hooks, utils, HTTP, forms, state, validation messages) is in `references/coding-conventions.md` §Search before creating. This file is the primitive-specific deep dive on the same rule.

## Folder convention

shadcn primitives live in `src/shared/ui/`. This is the same folder used for the rest of the design-system layer in this skill — there is one home for UI primitives, period.

```text
src/shared/ui/
  button.tsx          # shadcn primitive (vendored)
  dialog.tsx          # shadcn primitive
  input.tsx           # shadcn primitive
  select.tsx          # shadcn primitive
  popover.tsx         # shadcn primitive
  ...
  icon.tsx            # Lucide wrapper (see below)
  empty-state.tsx     # AD Ports composite primitives
  loading-state.tsx
  error-state.tsx
```

Configure the shadcn CLI in your repo to write to `src/shared/ui/` (do not accept the default `src/components/ui/`). The CLI's `aliases` block in `components.json` should map `ui` → `@shared/ui`.

## Customization rules

You own the source. Treat shadcn output the way you treat any other code in `shared/ui/`.

- **Edit primitives in place** when the AD Ports design system needs different tokens, sizes, RTL handling, or a11y wording. Do not wrap a primitive in a second component just to add a class — change the primitive.
- **Tailwind tokens and CSS variables** drive theming. Set the project palette in `globals.css` (or the shadcn-generated theme file). Do not hard-code colors in primitives.
- **Re-running the shadcn CLI for an existing primitive** overwrites local edits. Coordinate updates: keep a small `CHANGES.md` in `shared/ui/` listing local modifications per primitive, or commit a `// AD Ports edit:` marker comment so re-runs are merged consciously, not blindly.
- **A primitive that exists in shadcn must not be re-implemented**. If the available variant doesn't fit, edit the existing primitive — do not create `MyButton.tsx` next to `button.tsx`.

## When to add a new primitive

Before adding to `shared/ui/`:

1. **Compose first.** Most needs are met by composing existing primitives (e.g. a confirm dialog = `Dialog` + `Button` + your text). Do not add a new primitive for a one-feature use.
2. **Two real consumers.** Promote a feature-scoped component to `shared/ui/` only when a second feature actually needs it and the API can be made domain-neutral.
3. **shadcn first.** If the primitive exists in shadcn's catalog, vendor it via the CLI — do not hand-write a competing version.
4. **No domain leakage.** A primitive in `shared/ui/` knows nothing about vessels, bookings, or any AD Ports domain term. If it does, it belongs in a feature.

## Icons — the `<Icon />` wrapper

Use a single `Icon` wrapper, not direct `lucide-react` imports scattered through features.

```tsx
// src/shared/ui/icon.tsx
import {
  Anchor,
  ChevronRight,
  Search,
  Filter,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@shared/lib/cn';

const icons = {
  anchor: Anchor,
  'chevron-right': ChevronRight,
  search: Search,
  filter: Filter,
  close: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  /** Mirror the icon under [dir="rtl"] — for direction-sensitive icons (back arrows, chevrons). */
  mirrorInRTL?: boolean;
  className?: string;
  'aria-label'?: string;
};

/*
 * Single entry point for every Lucide icon used in the app.
 * Looks the icon up in a curated registry (the allowlist), defaults to aria-hidden,
 * and applies `rtl:scale-x-[-1]` for direction-sensitive icons under RTL.
 */
export function Icon({ name, mirrorInRTL, className, ...rest }: Props) {
  const Cmp = icons[name];
  return (
    <Cmp
      aria-hidden={rest['aria-label'] ? undefined : true}
      className={cn(
        'size-4 shrink-0',
        mirrorInRTL && 'rtl:scale-x-[-1]',
        className,
      )}
      {...rest}
    />
  );
}
```

### Icon rules

- **Always use `<Icon />`**, never `import { Search } from 'lucide-react'` in a feature.
- **Add a name to the registry** when a new icon is needed. The registry is the icon allowlist for the app.
- **Mirror direction-sensitive icons** in RTL via `mirrorInRTL`. Default off; opt in when the icon points (chevrons, arrows, breadcrumb separators).
- **Decorative icons are `aria-hidden`** by default. Pass `aria-label` only when the icon is the *only* label (e.g. an icon-only button — and even then prefer a visible label).
- **Sizing via Tailwind size utilities** (`size-4`, `size-5`, `size-6`). The wrapper defaults to `size-4`; override per usage.
- **Do not re-color icons inline**. Use `currentColor` (Lucide's default) and let the parent set color via `text-*` classes.

### Icon-only buttons

Always pair an icon-only button with `aria-label`. The icon stays decorative.

```tsx
<button aria-label={t('actions.close')} onClick={close}>
  <Icon name="close" />
</button>
```

## Dark mode

shadcn ships with a CSS-variable-based theme that supports dark mode out of the box. Rules:

- Toggle dark mode via the `class` strategy (`<html class="dark">`), not the `media` strategy — users override system preference.
- Do not write `dark:` Tailwind variants on primitives. The primitive consumes CSS variables; the variables flip in `.dark`. The variant goes on consumers only when a feature needs to deviate.
- Verify every `shared/ui/` primitive in both light and dark before promoting.

## RTL

Most shadcn primitives work in RTL out of the box because Radix uses logical placement. Two things to verify when vendoring or editing:

- **Floating elements** (Popover, Dropdown, Tooltip) anchor correctly under `dir="rtl"`.
- **Icons inside primitives** (e.g. dropdown caret, breadcrumb separator) use `mirrorInRTL` if direction-sensitive.

If a primitive fails RTL, edit it — do not work around it from the consumer side.

## Forms integration

shadcn provides `form.tsx` (built on react-hook-form). Use it. It owns:

- `<Form>` provider wrapping a react-hook-form context.
- `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` — accessible field wiring.

Combine with the project's central `validationMessage` helper (see `references/i18n-and-locale.md`) to translate validator error keys instead of hard-coding them in templates.

## Testing primitives

- Do not write unit tests for shadcn primitives themselves (Radix is tested upstream and the vendored component is a thin wrapper).
- Do test compositions of primitives that own behavior (e.g. a confirmation dialog with custom keyboard handling).
- Stories: every primitive in `shared/ui/` gets a `*.stories.tsx` (Default + variant + RTL + dark — see `references/react-architecture.md` §Storybook and Component Documentation).

## Anti-patterns

See `references/anti-patterns.md` §Reuse violations and §Components for the canonical list. Primitive-specific items not in the canonical list:

- **Hard-coded hex colors** in a primitive — use CSS variables / Tailwind tokens.
- **`dark:` variants on primitives** — let CSS variables flip; consumers may use `dark:` only when deviating.
- **Direction-sensitive icons** (chevrons, arrows) without `mirrorInRTL`.
- **Icon-only buttons without `aria-label`.**
- **Re-running the shadcn CLI** on a primitive without reviewing the diff against local edits.

## Quick reference

| Need | Reach for |
|---|---|
| Standard UI primitive (button, input, dialog, ...) | `@shared/ui/<primitive>` (vendored from shadcn) |
| New primitive that doesn't exist in shadcn | Add to `@shared/ui/` only after two real consumers; otherwise compose |
| Icon | `<Icon name="..." />` from `@shared/ui/icon`; add the name to the registry if missing |
| Direction-sensitive icon | `<Icon name="chevron-right" mirrorInRTL />` |
| Icon-only button | `<button aria-label={t('...')}><Icon name="..." /></button>` |
| Form field | shadcn `<Form>` + `<FormField>` (react-hook-form) |
| Dark-mode aware primitive | Drive via CSS variables; toggle with `.dark` class on `<html>` |
| Empty / Loading / Error state | `@shared/ui/empty-state`, `@shared/ui/loading-state`, `@shared/ui/error-state` (see architecture §UI states) |
