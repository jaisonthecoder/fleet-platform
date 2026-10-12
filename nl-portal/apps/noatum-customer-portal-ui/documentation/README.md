# UI technical documentation

Technical reference for `noatum-customer-portal-ui` — the React + Vite SPA.

**Scope:** how this application is built, styled, routed, tested and extended.
Nothing here is business requirement. For what the product is, why a feature
exists, or which slice owns it, see the **parent repository's `/docs`**.

---

## Start here

| If you are… | Read |
|---|---|
| Setting the project up for the first time | [02 — Build and tooling](02-build-and-tooling.md) |
| Trying to understand the shape of it | [01 — Architecture](01-architecture.md) |
| Building a screen | [04 — Components](04-component-library.md) → [03 — Tokens](03-design-tokens.md) → [08 — Styling](08-styling.md) |
| Building the new UI-kit components | [UI kit component plans](ui-kit/README.md) |
| Adding a route or a nav item | [05 — Routing and shells](05-routing-and-shells.md) |
| Calling an endpoint | [06 — Data layer](06-data-layer.md) |
| Adding text | [07 — Internationalisation](07-internationalisation.md) |
| Wondering whether something already exists | [12 — Feature inventory](12-feature-inventory.md) |
| About to open a pull request | [11 — Conventions](11-conventions.md) |

---

## Contents

| # | Document | Covers |
|---|---|---|
| 01 | [Architecture](01-architecture.md) | Source layout, layer rules, bootstrap order, the two pre-router dispatches, identity paths, where state lives, deliberate omissions |
| 02 | [Build and tooling](02-build-and-tooling.md) | Scripts, **generated code**, environment variables, TypeScript, ESLint, Prettier, Vite, Tailwind/shadcn, entry point |
| 03 | [Design tokens](03-design-tokens.md) | Every CSS custom property, **the two ramps**, load order, known inconsistencies, what the tests pin |
| 04 | [Component library](04-component-library.md) | Every design-system export with exact props, `DataGrid` in full, primitives, variant unions |
| 05 | [Routing and shells](05-routing-and-shells.md) | Full route table, the three shells, the four navigation arrays, adding a page |
| 06 | [Data layer](06-data-layer.md) | The three clients, four auth branches, the public transport seam, TanStack Query conventions, generated types |
| 07 | [Internationalisation](07-internationalisation.md) | i18next setup, namespaces, **build-time parity enforcement**, key conventions, editing `es-ES.json` |
| 08 | [Styling](08-styling.md) | CSS Modules vs globals vs Tailwind, token rules, state without colour, global element rules |
| 09 | [Accessibility](09-accessibility.md) | Focus, labels, announcements, semantics, colour, motion, and the per-screen checklist |
| 10 | [Testing](10-testing.md) | Runners, **the token and stylesheet guards**, the e2e suite, what is not covered |
| 11 | [Conventions](11-conventions.md) | File layout, imports, the React patterns the lint rules force, forms, storage, URL state, line endings |
| 12 | [Feature inventory](12-feature-inventory.md) | Every feature folder, which are empty, where the shared pieces live |
| UI kit | [Component implementation plans](ui-kit/README.md) | Component-only plans for all 81 kit codes across 12 categories; no screen migration |

---

## Five things that catch people out

1. **`src/api/generated/` is git-ignored and required.** A fresh clone does not
   typecheck until you run `pnpm api:generate:offline`, which reads
   `openapi.json` from the **sibling API submodule**. This app cannot generate
   its client from its own repository alone.

2. **There are two spacing ramps.** `--space-*` for the customer surface,
   `--noa-space-*` for the staff surface. They diverge from step 3 onward. The
   shell tells you which to use.

3. **A missing Spanish string fails the build**, not just the tests — the
   `noatum-locale-parity` Vite plugin throws at `buildStart`.

4. **The unit suite reaches into the parent repository.** `Workspace.test.tsx`
   pins `tokens.css` against a fenced block in `../../docs/noatum-designsystem.md`.

5. **Route-tree selection is non-reactive.** Crossing `/portal` ↔ `/app`
   requires a document load, which is why the shells use
   `window.location.replace` across that boundary.

---

## Maintaining these documents

They describe the code as it is, including its inconsistencies — those are
recorded deliberately in `03 §7`, `06 §5`, `07 §7` and `12 §5` so nobody
rediscovers them as bugs.

When you change the code, change the document that describes it. If you find
something here that is no longer true, it is a defect: fix it in the same commit
as the code.
