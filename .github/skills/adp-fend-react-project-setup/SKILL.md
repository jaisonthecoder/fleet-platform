---
name: adp-fend-react-project-setup
description: "End-to-end initial setup for a production-grade React + TypeScript SPA (Vite, Tailwind CSS v4 + shadcn/ui, TanStack Query, React Router, react-i18next with optional Arabic/RTL, typed+validated env, error boundary, typed API client, route-level code-splitting, Vitest + Testing Library + MSW, oxlint + Prettier, CI, optional Docker/nginx + PWA) plus per-environment .env files. Business-agnostic starter — no domain features. Use when scaffolding a new React frontend or bringing an empty one up to a complete, verifiable baseline. Owned by AI Frontend Engineer (React)."
---

# adp-fend-react-project-setup

A copy-paste, end-to-end guide to stand up a **production-grade React SPA** from zero to a green build. It is deliberately **business-agnostic**: it wires the build tool, styling system, data layer, routing, i18n, cross-cutting concerns, per-environment config files, testing and CI — but contains **no domain/feature screens**. Add those afterwards using the feature layout in §6.

All versions in this document are the **latest available** at authoring time (see the version table in §20). Pin them, then bump deliberately.

---

## Intake — ask the user before scaffolding

**Do not guess on choices that change the generated tree.** If the answer is unknown and material, ask the user; otherwise apply the documented default. Batch these into **one** question round, then read back the resulting stack for confirmation before writing any files. **If the user suggests a different library, version, or layout, take it** — adjust the install commands and the version table (§20) to match.

| # | Question | Default if unanswered |
|---|---|---|
| 1 | App name and repo layout — standalone repo, or a package inside an existing pnpm workspace? | standalone, `web-app` |
| 2 | Package manager — pnpm or npm? | pnpm |
| 3 | Router — React Router (SPA), TanStack Router, or none (single screen)? | React Router |
| 4 | Styling — Tailwind CSS v4 + shadcn/ui, or something else? | Tailwind v4 + shadcn/ui |
| 5 | Server-state library — TanStack Query, RTK Query, or none? | TanStack Query |
| 6 | Forms — react-hook-form + Zod, or none for now? | react-hook-form + Zod |
| 7 | Internationalisation — none, English only, or multi-language (which, and any RTL like Arabic)? | none (structure kept i18n-ready) |
| 8 | Theming — light only, or light + dark? | light + dark |
| 9 | Auth / identity — MSAL (Entra), other, or none for now? | none (add later) |
| 10 | Linter — oxlint or ESLint? | oxlint |
| 11 | API integration — is there a backend base URL / dev proxy target? | dev proxy `/api` → `http://localhost:3000` |
| 12 | Which environments to generate — `.env.local`, `.env.ut`, `.env.production`, others (staging)? | local (development), ut, production |
| 13 | Deployment target — static host (Azure Static Web Apps / S3+CDN), Docker/nginx, or undecided? | undecided (Docker/nginx optional) |
| 14 | Node version / any data-residency or compliance constraint? | Node 24 |

Then confirm the resulting stack back to the user in one line before writing files. Drop any optional block (§13 i18n, auth, §18 Docker/PWA) and its dependencies/env keys the user does not need — keep the scaffold minimal and green.

---

## 0. What you get

- **React 19 + TypeScript (strict) on Vite** — instant HMR, fast builds, `tsc -b --noEmit` as the strict type gate.
- **Tailwind CSS v4** (CSS-first config) + **shadcn/ui** (Radix primitives) owned in-repo, themed by CSS-variable tokens (light + optional dark).
- **TanStack Query** for server state + a **typed API client** built on `fetch` (base-URL aware, RFC-7807-friendly errors).
- **React Router** with **route-level code-splitting** (`lazy` + `Suspense`) and per-route **error + loading boundaries**.
- **A root error boundary** with an accessible fallback.
- **Typed, validated environment config** (Zod) + `.env` files per environment; only `VITE_*` vars reach the client.
- **Optional i18n** (react-i18next) with **Arabic / RTL** support built to drop in without rework.
- **Tests**: Vitest + Testing Library + **MSW** with a shared setup.
- **Quality gates**: oxlint (single linter) + Prettier; TypeScript strict.
- **CI** (GitHub Actions) and **optional** Docker/nginx static serving + PWA.

