# Internationalization, RTL, and Locale

AD Ports apps ship in Arabic and English. i18n, RTL, and locale-aware date/time/number formatting are load-bearing requirements, not a polish pass.

## Translation library choice

- **`react-i18next`** (via `i18next`) — the AD Ports default. Mature, supports lazy-loaded namespaces, plays well with Suspense.
- **`react-intl`** (FormatJS) — justified when the app needs ICU MessageFormat-heavy content or integrates with an existing FormatJS pipeline. Record the decision in an ADR.
- **`lingui`** — not the default; do not introduce without ADR.

Pick one per app and stay with it. Do not mix libraries.

## Setup for Arabic + English

The default `react-i18next` setup needs explicit configuration to handle Arabic correctly. These pieces matter for AD Ports apps:

### Locale detection

Use `i18next-browser-languagedetector`. Detection order: `localStorage` → `navigator` → `htmlTag`. Persist the user's choice in `localStorage` so it survives reloads. Do not detect from `Accept-Language` server-side and bake into the bundle — locale is a runtime decision.

### Resource loading

Use `i18next-http-backend` (or `i18next-resources-to-backend` for bundled JSON) with **lazy-loaded namespaces**. One namespace per feature module + a `common` namespace for shared strings.

```text
src/features/vessels/i18n/
  en.json          # namespace: "vessels"
  ar.json
```

Load namespaces on demand from each feature's page component (`useTranslation('vessels')` triggers lazy load).

### Pluralization (Arabic has six forms)

Arabic plural rules: `zero`, `one`, `two`, `few`, `many`, `other`. Most teams under-use this and ship `one`/`other` only — wrong for Arabic. Define all six forms whenever the string varies by count.

```json
{
  "items": {
    "zero":  "لا توجد عناصر",
    "one":   "عنصر واحد",
    "two":   "عنصران",
    "few":   "{{count}} عناصر",
    "many":  "{{count}} عنصرًا",
    "other": "{{count}} عنصر"
  }
}
```

```ts
// Translate a count-aware key — i18next selects zero/one/two/few/many/other automatically.
t('items', { count });   // i18next picks the form by CLDR rules for the active locale
```

English has only `one` / `other`; do not assume Arabic does.

### Direction switching

When the user toggles locale, update both `lang` and `dir` on `<html>`:

```ts
/*
 * Sync <html lang> and <html dir> with the active locale on every language change.
 * Drives Tailwind RTL utilities, screen-reader pronunciation, and CSS logical properties.
 */
document.documentElement.lang = locale;
document.documentElement.dir  = locale === 'ar' ? 'rtl' : 'ltr';
```

Do this in the i18n provider's `languageChanged` handler, not per page.

### Interpolation safety

i18next escapes by default. Do not disable it (`escapeValue: false`) globally — only per-call when rendering known-safe HTML, and even then prefer `<Trans>` with React components.

### Suspense

Enable `react: { useSuspense: true }` so namespace loading suspends rendering instead of flashing untranslated keys. Pair with a `Suspense` boundary at the route level.

### What the AD Ports default config looks like (sketch)

```ts
// src/app/providers/i18n-provider.tsx
/*
 * Initialize the AD Ports default i18next instance once at app boot:
 * detect locale from localStorage, fetch namespaces over HTTP, and bind to React (Suspense).
 */
i18n
  .use(LanguageDetector)
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    ns: ['common'],
    defaultNS: 'common',
    detection: { order: ['localStorage', 'navigator', 'htmlTag'], caches: ['localStorage'] },
    interpolation: { escapeValue: true },
    react: { useSuspense: true },
  });
```

## Text, dates, numbers

