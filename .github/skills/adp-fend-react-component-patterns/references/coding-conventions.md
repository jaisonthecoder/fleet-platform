# Coding Conventions (React)

Naming, imports, exports, aliases, linting, config — the shared rules that keep a codebase consistent across developers.

## Contents

- [Package manager](#package-manager)
- [Search before creating](#search-before-creating)
- [File naming](#file-naming)
- [Export style](#export-style)
- [Component naming](#component-naming)
- [Path aliases](#path-aliases)
- [Import order](#import-order)
- [TypeScript](#typescript)
- [Linting](#linting)
- [Prettier](#prettier)
- [Styling - Tailwind (the AD Ports standard)](#styling--tailwind-the-ad-ports-standard)
- [Class composition](#class-composition)
- [Environment & configuration](#environment--configuration)
- [Commit messages](#commit-messages)
- [Pull request conventions](#pull-request-conventions)
- [Review process](#review-process)
- [Folder & file skeleton reminder](#folder--file-skeleton-reminder)

## Package manager

**pnpm is the AD Ports standard.** Workflow examples in this skill use `pnpm <script>`; if your repo uses `npm` or `yarn` swap accordingly, but do not mix package managers within an app. Lockfile (`pnpm-lock.yaml`) is committed.

## Search before creating

Before writing any new component, hook, util, or schema, search for an existing one. The codebase already has answers for most needs:

| Need | Search first |
|---|---|
| UI primitive (button, dialog, input, select, popover, table, tooltip, ...) | `@shared/ui/*` (shadcn-vendored). Deeper rules in `references/ui-primitives.md`. |
| Icon | `@shared/ui/icon` (`<Icon name="..." />`) — never `lucide-react` directly |
| Generic hook (debounce, disclosure, clipboard, local storage, intersection, ...) | `@shared/hooks/*` |
| Feature-internal hook | `features/<feature>/hooks/ui/*` |
| Format / parse / merge util | `@shared/lib/*` (`cn`, `formatCurrency`, `formatDate`, ...) |
| HTTP call | `@shared/api/http` + `features/<feature>/api/<feature>.client.ts` — never raw `fetch` / `axios` in features |
| Form scaffolding | shadcn `<Form>` + `<FormField>` (in `@shared/ui/form`) — never hand-rolled controlled inputs |
| Client state (local / feature / app) | The kind's chosen tool — see `references/react-architecture.md` §Reactivity and State. Never introduce a second state library. |
| Server state | TanStack Query via the feature's query hooks. Never `useEffect` + `useState` for data. |
| Validation message i18n | The central `validationMessage` helper (see `references/i18n-and-locale.md` and `references/react-architecture.md` §Forms) — never inline strings. |

**If it exists, import it.** If it almost-exists but is missing a variant, edit the existing one. **Do not** create `MyButton`, `CustomDialog`, `IconWrapper`, `useFetch`, or any parallel implementation. Forking primitives is a hard violation of the skill.

This is the single rule most new code violates. AI generators in particular need to see this rule before any other.

For the **primitive-specific** rules (customization, icon registry, dark-mode behavior, RTL verification, `// AD Ports edit:` markers), see `references/ui-primitives.md` ⛔ — it's the deeper dive on the same rule applied to `@shared/ui/`.

## File naming

- **Kebab-case for all files and folders**: `vessel-list.page.tsx`, `use-vessel-booking.ts`, `query-keys.ts`.
- Multi-word React components keep kebab-case in the file name; the export is PascalCase. File `vessel-list.page.tsx` → export `VesselListPage`.
- Suffixes communicate role:
  - `*.page.tsx` — route-level page component.
  - `*.component.tsx` — optional; most feature components omit the suffix and just use the name (`vessel-row.tsx`).
  - `*.test.tsx` — unit/component test.
  - `*.spec.tsx` — reserved for Playwright/E2E specs.
  - `*.stories.tsx` — Storybook stories.
  - `*.types.ts` — type-only module.
  - `*.schemas.ts` — zod schemas.
  - `*.routes.tsx` — feature route definitions.
  - `use-*.ts` — hooks.

## Export style

- **Named exports only.** No `export default` except where a framework demands it (`React.lazy(() => import('./x'))` — and even then, use a named `.then` re-map to keep the named export).
- One primary export per file. Colocate tightly-coupled helpers (`function helper() {...}`) in the same file if they're private to the module.
- Re-export through the feature's `index.ts`, never through a `components/index.ts` barrel.

```ts
// ❌
export default function VesselList() { ... }

// ✅
export function VesselList() { ... }
```

React.lazy exception:

```tsx
// Re-map the named export to React.lazy's required `default` shape — keeps the source file's named-only convention intact.
const VesselListPage = lazy(() =>
  import('./vessel-list.page').then((m) => ({ default: m.VesselListPage })),
);
```

## Component naming

- Components: `PascalCase` (`VesselList`, `BookingDialog`).
- Hooks: `camelCase` starting with `use` (`useVesselBooking`, `useDisclosure`).
- Utilities: `camelCase` (`formatCurrency`, `parseFilters`).
- Constants: `SCREAMING_SNAKE_CASE` for module-level immutable values (`DEFAULT_PAGE_SIZE`).
- Types and interfaces: `PascalCase` (`Vessel`, `VesselFilters`). Prefer `type` over `interface` unless you need declaration merging.
- Enums: avoid. Use a union of string literals (`type Status = 'available' | 'booked'`).
- Boolean props and state: `is*` / `has*` / `can*` / `should*` (`isLoading`, `hasError`, `canEdit`). Not `loading`, not `error`.

## Path aliases

Configure in `tsconfig.json` and the bundler. Preferred aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@app/*": ["src/app/*"]
    }
  }
}
```

Rules:
- Use `@/` for imports that cross top-level directories.
- Use relative paths (`./`, `../`) for imports within the same feature.
- **Never** deep-import into another feature: `@features/other/hooks/queries/...` is banned; go through `@features/other` (which resolves to its `index.ts`).

## Import order

Enforced by `eslint-plugin-import` `import/order` rule. One blank line between groups.

1. Node built-ins (rare in the browser).
2. External packages (`react`, `react-router-dom`, `@tanstack/react-query`).
3. Internal aliases (`@/shared/...`, `@/features/...`).
4. Parent relatives (`../../..`).
5. Sibling relatives (`./something`).
6. Type-only imports (`import type { ... }`) — **inline within their respective group** (external types alongside external values, internal types alongside internal values). Do not collect all type imports at the bottom.
7. Style imports (`./foo.module.css`).

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { http } from '@shared/api/http';
import type { Vessel } from '@features/vessels';

import { parseFilters } from '../lib/parse-filters';

import { vesselKeys } from './query-keys';
```

## TypeScript

- `strict: true` in `tsconfig.json`. Also `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`.
- **No `any`.** Use `unknown` at boundaries and narrow with zod or a type guard.
- Derive types from zod schemas (`type Vessel = z.infer<typeof vesselSchema>`) so the schema is the single source of truth.
- Use discriminated unions for props with mutually exclusive variants.
- Prefer `as const` on literal arrays/objects to get narrow tuple/readonly types.
- Do not use non-null assertions (`value!`) — narrow explicitly.

## Linting

Minimum plugin set, enforced in CI:

- `@typescript-eslint/recommended` (strict variant).
- `eslint-plugin-react-hooks` — rules of hooks.
- `eslint-plugin-jsx-a11y` — accessibility lints on JSX.
- `eslint-plugin-react-refresh` — catches code that breaks Fast Refresh.
- `eslint-plugin-import` — import order and no-cycle.
- `eslint-plugin-tailwindcss` — class order, no conflicting classes, no deprecated utilities (Tailwind projects).
- `eslint-plugin-testing-library` + `eslint-plugin-jest-dom` (or `vitest-globals`) — idiomatic test assertions.
- `@tanstack/eslint-plugin-query` — catches common TanStack Query pitfalls (missing `queryKey`, mutating cache directly, unstable keys).

Treat warnings as errors in CI. Zero `eslint-disable` without a comment explaining why and a date.

## Prettier

Use Prettier for formatting. Treat its output as canonical — do not hand-format around it.

- Single quotes, semicolons, trailing commas `all`, print width 100.
- Prettier and ESLint stylistic rules must not overlap — disable stylistic ESLint rules that Prettier handles.

## Styling — Tailwind (the AD Ports standard)

**Tailwind is the standard.** v4 is the preferred direction (CSS-first config, no `tailwind.config.js`); v3 is supported until apps upgrade. Do not introduce CSS modules in new code — they're tolerated only in legacy apps that pre-date the standard, and those apps should plan migration.

No inline `style={{}}` attributes except for runtime-computed values (e.g. dynamic positioning, animation `--vars`).

## Class composition

Use `clsx` for conditional classes and `tailwind-merge` to resolve Tailwind conflicts. For components with many variants, use `class-variance-authority` (`cva`).

```ts
// @shared/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge conditional Tailwind classes via clsx, then resolve conflicts (e.g. `p-2` vs `p-4`) via tailwind-merge so the last-wins rule produces the expected styling.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Rules:
- Every component that accepts `className` merges via `cn(baseClasses, className)`.
- Prefer `cva` over hand-rolled conditionals once a component has 3+ boolean/variant props.
- Always use logical properties in classnames (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) — never `ml-*` / `mr-*` / `left-*` / `right-*` on layout-affecting elements.

## Environment & configuration

- Use `import.meta.env.VITE_*` for build-time config. Prefix all exposed vars with `VITE_`.
- Validate env at bootstrap with zod. Crash early on missing or malformed values.

```ts
// src/shared/config/env.ts
import { z } from 'zod';

// Schema for build-time env vars — every VITE_* the app reads must be declared here.
const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_APP_ENV: z.enum(['dev', 'uat', 'prod']),
});

// Validate at module load so a missing/malformed env crashes the app at boot, not at first call site.
export const env = envSchema.parse(import.meta.env);
```

- For runtime config (values that change per deployment without a rebuild), fetch `/config.json` at bootstrap and validate with zod. Don't bake runtime config into the bundle.
- Never put secrets in `VITE_*` vars — they ship to the browser.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`). Scope optional but recommended: `feat(vessels): add status filter`.

## Pull request conventions

- Title matches the commit style.
- Description names the feature module(s) touched and the user-visible change.
- Screenshot or short video for any UI change (both `en` LTR and `ar` RTL when applicable).
- Self-review checklist from `workflows/harden-feature.md` §First-PR self-review checklist completed before requesting review.
- Bundle-size diff and Lighthouse numbers for feature work that affects page-load pages.

## Review process

Who reviews what determines speed and signal. Default mapping:

| Change touches | Required reviewer |
|---|---|
| `@shared/ui/*` (primitive added or edited) | **Design-system owner** + one peer |
| `@shared/api/*` (HTTP, interceptors, auth) | **Security engineer** + backend partner |
| `@shared/config/env.ts` (env shape) | **Platform/SRE** + one peer |
| Feature code only (`features/<x>/...`) | One peer in the feature team |
| New feature module (`features/<new>/`) | One peer + **Design-system owner** (UI compliance) |
| CI / pipeline files | **Platform/SRE** |
| `tsconfig.json`, ESLint config, Vite config | One peer + governance lead (if standards-affecting) |

**Lead-time SLA**: first review within **1 working day** for feature PRs, **same day** for hotfixes. PRs older than 3 days without review get pinged in the team channel; older than a week, escalate to the **frontend tech lead** (or, if absent, the engineering manager). Repeated escalation across PRs is a process signal — fix the assignment / capacity, not just the individual PR.

**Merge gate**: green CI + at least one approving review + no unresolved threads. Author merges (squash by default; preserve commits only when the PR has clean atomic history).

**Author responsibilities**:
- Run the self-review checklist before requesting review. Reviewers should not catch trivia.
- Respond to threads within 1 working day; "I'll fix this in a follow-up" is not an acceptable resolution unless an issue is filed.
- Keep PRs ≤ 400 lines diff where possible. Larger PRs need a written reason in the description.

**Reviewer responsibilities**:
- Read the description first; read the code with the description in mind.
- Cite skill rules when rejecting (`SKILL.md ⛔`, `references/react-architecture.md §X`) — don't just say "this is wrong."
- Distinguish blocking comments (request changes) from suggestions (comment) clearly.

## Folder & file skeleton reminder

See `references/react-architecture.md` §Feature Module Structure for the canonical layout. Conventions above are what keep every module inside that layout consistent across developers.