---

## 1. Prerequisites & toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | **>= 24** | LTS. Pin in `.nvmrc`. |
| pnpm | **>= 11** | Recommended (workspace + catalog support). `npm` works too. |

```bash
node -v            # v24+
corepack enable    # or: npm i -g pnpm
echo "24" > .nvmrc
```

> Commands use `pnpm`. For `npm`: `pnpm add` → `npm i`, `pnpm add -D` → `npm i -D`, `pnpm <script>` → `npm run <script>`.

---

## 2. Initialise the project

Greenfield with the Vite React-TS template (keeps a minimal, current tree):

```bash
pnpm create vite@latest web-app --template react-ts
cd web-app
echo "24" > .nvmrc
git init
```

Set package metadata in `package.json`:

```jsonc
{
  "name": "web-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.13.1",
  "engines": { "node": ">=24", "pnpm": ">=11" }
}
```

Remove template noise the scaffold does not use (`src/App.css`, demo `src/assets/*`, boilerplate in `App.tsx`, the default README).

---

## 3. Install dependencies (latest)

**Runtime (core):**

```bash
pnpm add react@^19.2.7 react-dom@^19.2.7 \
  react-router-dom@^7.18.1 \
  @tanstack/react-query@^5.101.2 \
  zod@^4.4.3
```

**Styling — Tailwind v4 + shadcn/ui building blocks:**

```bash
pnpm add tailwindcss@^4.3.2 @tailwindcss/vite@^4.3.2 tw-animate-css@^1.4.0 \
  class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.6.0 lucide-react@^1.24.0 \
  @radix-ui/react-slot@^1.3.0 @radix-ui/react-dialog@^1.1.19 \
  @radix-ui/react-tooltip@^1.2.12 @radix-ui/react-label@^2.1.11
```

**Optional (include only what intake confirmed):**

```bash
# Forms
pnpm add react-hook-form@^7.81.0 @hookform/resolvers@^5.4.0
# i18n (+ Arabic/RTL)
pnpm add i18next@^26.3.6 react-i18next@^17.0.9
# Auth (Microsoft Entra)
pnpm add @azure/msal-browser@^5.17.0 @azure/msal-react@^5.5.2
# Data tables / maps as features need them
pnpm add @tanstack/react-table@^8.21.3
pnpm add maplibre-gl@^5.24.0
```

**Dev / tooling:**

```bash
pnpm add -D typescript@~7.0.2 @types/node@^26.1.1 @types/react@^19.2.17 @types/react-dom@^19.2.3 \
  vite@^8.1.5 @vitejs/plugin-react@^6.0.3 \
  vitest@^4.1.10 @vitest/coverage-v8@^4.1.10 jsdom@^29.1.1 \
  @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 @testing-library/user-event@^14.6.1 \
  msw@^2.15.0 \
  oxlint@^1.74.0 prettier@^3.9.5
```

> **Linter choice:** this guide uses **oxlint** (Rust-based, extremely fast, ports react / typescript / jsx-a11y rules). If your org standardises on ESLint, swap it for `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-config-prettier` and adjust the `lint` script. Do not run both — pick one linter; keep Prettier for formatting.

---

## 4. TypeScript configuration (strict)

`tsconfig.json` (project references):

```jsonc
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json` (app code — **strict on**, bundler resolution, `@/*` path alias):

```jsonc
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] },
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json` (config files — Vite/Vitest):

