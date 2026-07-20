# shadcn Recipes

When to use the CLI, when to wrap, when to hand-author. CVA patterns. Pinning. Common gotchas.

## CLI

```bash
pnpm dlx shadcn@latest add <component>     # pnpm
npx shadcn@latest add <component>          # npm
yarn shadcn@latest add <component>         # yarn
bun x shadcn@latest add <component>        # bun
```

The CLI:
1. Reads `components.json` to find install paths and aliases
2. Writes the component file into `components/ui/<name>.tsx`
3. Adds any required deps (`@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`, etc.) to `package.json`
4. Updates `globals.css` with any required utility classes (rare)

**`shadcn add` overwrites the destination file without confirmation.** Always inventory before running it (see `workflows/before-you-start.md`).

## When to use the CLI vs. wrap vs. hand-author

| Need | Approach |
|---|---|
| Standard primitive (Button, Dialog, Input, etc.) | **CLI** — `shadcn add <name>` |
| Token-aware variant the upstream component lacks (e.g. an extra Button variant) | **Wrap** — extend the upstream CVA in a thin wrapper |
| Composition of 2+ primitives that the kit ships as a Pattern | **Hand-author** in `components/ui/patterns/<name>.tsx` |
| Layout primitive shadcn doesn't provide (Container, Stack, Grid) | **Hand-author** in `components/ui/<name>.tsx` |
| Business component for a feature | **Not the kit's job** — lives in `features/<area>/components/` |

## Wrapping pattern

shadcn ships components with `class-variance-authority` (CVA) variant APIs. Extending them without forking:

```tsx
// components/ui/button.tsx — original from shadcn add
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center …",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        // … existing variants
      },
      size: { /* … */ },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
```

To add a brand-specific variant (e.g. AD Ports needs an "uppercase pill" button), **don't fork**. Add the variant inline:

```tsx
// In the same file, extend variant.variant with one new entry
variant: {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  // ... existing
  pill: "bg-primary text-primary-foreground rounded-full uppercase tracking-wide hover:bg-primary/90",
},
```

This keeps the file installable from `shadcn add` (subsequent re-installs will warn that the file changed) but avoids creating a parallel `BrandButton.tsx`.

If a wrap is genuinely needed (e.g. the upstream component takes a prop the brand never wants exposed), wrap in a *new* file:

```tsx
// components/ui/brand-button.tsx
import { Button as BaseButton, type ButtonProps } from "./button";
import { forwardRef } from "react";

export const BrandButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "variant"> & { tone?: "primary" | "ghost" }>(
  ({ tone = "primary", ...props }, ref) => (
    <BaseButton ref={ref} variant={tone === "primary" ? "default" : "ghost"} {...props} />
  )
);
BrandButton.displayName = "BrandButton";
```

Use this sparingly. Most cases are better served by CVA variant additions in-place.

## CVA conventions

When hand-authoring or extending:

- **Variant names match shadcn's naming.** `default | secondary | outline | ghost | destructive | link` for buttons. `default | secondary | destructive | outline` for badges. Don't invent `primary` / `error` etc.
- **Size names match shadcn's naming.** `default | sm | lg | icon` for most components. Buttons additionally have `xs | icon-xs | icon-sm | icon-lg`.
- **Default variant + size are explicit.** `defaultVariants: { variant: "default", size: "default" }`.
- **Compose variants don't multiply infinitely.** If you need a `variant × size × shape × tone` matrix, you're past the kit's job — that's a feature component.

## Pinning

`components.json` pins the registry URL. The kit also pins:

- `package.json` → `shadcn` CLI version (devDep) — prevents CLI version skew breaking installs
- `package.json` → component dep ranges (`@radix-ui/react-*`, `class-variance-authority`, `clsx`, `tailwind-merge`)

**Pin at minor.** Patch updates are safe. Minor updates may add components or change variant APIs — review before bumping.

## components.json

The skill ships `components.json` matching the framework. Key fields:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",            // or "default" — kit ships new-york
  "rsc": true,                    // false for non-Next projects
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

`style: "new-york"` is opinionated (denser, smaller default radius). The kit defaults to it because the brand specs we've seen (AD Ports, others) tend to assume tighter spacing. `style: "default"` is fine if a brand prefers more breathing room — change once at `components.json`, re-add components, done.

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `shadcn add` writes to wrong path | `aliases` in `components.json` mismatch tsconfig paths | Sync `aliases` and `tsconfig.json` `paths` |
| Component renders but colors are wrong | Tailwind theme extension missing the color name | Check `tailwind-mapping.md` — the `--color-*` variable for the missing name must be in `@theme` |
| Dark mode flickers on first paint | `data-theme` set in client effect, not on `<html>` server-side | Set `data-theme` in `<html>` directly (Next: in `layout.tsx` root); use a script tag for system preference |
| `Button` looks identical across variants | `tailwindcss-animate` plugin missing | `pnpm add -D tailwindcss-animate` and add to plugins |
| `Dialog` / `Sheet` portal not styled | `globals.css` not imported in root layout | Verify `import "./globals.css"` in `app/layout.tsx` |
| Focus ring missing | `--ring` token undefined OR custom outline-none on a parent | Check `tokens.css` for `--ring` in both themes; remove blanket outline resets |
| RTL breaks Dropdown / Popover position | Floating UI strategy not aware of dir | Wrap app in shadcn's `Direction` provider with `dir={dir}` |
| `shadcn add` complains about missing peer deps | Project's React version below shadcn's minimum | Upgrade to at least React 18.2 (absolute floor for shadcn); prefer the LTS in `/standards/framework-baselines.md` § React. Verify with `pnpm why react`. |

## Tested versions (snapshot 2026-06-26)

> Versions below are a snapshot. For the **current recommended baseline**, defer to `/standards/framework-baselines.md` § React.

| Package | Pinned to |
|---|---|
| `shadcn` (CLI) | `^2.4.0` |
| `react` | Match the React baseline in the standard (recommended: React 19). Absolute floor 18.2 for shadcn. |
| `tailwindcss` | `^4.0.0` (v3.4+ supported) |
| `@radix-ui/*` | latest as installed by `shadcn add` |
| `class-variance-authority` | `^0.7.0` |
| `clsx` | `^2.1.0` |
| `tailwind-merge` | `^2.5.0` |
| `lucide-react` | `^0.460.0` |
| `tailwindcss-animate` | `^1.0.7` |

Audit quarterly. When the upstream snapshot diverges materially from these versions, update this table and the templates.
