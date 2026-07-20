# Framework Adapters

shadcn supports Next.js (App and Pages Routers), Vite + React, Remix, and Astro + React. The kit detects which one and uses the right paths.

## Detection

The skill reads `package.json`:

| Signal | Framework |
|---|---|
| `"next": "*"` and `app/` directory exists | `next-app-router` |
| `"next": "*"` and only `pages/` directory | `next-pages-router` |
| `"vite": "*"` | `vite-react` |
| `"@remix-run/*": "*"` | `remix` |
| `"astro": "*"` | `astro` |

If none match, the skill asks the user explicitly.

## Path conventions per framework

### `next-app-router` (default)

```
app/
  layout.tsx
  globals.css                          ← imports tokens.css + Tailwind
  ui-kit/
    page.tsx
    layout.tsx
    sections/...
components/
  ui/                                  ← shadcn primitives
lib/
  utils.ts                             ← cn() helper
styles/
  tokens.css                           ← brand tokens
tailwind.config.ts                     ← v3 only; v4 puts @theme in globals.css
components.json
```

`components.json` aliases:
```json
"aliases": {
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui",
  "lib": "@/lib",
  "hooks": "@/hooks"
}
```

`tsconfig.json` paths:
```json
"paths": { "@/*": ["./*"] }
```

### `next-pages-router`

```
pages/
  _app.tsx                             ← imports globals.css
  _document.tsx                        ← injects data-theme on <html>
  ui-kit/
    index.tsx
    sections/... (rendered as components, not routes)
components/
  ui/
src/
  styles/
    globals.css
    tokens.css
```

The Pages Router can't have nested layouts the way App Router does. `/ui-kit` is a single page that imports section components.

### `vite-react`

```
src/
  main.tsx                             ← imports index.css
  App.tsx                              ← Routes including /ui-kit
  index.css                            ← imports tokens.css + Tailwind
  routes/
    UiKit.tsx
    ui-kit-sections/...
  components/
    ui/
  lib/
    utils.ts
  styles/
    tokens.css
tailwind.config.ts
components.json
```

`components.json`:
```json
"aliases": {
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui",
  "lib": "@/lib"
},
"rsc": false                            // critical — no Server Components in Vite
```

`vite.config.ts` needs the `@` alias:
```ts
import path from "path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

### `remix`

```
app/
  root.tsx                             ← Links to globals.css; sets data-theme on <html>
  routes/
    ui-kit.tsx                         ← container
    ui-kit.foundations.tsx             ← Remix nested route per section
    ui-kit.forms-controls.tsx
    ...
  components/
    ui/
  lib/
    utils.ts
  styles/
    tokens.css
    globals.css
tailwind.config.ts
components.json
```

Remix's flat route convention means each section can be its own route. The kit uses this — section nav becomes real navigation.

### `astro` (with React island)

```
src/
  components/
    ui/                                ← shadcn primitives (React)
    UiKit.tsx                          ← React island
  layouts/
    Layout.astro
  pages/
    ui-kit.astro                       ← <UiKit client:load />
  styles/
    globals.css
    tokens.css
  lib/
    utils.ts
```

Astro requires `client:*` directive on the React island. The kit uses `client:load` for `/ui-kit` because the showcase is interactive end-to-end.

`astro.config.mjs` must include `@astrojs/react` and `@astrojs/tailwind`.

## Per-framework gotchas

| Framework | Gotcha | Fix |
|---|---|---|
| Next App Router | `"use client"` missing on interactive components | shadcn adds it where needed; verify after install |
| Next Pages Router | RSC is unsupported | Set `rsc: false` in `components.json` |
| Vite | `@` alias unresolved at build time | Add to `vite.config.ts` AND `tsconfig.json` |
| Remix | Hydration mismatch on theme toggle | Set `data-theme` in root loader, not client effect |
| Astro | React state lost between pages | Use `client:load` for stateful islands; static markup for the rest |
| All | `globals.css` not loaded | Verify the framework's root file imports it |

## What stays identical across frameworks

- `tokens.css` — pure CSS, framework-agnostic
- `components/ui/*` — pure React, framework-agnostic
- `lib/utils.ts` — pure TS, framework-agnostic
- `tailwind.config.ts` (v3) or `@theme` block (v4) — framework-agnostic
- `components.json` (with `rsc` flag adjusted)

This is why the kit's verification (`/ui-kit` page) is identical across frameworks — only the route plumbing differs.

## Choosing a framework when the project is fresh

The skill doesn't pick. If a developer asks "which framework should I use?", route to a separate decision (architecture / ADR), not this skill. The kit installs into whatever exists.