```jsonc
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

> `erasableSyntaxOnly` disallows TS-only runtime constructs (enums, parameter properties). Use plain field declarations in classes and `as const` object maps instead.

---

## 5. Vite configuration

`vite.config.ts` — reads `.env` files via `loadEnv`, sets the `@` alias, wires Tailwind, and configures Vitest:

```ts
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        thresholds: { lines: 70, branches: 60 },
      },
    },
  }
})
```

> Reading the proxy target through `loadEnv` (not `process.env`) is what makes `.env` files actually drive the dev proxy.

---

## 6. Project structure

```text
src/
  app/
    App.tsx                 # root: providers + error boundary + router
    error-boundary.tsx      # class error boundary
    app-error-fallback.tsx  # accessible fallback (i18n)
    providers/
      app-providers.tsx     # composes QueryClient + Theme (+ i18n) + Tooltip
      query-client.ts
      theme-provider.tsx    # light/dark (omit if light-only)
    routing/
      router.tsx            # route table + lazy pages + errorElement
      route-fallback.tsx    # Suspense loading fallback
      route-error.tsx       # per-route error element
    shell/
      app-shell.tsx         # layout: header + nav + <Outlet/>
      app-header.tsx
      app-sidebar.tsx
      nav.ts                # single source of nav items
  components/ui/            # shadcn/ui primitives (owned in-repo)
  features/                 # one folder per feature (add later)
  i18n/                     # config + locales/en.json (+ ar.json) — optional
  lib/
    env.ts                  # typed + validated env accessor
    api-client.ts           # typed fetch wrapper
    utils.ts                # cn()
  mocks/                    # MSW server + handlers (tests/dev)
    server.ts
    handlers/index.ts
  test/setup.ts
  index.css                 # Tailwind + design tokens (light + .dark)
  main.tsx                  # mounts <App/>
  vite-env.d.ts             # typed import.meta.env
```

Repository-root files created by this guide:

```text
.nvmrc  .editorconfig  package.json  pnpm-lock.yaml
tsconfig.json  tsconfig.app.json  tsconfig.node.json  vite.config.ts
components.json  .prettierrc  .oxlintrc.json  .gitignore
index.html
.env  .env.development  .env.ut  .env.production  .env.example  .env.local
.github/workflows/ci.yml
```

**Feature layout (apply to every feature you add later).** A feature owns its pages, hooks, components, and API calls; it never imports another feature's internals:

```text
src/features/<feature>/
  <feature>-page.tsx        # route entry
  use-<feature>.ts          # TanStack Query hooks (build on lib/api-client)
  <feature>.contract.ts     # Zod schemas / types shared with the API shape
  components/               # feature-local components (compose components/ui)
```

Rules: pages compose UI; data access goes through `lib/api-client` + Query hooks; every user-facing string goes through i18n (if enabled); shared primitives live in `components/ui` (added via the shadcn CLI), never hand-rolled per feature.

---

## 7. Environment configuration (typed + validated)

Vite loads env files by **mode** (later wins): `.env` → `.env.<mode>` → `.env.local` / `.env.<mode>.local`. **Only `VITE_*` variables are exposed to the client — and every one of them is bundled into the JS and is PUBLIC. Never put secrets in a `VITE_*` var.**

`src/vite-env.d.ts` — type the custom env:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'ut' | 'production'
  readonly VITE_APP_NAME: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`src/lib/env.ts` — validate once at startup (fail fast), expose typed values:

```ts
import { z } from 'zod'

const envSchema = z.object({
  appEnv: z.enum(['development', 'ut', 'production']).default('development'),
  appName: z.string().min(1).default('Web App'),
  apiBaseUrl: z.string().min(1).default('/api'),
})

export type AppEnv = z.infer<typeof envSchema>

export const env: AppEnv = envSchema.parse({
  appEnv: import.meta.env.VITE_APP_ENV,
  appName: import.meta.env.VITE_APP_NAME,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
})