- Never hard-code user-visible strings in JSX or component code. Every string routes through the translation library from day one.
- Translate **form validation messages** centrally. Do not hard-code `"This field is required"` in each component — map zod error codes to translation keys via a single `validationMessage` helper.
- Use `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat` with explicit locale. Wrap in shared hooks (`useFormatDate`, `useFormatNumber`) for consistency.
- Arabic digits: respect the user/app preference. `Intl.NumberFormat('ar-AE')` emits Arabic-Indic digits; pass `numberingSystem: 'latn'` for Western digits on dashboards and financial figures.
- Hijri dates: treat as an explicit dual-calendar concern. Render alongside Gregorian, do not replace silently. Use `Intl.DateTimeFormat('ar-SA-u-ca-islamic')` or a vetted library.

## RTL layout

- Set `dir` at the document level from the active locale (`<html lang="ar" dir="rtl">`) — do not toggle per component.
- Use Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`). Never `ml-*` / `mr-*` / `left-*` / `right-*` on layout-affecting elements.
- Icons with direction (back arrows, chevrons, breadcrumb separators) must mirror. Use `<Icon mirrorInRTL />` from `@shared/ui/icon`, or `rtl:scale-x-[-1]` for raw SVG.
- Design-system primitives must be RTL-verified before use. Do not assume correctness from LTR screenshots.
- Bidirectional text in form inputs: set `dir="auto"` on free-text inputs (names, addresses, comments).

## Testing i18n

- Run critical journey tests in both `en` and `ar` locales — not LTR only.
- Add an RTL smoke check per persona: keyboard navigation order, modal close-button position, dropdown anchor direction.

## Date, time, timezone

A common source of bugs in AD Ports apps (vessel ETAs across ports, customs deadlines, shift-aware timestamps). Treat date/time as a discipline, not a formatting concern.

### Storage

- The wire and the database speak **UTC ISO 8601** (`2026-04-25T08:30:00Z`). The frontend never sends a local-time string.
- Server payloads carry UTC; the client displays in the user's timezone.

### Display timezone

- **Default display timezone is the user's browser timezone** (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- When the domain requires a fixed operational timezone (e.g. port operations always shown in `Asia/Dubai` regardless of where the user is), set it explicitly per format call. Document the choice in the feature.
- Allow user override (profile setting) when both views matter.
- Mixed-timezone screens (one column local, one column port-time) must label which is which — never leave the user guessing.

### Weekend and working week (GCC)

- The default GCC working week varies by country; the AD Ports operational default is **Sunday–Thursday** (off: Friday/Saturday). Some entities now run **Monday–Friday** for compliance with international counterparts.
- Do not hard-code `[0, 6]` (Sun/Sat) or `[6, 0]` (Sat/Sun) as "weekend." Read the working-week config from the backend or feature flag, default to **Friday/Saturday off**.
- Ramadan affects working hours in some entities — leave room for date-aware shift adjustments rather than hard-coded times.

### Formatting

- Default to `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat` for display. Wrap in shared hooks (`useFormatDate`, `useFormatRelative`, `useFormatDateTime`) so locale + timezone resolution is consistent across the app.
- Pass `timeZone` explicitly to `Intl` when rendering operational times.
- Never format dates with string concatenation or `.toString()`.

### Date library choice (when `Intl` isn't enough)

- **`date-fns`** (default) — tree-shakable, immutable, no monkey-patching. Use when you need parsing, arithmetic, or relative-time helpers beyond `Intl`. Pair with `date-fns-tz` for timezone-aware operations.
- **`dayjs`** — smaller bundle than `date-fns`, plugin-based. Acceptable when bundle size dominates; document in an ADR.
- **Temporal (TC39)** — the future. Polyfill is large; adopt when browser support lands across AD Ports' supported list.
- **Moment** — do not introduce. Migrate when touching code that uses it.

### Hijri calendar

- When the domain needs Hijri (some customs / regulatory contexts), render it **alongside** Gregorian, never replacing it silently.
- Use `Intl.DateTimeFormat('ar-SA-u-ca-islamic')` for display; do not roll your own conversion.
- Storage stays UTC ISO 8601 — Hijri is presentation only.

## Anti-patterns

See `references/anti-patterns.md` §i18n / RTL and §Date / time / timezone for the canonical lists (rejection-citable).
