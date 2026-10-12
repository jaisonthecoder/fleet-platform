# Internationalisation

Two languages, enforced at build time. Every user-visible string goes through
i18next — there are no hard-coded sentences in product code.

---

## 1. Configuration

`src/i18n/index.ts`:

```ts
void i18n.use(initReactI18next).init({
  resources: { 'en-US': { translation: english }, 'es-ES': { translation: spanish } },
  lng: navigator.language.startsWith('es') ? 'es-ES' : 'en-US',
  fallbackLng: false,
  supportedLngs: ['en-US', 'es-ES'],
  interpolation: { escapeValue: false },
});
```

- **No detector plugin, no HTTP backend.** Language is chosen once from
  `navigator.language`; anything not starting with `es` gets `en-US`.
- **`fallbackLng: false`** — a missing Spanish key renders *the key itself*, not
  the English text. This is what makes the parity check load-bearing: without
  it, a missing translation would silently look fine in review.
- `escapeValue: false` because React already escapes.
- Side effect: `document.documentElement.lang` is kept in sync on
  `languageChanged` and set once at init.

Imported for side effect as the **first line of `main.tsx`**, so i18next is
initialised before any component renders.

---

## 2. Namespaces

| Namespace | Source | Registered by |
|---|---|---|
| `translation` (default) | `src/i18n/{en-US,es-ES}.json` | `init({ resources })` |
| `staff` | `src/features/staff/i18n/` | `StaffPortalLayout.tsx` |
| `login` | `src/features/auth/i18n/` | `LoginPage.tsx`, `LocalAuthPage.tsx` |
| `localAuth` | `src/features/local-auth/i18n/` | `LocalAuthPage.tsx`, `AccountSecurityPage.tsx`, `LoginPage.tsx` |

Only three feature folders carry their own bundle. Everything else uses the
default namespace.

### How feature bundles are merged

At **module scope** in the page or layout that owns them:

```ts
i18n.addResourceBundle('en-US', 'staff', english);
i18n.addResourceBundle('es-ES', 'staff', spanish);
```

So a bundle lands as a side effect of its lazy chunk being imported, not through
a lifecycle hook. The same namespace is registered from more than one entry
point — that is intentional and idempotent: **the page that needs a namespace
registers it** rather than assuming another page already did.

Usage:

```ts
const { t } = useTranslation();          // default namespace
const { t } = useTranslation('staff');   // feature namespace
```

---

## 3. Parity enforcement

`vite.config.ts` carries a plugin that runs at `buildStart` — so on `pnpm dev`
and every `vite build`:

```ts
{
  name: 'noatum-locale-parity',
  buildStart() {
    // identical sorted top-level key sets, and no blank Spanish value
    throw new Error('Every English translation requires a nonempty Spanish translation.');
  },
}
```

`Workspace.test.tsx` asserts the same two conditions, so a missing Spanish
string fails **both** `pnpm build` and `pnpm test`.

### What the check does not cover

Worth knowing before relying on it:

- **Only the two root files.** The three feature bundles — including the ~42 KB
  `staff` bundle, the largest in the app — are **not** parity-checked by
  anything.
- **Top-level keys only.** A nested object could diverge beneath a shared key.
- It checks presence and non-emptiness, not that the Spanish is a translation.

---

## 4. Key conventions

The default namespace is **flat** — ~568 top-level keys, no nesting. Structure
comes from the key name:

| Pattern | Example | Used for |
|---|---|---|
| `camelCase` | `teamInvite` | A plain string |
| `<area><Thing>` | `publicTrackTitle` | Grouped by screen area |
| `<prefix>_<id>` | `customerNav_dashboard`, `teamStatus_active`, `role_customer_admin` | Templated lookups built from data |
| `<thing>Note` / `Hint` | `teamEmailHint` | Secondary copy under a control |

The `_<id>` convention matters: a component does
``t(`teamStatus_${member.status}`)``, so **every possible value of that field
needs a key in both files**. When you add an enum value on the server, add its
keys here.

Interpolation uses `{{name}}`:

```json
"teamChangeTitle": "Change what {{name}} can do"
```

---

## 5. Editing the locale files

`es-ES.json` stores non-ASCII characters as `\uXXXX` escapes. A naive
`JSON.stringify` write replaces them with literal UTF-8 and shows the **whole
file** as changed. If you edit it programmatically, re-escape on the way out:

```js
const escapeNonAscii = (text) =>
  text.replace(/[-￿]/g, (c) =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
```

Both files are also LF in the working tree on a CRLF checkout — see
`11-conventions.md`.

---

## 6. Brand rules for copy

From the parent repository's brand guidance, and they apply to every string
added here:

- Sentence-case headlines.
- "We" for Noatum, "you" for the customer.
- **No emoji. No exclamation marks.**
- Dates `DD.MM.YYYY` — rendered by `DateValue`, never formatted in a string.
- Money shows a currency code and an amount, never a symbol alone.
- Links read "Read more…".

---

## 7. Known gaps

| Gap | Detail |
|---|---|
| Three hard-coded English strings | `aria-label="Footer"` and `aria-label="Main"` in the design system, and `DateValue`'s `'—'` default |
| Feature bundles unchecked | §3 |
| No language switcher in the staff shell | The customer shell has EN/ES in its red strip |
| Language is not persisted | Chosen from `navigator.language` on every load |