export const isProduction = env.appEnv === 'production'
```

**Environment files (create all of them).** One committed template + shared defaults + one file per environment; `.env.local` (and `*.local`) are gitignored personal overrides.

| File | Loaded when | Committed |
|---|---|---|
| `.env` | always (shared defaults) | ✅ |
| `.env.development` | `pnpm dev` | ✅ |
| `.env.ut` | `pnpm build:ut` (`--mode ut`) | ✅ |
| `.env.production` | `pnpm build` | ✅ |
| `.env.example` | template (reference contract) | ✅ |
| `.env.local`, `.env.*.local` | always, personal overrides | ❌ gitignored |

`.gitignore` additions:

```gitignore
node_modules
dist
dist-ssr
coverage
*.tsbuildinfo
*.local
```

`.env` (shared, non-secret):

```dotenv
# WARNING: every VITE_* var is bundled into the client and is PUBLIC. No secrets.
VITE_APP_NAME=Web App
VITE_API_BASE_URL=/api
```

`.env.development`:

```dotenv
VITE_APP_ENV=development
VITE_API_BASE_URL=/api
VITE_API_PROXY=http://localhost:3000
```

`.env.ut`:

```dotenv
VITE_APP_ENV=ut
VITE_API_BASE_URL=https://web-app-ut.example/api
```

`.env.production`:

```dotenv
VITE_APP_ENV=production
VITE_API_BASE_URL=https://web-app.example/api
```

`.env.example` (committed contract — documents every key):

```dotenv
# Copy to .env.local for personal overrides (.env.local is gitignored).
# IMPORTANT: every VITE_* var is bundled into the client and is PUBLIC. No secrets here.
VITE_APP_ENV=development
VITE_APP_NAME=Web App
VITE_API_BASE_URL=/api
VITE_API_PROXY=http://localhost:3000
```

`.env.local` (gitignored starter):

```dotenv
# Personal local overrides (gitignored). Example:
# VITE_API_PROXY=http://localhost:4000
```

> Every key used through `import.meta.env` should be declared in `vite-env.d.ts` and consumed via `lib/env.ts` — never read `import.meta.env` ad hoc in components.

---

## 8. Tailwind v4 + shadcn/ui

Tailwind v4 is **CSS-first** — no `tailwind.config.js`. Tokens live as CSS variables in `src/index.css`; shadcn maps its theme variables onto them.

`src/index.css` (generic tokens — replace hues with your brand; keep the shape):

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.21 0.02 260);
  --card: oklch(1 0 0);
  --card-foreground: var(--foreground);
  --primary: oklch(0.55 0.15 260);
  --primary-foreground: oklch(0.99 0 0);
  --muted: oklch(0.96 0.005 260);
  --muted-foreground: oklch(0.5 0.02 260);
  --border: oklch(0.9 0.01 260);
  --input: oklch(0.87 0.01 260);
  --ring: oklch(0.55 0.15 260);
  --destructive: oklch(0.55 0.2 25);
  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.2 0.02 260);
  --foreground: oklch(0.95 0.01 260);
  --card: oklch(0.24 0.02 260);
  --card-foreground: var(--foreground);
  --primary: oklch(0.7 0.13 260);
  --primary-foreground: oklch(0.18 0.02 260);
  --muted: oklch(0.28 0.02 260);
  --muted-foreground: oklch(0.7 0.02 260);
  --border: oklch(0.32 0.02 260);
  --input: oklch(0.36 0.02 260);
  --ring: oklch(0.7 0.13 260);
  --destructive: oklch(0.62 0.2 25);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --radius-md: var(--radius);
}

* { border-color: var(--border); }
body { margin: 0; min-height: 100vh; background: var(--background); color: var(--foreground); }
```

`src/lib/utils.ts` (the shadcn `cn` helper):

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`components.json` (shadcn CLI config — points at the tokens + alias):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "css": "src/index.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Add primitives with the CLI (they are written into `src/components/ui/`, owned by you):

```bash
pnpm dlx shadcn@latest add button card badge input label dialog sheet tooltip skeleton
```

> **Consistency rule:** every interactive control/surface comes from `components/ui` (shadcn). Do not hand-roll raw `<button>`/`<input>`/modals in feature code. Custom visuals (charts, maps) are wrapped inside shadcn shells.

---

## 9. App providers

