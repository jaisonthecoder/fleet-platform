# Testing

What exists, what it actually protects, and where the gaps are.

---

## 1. Runners

| Kind | Runner | Command | Files |
|---|---|---|---|
| Unit / component | Vitest + jsdom | `pnpm test` | `src/**/*.test.ts(x)`, `src/**/*.spec.ts` |
| End to end + visual + a11y | Playwright | `pnpm e2e` | `e2e/*.spec.ts` |

`pnpm test` passes `--exclude e2e/**` so Vitest never picks up Playwright specs.

Testing Library (`@testing-library/react`, `user-event`, `jest-dom/vitest`) is
the component-testing style; there are no shallow renders and no snapshot tests
in the unit suite. Visual snapshots live in Playwright only.

---

## 2. The suite as it stands

| File | What it covers |
|---|---|
| `src/features/ui-workspace/Workspace.test.tsx` | Shell behaviour, locale parity, **the design-token guard**, **the stylesheet reference guard**, and a form round-trip |
| `src/features/auth/AccessPanel.test.tsx` | Sign-in access panel |
| `src/api/public/public-api.test.ts` | The public API stand-in against the zod contracts |
| `src/lib/relative-time.test.ts` | `timeAgo` unit behaviour |
| `src/features/pricing/money.spec.ts` | Money formatting |
| `eslint.config.test.mjs` | Asserts the flat config preserves every legacy rule and its options |
| `e2e/foundation.spec.ts` | Responsive navigation, shell persistence, Spanish rendering, axe, and full-page screenshots |

---

## 3. The guards worth understanding

These are the tests that will fail on changes that look harmless.

### 3.1 Design-token guard

In `Workspace.test.tsx`:

> *"matches canonical tokens and keeps all stylesheet aliases resolvable without cycles"*

It does four things:

1. Reads `src/design-system/styles/tokens.css`.
2. Reads the **first fenced ```css block** out of
   `../../docs/noatum-designsystem.md` — a file in the **parent repository**,
   outside this submodule — and treats it as canonical.
3. For every declaration in that canonical block, asserts `tokens.css` declares
   the same name with the same value. Comparison is normalised: hex colours are
   lowercased and numbers are canonicalised (`0.50` ≡ `0.5`), whitespace is
   stripped.
4. Asserts `tokens.css` contains no `prefers-color-scheme`.

**Consequences.** Any token named in that document is pinned: you cannot change
its value here without changing the design-system document in the parent repo.
Tokens *not* in the canonical block are unconstrained — that is where the
`--noa-*` extensions live and why new tokens are safe to add.

This is also a real cross-repository coupling: running the unit suite requires
the parent checkout to be present at `../../docs/`.

### 3.2 Stylesheet reference guard

Same test, second half. It concatenates **every `.css` file under
`src/design-system`** (recursively) and then, for every `var(--x)` reference
anywhere in that corpus:

- asserts `--x` is defined somewhere in the corpus;
- walks the definition's own `var()` references recursively;
- fails if a name appears in its own ancestor chain — i.e. **cycles are a test
  failure**.

One name is allowlisted as runtime-provided and therefore exempt from the
"must be defined" rule:

```
--radix-select-content-available-height
```

A separate test proves the allowlist works and that an unresolvable alias still
throws.

**Consequence.** A `var()` typo in any design-system stylesheet fails the unit
suite, not just visual review. Note the scan covers `src/design-system` **only**
— stylesheets under `src/features` and `src/shared` are not checked.

### 3.3 Locale parity — enforced twice

- **Build time**: the `noatum-locale-parity` Vite plugin throws at `buildStart`
  if the two locale files have different key sets, or if any Spanish value is
  blank or whitespace.
- **Test time**: `Workspace.test.tsx` asserts the same two conditions.

So a missing Spanish string fails `pnpm build` *and* `pnpm test`. Adding an
English key without its Spanish counterpart breaks the build immediately.

### 3.4 Lint-config guard

`eslint.config.test.mjs` calls `eslint.calculateConfigForFile()` against a
fixture and asserts the flat config still carries every rule and option from the
legacy `.eslintrc.cjs`, including severities.

**Known flake**: this test computes a full config and intermittently exceeds
Vitest's default 5 s timeout on a cold cache. It has been observed to fail once
and pass on an immediate re-run. If it is the only failure, re-run before
investigating.

---

## 4. End-to-end suite

`e2e/foundation.spec.ts` runs against the two Playwright projects and covers:

- **Responsive navigation** — bottom destinations and the shared drawer at phone
  and tablet widths, with screenshots per width.
- **Shell persistence** — the shell survives client navigation, direct URL entry
  and browser history; focus moves to `main`; `aria-current="page"` tracks.
- **Localisation** — a Spanish rendering is screenshotted.
- **Accessibility** — `@axe-core/playwright` (`AxeBuilder`) runs against the
  workspace.
- **The listing pattern** — pagination, the right-hand filter drawer, grid and
  card views, in both languages.

Screenshots are `fullPage` with `animations: 'disabled'`, stored in
`e2e/foundation.spec.ts-snapshots/`.

Note the e2e suite exercises the **UI-kit workspace routes** (`/controls`,
`/data`, `/listings`, `/overlays`, `/foundation`), not the product screens.

---

## 5. What is not covered

Stated plainly so nobody assumes otherwise:

- **No test renders a product page.** The dashboard, Team, Customers,
  Organisations, Staff and login-flow screens have no component tests.
- **No test exercises the authenticated client.** `authenticatedClient` and its
  four auth branches are untested.
- **No MSW or equivalent.** The only mocked transport is the public API
  stand-in, which is a deliberate application-level seam rather than a test tool
  — though `public-api.test.ts` reuses it as a fixture.
- **Feature and shared stylesheets are outside the CSS guard** (§3.2).
- **No axe run over product screens** — the a11y check targets the UI kit only.
- **No coverage thresholds** are configured.

---

## 6. Conventions when adding tests

- Co-locate: `Thing.test.tsx` next to `Thing.tsx`; `.spec.ts` is used for pure
  logic modules.
- Prefer role-based queries (`getByRole`) over test ids; the existing suite has
  no `data-testid` anywhere.
- Import the `@` alias — it resolves in Vitest through the Vite config.
- If a module reads the clock, take `now` as a parameter so the test can pin it.
  `src/lib/relative-time.ts` is the reference example.
- If a module fetches, let it take its transport or its schema as an argument
  rather than reaching for a global mock.

---

## 7. Verification policy

This repository's parent `CLAUDE.md` states that **verification is
user-scheduled**: tests, typecheck, lint and formatters are not run
automatically on finishing a change. Tests are written alongside the code and
left pending until someone asks for them to run. Treat "implemented" and
"verified" as separate claims.
