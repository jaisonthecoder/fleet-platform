# Workflow — Scaffold Kit

Wire tokens, install primitives, build all 10 sections. The main flow.

**Run [`before-you-start.md`](before-you-start.md) first.** This workflow assumes its checklist passed.

## Before you start
- Resolve documentation artifact target paths through `/standards/artifact-path-routing.md` as target-repository-root-relative paths; do not write output inside skill or catalog folders.

- [ ] Check the applicable shared standards: `/standards/definition-of-done.md`, `/standards/code-review-checklist.md`, `/standards/test-plan.md`.
Use the recorded preflight output from [`before-you-start.md`](before-you-start.md): framework, package manager, Tailwind version, shadcn status, aliases, token path, dark mode, RTL, and component inventory.

## Goal

A fresh project goes from "no kit" to "all 10 sections render at `/ui-kit` with the brand applied" in one session.

## Steps

### 1. Validate tokens

Re-read [`references/tokens-spec.md`](../references/tokens-spec.md) §"Validation rules" and apply each to `styles/tokens.css` (or wherever the user's filled tokens live).

If any rule fails, **stop**. Don't proceed with broken tokens.

### 2. Place tokens

Copy the user's filled tokens to the framework-conventional location:

| Framework | Path |
|---|---|
| `next-app-router` | `app/styles/tokens.css` (or `styles/tokens.css` at root) |
| `next-pages-router` | `src/styles/tokens.css` |
| `vite-react` | `src/styles/tokens.css` |
| `remix` | `app/styles/tokens.css` |
| `astro` | `src/styles/tokens.css` |

### 3. Wire globals.css

Copy [`templates/globals.css.tmpl`](../templates/globals.css.tmpl) to the framework-conventional location:

| Framework | Path |
|---|---|
| `next-app-router` | `app/globals.css` |
| `next-pages-router` | `src/styles/globals.css` |
| `vite-react` | `src/index.css` |
| `remix` | `app/styles/globals.css` |
| `astro` | `src/styles/globals.css` |

Adjust the `@import "./tokens.css";` path if needed for the layout.

For Tailwind v3 projects: also copy [`templates/tailwind.config.ts.tmpl`](../templates/tailwind.config.ts.tmpl) to `tailwind.config.ts` and **delete the v4 `@theme` block** from `globals.css`.

### 4. Wire root layout

Ensure the root file imports `globals.css`:

| Framework | File | Import to add |
|---|---|---|
| `next-app-router` | `app/layout.tsx` | `import "./globals.css";` |
| `next-pages-router` | `pages/_app.tsx` | `import "@/styles/globals.css";` |
| `vite-react` | `src/main.tsx` | `import "./index.css";` |
| `remix` | `app/root.tsx` | Add to `links()` |
| `astro` | `src/layouts/Layout.astro` | `import "../styles/globals.css";` in frontmatter |

### 5. Add ThemeProvider (if dark mode != "none")

Copy [`templates/theme-provider.tsx.tmpl`](../templates/theme-provider.tsx.tmpl) to `components/theme-provider.tsx`.

Wrap the root in it:

```tsx
// next-app-router example
import { ThemeProvider } from "@/components/theme-provider";

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### 6. Install shadcn primitives — by section

Walk [`references/sections-catalog.md`](../references/sections-catalog.md) section by section. For each component listed, run `shadcn add <name>` IF it isn't already in `components/ui/` (per the inventory from `before-you-start.md`).

Use this exact order — installing a section at a time keeps the diffs reviewable:

```bash
# Section 2 — Forms & Controls
pnpm dlx shadcn@latest add input textarea native-select select combobox checkbox radio-group switch slider date-picker calendar field label input-group input-otp

# Section 3 — Buttons & Actions
pnpm dlx shadcn@latest add button button-group toggle toggle-group kbd

# Section 4 — Data Display
pnpm dlx shadcn@latest add avatar badge card separator item table data-table chart

# Section 5 — Feedback
pnpm dlx shadcn@latest add alert sonner progress skeleton spinner empty

# Section 6 — Overlays
pnpm dlx shadcn@latest add dialog alert-dialog sheet drawer popover hover-card tooltip dropdown-menu context-menu menubar command

# Section 7 — Navigation
pnpm dlx shadcn@latest add tabs breadcrumb pagination navigation-menu sidebar

# Section 8 — Disclosure
pnpm dlx shadcn@latest add accordion collapsible

# Section 9 — Layout
pnpm dlx shadcn@latest add aspect-ratio scroll-area resizable carousel
```

Confirm each install before moving on. If the CLI errors, stop and resolve — don't continue with a half-installed section.

### 7. Hand-author missing primitives

Some primitives shadcn doesn't ship — write them once, document them in `UI_KIT.md`. The kit needs:

| Component | Where | Why |
|---|---|---|
| `Container` | `components/ui/container.tsx` | Width-capped wrapper, token-driven padding |
| `Stack` | `components/ui/stack.tsx` | Vertical/horizontal flex with token gap |
| `Grid` | `components/ui/grid.tsx` | CSS grid with column / gap props |
| `Banner` | `components/ui/banner.tsx` | Page-level banner (Section 5 — distinct from `Alert`) |

Reference [`references/shadcn-recipes.md`](../references/shadcn-recipes.md) §"Wrapping pattern" for CVA conventions.

### 8. Compose Section 10 patterns

Per [`references/sections-catalog.md`](../references/sections-catalog.md) Section 10, compose these in `components/ui/patterns/`:

- `page-header.tsx`
- `toolbar.tsx`
- `confirm-dialog.tsx`
- `filter-bar.tsx`
- `empty-results.tsx`
- `app-shell.tsx`
- `data-table-page.tsx`
- `form-page.tsx`

Each pattern is composed of primitives. No new variants. No new colors. The pattern is just a typed React component that combines kit pieces in a repeatable shape.

### 9. Build the showcase route

Run [`build-showcase.md`](build-showcase.md). It produces `app/ui-kit/page.tsx` and the 10 section files.

### 10. Write `UI_KIT.md`

Copy [`templates/ui-kit.md.tmpl`](../templates/ui-kit.md.tmpl) to project root. Fill the placeholders:

- `{{TOKENS_SOURCE}}` — path to brand spec OR "filled by hand on YYYY-MM-DD"
- `{{BRAND_NAME}}` — e.g. "AD Ports — Corporate"
- `{{PRIMARY_VALUE}}` — the actual `--brand-primary` value
- `{{LAST_EDIT_DATE}}` — today
- `{{DARK_MODE_ENABLED}}` — `true` / `false`
- `{{RTL_ENABLED}}` — `true` / `false`
- `{{FRAMEWORK}}` — detected framework
- `{{TAILWIND_VERSION}}` — `v4` or `v3`
- `{{SHADCN_STYLE}}` — `new-york` or `default`
- `{{SCAFFOLD_DATE}}` — today

### 11. Run after-you-finish

Run [`after-you-finish.md`](after-you-finish.md). The kit is not done until that checklist passes 100%.

## Anti-patterns

- ❌ Installing all components in one giant CLI call. The diff is unreviewable; one component's failure cascades.
- ❌ Skipping hand-authored primitives because "we can add them later." Section 9 (Layout) needs them on day one.
- ❌ Inventing variants during scaffold. The kit ships with shadcn defaults; brand-specific variants come *after* the kit is verified working.
- ❌ Customizing CVAs in the same session as the install. Confirm the default works first, then iterate.
- ❌ Generating Section 10 patterns before Sections 1–9 are confirmed working. Patterns assume primitives work.

## After you finish

Record installed primitives, hand-authored primitives, Section 10 patterns, token file path, framework wiring, and any setup choices in `UI_KIT.md`.
- [ ] Notify the downstream role(s): `ai-quality-engineer`, `ai-reviewer`, `ai-ux-ui-designer`.

## Definition of Done

- All sections of [`references/sections-catalog.md`](../references/sections-catalog.md) have their primitives installed or hand-authored.
- All Section 10 patterns exist in `components/ui/patterns/`.
- `globals.css` is wired and the root layout imports it.
- `ThemeProvider` wraps the root if dark mode is enabled.
- `UI_KIT.md` exists with all placeholders filled.
- The dev server runs without errors (`pnpm dev` and visit `/`).
- Ready to run [`build-showcase.md`](build-showcase.md) to populate `/ui-kit`.