`src/app/providers/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
    },
  })
}
```

`src/app/providers/theme-provider.tsx` (light/dark; omit if light-only). Guard `localStorage`/`matchMedia` so it is test-safe:

```tsx
import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'app-theme'
interface ThemeContextValue { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void }
const ThemeContext = createContext<ThemeContextValue | null>(null)

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    try { window.localStorage?.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])
  const value = useMemo<ThemeContextValue>(() => ({
    theme, setTheme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }), [theme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
```

`src/app/providers/app-providers.tsx` (accepts an optional client for tests; include the i18n line only if i18n is enabled):

```tsx
import { useState, type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next' // remove if no i18n
import i18n from '@/i18n/config'                // remove if no i18n
import { createQueryClient } from './query-client'
import { ThemeProvider } from './theme-provider'

export function AppProviders({ children, queryClient }: { children: ReactNode; queryClient?: QueryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>{children}</ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}
```

---

## 10. Routing (code-split + boundaries)

`src/app/routing/route-fallback.tsx`:

```tsx
import { Loader2 } from 'lucide-react'

export function RouteFallback() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-64 items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
```

`src/app/routing/route-error.tsx`:

```tsx
import { useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error('Route error', error)
  return (
    <div className="mx-auto mt-10 max-w-lg">
      <Card>
        <CardHeader><CardTitle>Something went wrong</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>An unexpected error occurred.</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

`src/app/routing/router.tsx` — pages are `lazy` (own chunks), wrapped in `Suspense`, with a route `errorElement`:

```tsx
import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { AppShell } from '@/app/shell/app-shell'
import { RouteError } from './route-error'
import { RouteFallback } from './route-fallback'

const HomePage = lazy(() => import('@/features/home/home-page').then((m) => ({ default: m.HomePage })))
const NotFoundPage = lazy(() => import('@/features/misc/not-found').then((m) => ({ default: m.NotFoundPage })))

const page = (node: ReactNode): ReactNode => <Suspense fallback={<RouteFallback />}>{node}</Suspense>

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: page(<HomePage />) },
      { path: '*', element: page(<NotFoundPage />) },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
```

> **URL-based locale (optional):** to make the language part of the URL, nest routes under `:lang` and sync i18next from the param in a small `LocaleRoute` element (redirect `/` → `/<defaultLang>`). This makes language shareable/bookmarkable.

`src/app/App.tsx` and `src/main.tsx`:

```tsx
// App.tsx
import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers/app-providers'
import { ErrorBoundary } from './error-boundary'
import { createAppRouter } from './routing/router'

export function App() {
  const [router] = useState(createAppRouter)
  return (
    <AppProviders>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </AppProviders>
  )
}
export default App
```

```tsx
// main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found')
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---

## 11. Error boundary

`src/app/app-error-fallback.tsx`:

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AppErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Something went wrong</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>An unexpected error occurred.</p>
          <Button onClick={onReset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

`src/app/error-boundary.tsx` (class component — the one place a class is required):

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AppErrorFallback } from './app-error-fallback'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(): State { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Forward to error monitoring (App Insights / Sentry) here later.
    console.error('Unhandled UI error', error, info)
  }
  private readonly handleReset = (): void => this.setState({ hasError: false })
  render(): ReactNode {
    if (this.state.hasError) return <AppErrorFallback onReset={this.handleReset} />
    return this.props.children
  }
}
```

> Place the boundary **inside** `AppProviders` so its fallback can use theme/i18n. React Router render errors are caught by the route `errorElement` (§10); this boundary catches everything else.

---

## 12. Typed API client

`src/lib/api-client.ts` — base-URL aware, JSON in/out, normalised errors:

```ts
import { env } from './env'

