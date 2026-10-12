# Code conventions

Patterns this codebase actually uses, and the rules that will fail your build if
you do not.

---

## 1. File layout

```
src/features/<name>/
├── api/          TanStack Query hooks, one file per resource
├── components/   feature-local components (+ .module.css)
├── pages/        route targets (+ .module.css)
└── i18n/         only if the feature needs its own namespace
```

- One folder per feature. A feature never imports another feature's internals.
- Anything used by two features moves to `src/shared/`.
- Anything used on exactly one screen stays in that feature folder.
- Pages export a named function **and** usually a default:
  `export function TeamPage() {}` + `export default TeamPage;`

Naming: `PascalCase.tsx` for components, `kebab-case.ts` for modules,
`camelCase` for CSS-module classes.

---

## 2. Imports

Type-only imports are **mandatory** (`@typescript-eslint/consistent-type-imports`
is an error, and `isolatedModules` is on):

```ts
import { useState, type ReactNode } from 'react';
import type { components } from '../../../api/generated/schema';
```

Two import bans are enforced:

```
apps/noatum-customer-portal-api/**   → generate the client instead
cw1-simulator/**                     → never imported by the SPA
```

`@/` resolves to `src/` in both `tsconfig.json` and `vite.config.ts` — **change
both together** or the editor and the bundler disagree, and it fails only at
build time. Relative paths are still common in feature code; both work.

---

## 3. React patterns the lint rules force

`react-hooks` rules are errors here, and two in particular shape the code.

### `set-state-in-effect`

Calling `setState` synchronously inside an effect is an **error**. Three
replacements are used in this codebase:

**Adjust state during render** — for "a prop changed, reset derived state":

```tsx
const [shownRef, setShownRef] = useState(urlRef);
if (urlRef !== shownRef) {
  setShownRef(urlRef);
  setQuery(urlRef);
}
```

React re-runs the component immediately, before paint, and nothing cascades.
Note you must **not** read a ref during render — that is its own violation.

**Key the component** — for "a new subject means fresh state":

```tsx
<AccountActionDialog key={`${subject.id}:${action}`} … />
```

Remounting is cleaner than clearing four fields by hand.

**Do it on the event** — for "record that something happened":

```ts
queryFn: async ({ signal }) => {
  const found = await publicGet(…);
  options.onResolved?.(found.reference);
  return found;
}
```

An arrival is an event, not a state the render must be kept in sync with.

### `incompatible-library`

`form.watch()` from react-hook-form returns a fresh function each render, so
React Compiler skips memoising the whole component. Use `useWatch` instead:

```ts
const selected = useWatch({ control: form.control, name: 'roleKeys' });
```

---

## 4. Forms

`react-hook-form` + zod through `@hookform/resolvers`. Where a schema mirrors an
API DTO it is **generated** (`staff-role-form.ts`), not hand-written.

The server validates every request regardless. **A client-side check is a
convenience, never a second rulebook** — if a rule matters, it lives on the
server and the form merely answers faster.

---

## 5. Required states

Every data view provides **loading, empty and error** states. This is not
optional.

```tsx
if (query.isPending) return <StatePanel title={t('loading')} />;
if (query.isError)   return <StatePanel title={t(errorKey(query.error))} action={retry} />;
if (rows.length === 0) return <StatePanel title={t('empty')} />;
```

`DataGrid` handles all four internally — prefer it to hand-rolling a list.

---

## 6. Formatting values

| Value | Use |
|---|---|
| Date | `<DateValue value={iso} />` or `formatDate(iso)` — **DD.MM.YYYY**, never a hand-built string |
| Relative age | `timeAgo(iso, i18n.language, now)` with `useNow()` driving `now` |
| Identifier | `<Code>{orgCode}</Code>` — forces the monospace face |
| Money | Currency code plus amount, never a symbol alone |

Anything the browser would compute the same way as the server comes from an
endpoint, not a duplicated function. Duplicating it is how the number on screen
ends up disagreeing with the number on the quotation.

---

## 7. Browser storage

Always guarded, always per-viewer, never for anything that must be reliable:

```ts
function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
}
```

Storage throws in a private window and comes back empty when site data is
cleared. Neither is an error worth showing.

Keys in use: `noatum.csrf` (localStorage), `noatum.dev-identity`
(sessionStorage), `noatum.recent-staff` (localStorage), `noatum.public.recent`
(localStorage).

---

## 8. URL as state

A view somebody should be able to share, refresh or reach with Back belongs in
the URL, not `useState`:

```tsx
const [params, setParams] = useSearchParams();
const urlRef = (params.get('ref') ?? '').trim();
const urlKind = ReferenceKindSchema.safeParse(params.get('kind'));
```

**Parse what arrives from the address bar** — it is untrusted input. Push for a
new view; replace when undoing one.

---

## 9. Comments

The codebase comments **why**, not what. A comment earns its place by recording a
decision, a constraint, or a trap:

```ts
/* Not type="search": the browser's own × clears the field but leaves the result
   card standing, which is the exact mismatch the Clear button exists to avoid. */
```

Match the density of the file you are editing. Do not narrate obvious code.

---

## 10. Line endings

Several files are checked out **CRLF** on Windows while Prettier is configured
`endOfLine: "lf"`. A script that rewrites source must normalise, edit, then
restore:

```js
const raw = readFileSync(path, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.split('\r\n').join('\n') : raw;
// …edit s…
writeFileSync(path, crlf ? s.split('\n').join('\r\n') : s);
```

Skip this and every line shows as changed.

---

## 11. Before you push

```bash
pnpm --filter noatum-customer-portal-ui run typecheck
```

```bash
pnpm --filter noatum-customer-portal-ui run lint
```

```bash
pnpm --filter noatum-customer-portal-ui run test
```

Lint runs at `--max-warnings=0`, so a warning fails exactly like an error.

**This app is a submodule.** A change spans two repositories: commit and push
here, then commit the moved pointer in the parent. Work pushed to the child that
the parent does not point at is invisible to a fresh clone and to CI — and the
pipelines trigger on the parent's pointer, never on a child push.

```bash
git -C apps/noatum-customer-portal-ui push origin dev
```

```bash
git add apps/noatum-customer-portal-ui && git commit -m "…" && git push origin dev
```
