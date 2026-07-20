# app-ui

Frontend for the Carpool & Fleet Management Platform (AD Ports Group).

## Stack

- **React 19 + TypeScript** (strict) on **Vite**
- **Tailwind CSS v4** (CSS-first config in `src/index.css`; exact-hex design tokens, Wayfinder palette)
- **shadcn/ui** (Radix primitives) in `src/components/ui`, styled by the design tokens
- **TanStack Query** for server state
- **react-i18next** — English + Arabic with automatic **RTL**
- **react-router-dom** for routing
- **Vitest + Testing Library + MSW** for tests

Design language + phase plan live in [developer-docs/design-system.md](developer-docs/design-system.md)
and [developer-docs/design-implementation-plan.md](developer-docs/design-implementation-plan.md).
The layout follows the modern-mix "Helm" prototype re-skinned to the Wayfinder palette
(navy `#0B3D5C`, gold `#E2A33D`, warm paper, soft warm border `#E0DACB`); one font family (IBM Plex Sans).

## Project structure

```
src/
  app/
    App.tsx              # root: providers + router
    providers/           # query client, theme (light/dark), i18n composition
    routing/             # route table + router factory
    shell/               # fixed header + sidebar layout, nav table
  components/ui/         # shadcn/ui primitives (owned in-repo)
  features/              # one folder per feature (home, misc/coming-soon, …)
  i18n/                  # i18next config + en/ar catalogs
  lib/                   # utilities (cn)
  mocks/                 # MSW server + handlers (tests)
  index.css              # Tailwind + design tokens (light + .dark)
```

## Scripts

```bash
pnpm dev            # start Vite dev server (mode: development)
pnpm build          # type-check + production build (mode: production)
pnpm build:ut       # type-check + build for UT/UAT (mode: ut)
pnpm preview        # preview a production build
pnpm typecheck      # type-check only
pnpm lint           # oxlint (the single linter)
pnpm format         # prettier --write
pnpm format:check   # prettier --check (CI)
pnpm test           # vitest run
pnpm test:coverage  # vitest with coverage
```

## Environment variables

Config uses Vite's mode-based env files (in load order, later wins):

| File | Loaded when | Committed |
|------|-------------|-----------|
| `.env` | always (shared defaults) | yes |
| `.env.development` | `pnpm dev` | yes |
| `.env.ut` | `pnpm build:ut` (`--mode ut`) | yes |
| `.env.production` | `pnpm build` | yes |
| `.env.example` | never (template) | yes |
| `.env.local`, `.env.*.local` | always, personal overrides | **no** (git-ignored) |

Rules:
- Only `VITE_*` variables are exposed to the client — and **all of them are bundled into the JS and are PUBLIC**. Never put secrets in a `VITE_*` var; secrets stay in the backend / Key Vault.
- Access env through the validated, typed helper [src/lib/env.ts](src/lib/env.ts) (`import { env } from '@/lib/env'`), not `import.meta.env` directly. It fails fast if misconfigured. Types live in [src/vite-env.d.ts](src/vite-env.d.ts).
- Copy `.env.example` → `.env.local` for personal overrides.

## Conventions

- Every user-facing string goes through i18n (`useTranslation`); no hardcoded copy.
- **Locale is URL-based** (`/:lang`, e.g. `/en`, `/ar`). `LocaleRoute` syncs i18next from the URL; the header language toggle navigates to the locale-prefixed path. Keep internal links locale-aware.
- Use Tailwind **logical** utilities (`ps-*`, `pe-*`, `start-*`, `text-start`) so layouts mirror in RTL.
- Theme is switched from the header; light/dark and EN/AR are first-class.
- Add new UI primitives via shadcn into `components/ui`; compose features under `features/`.
- The API is proxied in dev: `/api` → `VITE_API_PROXY` (default `http://localhost:3100`).
- i18n rules for new components are enforced by [.github/instructions/ui-i18n.instructions.md](../.github/instructions/ui-i18n.instructions.md).