export class ApiRequestError extends Error {
  readonly status: number
  readonly reasons: string[] | undefined
  constructor(status: number, title: string, reasons?: string[]) {
    super(title)
    this.name = 'ApiRequestError'
    this.status = status
    this.reasons = reasons
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    let title = response.statusText
    let reasons: string[] | undefined
    try {
      const body = (await response.json()) as { title?: string; reasons?: string[] }
      title = body.title ?? title
      reasons = body.reasons
    } catch { /* non-JSON error body */ }
    throw new ApiRequestError(response.status, title, reasons)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: 'DELETE' }),
}
```

Feature hooks build on it, e.g. `useQuery({ queryKey: ['things'], queryFn: () => apiClient.get<Thing[]>('/things') })`.

---

## 13. i18n (optional — include Arabic/RTL when required)

`src/i18n/config.ts`:

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ar from './locales/ar.json' // remove if English-only

export const supportedLanguages = ['en', 'ar'] as const
export type AppLanguage = (typeof supportedLanguages)[number]
export const defaultLanguage: AppLanguage = 'en'
export const rtlLanguages: readonly AppLanguage[] = ['ar']

export function directionFor(language: string): 'rtl' | 'ltr' {
  return (rtlLanguages as readonly string[]).includes(language.split('-')[0] ?? '') ? 'rtl' : 'ltr'
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
}

export default i18n
```

`src/i18n/locales/en.json` (and a mirrored `ar.json`):

```json
{ "common": { "loading": "Loading…", "retry": "Try again" } }
```

RTL rules: sync `document.documentElement.lang`/`dir` from the active language (in `AppProviders` via `i18n.on('languageChanged', ...)`), and use Tailwind **logical** utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`, `text-start`/`text-end`) — never hardcode left/right. Keep IDs/codes LTR-isolated inside RTL text.

> If i18n is **not** selected, skip this section and remove the `I18nextProvider`/`i18n` lines from `app-providers.tsx`. Keep components string-literal-light so i18n can drop in later.

---

## 14. Testing (Vitest + Testing Library + MSW)

`src/mocks/handlers/index.ts` and `src/mocks/server.ts`:

```ts
// handlers/index.ts
import type { RequestHandler } from 'msw'
export const handlers: RequestHandler[] = []
```

```ts
// server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'
export const server = setupServer(...handlers)
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from '../mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { cleanup(); server.resetHandlers() })
afterAll(() => server.close())

// jsdom has no matchMedia — stub it for the theme provider
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(),
  })),
})
```

Example smoke test (`src/app/App.test.tsx`) — render a route via a memory router with the providers, and drive APIs with MSW `server.use(...)` per test. Prefer `findBy*` for async content. Aim to cover the API client and each feature hook.

---

## 15. Quality gates (oxlint + Prettier)

`.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc", "jsx-a11y"],
  "categories": { "correctness": "error" },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }],
    "jsx-a11y/prefer-tag-over-role": "warn"
  },
  "overrides": [
    {
      "files": ["**/components/ui/**"],
      "rules": {
        "jsx-a11y/heading-has-content": "off",
        "jsx-a11y/label-has-associated-control": "off",
        "jsx-a11y/anchor-has-content": "off"
      }
    }
  ],
  "ignorePatterns": ["dist", "coverage", "node_modules"]
}
```

> The `components/ui` override relaxes a11y rules that false-positive on vendored shadcn primitives (content is passed at usage). Keep those rules strict for feature code.

`.prettierrc` (match your team style; this pairs cleanly with oxlint):

```json
{ "singleQuote": true, "semi": false, "trailingComma": "all" }
```

`.editorconfig` (repo root):

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

---

## 16. Scripts

`package.json` scripts:

```jsonc
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:ut": "tsc -b && vite build --mode ut",
    "preview": "vite preview",
    "lint": "oxlint",
    "typecheck": "tsc -b --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,css,json}\"",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 17. CI (GitHub Actions)

`.github/workflows/ci.yml`:

```yaml
name: web-app CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm test
      - run: pnpm build
```

> If any dependency resolves from a **private registry**, configure registry auth (an `.npmrc` with a token secret) before `install`. Public-registry-only projects work as-is.

---

## 18. Optional — containerisation & PWA

**Docker (multi-stage build → nginx static serve):**

```dockerfile
# Dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf — SPA history fallback
server {
  listen 80;
  root /usr/share/nginx/html;
  location / { try_files $uri /index.html; }
}
```

> Static hosts (Azure Static Web Apps, S3+CloudFront, Netlify) need only the SPA history fallback rule — no container. **PWA:** add `vite-plugin-pwa` and a manifest if offline/installable is required.

---

## 19. Run & verify (green-build checklist)

```bash
pnpm install
pnpm dev                 # http://localhost:5173
pnpm typecheck           # tsc -b --noEmit — clean
pnpm lint                # oxlint — 0 errors
pnpm format:check        # prettier — clean
pnpm test                # vitest — passing
pnpm build               # tsc -b && vite build — chunks split per route
pnpm build:ut            # builds with .env.ut
```

Done when all six gates are green, routes load as separate chunks, and the app renders in each configured environment (and, if i18n/dark enabled, in each language + theme).

---

## 20. Versions (latest at authoring)

| Package | Version |
|---|---|
| react / react-dom | ^19.2.7 |
| vite | ^8.1.5 |
| @vitejs/plugin-react | ^6.0.3 |
| typescript | ~7.0.2 |
| tailwindcss / @tailwindcss/vite | ^4.3.2 |
| class-variance-authority | ^0.7.1 |
| tailwind-merge | ^3.6.0 |
| clsx | ^2.1.1 |
| lucide-react | ^1.24.0 |
| @radix-ui/react-* | dialog ^1.1.19 · select ^2.3.3 · slot ^1.3.0 · tooltip ^1.2.12 · label ^2.1.11 |
| @tanstack/react-query | ^5.101.2 |
| @tanstack/react-table | ^8.21.3 |
| react-router-dom | ^7.18.1 |
| i18next / react-i18next | ^26.3.6 / ^17.0.9 |
| react-hook-form / @hookform/resolvers | ^7.81.0 / ^5.4.0 |
| zod | ^4.4.3 |
| @azure/msal-browser / @azure/msal-react | ^5.17.0 / ^5.5.2 |
| vitest / @vitest/coverage-v8 | ^4.1.10 |
| @testing-library/react | ^16.3.2 |
| jsdom | ^29.1.1 |
| msw | ^2.15.0 |
| oxlint | ^1.74.0 |
| prettier | ^3.9.5 |

Bump with `pnpm up --latest` (or `pnpm outdated`), then re-run the §19 gates before committing.

---

## Ownership

- **Primary owner:** AI Frontend Engineer (React) (`ai-frontend-react`)
- **Review cadence:** Quarterly, or when React / Vite / Tailwind / shadcn ship a major.
- **Companion skills:** `adp-fend-react-scaffold`, `adp-fend-react-component`, `adp-fend-react-page`, `adp-fend-react-tests`.

## Tier guidance

Per the AI Role Skills Tier Application Guide, include this skill whenever a **new React frontend** is scaffolded or an empty one is brought to a verifiable baseline. Drop optional blocks (i18n, auth, Docker, PWA) the product tier does not need.

## Definition of Done

- [ ] Intake answered and the stack confirmed with the user before writing files.
- [ ] All six gates green (§19): typecheck, lint, format, test, build, build:ut.
- [ ] `.env.example` committed; real/dummy env files gitignored via `*.local` and `.env.*` rules as configured; no secrets in any `VITE_*` var.
- [ ] Routes code-split; root error boundary + per-route error/loading boundaries present.
- [ ] Typed, validated env accessor in place; components read env via `lib/env.ts`.
- [ ] Business-agnostic — no domain features added by this skill.

## Handoff

- **Upstream:** intake answers (name, package manager, router, styling, data layer, i18n/RTL, theming, auth, linter, environments, deploy target, Node version).
- **Downstream:** `ai-frontend-react` to add feature slices; `ai-ux-ui-designer` for design tokens/components; `ai-platform-engineer` for hosting/CI wiring.
- **Evidence:** the green §19 checklist output and the generated file tree.
